// THE MOMENT SOMEONE MIGHT PAY.
//
// The paywall sells "fully unrestricted". The free floor deflects in character
// and keeps the vibe going — warmly, convincingly. So a free user asks for
// something, gets brushed off, concludes she isn't into it, and leaves. They
// never learn there was a wall, and a limit nobody can see is a limit nobody
// pays to remove. The product was selling a difference it never showed anyone.
//
// This suite guards the fix AND the thing the fix must not become: the signal is
// an upsell hint, never a filter.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const chat = strip("app/api/chat/route.ts")
const bubble = strip("components/airroom/AirBubble.tsx")

// ── the gate is untouched ───────────────────────────────────────────────────
// Everything here is additive. If any of this changed, the paywall changed.
check(/return pro \? NO_FILTERS : PUBLIC_CEILING/.test(chat), "the content gate still keys on a verified pass alone")
check(/const pro = proTokenValid\(proToken\)/.test(chat), "and the pass is still verified server-side")
check(/never graphic/.test(chat), "the free ceiling still holds")

// ── the signal is a HINT, not a filter ──────────────────────────────────────
// A word list that can block is a censor. This one can only decorate.
const fn = chat.slice(chat.indexOf("function ceilingHit"), chat.indexOf("const NO_FILTERS") > chat.indexOf("function ceilingHit")
  ? chat.indexOf("const NO_FILTERS") : chat.length)
check(/function ceilingHit/.test(chat), "the ceiling-hit signal exists")
check(!/WANTS_MORE/.test(chat.slice(chat.indexOf("function contentLayer"))),
  "the word list is never consulted by the content layer")
const emit = chat.slice(chat.indexOf("X-Ceiling-Hit") - 400, chat.indexOf("X-Ceiling-Hit") + 200)
check(/headers/.test(emit), "it only ever becomes a response header")
check(/if \(pro\) return false/.test(chat), "a paying user is never nudged — nothing is capped for them")

// It must not be able to change what the model is told. The real property is
// that there is exactly ONE call site and it sits in the response headers —
// checking "does the name appear before the header" instead just matched the
// function's own definition.
const uses = [...chat.matchAll(/ceilingHit\(/g)].map((m) => m.index)
// +"function ".length: `uses` holds the offset of "ceilingHit(", while indexOf
// finds "function ceilingHit(" nine characters earlier — so the definition never
// matched itself and counted as a call.
const defAt = chat.indexOf("function ceilingHit(") + "function ".length
const callSites = uses.filter((i) => i !== defAt)
check(callSites.length === 1, `ceilingHit is called exactly once (${callSites.length})`)
const around = chat.slice(callSites[0] - 300, callSites[0] + 120)
check(/X-Ceiling-Hit/.test(around) && /headers/.test(chat.slice(callSites[0] - 900, callSites[0])),
  "and its only call is inside the response headers, never in prompt construction")

// ── the user is told, once ──────────────────────────────────────────────────
check(/X-Ceiling-Hit/.test(bubble), "the client reads the signal")
check(/ceilingShown/.test(bubble), "and shows it at most once per conversation")
check(/!ceilingShown\.current/.test(bubble), "guarded before it can fire twice")
check(/setShowPro\(true\)/.test(bubble), "tapping it opens the pass sheet")
check(/not now/.test(bubble), "and there is a way to dismiss it")
check(/ceiling && !pro/.test(bubble), "it can never render for someone who already paid")

// ── it says what actually happened ──────────────────────────────────────────
// Someone who was just deflected has earned a straight answer. Teasing them
// again at that exact moment reads as a trick, not an offer.
check(/free floor/.test(bubble), "it names the reason plainly")
check(/\$9/.test(bubble), "and states the price")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
