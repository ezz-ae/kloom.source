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

const KEY = process.env.TOGETHER_API_KEY
if (!KEY) { console.error("set TOGETHER_API_KEY"); process.exit(1) }

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

const BASE = "RAW photo, ultra realistic portrait photograph, shot on 85mm f/1.4, shallow depth of field, detailed natural skin texture, cinematic color grade, head and shoulders, looking at camera, sharp focus on eyes"
// SFW, late-night-floor cinematic styles — rotated deterministically per name.
const STYLES = [
  "night street with neon bokeh, candid fashion photography, effortless stylish look",
  "golden hour window light, warm intimate evening ambience, soft glow on skin",
  "blue hour ambient light, contemplative editorial portrait, timeless wardrobe",
  "moody low-key lighting with warm practical accents, upscale lounge, relaxed confidence",
  "soft beauty-dish studio key light, glossy magazine editorial look",
  "warm tungsten bar light, intimate late-night candid, soft film grain",
]
const NEG = "cartoon, illustration, 3d render, doll, plastic skin, deformed, text, watermark, nudity, nsfw, child"
const gw = (g) => g === "female" ? "strikingly beautiful young woman with captivating eyes"
  : g === "male" ? "strikingly handsome man with strong features"
  : "striking androgynous fashion model"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function gen({ n, g }) {
  const s = slug(n)
  const out = path.join(CAST, `${s}.jpg`)
  if (fs.existsSync(out)) return { s, skip: true }
  const style = STYLES[hash(n) % STYLES.length]
  const prompt = `${BASE}, ${style}, portrait of a ${gw(g)} named ${n}. negative: ${NEG}`
  // The free FLUX-schnell tier is rate-limited; retry 429s with backoff.
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "black-forest-labs/FLUX.1-schnell", prompt, width: 768, height: 1024, steps: 4, n: 1 }),
    })
    if (r.status === 429) { await sleep((Number(r.headers.get("retry-after")) || (3 * (attempt + 1))) * 1000); continue }
    if (!r.ok) return { s, err: `${r.status} ${(await r.text()).slice(0, 80)}` }
    const d = await r.json()
    const url = d?.data?.[0]?.url
    if (!url) return { s, err: "no url" }
    const img = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
    if (!img.ok) return { s, err: `dl ${img.status}` }
    const buf = Buffer.from(await img.arrayBuffer())
    if (buf.length < 8000) return { s, err: "tiny" }
    fs.writeFileSync(out, buf)
    await sleep(400)   // gentle pacing between successful calls
    return { s, ok: buf.length }
  }
  return { s, err: "429 retries exhausted" }
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
