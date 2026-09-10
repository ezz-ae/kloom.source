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
const prompt = readFileSync("lib/airraw/portrait-prompt.ts", "utf8")

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

// Choosing a model is not sorting strings. A plain descending sort picked
// "gemini-3.1-flash-lite-image" out of the six the account lists — the cheapest,
// weakest one — which is exactly the quality problem this change was made for.
const pick = src.slice(src.indexOf("const score = (n: string)"), src.indexOf("googleModelCache = {"))
check(/lite/i.test(pick) && /-= 400/.test(pick), "the cheap 'lite' tier is ranked DOWN, not alphabetically up")
check(/preview\|exp/.test(pick), "stable is preferred over preview")
const score = (n) => { let v = 0
  if (/lite/i.test(n)) v -= 400; else if (/flash/i.test(n)) v += 300
  if (/imagen/i.test(n)) v += 200
  if (/preview|exp/i.test(n)) v -= 150
  const m = n.match(/(\d+(?:\.\d+)?)/); if (m) v += Math.min(99, Number(m[1]) * 10)
  return v }
// The six this account actually lists, from the production log.
const REAL = ["gemini-3.1-flash-lite-image", "gemini-3.1-flash-image-preview", "gemini-3.1-flash-image",
              "gemini-3-pro-image-preview", "gemini-3-pro-image", "gemini-2.5-flash-image"]
const best = [...REAL].sort((a, b) => score(b) - score(a) || b.localeCompare(a, "en", { numeric: true }))[0]
check(best === "gemini-3.1-flash-image", `the live model list resolves to a real image model (${best})`)
check(best !== "gemini-3.1-flash-lite-image", "and never back to the lite tier")

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

// ── the shape the UI actually lays out ────────────────────────────────────
// Without imageConfig this endpoint returns whatever it likes: a live sample came
// back 1408x768 landscape for a card the whole UI renders as a 3:4 portrait.
check(/imageConfig: \{ aspectRatio: "3:4" \}/.test(src), "the generateContent path asks for a 3:4 portrait")
check(/aspectRatio: "3:4"/.test(g.slice(g.indexOf("imagen"))), "and so does the imagen path")

// ── the grit pass does not run over a photograph ──────────────────────────
// The pass exists to un-plastic FLUX output. Over Google's images it is pure
// degradation, and stacked on the old "harsh light, underexposed" style prompt it
// is what made faces look ill and grimy.
check(/realismPass\(bytes, \/gemini\|imagen\/i\.test\(usedModel\)\)/.test(src),
  "a google image skips the grain, vignette and aberration")
check(/async function realismPass\(input: Buffer, plain = false\)/.test(src),
  "the pass takes a plain mode rather than being bypassed entirely")
check(/const R_JPEG_Q = plain \? 95 : R_JPEG_Q_ENV/.test(src),
  "plain mode still re-encodes to JPEG, so the cache path and content type stay consistent")

// A ZERO amount must not poison the tone curve. With contrast 0 the S-curve
// divides by zero, norm becomes NaN, and NaN into a Uint8Array lands as 0 — every
// LUT entry reads 0 and the whole image maps to black. Plain mode sets contrast to
// 0, so this shipped solid black portraits to production.
check(/if \(!\(R_CONTRAST > 0\)\)/.test(src), "a zero contrast takes an identity curve instead of dividing by zero")
const lut = (C) => { const t = new Uint8Array(256)
  if (!(C > 0)) { for (let v = 0; v < 256; v++) t[v] = v; return t }
  const k = C * 4, s0 = 1 / (1 + Math.exp(k * 0.5)), s1 = 1 / (1 + Math.exp(-k * 0.5))
  for (let v = 0; v < 256; v++) { const x = v / 255, sg = 1 / (1 + Math.exp(-k * (x - 0.5)))
    t[v] = Math.max(0, Math.min(255, Math.round((x * (1 - C) + ((sg - s0) / (s1 - s0)) * C) * 255))) }
  return t }
check(lut(0)[128] === 128 && lut(0)[255] === 255, `contrast 0 is an identity curve, not black (${lut(0)[128]}, ${lut(0)[255]})`)
check(lut(0.05)[255] === 255 && lut(0.05)[0] === 0, "and a real contrast still maps the endpoints")

// ── the style pool asks for real, not for ugly ────────────────────────────
// The pool, not the prose above it. This scanned the raw slice, so a comment
// EXPLAINING that the bathrooms were dropped for being unflattering failed the
// check that no style asks for "unflattering".
const styleRaw = prompt.slice(prompt.indexOf("const STYLE = ["), prompt.indexOf("]", prompt.indexOf("const STYLE = [")))
const style = styleRaw.replace(/^\s*\/\/.*$/gm, "")
for (const w of ["unflattering", "underexposed", "blurry", "grainy", "out of focus", "dirty", "smudged", "harsh"]) {
  check(!new RegExp(w, "i").test(style), `the style pool no longer asks for "${w}"`)
}
check(/soft|warm|golden|natural/i.test(style), "it asks for available light that is actually kind to a face")

// ── the floor is young adults ─────────────────────────────────────────────
const ages = prompt.slice(prompt.indexOf("const AGE = ["), prompt.indexOf("]", prompt.indexOf("const AGE = [")))
check(!/40s|50s/.test(ages), "no rung reaches the 40s — that is where 'everyone looks fifty' came from")
check(/20s/.test(ages) && /30s/.test(ages), "the cast is twenties and thirties")

