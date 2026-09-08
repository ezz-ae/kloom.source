// SHOWING A PRICE IN SOMEONE ELSE'S CURRENCY.
//
// The golden room is aimed at Saudi Arabia and the gateway is a UAE account, so
// a Saudi buyer is looking at three numbers: the dollar on the button, the riyal
// in their head, and the dirham that lands on their statement. Getting that
// wrong does not produce a bug report — it produces a chargeback, and on a
// merchant-of-record account chargebacks are what closes the account.
//
// So the assertions here are about honesty rather than arithmetic:
//   · a displayed conversion is within a rounding step of the real peg
//   · nothing floating is ever quoted, because a stale rate shown confidently is
//     worse than showing dollars
//   · the charge currency is always named, and never mis-stated as USD
//   · no network, so a price cannot render differently depending on a fetch
import { readFileSync } from "node:fs"
import { localPrice, chargeNote, priceFootnote } from "../lib/airraw/money.ts"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

// The published central-bank pegs, written here independently of the module so
// this is a second opinion rather than an echo of the same constant.
const PEG = { SAR: 3.75, AED: 3.6725, QAR: 3.64, BHD: 0.376, OMR: 0.3845, JOD: 0.709 }

console.log("— a converted price is actually that price —")
for (const [code, rate] of Object.entries(PEG)) {
  for (const usd of [5, 11, 12, 30, 110]) {
    const p = localPrice(usd, code)
    const real = usd * rate
    // Whole-unit rounding above 10, two decimals below: either way the shown
    // figure must be within one rounding step of the truth.
    const step = real >= 10 ? 0.5 : 0.005
    if (!p || Math.abs(p.amount - real) > step + 1e-9) {
      check(false, `${code} ${usd} USD → ${p ? p.amount : "null"}, real ${real.toFixed(3)}`)
    }
  }
}
check(fail === 0, "every pegged currency converts within a rounding step of its peg")
check(localPrice(11, "SAR").text.includes("SAR"), "and the text names the currency, so 41 is never a bare number")

console.log("\n— nothing floating is ever quoted —")
// These are real, obvious markets. Quoting them from a compiled-in rate would be
// wrong within months, so the honest answer is no answer.
for (const code of ["KWD", "EGP", "TRY", "IQD", "MAD", "LBP", "USD", "EUR"]) {
  check(localPrice(11, code) === null, `${code} is not quoted from a hard-coded rate`)
}
check(localPrice(11, "sar") === null, "and the lookup is exact, so a typo shows dollars rather than a guess")

console.log("\n— it declines rather than guesses —")
check(localPrice(0, "SAR") === null, "a zero price has no local equivalent")
check(localPrice(-5, "SAR") === null, "and neither does a negative one")
// No region is resolvable in a bare Node process, which is the same situation as
// a browser reporting a country we have no peg for.
check(localPrice(11) === null, "an unrecognised region falls back to dollars instead of inventing a currency")

console.log("\n— the statement currency is always said —")
check(chargeNote("AED") === "charged in AED", "an AED gateway says AED")
check(chargeNote("USD") === "charged in USD", "a USD gateway says USD")
check(chargeNote("") === "charged in USD" && chargeNote() === "charged in USD",
  "and an unknown one says USD rather than nothing — the prices are quoted in USD")
check(!/AED/.test(chargeNote("USD")), "it never names a currency the gateway is not using")
for (const usd of [5, 11, 30]) {
  check(/charged in [A-Z]{3}/.test(priceFootnote(usd, "AED")) || /^AED /.test(priceFootnote(usd, "AED")),
    `the footnote for $${usd} always resolves to a real currency`)
}
{
  // A Saudi buyer: their number AND the one on the statement, both present.
  const f = priceFootnote(11, "AED")
  check(/charged in AED/.test(f), "a non-local gateway currency is disclosed in the footnote")
}

console.log("\n— the price cannot depend on the network —")
const src = readFileSync(new URL("../lib/airraw/money.ts", import.meta.url), "utf8")
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n")
check(!/\bfetch\s*\(|XMLHttpRequest|axios/.test(code),
  "no rate is fetched, so two people never see two different prices for the same pack")
check(!/localStorage|sessionStorage/.test(code),
  "and nothing about the price is remembered client-side where it could be edited")

console.log(fail === 0 ? "\nPASS — prices are honest in both currencies" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
