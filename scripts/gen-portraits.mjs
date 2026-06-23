// One-off portrait generator. Produces photoreal human portraits for the AIRRAW
// roster names (and any extra names passed) into public/cast/<slug>.jpg — the same
// pipeline imageFor() reads. Idempotent: skips slugs that already have a file, so
// it's safe to re-run to fill gaps after rate-limit errors.
//
//   TOGETHER_API_KEY=... node scripts/gen-portraits.mjs
//
// Optionally pass extra "Name:gender" pairs as args, e.g. `node scripts/gen-portraits.mjs "Aria:female"`.
import fs from "fs"
import path from "path"

// Provider: fal.ai (FLUX-dev/pro, top quality) when FAL_KEY is set, else Together
// (FLUX-schnell, free/fast). FORCE=1 regenerates even slugs that already exist
// (use it to re-shoot the whole cast at fal quality).
const FAL = process.env.FAL_KEY
const TKEY = process.env.TOGETHER_API_KEY
const FAL_MODEL = process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev"
const FORCE = process.env.FORCE === "1"
if (!FAL && !TKEY) { console.error("set FAL_KEY (best) or TOGETHER_API_KEY"); process.exit(1) }
console.log("provider:", FAL ? `fal · ${FAL_MODEL}` : "together · FLUX.1-schnell", FORCE ? "· FORCE" : "")

const ROOT = process.cwd()
const CAST = path.join(ROOT, "public", "cast")
fs.mkdirSync(CAST, { recursive: true })

// Pull the name pools straight from the roster so the script never drifts from it.
const roster = fs.readFileSync(path.join(ROOT, "lib/airroom/roster.ts"), "utf8")
const arr = (tag) => {
  const m = roster.match(new RegExp(`const ${tag} = \\[([\\s\\S]*?)\\]`))
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : []
}
const names = [
  ...arr("NAMES_F").map((n) => ({ n, g: "female" })),
  ...arr("NAMES_M").map((n) => ({ n, g: "male" })),
  ...process.argv.slice(2).map((a) => { const [n, g] = a.split(":"); return { n, g: g || "female" } }),
]

const slug = (s) => s.toLowerCase().replace(/\(.*?\)/g, "").trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }

const BASE = "RAW photo, ultra realistic, real human being, detailed natural skin texture with pores and imperfections, looking at camera"
// Different "levels" — most are casual phone/candid shots (real people, not models),
// a few are cinematic. Rotated deterministically per name.
const STYLES = [
  "casual front-facing phone selfie, slightly grainy, natural indoor light, imperfect framing",
  "candid everyday snapshot, plain room, ordinary clothes, amateur photo, soft phone-camera look",
  "bathroom mirror selfie, casual, phone flash, relaxed",
  "outdoor daylight candid, relaxed, slightly overexposed, real and unposed",
  "cozy room at night, warm lamp light, soft phone-camera look, comfortable",
  "webcam-style photo, soft and a little low-res, at home",
  "night street with neon bokeh, candid fashion photography, effortless stylish look",
  "golden hour window light, warm intimate evening ambience, soft glow on skin",
  "moody low-key lighting with warm practical accents, upscale lounge, relaxed confidence, cinematic",
]
const NEG = "cartoon, illustration, 3d render, doll, plastic skin, deformed, text, watermark, nudity, nsfw, child"
// Varied LOOKS — not all gorgeous models. A real spread of ages and ordinary faces.
const LOOKS_F = ["a strikingly beautiful young woman with captivating eyes", "an average-looking woman, girl-next-door, natural and real", "a cute woman in her late twenties, little to no makeup, light freckles", "a woman in her thirties with a warm relatable face", "a plain but lovely woman, real everyday face", "a stylish woman with an unconventional, interesting face"]
const LOOKS_M = ["a strikingly handsome man with strong features", "an average-looking guy, everyday relatable face", "a man in his thirties with stubble and a real, warm look", "a regular guy, a little awkward and genuine", "a rugged older man with a character-filled face", "a stylish guy with an unconventional, interesting face"]
const LOOKS_X = ["a striking androgynous person", "an ordinary-looking, real androgynous person"]
const gw = (g, n) => { const a = g === "female" ? LOOKS_F : g === "male" ? LOOKS_M : LOOKS_X; return a[hash(n + "look") % a.length] }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function imageUrl(prompt, seed) {
  if (FAL) {
    const r = await fetch(`https://fal.run/${FAL_MODEL}`, {
      method: "POST", headers: { Authorization: `Key ${FAL}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, seed, image_size: "portrait_4_3", num_inference_steps: 30, enable_safety_checker: true }),
    })
    if (!r.ok) return { err: `${r.status} ${(await r.text()).slice(0, 80)}` }
    const d = await r.json(); const url = d?.images?.[0]?.url; return url ? { url } : { err: "no url" }
  }
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST", headers: { Authorization: `Bearer ${TKEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "black-forest-labs/FLUX.1-schnell", prompt, seed, width: 768, height: 1024, steps: 4, n: 1 }),
    })
    if (r.status === 429) { await sleep((Number(r.headers.get("retry-after")) || (3 * (attempt + 1))) * 1000); continue }
    if (!r.ok) return { err: `${r.status} ${(await r.text()).slice(0, 80)}` }
    const d = await r.json(); const url = d?.data?.[0]?.url; return url ? { url } : { err: "no url" }
  }
  return { err: "429 retries exhausted" }
}

async function gen({ n, g }) {
  const s = slug(n)
  const out = path.join(CAST, `${s}.jpg`)
  if (fs.existsSync(out) && !FORCE) return { s, skip: true }
  const style = STYLES[hash(n) % STYLES.length]
  // No name in the prompt (FLUX renders it as text on the image). Per-name variety
  // comes from the seed + the look/style rotation instead.
  const prompt = `${BASE}, ${style}, portrait of ${gw(g, n)}. negative: ${NEG}`
  const res = await imageUrl(prompt, hash(n) % 2147483647)
  if (res.err) return { s, err: res.err }
  const img = await fetch(res.url, { headers: { "User-Agent": "Mozilla/5.0" } })
  if (!img.ok) return { s, err: `dl ${img.status}` }
  const buf = Buffer.from(await img.arrayBuffer())
  if (buf.length < 8000) return { s, err: "tiny" }
  fs.writeFileSync(out, buf)
  await sleep(FAL ? 120 : 400)
  return { s, ok: buf.length }
}

let i = 0, done = 0, made = 0, skip = 0
const errs = []
const CONC = 2
async function worker() {
  while (i < names.length) {
    const item = names[i++]
    try { const r = await gen(item); if (r.ok) made++; else if (r.skip) skip++; else errs.push(`${item.n}:${r.err}`) }
    catch (e) { errs.push(`${item.n}:${e.message}`) }
    done++
    if (done % 10 === 0 || done === names.length) console.log(`${done}/${names.length} — made ${made}, skipped ${skip}, err ${errs.length}`)
  }
}
await Promise.all(Array.from({ length: CONC }, () => worker()))
console.log(`DONE made=${made} skipped=${skip} err=${errs.length}`)
if (errs.length) console.log("errors:", errs.slice(0, 30).join(" | "))
