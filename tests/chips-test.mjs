// CHIPS — the economy has to make money, and it has to do it without any of the
// mechanics that make an economy predatory.
//
// Two halves, tested two ways. The price list is dependency-free, so the money
// questions are asked of the REAL numbers: does every pack clear what it costs to
// serve, is the advertised bonus the bonus you actually get. The ledger and the
// purse reach for Supabase and the `@/` alias, so those are read as source and
// asserted on the guarantees that must never quietly disappear — idempotency,
// failing closed, and not minting a fresh wallet for an unverifiable token.
//
// The "never" assertions here are the point of the file. This economy was asked
// for as a casino, and the difference between a casino floor and a trap is not
// the chips — it is whether the house takes something away to make you move.
import { readFileSync } from "node:fs"
import {
  CHIP_PACKS, CHIP_COST_USD, BASE_RATE, CHARS_PER_CHIP, CHIPS_PER_PHOTO,
  DAILY_CHIPS, REFERRAL_CHIPS, packById, packMargin, chipsForChars, utcDay,
} from "../lib/airraw/chip-rates.ts"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

/**
 * Strip comments, so a "never do X" assertion reads CODE and not the sentence
 * explaining that we do not do X. Without this every prohibition below passes or
 * fails on its own disclaimer — which is worse than not testing it, because it
 * looks like a guarantee. Walks the source tracking string and template state so
 * a `//` inside "https://…" survives.
 */
function codeOnly(src) {
  let out = "", i = 0, q = null
  while (i < src.length) {
    const c = src[i], n = src[i + 1]
    if (q) {
      if (c === "\\") { out += c + (n || ""); i += 2; continue }
      if (c === q) q = null
      out += c; i++; continue
    }
    if (c === '"' || c === "'" || c === "`") { q = c; out += c; i++; continue }
    if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") i++; continue }
    if (c === "/" && n === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue }
    out += c; i++
  }
  return out
}

const rates  = readFileSync(new URL("../lib/airraw/chip-rates.ts", import.meta.url), "utf8")
const ledger = readFileSync(new URL("../lib/airraw/chips.ts", import.meta.url), "utf8")
const purse  = readFileSync(new URL("../lib/airraw/purse.ts", import.meta.url), "utf8")
const route  = readFileSync(new URL("../app/api/chips/route.ts", import.meta.url), "utf8")
const sql    = readFileSync(new URL("../db/chips.sql", import.meta.url), "utf8")

// ── the packs have to make money ─────────────────────────────────────────────
// The reason chips exist: the pass sells 6,000 voice minutes for $9, which is
// roughly $380 of speech. It survives only on people not redeeming it. A unit
// priced below its own cost is that same bug, so it is the first thing asserted.
console.log("— the house edge is real —")
check(CHIP_PACKS.length >= 3, "there are at least three packs, so there is a middle to choose")
for (const p of CHIP_PACKS) {
  const m = packMargin(p)
  check(m > 0.4, `$${p.usd} → ${p.chips} chips clears cost with room (${Math.round(m * 100)}% margin)`)
  check(p.usd / p.chips > CHIP_COST_USD, `and $${p.usd} sells a chip above what a chip costs to serve`)
}

// ── the bonus is the bonus ───────────────────────────────────────────────────
// A stated bonus that isn't in the chips is the same lie as a struck-through
// price that was never charged. These are computed from the rates, not typed in.
console.log("\n— the advertised bonus is the one you get —")
check(CHIP_PACKS[0].bonusPct === 0, "the base pack claims no bonus, because it is the baseline")
for (const p of CHIP_PACKS) {
  const actual = Math.round(((p.chips / (p.usd * BASE_RATE)) - 1) * 100)
  check(p.bonusPct === actual, `${p.id} advertises +${p.bonusPct}% and delivers +${actual}%`)
}
const rate = (p) => p.chips / p.usd
for (let i = 1; i < CHIP_PACKS.length; i++) {
  check(rate(CHIP_PACKS[i]) > rate(CHIP_PACKS[i - 1]),
    `${CHIP_PACKS[i].id} is genuinely better value per dollar than ${CHIP_PACKS[i - 1].id}`)
}
check(packById("large")?.chips === CHIP_PACKS[2].chips, "a pack is looked up by id, never by index off the wire")
check(packById("nope") === null && packById(undefined) === null, "an unknown pack is null, not a default")

