// THE CRYPTO RAIL — the callback is the only proof, so it gets the most scrutiny.
//
// The card rail can be relaxed about the body it is POSTed because it re-fetches
// the intent from Ziina and believes only that. Crypto has no equivalent: an
// invoice has no pollable status, so a SIGNED CALLBACK is the entire evidence
// that money arrived. Which means the signature check is not a formality here —
// it is the thing standing between a stranger with the callback URL and an
// unlimited supply of free passes.
//
// So this suite imports the REAL verifier (lib/pay/ipn-sig.ts, dependency-free
// for exactly this reason) rather than mirroring it. A mirrored implementation
// would only prove the test agrees with itself.
import { readFileSync } from "node:fs"
import { createHmac } from "node:crypto"
import { verifyIpnSignature, ipnSignature, stableStringify } from "../lib/pay/ipn-sig.ts"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

const SECRET = "test-ipn-secret"
const body = {
  payment_status: "finished",
  order_id: "air_deadbeefdeadbeefdeadbeef",
  price_amount: 9,
  price_currency: "usd",
  actually_paid: 0.00031,
  outcome: { amount: 8.91, currency: "usdttrc20" },   // nested, on purpose
}
const raw = JSON.stringify(body)
const good = ipnSignature(body, SECRET)

// ── the happy path ──────────────────────────────────────────────────────────
{
  const r = verifyIpnSignature(raw, good, SECRET)
  check(r.ok && r.body?.order_id === body.order_id, "a correctly signed callback verifies and yields its body")
}

// ── THE TRAP: sign the bytes, not the sorted form ────────────────────────────
// This is the mistake that costs you every payment silently. Signing the raw body
// works right up until a key order differs, then no callback ever verifies again
// and the symptom is "nobody is buying".
{
  const overRaw = createHmac("sha512", SECRET).update(raw).digest("hex")
  const reordered = JSON.stringify({ order_id: body.order_id, payment_status: "finished" })
  const sortedSig = ipnSignature(JSON.parse(reordered), SECRET)
  const otherOrder = JSON.stringify({ payment_status: "finished", order_id: body.order_id })
  check(ipnSignature(JSON.parse(otherOrder), SECRET) === sortedSig,
    "the signature is over SORTED keys, so key order in the wire body cannot change it")
  // Sanity: the raw-bytes signature is genuinely a different value, i.e. this
  // test would actually catch someone "simplifying" it back to update(raw).
  check(overRaw !== good, "signing the raw bytes gives a different signature — the sort is load-bearing")
}

// ── nesting ─────────────────────────────────────────────────────────────────
// JSON.stringify's replacer-array only sorts the top level. A top-level-only
// implementation passes on flat payloads and fails on exactly the ones that carry
// an object, which is the worst kind of intermittent.
{
  const a = { z: 1, inner: { b: 2, a: 1 } }
  const b = { inner: { a: 1, b: 2 }, z: 1 }
  check(stableStringify(a) === stableStringify(b), "nested objects are sorted too, at every depth")
  check(ipnSignature(a, SECRET) === ipnSignature(b, SECRET), "so two orderings of a nested payload sign identically")
}

// ── forgery and tampering ───────────────────────────────────────────────────
{
  check(!verifyIpnSignature(raw, good, "wrong-secret").ok, "a signature made with another secret is refused")
  const tampered = JSON.stringify({ ...body, price_amount: 900 })
  check(!verifyIpnSignature(tampered, good, SECRET).ok, "changing the amount invalidates the signature")
  const flipped = JSON.stringify({ ...body, payment_status: "waiting" })
  check(!verifyIpnSignature(flipped, good, SECRET).ok, "changing the status invalidates it too")
}

// ── fails CLOSED, every way in ──────────────────────────────────────────────
// Each of these is a real deployment state: secret not set yet, header missing,
// provider posting form-encoded by mistake, someone probing the endpoint.
{
  check(!verifyIpnSignature(raw, good, "").ok, "no secret configured → refused (never 'allow while unconfigured')")
  check(!verifyIpnSignature(raw, null, SECRET).ok, "no signature header → refused")
  check(!verifyIpnSignature(raw, "", SECRET).ok, "empty signature → refused")
  check(!verifyIpnSignature("not json at all", good, SECRET).ok, "unparseable body → refused")
  check(!verifyIpnSignature(raw, "zz", SECRET).ok, "a non-hex signature → refused, not thrown")
  check(!verifyIpnSignature(raw, good.slice(0, 40), SECRET).ok, "a truncated signature → refused")
  // Body is withheld unless verified, so a caller can't read it by mistake.
  check(verifyIpnSignature(raw, "bad", SECRET).body === null, "an unverified callback yields no body to act on")
}

// ── which states actually pay ───────────────────────────────────────────────
const src = readFileSync("lib/pay/crypto.ts", "utf8")
const paid = (src.match(/const PAID = new Set\(\[([^\]]*)\]/) || [, ""])[1]
check(/"finished"/.test(paid) && /"confirmed"/.test(paid), "confirmed and finished buy a pass")
check(!/partially_paid/.test(paid),
  "partially_paid does NOT — underpayment is real money that isn't enough money")
