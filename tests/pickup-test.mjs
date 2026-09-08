// PICKING IT BACK UP — she opens with something real, or she says nothing.
//
// Memory restored the words and nothing else: you reopened a thread, your old
// conversation sat there, and you had to start again. Someone who remembered you
// would not do that, and being remembered is most of why anyone returns.
//
// The whole risk of this feature is in one direction. A model told to "refer to
// something specific" will produce something whether or not there is anything to
// refer to, and a character who warmly recalls a conversation you never had is
// worse than one who stays quiet — on a product whose entire proposition is that
// someone was actually listening, a fabricated memory is the deepest possible
// break. So most of this file is about refusing to show a line rather than about
// producing one.
import { readFileSync } from "node:fs"
import {
  NOTHING, MIN_GAP_MS, shouldPickUp, gapLabel, pickupInstruction, cleanPickup, worthPickingUp,
} from "../lib/airraw/pickup.ts"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

const MIN = 60_000
const now = Date.UTC(2026, 0, 10, 12, 0)

console.log("— coming back is a gap, not a page load —")
check(!shouldPickUp(0), "a thread that was never spoken in is not a return")
check(!shouldPickUp(NaN) && !shouldPickUp(undefined), "and neither is a missing or broken timestamp")
check(!shouldPickUp(now - 2 * MIN, now), "reopening two minutes later is not a return — it is the same sitting")
check(!shouldPickUp(now - 24 * MIN, now), "nor is twenty-four minutes")
check(shouldPickUp(now - 26 * MIN, now), "twenty-six minutes is")
check(shouldPickUp(now - 40 * 24 * 60 * MIN, now), "and so is forty days — there is no upper limit on being remembered")
check(!shouldPickUp(now + 60 * MIN, now),
  "a clock that has run backwards does not read as an enormous gap in the other direction")
check(MIN_GAP_MS >= 15 * 60_000, "the threshold is minutes, not seconds")

console.log("\n— the gap is described the way a person remembers it —")
check(gapLabel(now - 30 * MIN, now) === "a little while ago", "half an hour is 'a little while ago'")
check(gapLabel(now - 3 * 60 * MIN, now) === "a few hours ago", "three hours is 'a few hours ago'")
check(gapLabel(now - 30 * 60 * MIN, now) === "yesterday", "thirty hours is 'yesterday'")
check(gapLabel(now - 9 * 24 * 60 * MIN, now) === "last week", "nine days is 'last week'")
check(!/\d+ (?:minutes|hours)\b/.test(gapLabel(now - 4 * 60 * MIN, now)),
  "and it never reads out a duration — a character counting hours is a machine")

// ── the guard that actually works ───────────────────────────────────────────
// Measured against the live model, not reasoned about: given a transcript of
// "hey / hi / what's up / nm u" and asked to refer to something specific, it
// replied "still editing your sentences?" — a confident memory of a conversation
// that never happened. No output filter catches that; it reads exactly like a
// real one. So the model is never asked unless the person actually said
// something, and that decision is made here, deterministically.
console.log("\n— she is not asked at all when there is nothing to remember —")
const thin = [
  { who: "host", text: "hey" }, { who: "you", text: "hi" },
  { who: "host", text: "what's up" }, { who: "you", text: "nm u" },
]
const rich = [
  { who: "host", text: "you sound wrecked. what happened?" },
  { who: "you", text: "my landlord is threatening to evict me on thursday if i don't pay" },
  { who: "host", text: "thursday is four days. can your brother help?" },
  { who: "you", text: "we haven't spoken in two years. i might call him anyway" },
]
check(worthPickingUp(rich), "a conversation with a plan, a person and a deadline in it is worth picking up")
check(!worthPickingUp(thin), "'hey / hi / what's up / nm u' is not — this is the exact case that fabricated a memory")
check(!worthPickingUp([]), "an empty thread is not")
check(!worthPickingUp(null), "and neither is a missing one")
check(!worthPickingUp([{ who: "you", text: "lol" }, { who: "you", text: "ok" }, { who: "you", text: "sure" }, { who: "you", text: "haha" }]),
  "four acknowledgements are still nothing — filler does not add up to substance")
check(!worthPickingUp([{ who: "host", text: "i have been thinking about that thing you told me about your mother all week" }]),
  "HER side never counts — it is generated, always fluent, and would pass every transcript ever written")
check(worthPickingUp([{ who: "you", text: "i finally quit today. told my boss at 4pm and walked out with a box." }]),
  "one long line of their own is enough on its own")

