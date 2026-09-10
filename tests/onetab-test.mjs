// ONE TAB, AND EVERYTHING YOU NEED WITHOUT LEAVING IT.
//
// Two rules that are really the same rule: a second tab costs money and a second
// screen costs the conversation.
//
//   1. Nothing on a chat or call surface opens a new tab. The room generates on
//      a timer, so every extra tab is another room running in parallel for a
//      person who can only read one of them. A link that spawns one is the
//      product doing that to itself.
//   2. Everything you might reach for mid-call is reachable mid-call. Changing
//      language used to mean opening a sheet over the conversation you were
//      trying not to interrupt — so people left the call to adjust the call.
import { readFileSync, readdirSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const read = (p) => readFileSync(p, "utf8")

// ── no chat or call surface opens a tab ─────────────────────────────────────
console.log("— a chat or call surface never spawns a tab —")
const surfaces = readdirSync("components/airroom").filter((f) => f.endsWith(".tsx"))
check(surfaces.length > 10, `${surfaces.length} surfaces checked`)
for (const f of surfaces) {
  const src = read(`components/airroom/${f}`)
  const hit = /target=["{]_?["']?_blank|window\.open\s*\(/.test(src)
  check(!hit, `${f.replace(/\.tsx$/, "")} opens nothing in a new tab`)
}

// The crisis links are the deliberate exception and live OUTSIDE these
// surfaces. They must keep opening a new tab: someone reaching a helpline
// should not lose the page they were on, and that is worth more than a rule
// about tabs. Asserted so a future sweep does not "tidy" it away.
const wellness = read("components/widgets/WellnessSupport.tsx")
check(/target="_blank"/.test(wellness),
  "support links still open a new tab — reaching a helpline must never close what you were in")

// ── the call carries its own settings ───────────────────────────────────────
console.log("\n— and the call carries its own settings —")
const bubble = read("components/airroom/AirBubble.tsx")
const drawer = bubble.slice(bubble.indexOf("── THE CALL DRAWER"), bubble.indexOf("{humanNote &&"))
check(drawer.length > 800, "there is a drawer on the call screen")
check(/const \[audioPanel, setAudioPanel\] = useState\(false\)/.test(bubble),
  "closed until asked for — it never covers the call by default")
// The label may be wrapped in the translator now — what matters is that it IS a
// dialog and that it carries the call-settings name, in whatever language.
check(/role="dialog" aria-label=(?:"call settings"|\{t\("call settings"\)\})/.test(drawer),
  "it is a real dialog, not a floating div")
check(/position: "absolute", top: 0, bottom: 0, right: 0/.test(drawer),
  "and it slides in from the side, so the portrait and the call button do not move under it")
check(/onClick=\{\(\) => setAudioPanel\(false\)\}/.test(drawer), "tapping away closes it")

// The four things it exists for.
check(/onClick=\{cycleLang\}/.test(drawer) && /myLangs\.length > 1 &&/.test(drawer),
  "language shifts from inside the call, and hides itself when there is only one")
check(!/<select[^>]*aria-label="language"/.test(drawer) && !/LANGUAGES\.map/.test(drawer),
  "as one button that names where it goes — not a forty-row picker in the middle of a conversation")
check(/setChatOpen\(\(v\) => !v\)/.test(drawer), "the words can be turned on during the call")
check(/stopSpeaking\(\); return n/.test(drawer), "and her voice can be turned on while you are reading")
check(/<MicTest accent=\{accent\} \/>/.test(drawer), "the mic can be tested without talking to anyone")

// ── the mic test answers the question and costs nothing ─────────────────────
console.log("\n— the mic test answers it locally —")
const mic = read("components/airroom/MicTest.tsx")
check(!/fetch\(|\/api\//.test(mic), "it sends nothing anywhere — no request, no transcription")
check(/stream\.getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/.test(mic), "it lets go of the microphone when it stops")
check(/useEffect\(\(\) => \(\) => \{ stopRef\.current\?\.\(\) \}, \[\]\)/.test(mic),
  "and on unmount too — a test that leaves the mic open is the bug it exists to find")
check(/Date\.now\(\) - started > 6000/.test(mic), "it stops on its own, so a forgotten test does not hold the mic")
check(/state === "denied"/.test(mic) && /blocked the mic/.test(mic),
  "a blocked mic is named as a browser permission, not left looking like the product failing")
check(/state === "listening" && \(/.test(mic),
  "the level bar exists only while listening — a dead meter implies a live mic")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
