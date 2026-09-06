// THE GOOD ENGINE FIRST, AND A REFUSAL IS NOT A FAILURE.
//
// Faces were coming out cheap because Together's account is throttled off the
// photoreal ladder most of the day (hundreds of 429s), so every portrait fell to
// a 4-step distillation model. Google's image models are much better at a human
// face — but Google's policy refuses this product's harder prompts, and no key
// opts out of that.
//
// So the whole design rests on one distinction: a REFUSAL is a different result
// from a FAILURE. A refusal must cost one request and fall through to the
// engines that will render it; only a rejected KEY should latch anything off.
// If those two ever collapse into each other, either every face stops (a refusal
// treated as fatal) or the fallback never fires (a refusal treated as success).
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const src = readFileSync("app/api/character-photo/route.ts", "utf8")

// ── a refusal is its own result ───────────────────────────────────────────
check(/const REFUSED = Symbol/.test(src), "a refusal has its own sentinel, distinct from null")
check(/Promise<Buffer \| null \| typeof REFUSED>/.test(src), "genGoogle's type says a refusal is a third outcome")
check(/if \(g === REFUSED\)/.test(src), "the caller handles a refusal explicitly")
const chain = src.slice(src.indexOf("const genWithSeed"), src.indexOf("const gate = globalGate"))
check(/const engine = provider === "google" \? "together" : provider/.test(chain),
  "when google is the engine, the diffusion ladder is still the fallback")
check(!/googleOffUntil = Date\.now\(\)[\s\S]{0,200}REFUSED/.test(src), "a refusal never latches the provider off")

// ── only a rejected key latches ───────────────────────────────────────────
const g = src.slice(src.indexOf("async function genGoogle"), src.indexOf("/**\n * Ask Together"))
check(/res\.status === 401 \|\| res\.status === 403/.test(g) && /googleOffUntil = Date\.now\(\) \+ AUTH_OFF_MS/.test(g),
  "a rejected key pauses google, the same way fal and together behave")
check(/if \(!b64\) return REFUSED/.test(g), "a 200 carrying no image is treated as a refusal, not as success")
check(/blockReason|finishReason/.test(g), "the stated block reason is read before the image is looked for")

// ── the model is discovered, not guessed ──────────────────────────────────
check(/async function googleImageModel/.test(src), "the model is looked up from the account")
check(/process\.env\.GOOGLE_IMAGE_MODEL/.test(src), "and can be overridden outright")
check(/G_BASE\}\/models\?key=/.test(src) && /v1beta/.test(src), "the lookup reads the real model list")
check(/googleModelCache/.test(src), "the lookup is cached, so it isn't a round-trip per face")

// ── google is opt-in and cannot break the existing engines ────────────────
check(/process\.env\.IMAGE_PROVIDER\s*$/m.test(src) || /process\.env\.IMAGE_PROVIDER\b/.test(src),
  "IMAGE_PROVIDER still wins when it is set")
check(/AIRRAW_HOME === "1" && process\.env\.GEMINI_API_KEY \? "google" : "runpod"/.test(src),
  "AIRRAW prefers google automatically when a key exists — no env change needed to get the good faces")
check(/AIRRAW_HOME === "1"/.test(src.slice(src.indexOf("const PROVIDER"), src.indexOf("const PROVIDER") + 700)),
  "and Kloom is excluded from that switch, keeping its own engine")
check(/if \(!GEMINI_KEY \|\| Date\.now\(\) < googleOffUntil\) return null/.test(g),
  "with no key, google is skipped rather than erroring")

// ── the cache is what makes a face stable, since this API has no seed ─────
check(/PROMPT_FINGERPRINT/.test(src), "the cache key still carries the prompt fingerprint")
check(/cached: true/.test(src), "make-once / cache-forever is intact, which is where a face's stability comes from")

// ── the safety floor on portraits is untouched ────────────────────────────
const prompt = readFileSync("lib/airraw/portrait-prompt.ts", "utf8")
for (const w of ["child", "minor", "underage", "teenager"]) {
  check(new RegExp(`\\b${w}\\b`).test(prompt), `the portrait negative still refuses "${w}"`)
}

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
