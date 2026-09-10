// THE PRICE ON THE PAGE IS THE PRICE AT THE TILL.
//
// The lobby — the page the ads land on — told visitors "airraw opens with a $1
// day-pass" while checkout charged $9. Five people reached the payment page in
// six weeks and not one of them entered a card. A stated $1 followed by a $9
// charge is reason enough on its own, and it is the only thing on that path that
// asks someone to trust a number.
//
// ProSheet already had the rule and the reasoning in a comment: fetch the live
// offer "so changing the env price can never leave the UI selling one thing and
// the checkout charging another". This asserts it everywhere a price is spoken,
// because a second file drifting is exactly how the first one did.
import { readFileSync, readdirSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

console.log("— no surface hardcodes a price it does not charge —")
const dirs = ["components/airroom", "app/ar", "app/floor"]
const OFFENDER = /\$\s?\d+(?:\.\d+)?\s*(?:day-?pass|pass|a month|\/mo|per month)/gi
let scanned = 0, bad = []
for (const d of dirs) {
  let files = []
  try { files = readdirSync(d).filter((f) => f.endsWith(".tsx")) } catch { continue }
  for (const f of files) {
    const src = strip(readFileSync(`${d}/${f}`, "utf8"))
    scanned++
    for (const m of src.matchAll(OFFENDER)) bad.push(`${f}: ${m[0]}`)
  }
}
check(scanned > 15, `${scanned} surfaces scanned`)
if (bad.length) bad.slice(0, 5).forEach((b) => console.log(`   ${b}`))
check(bad.length === 0, "no surface states a pass price as a literal — the number comes from the checkout")

console.log("\n— and the lobby's own claim is fetched, not written —")
const cw = strip(readFileSync("components/airroom/CaptureWall.tsx", "utf8"))
check(/fetch\("\/api\/airraw-pro"\)/.test(cw), "CaptureWall asks the checkout what the offer is")
check(/\$\{usd\}/.test(cw) && /\{days\}/.test(cw), "and renders the answer rather than a number of its own")
check(/offer\s*\n?\s*\?/.test(cw) || /offer\s*$/m.test(cw) || /offer$/m.test(cw) || /offer\b[\s\S]{0,40}\?/.test(cw),
  "with a price-free line while the offer is still loading, so it never guesses")

// ProSheet is where the rule came from; it must not lose it either.
const ps = strip(readFileSync("components/airroom/ProSheet.tsx", "utf8"))
check(/fetch\("\/api\/airraw-pro"\)/.test(ps), "and the pass sheet still fetches it too")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
