// THE EAR NEVER ANSWERS 503 WHILE A RECOGNISER IS ALIVE.
//
// Measured on production: every English clip sent to /api/stt came back 503
// "temporarily unavailable". The Arabic path, one tier up, transcribed the very
// same audio perfectly through ElevenLabs Scribe. Groq (the English primary)
// was not answering, Scribe was scoped to Arabic, and nothing else was
// configured — so the route gave up with a live recogniser in hand.
//
// A 503 is not a soft failure on the client: it is read as "no recogniser", the
// mic is torn down, and the call falls to the browser's own recognition, which
// the in-app browsers the ads deliver mostly do not have. The rule: on AIRRAW,
// Scribe is tried for every language before the route can answer 503, and a
// 503 says which tiers declined.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const src = strip(readFileSync("app/api/stt/route.ts", "utf8"))

const groq = src.indexOf('fetch("https://api.groq.com')
const scribeAll = src.indexOf('if (adult && elKey && process.env.STT_SCRIBE !== "0" && !isArabic)')
const runpod = src.indexOf("RUNPOD_STT_ENDPOINT_ID")
const unavailable = src.indexOf('"STT temporarily unavailable — try again"')

console.log("— Scribe stands behind Groq for every language —")
check(groq > 0 && scribeAll > groq, "the all-language Scribe tier comes AFTER Groq (Groq stays the cheap English primary)")
check(scribeAll > 0 && scribeAll < runpod, "and BEFORE RunPod and the OpenAI-compatible fallback that were never configured")
check(scribeAll < unavailable, "so the 503 is only reachable once Scribe has also declined")
check(/let groqWhy = groqKey \? "" : "groq:no-key"/.test(src), "no Groq key is recorded as a reason, not silently skipped")
check(/groqWhy = `groq:\$\{res\.status\}`/.test(src) && /groqWhy = "groq:error"/.test(src), "a Groq failure is recorded with its status")
{
  const tier = src.slice(scribeAll, scribeAll + 400)
  check(/scribeSTT\(file, elKey\)/.test(tier), "Scribe detects the language itself — no pin, so a bilingual caller is still understood")
  check(/transcript\(t, "scribe"[\s\S]*?groqWhy/.test(tier), "the transcript carries why Groq did not answer (X-STT-Fallback)")
}

console.log("— the 503 explains itself, and Kloom is not in this —")
check(/"X-STT-Fallback": why/.test(src.slice(unavailable - 900, unavailable + 200)), "a 503 names every tier that declined")
check(/if \(adult && elKey/.test(src.slice(scribeAll, scribeAll + 120)), "the tier is gated on the adult variant — Kloom's path is exactly what it was")

console.log(fail ? `\n${fail} FAILED` : "\nPASS")
process.exit(fail ? 1 : 0)