console.log("\n— she is given a way to say nothing, twice —")
const inst = pickupInstruction("a few hours ago")
check(inst.includes(NOTHING), "the instruction names the escape token")
check((inst.match(new RegExp(NOTHING, "g")) || []).length >= 2,
  "and names it twice, because one soft 'if you can't, don't' is what a model rounds away")
check(/Do not invent/i.test(inst), "it forbids inventing a detail outright")
check(/Not a greeting/i.test(inst) && /missed you/i.test(inst),
  "and rules out the greeting-shaped non-answer, which is what gets produced when there is nothing")
check(/under 20 words/i.test(inst), "one short line, not a speech")
check(inst.includes("a few hours ago"), "and it knows how long it has been")

console.log("\n— nothing reaches the screen unless it is real —")
check(cleanPickup(`${NOTHING}`) === null, "the escape token is dropped")
check(cleanPickup(`  ${NOTHING}  `) === null, "even padded")
check(cleanPickup(`Well, ${NOTHING}`) === null, "and even wrapped in a sentence, which is how it usually comes back")
check(cleanPickup("") === null && cleanPickup("   ") === null, "an empty answer shows nothing")
check(cleanPickup("x".repeat(300)) === null, "a wall of text is not an opening line")
// The route's own sentence processing strips the underscores off the token on
// the way back — observed in production, not hypothesised.
check(cleanPickup("none") === null && cleanPickup("None.") === null,
  "and the bare word survives the round trip as a refusal, not as a line")

// The failure mode that matters: a model with nothing to say produces warmth.
// Warmth is not memory, and shipping it as memory teaches people in two visits
// that the feature is hollow.
for (const g of [
  "Hey, missed you!", "missed you", "Welcome back", "you're back",
  "Hi! How have you been?", "So, how are you?", "it's been a while",
  "Good to see you again", "Long time!",
]) check(cleanPickup(g) === null, `"${g}" is warmth, not memory — dropped`)

// And what should survive.
for (const g of [
  "did you ever send that email to your sister?",
  "so how did Thursday go, in the end?",
  "you never told me what he said after that.",
  "I'm still thinking about the thing with your landlord.",
]) check(cleanPickup(g) === g, `"${g.slice(0, 34)}…" is something only someone who was there could say — kept`)

check(cleanPickup('"so how did Thursday go?"') === "so how did Thursday go?",
  "surrounding quotes are stripped, the way every other line on this floor is")

console.log("\n— and it costs the listener nothing they did not ask for —")
const bubble = readFileSync(new URL("../components/airroom/AirBubble.tsx", import.meta.url), "utf8")
// Bounded to the effect ITSELF, not to the next landmark in the file — a loose
// slice swept in unrelated code that legitimately speaks, and the assertion
// below is meaningless if it can see any speak() in the component.
const effStart = bubble.indexOf("// ── she picks it back up")
const effEnd = bubble.indexOf("}, [])", effStart) + 6
const eff = bubble.slice(effStart, effEnd)
// And read code, not the comment explaining why there is no voice here.
const effCode = eff.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
check(eff.length > 400, "the pickup effect is where it says it is")
check(!/speak\(|speakChunk\(|api\/tts/.test(effCode),
  "the opener is TEXT — an unrequested line must never spend a free visitor's one minute of voice")
check(/pickedUpRef\.current = true/.test(eff), "it happens once per arrival, not on every render")
check(/talkedRef\.current\) return/.test(eff),
  "if they start talking first, their line wins and the opener is dropped")
// This one shipped wrong and the browser caught it: the guard was "is the last
// message theirs", which is TRUE for almost every restored thread — saying
// something and then leaving is how a conversation gets left — so the opener was
// suppressed in exactly the normal case. What it has to compare is whether the
// list GREW while the request was in flight.
check(/const beforeLen = history\.length/.test(eff) && /m\.length > beforeLen \? m :/.test(eff),
  "a late arrival is judged by the list growing, not by whose line happens to be last")
check(/opening\?\.trim\(\)\) return/.test(eff),
  "and someone who arrived with their own opening line does not get a second one")
check(/memoryEnabled\(\) \|\| !resumed/.test(eff),
  "nothing happens for a session that stores nothing")
check(/worthPickingUp\(history\)\) return/.test(eff),
  "and the model is never even asked unless there is something to remember")
check(/ctrl\.abort\(\)/.test(eff), "leaving the thread cancels the request")

// The canned greeting and the pickup must be mutually exclusive, or a returning
// visitor gets both "hey, I'm Mara" and a callback to last Tuesday.
check(/if \(greetedRef\.current \|\| resumed\) return/.test(bubble),
  "the canned hello is still suppressed on a resumed thread, so the two can never both fire")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
