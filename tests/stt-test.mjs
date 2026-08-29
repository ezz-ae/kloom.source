// Which recogniser answered, and why the better ones didn't.
//
// This exists because "the Arabic is barely understood" was unactionable: five
// tiers can answer /api/stt, the response looks identical whichever did, and the
// tier everyone assumed was running (Gemini) was switched off. A measured round
// trip through the live site put genuine mishearings at 22% on CLEAN synthetic
// audio — "أنا مش قادرة أنام" came back as "أنا مش أدرى نام".
import { readFileSync } from "node:fs"
let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const route = strip("app/api/stt/route.ts")

// Every success path must name its tier — otherwise the next report of bad
// transcription is as undiagnosable as this one was.
// The only place a transcript may be returned is the tagging helper itself —
// anywhere else is a tier that answers anonymously.
const helper = route.slice(route.indexOf("function transcript("))
const helperEnd = helper.indexOf("\n}") + 2
const outside = route.replace(helper.slice(0, helperEnd), "")
check(!/return Response\.json\(\{ text:/.test(outside), "no tier answers without naming itself")
check((route.match(/return transcript\(/g) || []).length >= 5, "every tier answers through the tagging helper")
check(/X-STT-Provider/.test(route), "the answering recogniser is reported")
check(/X-STT-Fallback/.test(route), "the reason better tiers were skipped is reported")
check(/gemini:off|gemini:no-key/.test(route) && /scribe:parked|scribe:off/.test(route),
  "the reason distinguishes off / no-key / parked / failed")

// The Whisper prompt is the only lever on dialect that costs nothing, and a
// style sentence naming no words is not one. It biases by VOCABULARY.
const seed = (route.match(/const AR_STYLE_SEED = "([^"]+)"/) || [, ""])[1]
const markers = ["لسه", "دلوقتي", "مش", "عايز", "كده", "بص"]
const present = markers.filter((m) => seed.includes(m))
check(present.length >= 5, `the Arabic prompt seeds real dialect words (${present.length}/${markers.length})`)
// Pan-dialect: the floor is Egyptian, Levantine, Gulf and Maghrebi at once.
check(["شو", "هلق", "وين", "بزاف"].some((m) => seed.includes(m)), "and not only Egyptian ones")
// Whisper degrades past ~16 tokens as the decoder starts inventing continuations.
check(seed.split(/[\s،]+/).filter(Boolean).length <= 16, `the seed stays short (${seed.split(/[\s،]+/).filter(Boolean).length} tokens)`)

// Kloom must not be touched by any of the Arabic-specific handling.
check(/adult && isArabic/.test(route), "the Arabic tiers stay behind the variant gate")
check(/if \(language && \(!adult \|\| isArabic\)\)/.test(route),
  "Kloom still pins whatever language the UI selected")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
