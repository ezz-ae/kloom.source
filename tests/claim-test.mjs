// A PAID PASS IS CLAIMED, AND A TYPED ONE IS CHECKED.
//
// Three holes on the only path that turns money into a pass, found on a
// "fix the payment bugs" audit, none of them visible from the outside:
//
//  1. The claim on return skipped itself when isPro() said the browser already
//     held a pass. isPro() reads the expiry out of the stored token without a
//     signature check, because the client has no secret. So a stale or
//     hand-typed token that merely LOOKED active blocked the claim of the pass
//     that had just been paid for.
//  2. A card return claimed once. The hosted page can send the buyer back a
//     beat before the intent reads completed, and that one claim told a person
//     who had just paid to "reopen in a moment".
//  3. "Restore" stored whatever was pasted and called it active if the expiry
//     inside was in the future. Every voice request was then refused.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const claim = strip(readFileSync("components/ProClaim.tsx", "utf8"))
const planet = strip(readFileSync("components/airroom/Planet.tsx", "utf8"))
const route = strip(readFileSync("app/api/airraw-pro/route.ts", "utf8"))
const sheet = strip(readFileSync("components/airroom/ProSheet.tsx", "utf8"))
const ar = readFileSync("lib/airraw/ar.ts", "utf8")

console.log("— a pending intent is always claimed —")
{
  check(!/if \(!pending\?\.id \|\| isPro\(\)\)/.test(claim), "the universal claim never bails because the browser thinks it already has a pass")
  check(/if \(!pending\?\.id\) \{/.test(claim), "it bails only when there is nothing to claim")
  check(!/if \(!pending\?\.id \|\| isPro\(\)\)/.test(planet), "and neither does the planet's copy")
  check(/setProToken\(d\.token\); clearPendingIntent\(\)/.test(claim), "a paid claim stores the token and forgets the intent (so re-running is free)")
}

console.log("— a card return is given time to settle —")
{
  const m = claim.match(/const MAX_TRIES = ([^\n]+)/)
  check(!!m, "the retry budget is one expression")
  check(!!m && /!justPaid \? 1/.test(m[1]), "a later page load still claims exactly once")
  check(!!m && /isCrypto \? 24 : 8/.test(m[1]), "on the return trip a card gets 8 tries (~40s) and crypto 24 (~2min)")
  check(/"failed", "canceled", "cancelled", "expired", "refunded"/.test(claim), "terminal statuses stop the retry and clear the intent")
}

console.log("— a typed restore code is verified by the server before it is kept —")
{
  check(/action === "verify"/.test(route), "the pass route answers action: verify")
  check(/proTokenClaims\(token\)/.test(route) && /proTokenRefusal\(token\)/.test(route), "with the same signature check /api/tts makes, and the same refusal reasons")
  check(!/mintProToken/.test(route.slice(route.indexOf('action === "verify"'), route.indexOf('action === "verify"') + 900)), "verify mints nothing")
  const restore = sheet.slice(sheet.indexOf("const restore = "), sheet.indexOf("useEffect(() => {\n    let live"))
  check(/action: "verify", token: c/.test(restore), "restore asks the server first")
  check(/if \(!d\?\.valid\)[\s\S]*?return[\s\S]*?setProToken\(c\)/.test(restore), "and stores the code only after a yes")
  check(/reason === "expired"/.test(restore), "an expired pass is told apart from a wrong code")
  check(/"that pass has expired — the floor's open again with a new one":/.test(ar), "in Arabic too")
}

console.log(fail ? `\n${fail} FAILED` : "\nPASS")
process.exit(fail ? 1 : 0)