// ── the unit ─────────────────────────────────────────────────────────────────
console.log("\n— a chip is a minute of her voice —")
check(chipsForChars(0) === 0, "silence is free — zero characters costs zero chips")
check(chipsForChars(-5) === 0, "and a negative run cannot mint chips")
check(chipsForChars(1) === 1, "any speech at all costs at least one chip")
check(chipsForChars(CHARS_PER_CHIP) === 1, "exactly one chip's worth costs exactly one chip")
check(chipsForChars(CHARS_PER_CHIP + 1) === 2, "and a fraction over rounds UP, so speech is never served free")
check(CHARS_PER_CHIP >= 100, "the chip size has a floor, so a bad env var cannot give the product away")
check(CHIPS_PER_PHOTO >= 1, "a photo always costs at least one chip — it bills us cash per generation")
check(utcDay(Date.UTC(2026, 0, 2, 23, 59)) === "2026-01-02", "the day boundary is UTC, the same for everyone")

// ── what this economy must never do ──────────────────────────────────────────
// Asked for as a casino. This is the half of a casino that is hospitality — a
// legible chip, a real comp — without the half that works by taking something
// away. Each of these is a mechanic that was available and deliberately not used.
console.log("\n— nothing here is taken back to make someone move —")
const economyCode = codeOnly(rates) + codeOnly(ledger) + codeOnly(route)
check(!/expire|expiry|ttl|decay/i.test(economyCode),
  "chips never expire, so no balance is destroyed to manufacture urgency")
check(!/streak|combo|multiplier/i.test(economyCode),
  "there is no streak or multiplier, so a missed day forfeits nothing")
check(!/Math\.random|randomInt|jackpot|spin|reward_?roll/i.test(economyCode),
  "no grant is randomised — every amount is fixed and stated before it is earned")
check(/DAILY_CHIPS/.test(codeOnly(rates)) && !/DAILY_CHIPS\s*\*/.test(economyCode),
  "and the daily is a flat amount, never scaled by how long someone has been coming")
check(DAILY_CHIPS >= 0 && DAILY_CHIPS <= 10,
  "the daily is small enough that it never competes with buying")
check(REFERRAL_CHIPS > 0 && /actually\s+BUYS|only when the person you sent actually/i.test(rates),
  "referral pays on a real purchase, so it rewards customers rather than link-spraying")

// ── the ledger ───────────────────────────────────────────────────────────────
// Two things actually happen in production: a payment webhook delivered twice,
// and a client retrying a spend it never saw the answer to. Both are one bug.
console.log("\n— a payment applied twice is the bug this ledger exists to stop —")
check(/p_event\s+text/.test(sql) && /event\s+text primary key/.test(sql),
  "the ledger's primary key IS the caller's event id, so a duplicate cannot insert")
check(/select \* into prev from public\.chip_ledger where event = p_event/.test(sql),
  "a replay is detected before anything is applied")
check(/when unique_violation then/.test(sql),
  "and two callers racing the same event id resolve to one winner, not two grants")
check(/for update/.test(sql), "the wallet row is locked for the read-modify-write")
check(/next_balance < 0/.test(sql), "an overdraft is refused in the database, not in the caller")
check(/if \(!event\) return .*no-event/.test(ledger),
  "a move with no event key is refused outright rather than applied unguarded")
check(/insert into public\.chip_ledger[\s\S]{0,400}?values \(p_event/.test(sql),
  "the ledger row and the balance change are one transaction")
check(/revoke all on function public\.chips_move[\s\S]*?grant execute on function public\.chips_move\(text, bigint, text, text\) to service_role/.test(sql),
  "only the service role can move chips — never anon, never the browser")

console.log("\n— money fails closed —")
check(/FAILS CLOSED/.test(ledger), "spending states that it fails closed, and why")
check(/reason: "unavailable"/.test(ledger),
  "an unreachable ledger reports unavailable instead of guessing a balance")
const spendFn = ledger.slice(ledger.indexOf("export async function spendChips"))
check(!/return \{ ok: true[^}]*unmetered/.test(spendFn),
  "there is no unmetered escape hatch on the spend path")

// ── the purse ────────────────────────────────────────────────────────────────
console.log("\n— a wallet is server-signed, and its key is a hash —")
check(/createHmac/.test(purse), "a purse is HMAC-signed by the server, so a browser cannot forge one")
check(/randomBytes\(16\)/.test(purse), "and its id is random, so a purse says nothing about who holds it")
check(/createHash\("sha256"\)/.test(purse) && /purseKey/.test(purse),
  "the wallet is keyed on the token's HASH — a leaked table has balances, not bearer credentials")
check(/timingSafeEqual/.test(purse), "signature comparison is constant-time")
check(/proTokenValid\(passToken\)/.test(purse),
  "a valid pass IS the wallet, so chips travel with the pass a buyer can already restore")
check(/return null\s*\n\}/.test(purse.slice(purse.indexOf("export function walletFor"))),
  "an unverifiable token resolves to NO wallet — it is never silently given a fresh one")
