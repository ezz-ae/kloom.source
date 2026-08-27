// Every AIRRAW-only behaviour must be behind a variant gate. This is the check
// that "don't affect Kloom" is structurally true, not just believed.
import { readFileSync } from "fs"
const chat = readFileSync("app/api/chat/route.ts", "utf8")
const stt  = readFileSync("app/api/stt/route.ts", "utf8")
const tts  = readFileSync("app/api/tts/route.ts", "utf8")
let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

check(/const platform = adult \? platformFactsFor/.test(chat),
  "AIRRAW platform facts never reach a Kloom persona")
check(/function languageLine\(persona: Persona, follow = false\)/.test(chat),
  "language-following is opt-in, defaulting OFF")
check(/if \(!follow\) \{/.test(chat) && /Kloom: exactly as it was/.test(chat),
  "Kloom keeps its original strict language block")
check(chat.match(/languageLine\((persona|self), adult\)/g)?.length === 3,
  "all three prompt modes pass the variant through")
check(/persona\.seedKey \? arabicDialectLine/.test(chat),
  "regional dialect requires a seedKey, which only AIRRAW sends")

check(/if \(adult && isArabic && gemKey/.test(stt), "Gemini tier is AIRRAW-only")
check(/if \(adult && isArabic && elKey/.test(stt), "Scribe tier is AIRRAW-only")
check(/if \(language && \(!adult \|\| isArabic\)\)/.test(stt),
  "Kloom still pins the selected STT language")

check(/if \(seedKey\) \{\s*\n\s*const aKey = accentForSeed/.test(tts),
  "accent voice pools require a seedKey (AIRRAW-only)")

console.log(fail === 0 ? "\nPASS — Kloom is structurally unaffected" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