check(!/"waiting"/.test(paid) && !/"confirming"/.test(paid), "and neither does an unconfirmed payment")

// ── the webhook has no way to say yes without a signature ───────────────────
const hook = readFileSync("app/api/crypto-webhook/route.ts", "utf8")
check(/if \(!ok \|\| !body\) return Response\.json\([^)]*401/.test(hook.replace(/\s+/g, " ")),
  "an unverifiable callback is a 401 and nothing is written")
check(!/warn|anyway|skip.*verif/i.test(hook.replace(/^\s*\/\/.*$/gm, "")),
  "there is no accept-it-anyway path in the code")
// Look inside the handler, not the file: "verifyIpn" also appears in the import
// line, which naturally precedes everything and made this compare the wrong two
// positions.
const handler = hook.slice(hook.indexOf("export async function POST"))
check(/req\.text\(\)/.test(handler) && handler.indexOf("req.text()") < handler.indexOf("verifyIpn("),
  "the RAW body is what gets verified, before anything parses it")
check(!/JSON\.parse\(raw\)/.test(handler),
  "and the handler never re-parses it itself — the verifier hands back the parsed body")
check(/orderId\.startsWith\("air_"\)/.test(hook),
  "callbacks for ids we didn't mint are ignored rather than recorded")

// ── the amount is compared in a unit that means something ───────────────────
// actually_paid and outcome_amount are denominated in the COIN. Comparing either
// against a dollar price compares USDT to dollars and passes or fails for reasons
// unrelated to underpayment.
check(/price_amount/.test(hook), "the USD quote is what gets recorded")
const hookCode = hook.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
check(!/actually_paid/.test(hookCode) && !/outcome_amount/.test(hookCode),
  "coin-denominated amounts are never used as the dollar figure")
check(/price_currency[\s\S]{0,80}usd/i.test(hookCode),
  "and the quote is only trusted when the provider says it is USD")

// ── a sale we cannot confirm must not open ──────────────────────────────────
check(/ready\(\)\s*\{[\s\S]{0,200}hasAdmin\(\)/.test(src),
  "crypto checkout requires somewhere to record the callback")
check(/upsert/.test(src), "callbacks are idempotent — providers re-send them")
check(/if \(quotedUsd != null\) row\.amount/.test(src),
  "a callback without a usable price can't erase the quote the claim checks against")

// ── the pass route guards both rails identically ────────────────────────────
const pro = readFileSync("app/api/airraw-pro/route.ts", "utf8")
check(/intentId\.startsWith\("air_"\)/.test(pro),
  "the claim routes on the id we minted, not on a client-supplied method")
const cryptoClaim = pro.slice(pro.indexOf('intentId.startsWith("air_")'), pro.indexOf('const intent = await getPaymentIntent'))
check(/amount_mismatch/.test(cryptoClaim), "the crypto claim checks the amount, like the card claim")
check(/verifyIntentSig/.test(cryptoClaim), "and anchors the window to purchase time, so re-claiming can't extend it")
check(/mintProToken/.test(cryptoClaim) && cryptoClaim.indexOf("st.paid") < cryptoClaim.indexOf("mintProToken"),
  "and mints only after the rail says paid")
check(/!ziinaConfigured\(\) && !cryptoGateway\.ready\(\)/.test(pro),
  "the 503 gate asks 'can we sell at all', not 'is the card rail up'")

// ── a callback we cannot write down is NOT acknowledged ─────────────────────
// This shipped the other way and the local smoke test caught it: the signature
// verified, the row went nowhere, and the route answered 200. A provider retries
// a failed callback and never retries a successful one, so a 200 on a failed
// write is how a real payment becomes permanently unclaimable — silently, with
// the buyer's money already gone.
check(/throw new Error\(`recording the payment failed/.test(src),
  "a failed write throws instead of being swallowed")
check(/if \(!hasAdmin\(\)\) throw/.test(src),
  "and so does having nowhere to write at all")
const hookHandler = hook.slice(hook.indexOf("export async function POST"))
check(/catch[\s\S]{0,220}status: 503/.test(hookHandler),
  "the route answers 5xx when it can't record, so the provider retries")
// lastIndexOf: an earlier `ok: true` is the "not our order id" acknowledgement,
// which correctly precedes any write. The SUCCESS answer is the last one.
check(hookHandler.indexOf("recordIpn") < hookHandler.lastIndexOf("ok: true"),
  "and only says ok AFTER the write succeeded")

// ── hasAdmin has to be able to say no ───────────────────────────────────────
// It read `!!serviceKey`, a placeholder-defaulted constant, so it was ALWAYS
// true: every "is storage available" guard in the codebase was decorative, and
// this rail's "don't sell what we can't record" check was reading a lie.
const admin = readFileSync("lib/supabase-admin.ts", "utf8")
check(/return !!rawKey && !!rawUrl/.test(admin),
  "hasAdmin reads the environment, not the placeholder fallback")
check(/const rawKey = process\.env\.SUPABASE_SERVICE_ROLE_KEY \|\| ""/.test(admin),
  "the raw value is kept separately from the placeholder used to construct the client")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