check(/production" \? "" :/.test(purse),
  "with no secret in production nothing is minted, rather than everything signed with an empty key")

// ── buying ───────────────────────────────────────────────────────────────────
console.log("\n— you cannot pay for the small pack and claim the large one —")
check(/packAnchor = \(intentId: string, packId: string\)/.test(route),
  "the signature covers the pack as well as the intent")
check(/verifyIntentSig\(packAnchor\(intentId, packId\), Number\(anchorTs\), anchorSig\) === null/.test(route),
  "so a claim naming a different pack than it paid for fails the anchor check")
check(/paidUsd \+ 0\.01 < pack\.usd/.test(route),
  "and independently, the money that arrived must cover the pack's price")
check(/intent\.status !== "completed"/.test(route),
  "chips are credited only on a completed payment, never on the client saying so")
check(/`buy:\$\{intentId\}`/.test(route),
  "the grant is keyed on the intent, so a refresh, a webhook and a second tab credit it once")
const buyBranch = route.slice(route.indexOf('if (action === "buy")'), route.indexOf('if (action === "claim")'))
check(buyBranch.indexOf("walletFor(") > -1
   && buyBranch.indexOf("walletFor(") < buyBranch.indexOf("createPaymentIntent("),
  "a wallet is required BEFORE money is taken — paid-for chips with nowhere to go has no clean recovery")
check(/if \(!mv\.replay\) \{\s*metaPurchase/.test(route),
  "and the conversion fires once, on the credit that actually happened")

console.log("\n— the daily cannot be farmed by minting purses —")
check(/ipDailyAllowed/.test(route), "the daily is bounded by IP as well as by wallet")
check(/`daily:\$\{wallet\}:\$\{day\}`/.test(route), "and is idempotent per wallet per UTC day")
check(/catch \{\s*return true\s*\}/.test(route.slice(route.indexOf("async function ipDailyAllowed"))),
  "if that counter is unreachable a real returning visitor is still served")

// ── spending: the free wall becomes a door ───────────────────────────────────
// The point of the whole economy. Someone enjoying themselves at the moment the
// free minute ends could not previously give us a penny until their next visit.
console.log("\n— the free minute ends in an offer, not a wall —")
const tts = readFileSync(new URL("../app/api/tts/route.ts", import.meta.url), "utf8")
const freeBranch = tts.slice(tts.indexOf('if (tier === "free")'), tts.indexOf('tierHeaders["X-TTS-Tier"]'))
check(freeBranch.indexOf("payWithChips") > -1
   && freeBranch.indexOf("payWithChips") < freeBranch.indexOf("paywall: true"),
  "chips are tried BEFORE the 402, so a paying listener is never stopped")
check(/paywall: true/.test(freeBranch),
  "and with no chips it is still the same clean paywall it was")

const payFn = tts.slice(tts.indexOf("async function payWithChips"), tts.indexOf("export async function POST"))
check(/walletFor\(proToken, cookiePurse\)/.test(payFn),
  "the wallet comes from the pass or the purse cookie — no call site had to learn about wallets")
check(/Math\.floor\(Date\.now\(\) \/ 60_000\)/.test(payFn) && !/Date\.now\(\)\}`/.test(payFn),
  "the spend's event key buckets by minute, so a retried chunk is not charged twice")
check(/createHash\("sha256"\)/.test(payFn),
  "and is derived from the text, so two different lines are two different spends")
check(/return \{ ok: false as const/.test(payFn),
  "no wallet, no ledger or no chips all mean no speech — it fails closed")

// Kloom must not be able to reach any of this.
check(/const airraw = adultEnabled\(\)/.test(tts) && /: "kloom"/.test(tts),
  "tier is 'kloom' off the AIRRAW variant")
check(!/payWithChips/.test(tts.slice(tts.indexOf('let tier'), tts.indexOf('if (tier === "free")'))),
  "and nothing spends a chip before the tier is decided, so Kloom never reaches the wallet")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