// ── a face is not paid for three times ────────────────────────────────────
// isCleanPortrait rejecting an image means generating that person AGAIN. It
// catches diffusion artifacts, which Google does not produce — so on Google a
// rejection is almost always the detector being wrong, at the price of another
// paid image.
check(/if \(\/gemini\|imagen\/i\.test\(usedModel\)\) break/.test(src),
  "google output is accepted on the first pass instead of being re-generated")
const loop = src.slice(src.indexOf("for (let attempt = 0"), src.indexOf("if (!bytes || bytes.length < 8000)"))
check(/isCleanPortrait/.test(loop), "the detector still guards the diffusion engines, where it earns its cost")

// ── the daily ceiling is sized for a paid API ─────────────────────────────
const rl = readFileSync("lib/rate-limit.ts", "utf8")
const cap = Number((rl.match(/AIRRAW_DAILY_CALL_CAP \|\| "(\d+)"/) || [])[1])
check(cap > 0 && cap <= 1000, `the default daily cap is sized for paid generations (${cap})`)

// ── attractive, and still not explicit ────────────────────────────────────
// These faces sit on public cards and in link previews where anyone can see
// them. Appeal has to come from presence — a direct gaze, warm light, a
// half-smile — not from undress. What the paid tier unlocks is enforced
// server-side and must never be bought by writing a more explicit prompt.
const positive = prompt.slice(0, prompt.indexOf("PORTRAIT_NEG"))
const EXPLICIT = /\b(nude|naked|topless|lingerie|underwear|bikini|nsfw|breasts|cleavage|erotic|seductive pose|undressed)\b/i
const lines = positive.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
check(!EXPLICIT.test(lines.join(" ")), "no portrait prompt asks for anything explicit")
check(/looking (straight )?into the lens|direct.*gaze|looking at the camera/i.test(positive),
  "appeal comes from eye contact, which is the part that actually reads as inviting")

// ── THE NEGATIVE HAS TO REACH EVERY ENGINE ────────────────────────────────
// Gemini's generateContent has no negative-prompt field. When Google became the
// primary engine the whole of PORTRAIT_NEG was silently dropped on that path:
// faces came back sixty years old from a prompt asking for late twenties, and —
// far more seriously — "child, minor, underage, teenager" stopped being sent at
// all. It is folded into the prompt text instead, because this API reads
// instructions.
const gg = src.slice(src.indexOf("async function genGoogle"), src.indexOf("/**\n * Ask Together"))
check(/genGoogle\(prompt: string, negative: string/.test(gg), "genGoogle takes the negative rather than ignoring it")
check(/Absolutely do not depict any of the following/.test(gg), "and states the exclusions in words, since there is no field for them")
check(/text: full/.test(gg) && /prompt: full/.test(gg), "both request shapes send the combined text, not the bare prompt")
check(/genGoogle\(prompt, negative, dseed\)/.test(src), "the caller passes it through")

// ── the front door shows the face it went and generated ───────────────────
const fd = readFileSync("components/airroom/FrontDoor.tsx", "utf8")
const scrimTop = Number((fd.match(/linear-gradient\(180deg, rgba\(7,4,15,\.(\d+)\) 0%/) || [])[1])
check(scrimTop <= 30, `the top of the scrim does not sit over the eyes (.${scrimTop})`)
check(/scale\(1\.06\) translateY\(-2%\)/.test(fd), "the portrait is not lifted so far that the top of the head leaves the frame")

// ── the safety floor on portraits is untouched ────────────────────────────
// The negative list is half of the age floor; the positive half has to be stated
// too, because the Google engine read the identical prompt younger than every
// diffusion engine did — one sampled face came back reading as a teenager.
check(/They are clearly an adult/.test(prompt),
  "the prompt states ADULT outright rather than leaving it to be inferred from the age phrase")
// Ordering is load-bearing on an instruction-following model: Gemini read a long
// technical opener as the brief and largely ignored the ethnicity buried after
// it, so a pool that is 19% East Asian returned a floor that looked far more so.
// Asserted as an ORDERING, not as a sentence. It was pinned to the exact opening
// words, so re-briefing the photograph — which is a thing that will keep
// happening — failed a check about where the ethnicity sits.
{
  // Comments stripped first. A comment in the template block that merely NAMES
  // BASE is not BASE, and indexing raw source found the word in the prose.
  const tpl = prompt.slice(prompt.indexOf("const prompt ="), prompt.indexOf("return { prompt"))
    .replace(/^\s*\/\/.*$/gm, "")
  const at = (needle) => tpl.indexOf(needle)
  check(at("${ethnicity}") > 0, "the ethnicity is in the prompt at all")
  check(at("${ethnicity}") < at("${style}") && at("${ethnicity}") < at("BASE"),
    "the subject — and their ethnicity — opens the prompt rather than trailing the setting and the technical notes")
  const firstLine = tpl.slice(at("`"), at("`") + 120)
  check(/\$\{ethnicity\}/.test(firstLine),
    "and it is in the FIRST clause, which is the part an instruction-following model reads as the brief")
}

for (const w of ["child", "minor", "underage", "teenager"]) {
  check(new RegExp(`\\b${w}\\b`).test(prompt), `the portrait negative still refuses "${w}"`)
}

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
