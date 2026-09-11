// Reissue a pass to someone who already paid for one, from a terminal.
//
// WHY THIS EXISTS
// Every pass is an HMAC over AIRRAW_PRO_SECRET, and that secret falls back to
// SUPABASE_SERVICE_ROLE_KEY when unset — so it moved the day AIRRAW_PRO_SECRET
// was first set, and again on the Supabase project switch. A pass signed with a
// secret we no longer hold can never verify again: its holder is metered as a
// free visitor, and the wallet their chips live in (a hash of the whole token)
// is unreachable too.
//
// The FIRST thing to try is not this file. If you still know the old value, set
// AIRRAW_PRO_SECRET_PREV to it and redeploy: verification accepts it, and every
// pass comes back intact — the same token, the same wallet, the same chips.
// Nobody has to be contacted and nothing is reissued. This tool is only for when
// that value is genuinely gone.
//
// WHAT IT WILL NOT DO
// It is not a way to hand out passes. It mints nothing on your say-so:
//   · Ziina must report the intent as `completed`. There is no override flag.
//   · The payment must have been for at least the pass price.
//   · The new pass is anchored to the ORIGINAL purchase time, so reissuing can
//     neither extend the window nor turn a $9 sale into a lifetime pass.
//   · A pass whose window has already elapsed is refused, not resurrected.
//   · Chips are re-granted under the event id `reissue:<intentId>`, which the
//     ledger already de-duplicates — so running this twice cannot pay twice.
// It never prints a secret. It prints the customer's own restore code, which is
// the credential they were always meant to hold.
//
// USAGE
//   node db/reissue-pass.mjs --list                  what we know was paid
//   node db/reissue-pass.mjs pi_123 pi_456           reissue these
//   node db/reissue-pass.mjs --all --dry-run         check everyone, mint nothing
//   node db/reissue-pass.mjs --all --yes             reissue everyone
//   node db/reissue-pass.mjs --all --yes --out codes.csv
//
// It reads .env.production.local (as `vercel env pull` writes it) and needs
// AIRRAW_PRO_SECRET, ZIINA_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// No dependencies and no build step — plain fetch against Supabase's REST API.
import { readFileSync, existsSync, writeFileSync } from "node:fs"
import { createHash, createHmac } from "node:crypto"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

function loadEnvFile(path) {
  const out = {}
  if (!existsSync(path)) return out
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq < 1) continue
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
  }
  return out
}
const FILE_ENV = ["", ".local", ".production.local", ".production"]
  .reduce((acc, s) => ({ ...acc, ...loadEnvFile(join(ROOT, `.env${s}`)) }), {})
const env = (k, d) => process.env[k] ?? FILE_ENV[k] ?? d

// The same numbers the server sells on. Read from the same variables with the
// same defaults, so a reissue can never mint a different product than checkout.
const PRICE_USD    = Number(env("AIRRAW_PRO_USD", 9))
const DAYS         = Number(env("AIRRAW_PRO_DAYS", 90))
const PASS_MINUTES = Number(env("AIRRAW_PASS_MINUTES", 6000))
const PASS_CHIPS   = Math.max(0, Number(env("CHIP_PASS_GRANT", 120)))
const CURRENCY     = String(env("ZIINA_CURRENCY", "AED")).toUpperCase()
const USD_RATE     = Number(env("ZIINA_USD_RATE", CURRENCY === "AED" ? "3.6725" : "1"))
const usdToMinor   = (usd) => Math.round(usd * USD_RATE * 100)

