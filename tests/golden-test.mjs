// THE GOLDEN ROOM — the one you rent, and the one thing it must never do.
//
// The brief named the failure itself: "entering is always converting — the agent
// is not going to shift from Sami to Layla." You are already talking to someone;
// you take THEM into the room. If the room regenerates a person, eleven dollars
// bought a stranger, and the feature is worse than not existing.
//
// The second thing this file guards is the price. "$11 no matter how long" is
// the pass's mistake restated — nine dollars for six thousand voice minutes, or
// about four hundred dollars of speech, surviving only because nobody redeemed
// it. Flat is fine. Flat and unbounded is not.
import { readFileSync } from "node:fs"
import {
  GOLDEN_USD, GOLDEN_MINUTES, GOLDEN_MAX_BOOKED, GOLDEN_COST_USD, GOLDEN_GAMES,
  goldenGame, sameGuest, goldenLeftMs, goldenLabel,
} from "../lib/airraw/golden.ts"
import { applyPromo, promoPercent, PROMO_MAX_OFF } from "../lib/airraw/promo.ts"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const route = readFileSync(new URL("../app/api/golden/route.ts", import.meta.url), "utf8")

console.log("— it is the same person, or it is nothing —")
const sami = { key: "w:sami-7", host: "Sami", gender: "male" }
const layla = { key: "w:layla-2", host: "Layla", gender: "female" }
check(sameGuest(sami, { ...sami }), "the same key is the same person")
check(!sameGuest(sami, layla), "a different key is a different person — Sami does not become Layla")
check(!sameGuest(sami, { key: "", host: "Sami", gender: "male" }),
  "and a MISSING key is never a match, so a lost identity fails loudly instead of quietly recasting")
check(!sameGuest(sami, null) && !sameGuest(null, null), "nothing is not a match either")
check(!sameGuest(sami, { key: "w:other", host: "Sami", gender: "male" }),
  "the NAME does not make it the same person — two people may share one, the key is the identity")

console.log("\n— flat, but not unbounded —")
check(GOLDEN_USD >= 1, `a session is $${GOLDEN_USD}`)
check(GOLDEN_MINUTES >= 10, `and runs ${GOLDEN_MINUTES} minutes, stated before anyone pays`)
check(GOLDEN_COST_USD < GOLDEN_USD,
  `the worst case ($${GOLDEN_COST_USD.toFixed(2)}) sits under the sale ($${GOLDEN_USD}) — unlike the pass`)
check(GOLDEN_COST_USD < GOLDEN_USD * 0.6, "with real margin, not a rounding error")
check(GOLDEN_MAX_BOOKED >= 1 && GOLDEN_MAX_BOOKED <= 20, `you may hold up to ${GOLDEN_MAX_BOOKED} at once`)
check(goldenLeftMs(null) === 0, "no session, no time")
check(goldenLeftMs({ startedAt: 0 }) === GOLDEN_MINUTES * 60_000,
  "an unopened session still has its whole length — booking ahead does not burn it")
const t0 = 1_000_000_000
check(goldenLeftMs({ startedAt: t0 }, t0 + 60_000) === (GOLDEN_MINUTES - 1) * 60_000, "and it counts down once opened")
check(goldenLeftMs({ startedAt: t0 }, t0 + GOLDEN_MINUTES * 60_000 + 5000) === 0, "and never goes negative")
check(goldenLabel(0) === "finished" && /minutes left/.test(goldenLabel(5 * 60_000)), "the time left reads in words")

console.log("\n— four games, and they are all conversation —")
check(GOLDEN_GAMES.length === 4, "there are four")
for (const g of GOLDEN_GAMES) {
  check(!!g.name && !!g.blurb && !!g.play, `${g.id} has a name, a blurb and a way to play`)
  // A game must shape the talking, not replace her with a board.
  check(!/canvas|board|grid|score|points|level/i.test(g.play), `${g.id} is played in conversation, not on a screen`)
  check(!/you are |your name is |forget/i.test(g.play),
    `${g.id} never re-describes who she is — that is how a game would turn Sami into someone else`)
}
check(goldenGame("truth")?.id === "truth" && goldenGame("nope") === null && goldenGame(null) === null,
  "a game is looked up by id, and an unknown one is nothing rather than a default")

console.log("\n— money —")
check(/verifyIntentSig\(anchorFor\(intentId, qty\)/.test(route),
  "the QUANTITY is inside the signature, so a claim cannot ask for ten against a payment for one")
check(/if \(!\(await ledgerReady\(\)\)\)/.test(route) &&
  route.indexOf("ledgerReady()") < route.indexOf("createPaymentIntent("),
  "and no checkout opens against a ledger that cannot credit it")
check(/intent\.status !== "completed"/.test(route), "sessions are credited only on a completed payment")
check(/`golden:\$\{intentId\}`/.test(route), "the grant is keyed on the intent — one payment, one credit")
check(/const id = randomUUID\(\)/.test(route) && /`gopen:\$\{id\}`/.test(route),
  "the session id is minted SERVER-side, so a retry cannot burn two and a client cannot replay someone else's")
check(/goldKey = \(wallet: string\) => `golden:\$\{wallet\}`/.test(route),
  "sessions live in the existing wallet under their own key — no second migration to run")
check(/reason === "insufficient" \? 402/.test(route), "holding none is a 402, which is a price, not an error")

console.log("\n— promo codes —")
check(promoPercent("NOPE") === 0 && promoPercent("") === 0 && promoPercent(null) === 0,
  "an unknown code is worth nothing")
const none = applyPromo(11, "NOPE")
check(none.usd === 11 && none.applied === false,
  "and it charges list — but says applied:false, so the UI can never show a discount that was not given")
process.env.AIRRAW_PROMOS = "TEST25:25,HUGE:999"
const d = applyPromo(11, "test25")
check(d.usd === 8.25 && d.percent === 25 && d.applied, `TEST25 takes $11 to $${d.usd}, case-insensitively`)
const capped = applyPromo(100, "HUGE")
check(capped.percent === PROMO_MAX_OFF, `a 999% code is capped at ${PROMO_MAX_OFF}%, not honoured`)
check(applyPromo(1.2, "HUGE").usd >= 1, "and nothing is ever discounted below a dollar")
check(/const floor = pack\.usd \* \(1 - PROMO_MAX_OFF \/ 100\)/.test(readFileSync(new URL("../app/api/chips/route.ts", import.meta.url), "utf8")),
  "the claim's amount guard allows a real discount but still refuses a free pack")
const promoSrc = readFileSync(new URL("../lib/airraw/promo.ts", import.meta.url), "utf8")
check(/process\.env\.AIRRAW_PROMOS/.test(promoSrc), "codes live in env, so one can be made or killed without a deploy")
check(/applyPromo\(GOLDEN_USD \* qty, promo\)/.test(route),
  "and the golden checkout prices on the SERVER from the code it was opened with")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
