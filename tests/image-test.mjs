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
check(/const engine = provider === "google" \? \(TOGETHER_KEY \? "together" : "runpod"\) : provider/.test(chain),
  "when google is the engine, a real diffusion engine is still the fallback")
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
// GOOGLE_FIRST and IMAGE_PROVIDER answer two different questions. Production had
// IMAGE_PROVIDER=fal with a dead fal key, so tying "try the good engine" to that
// setting meant every new face failed with three working engines available.
const gf = src.slice(src.indexOf("const GOOGLE_FIRST ="), src.indexOf("const RP_KEY"))
check(!/IMAGE_PROVIDER/.test(gf), "whether google runs first does NOT depend on IMAGE_PROVIDER")
check(/AIRRAW_HOME === "1"/.test(gf), "google-first is AIRRAW only — Kloom keeps its own engine")
check(/GEMINI_API_KEY/.test(gf), "and needs a key")
check(/GOOGLE_IMAGE_OFF !== "1"/.test(gf), "an operator can still turn it off")
check(/GOOGLE_FIRST && !providerOverride/.test(src), "an explicit per-request provider still wins")

// A named engine that is not answering must not end the request.
const falBranch = src.slice(src.indexOf('if (engine === "fal")'), src.indexOf('if (engine === "fal")') + 900)
check(/TOGETHER_KEY/.test(falBranch) && /genTogether/.test(falBranch),
  "a dead fal falls through to another engine instead of failing the whole request")
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