const SECRET   = env("AIRRAW_PRO_SECRET") || env("SUPABASE_SERVICE_ROLE_KEY")
const ZIINA    = env("ZIINA_API_KEY")
const ZIINA_URL = String(env("ZIINA_BASE_URL", "https://api-v2.ziina.com/api")).replace(/\/$/, "")
const SB_URL   = (env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL") || "").replace(/\/$/, "")
const SB_KEY   = env("SUPABASE_SERVICE_ROLE_KEY")

/** Byte-identical to mintProToken in lib/airraw-pro-token.ts — asserted in tests/reissue-test.mjs,
 *  which imports THIS function and compares its output to the server's. */
export function mintProToken(untilMs, minutes = PASS_MINUTES) {
  if (!SECRET) throw new Error("AIRRAW_PRO_SECRET not configured — refusing to mint with an empty secret")
  const payload = Buffer.from(JSON.stringify({ until: untilMs, v: 1, adult18: true, minutes })).toString("base64")
  return `${payload}.${createHmac("sha256", SECRET).update(payload).digest("hex")}`
}
/** Same derivation as purseKey in lib/airraw/purse.ts — the wallet IS the token's hash. */
const walletFor = (token) => `pass:${createHash("sha256").update(token).digest("hex").slice(0, 32)}`

async function sb(path, init = {}) {
  if (!SB_URL || !SB_KEY) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`supabase ${res.status}: ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

async function ziinaIntent(id) {
  if (!ZIINA) throw new Error("ZIINA_API_KEY not set — the payment cannot be verified, so nothing will be minted")
  const res = await fetch(`${ZIINA_URL}/payment_intent/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${ZIINA}`, Accept: "application/json" },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`ziina ${res.status}: ${text.slice(0, 160)}`)
  return JSON.parse(text)
}

// ── the decision, in one place so it can be tested on its own ───────────────

/** Crypto states NOWPayments considers money-in — the same set lib/pay/crypto.ts uses. */
const CRYPTO_PAID = new Set(["confirmed", "sending", "finished"])

/**
 * The two rails record their amount in DIFFERENT UNITS, and comparing the wrong
 * pair silently refuses every sale on one of them (or accepts every sale on the
 * other). The card row holds Ziina's minor units in the charge currency — AED
 * by default, so ~3305 for a $9 pass — while a crypto row holds plain USD cents,
 * 900. So the floor is per rail, never shared.
 */
export function priceFloor(rail) {
  return rail === "crypto" ? Math.round(PRICE_USD * 100) : usdToMinor(PRICE_USD)
}

/** Normalise a row + whatever the rail can tell us into one shape. */
export function saleFrom({ rail, status, amountMinor }) {
  return {
    rail,
    status: String(status || "unknown"),
    amountMinor: typeof amountMinor === "number" ? amountMinor : null,
    paid: rail === "crypto" ? CRYPTO_PAID.has(String(status)) : status === "completed",
  }
}

/**
 * Everything that decides whether a reissue is allowed and what it produces.
 * Pure: no network, no clock beyond `now`. tests/reissue-test.mjs drives it.
 */
export function reissuePlan({ sale, purchasedAt, now = Date.now() }) {
  if (!sale) return { ok: false, why: "no record of that sale on either rail" }
  if (!sale.paid) {
    return { ok: false, why: sale.rail === "crypto"
      ? `the chain reports "${sale.status}", which is not a settled payment`
      : `Ziina says "${sale.status}", not completed` }
  }
  const floor = priceFloor(sale.rail)
  // A tolerance of 2 minor units, matching the card claim path — rounding across
  // a currency conversion should not cost someone the pass they bought.
  if (sale.amountMinor != null && sale.amountMinor + 2 < floor) {
    return { ok: false, why: `paid ${sale.amountMinor} against a floor of ${floor} (${sale.rail}) — below the price of the pass` }
  }
  if (!purchasedAt) return { ok: false, why: "no purchase time on record — cannot anchor the window without extending it" }
  const until = purchasedAt + DAYS * 86_400_000
  if (until <= now) {
    const gone = Math.round((now - until) / 86_400_000)
    return { ok: false, why: `that pass ran out ${gone} day${gone === 1 ? "" : "s"} ago — a reissue restores, it does not resurrect` }
  }
  return { ok: true, until, purchasedAt, rail: sale.rail }
}

// ── main ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined }
const ids = argv.filter((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--out" && argv[argv.indexOf(a) - 1] !== "--since")
const DRY = has("--dry-run")

async function knownPayments() {
  const since = val("--since")
  // BOTH rails. The crypto rail records under its own kind, and filtering on the
  // card one alone made every crypto buyer invisible to this tool — the exact
  // customers it exists for.
  const q = ["kind=in.(airraw_pass,airraw_pass_crypto)",
             "select=id,kind,status,amount,currency,created_at,wallet",
             "order=created_at.desc", "limit=500"]
  if (since) q.push(`created_at=gte.${since}`)
  return sb(`ziina_payments?${q.join("&")}`)
}

async function grantChips(wallet, n, event) {
  if (n <= 0) return { skipped: true }
  return sb("rpc/chips_move", {
    method: "POST",
    body: JSON.stringify({ p_purse: wallet, p_delta: n, p_reason: "pass", p_event: event }),
  })
}

/**
 * ATTACH AN ADDRESS TO A PURCHASE THAT WAS MADE WITHOUT ONE.
 *
 * The email is asked for at checkout now, and it is what reopens a pass on
 * another phone. Anyone who paid BEFORE that shipped has a row with no address
 * on it, so the email door cannot find them — including the first person who
 * ever paid for this, whose money arrived against a row with a blank wallet.
 *
 *   node db/reissue-pass.mjs --email someone@example.com <intentId>
 *
 * It refuses a row the rail has not confirmed as paid, so this can attach an
 * address to a sale but never invent one.
 */
async function attachEmail(address, intentId) {
  const a = String(address || "").trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) { console.error(`"${address}" is not an email address.`); process.exit(2) }
  const rows = await sb(`ziina_payments?id=eq.${encodeURIComponent(intentId)}&select=id,kind,status,wallet`)
  const row = rows?.[0]
  if (!row) { console.error(`no purchase on record with id ${intentId}`); process.exit(2) }
  const rail = intentId.startsWith("air_") || row.kind === "airraw_pass_crypto" ? "crypto" : "card"
  let sale
  if (rail === "crypto") {
    sale = saleFrom({ rail, status: row.status, amountMinor: null })
  } else {
    let intent = null
    try { intent = await ziinaIntent(intentId) } catch (e) { console.error(`refused  ${intentId}  ${e.message}`); process.exit(1) }
    if (!intent) { console.error(`refused  ${intentId}  no such payment intent at Ziina`); process.exit(1) }
    sale = saleFrom({ rail, status: intent.status, amountMinor: intent.amount })
  }
  if (!sale.paid) { console.error(`refused  ${intentId}  the rail says "${sale.status}", not a settled payment`); process.exit(1) }
  await sb(`ziina_payments?id=eq.${encodeURIComponent(intentId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ wallet: a, status: "completed" }),
  })
  console.log(`\nattached  ${a}  →  ${intentId}`)
  console.log(`\nThat address now opens this pass on any phone: type it into`)
  console.log(`"already paid? restore it" on airraw.com. Three devices.\n`)
}

async function main() {
  if (has("--email")) {
    const address = val("--email")
    const id = ids[0]
    if (!address || !id) { console.error("usage: node db/reissue-pass.mjs --email you@example.com <intentId>"); process.exit(2) }
    await attachEmail(address, id)
    return
  }
  if (!SECRET) {
    console.error("AIRRAW_PRO_SECRET is not set (and neither is SUPABASE_SERVICE_ROLE_KEY).")
    console.error("Run `vercel env pull .env.production.local` first, or export it.")
    process.exit(1)
  }

  if (has("--list") || (!ids.length && !has("--all"))) {
    const rows = await knownPayments()
    console.log(`${rows.length} pass payment${rows.length === 1 ? "" : "s"} on record\n`)
    for (const r of rows) {
      console.log(`  ${r.id.padEnd(34)} ${(r.kind === "airraw_pass_crypto" ? "crypto" : "card").padEnd(7)} ${String(r.status).padEnd(10)} ${String(r.amount ?? "?").padStart(7)} ${r.currency || ""}  ${String(r.created_at).slice(0, 10)}  ${r.wallet && r.wallet !== "anon" ? r.wallet : ""}`)
    }
    if (!ids.length && !has("--all")) {
      console.log("\nReissue with:  node db/reissue-pass.mjs <intentId>   or   --all --yes")
      console.log("Add --dry-run to check without minting anything.")
    }
    return
  }

  let targets = ids
  if (has("--all")) {
    const rows = await knownPayments()
    targets = rows.map((r) => r.id)
    if (!DRY && !has("--yes")) {
      console.error(`--all would reissue ${targets.length} pass(es). Re-run with --yes, or --dry-run to see what would happen.`)
      process.exit(1)
    }
  }

  // Purchase times come from OUR row, not from the rail — Ziina's intent has no
  // dependable created timestamp, and anchoring on "now" would quietly hand
  // everyone a fresh 90 days.
  const rows = await knownPayments().catch(() => [])
  const known = new Map(rows.map((r) => [r.id, r]))

  const out = []
  let done = 0, refused = 0
  for (const id of targets) {
    const row = known.get(id)
    // The id says which rail sold it — crypto order ids are minted by us with an
    // "air_" prefix and Ziina's never look like that. Routing on the id rather
    // than on anything supplied means a crypto sale is never handed to Ziina,
    // which would 404 and read as "never paid".
    const rail = id.startsWith("air_") || row?.kind === "airraw_pass_crypto" ? "crypto" : "card"

    let sale = null
    if (rail === "crypto") {
      // There is nothing to poll: an invoice has no status endpoint, so the row
      // the IPN wrote IS the record of the payment.
      if (!row) { console.log(`refused  ${id}  no crypto record — the IPN never landed, so there is no proof of payment`); refused++; continue }
      sale = saleFrom({ rail, status: row.status, amountMinor: row.amount })
    } else {
      let intent = null
      try { intent = await ziinaIntent(id) } catch (e) { console.log(`refused  ${id}  ${e.message}`); refused++; continue }
      if (!intent) { console.log(`refused  ${id}  no such payment intent at Ziina`); refused++; continue }
      sale = saleFrom({ rail, status: intent.status, amountMinor: intent.amount })
    }

    const plan = reissuePlan({ sale, purchasedAt: row ? Date.parse(row.created_at) : null })
    if (!plan.ok) { console.log(`refused  ${id}  ${plan.why}`); refused++; continue }

    if (DRY) {
      console.log(`would     ${id}  (${rail})  valid until ${new Date(plan.until).toISOString().slice(0, 10)}`)
      done++
      continue
    }
    const token = mintProToken(plan.until)
    const wallet = walletFor(token)
    let chips = "—"
    try {
      const r = await grantChips(wallet, PASS_CHIPS, `reissue:${id}`)
      chips = r?.replay ? `${PASS_CHIPS} (already)` : String(PASS_CHIPS)
    } catch (e) { chips = `not granted (${e.message.slice(0, 40)})` }
    console.log(`reissued  ${id}  (${rail})  until ${new Date(plan.until).toISOString().slice(0, 10)}  chips ${chips}`)
    console.log(`          code: ${token}`)
    out.push({ id, until: new Date(plan.until).toISOString().slice(0, 10), code: token })
    done++
  }

  const file = val("--out")
  if (file && out.length) {
    writeFileSync(file, "intent_id,valid_until,restore_code\n" + out.map((r) => `${r.id},${r.until},${r.code}`).join("\n") + "\n")
    console.log(`\nwrote ${out.length} code(s) to ${file}`)
  }
  console.log(`\n${done} ${DRY ? "would be reissued" : "reissued"}, ${refused} refused`)
  if (!DRY && out.length) {
    console.log("Send each customer their own code. They paste it into the pass sheet → \"restore\".")
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e.message); process.exit(1) })
}
