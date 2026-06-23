// POST /api/character-photo — generate a character portrait on demand and
// persist it to Supabase Storage. Returns { url }.
//
// Model-agnostic. Pick the engine with IMAGE_PROVIDER:
//   runpod (default) — RUNPOD_IMAGE_ENDPOINT_ID on RunPod (SDXL today; point it
//                      at a Flux endpoint for the strong model, no code change).
//   fal              — Flux.1-dev via fal.ai. Set FAL_KEY. This is the
//                      "real strong model" path — photoreal, top quality.
//
// The generated image is uploaded to the public `character-photos` bucket so
// the URL is permanent and cheap to serve.

import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"
import { buildPortraitPrompt } from "@/lib/airraw/portrait-prompt"

export const runtime = "nodejs"
export const maxDuration = 120

const PROVIDER = (process.env.IMAGE_PROVIDER || "runpod").toLowerCase()
const RP_KEY   = process.env.RUNPOD_API_KEY || ""
const RP_IMG   = process.env.RUNPOD_IMAGE_ENDPOINT_ID || "6cpprak5lw3tjt" // SDXL we deployed
const RP_QWEN  = process.env.RUNPOD_QWEN_ENDPOINT_ID || "xjxxy35917x09e"  // Qwen-Image lora
const FAL_KEY  = process.env.FAL_KEY || ""
// Together AI hosts FLUX.1 — the simplest "real model" path since TOGETHER_API_KEY
// is already configured. FLUX.1-schnell-Free is free + fast (4 steps).
const TOGETHER_KEY   = process.env.TOGETHER_API_KEY || ""
const TOGETHER_MODEL = process.env.TOGETHER_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell"
const TOGETHER_STEPS = Number(process.env.TOGETHER_IMAGE_STEPS || (TOGETHER_MODEL.includes("schnell") ? "4" : "28"))

const WORLD_STYLE: Record<string, string> = {
  fantasy:        "fantasy film still, elaborate costume, ethereal violet practical lighting, cinematic",
  romantic:       "golden hour window light, warm intimate evening ambience, soft glow on skin, alluring gaze",
  dark:           "moody low-key lighting with deep red gel accents, smoky upscale nightclub, sultry expression",
  social:         "night street with neon bokeh, candid fashion photography, effortless stylish look",
  trading:        "modern trading office at night, soft monitor glow, sharp tailored clothing, confident",
  workshop:       "industrial creative loft, warm practical lights, candid documentary portrait",
  creator:        "beauty-dish studio lighting, glossy fashion magazine editorial look",
  professional:   "clean corporate editorial headshot, soft key light, composed",
  philosophy:     "blue hour ambient light, contemplative editorial portrait, timeless wardrobe",
  "co-intelligence": "cool teal accent lighting, minimalist studio editorial portrait",
  "zero-memory":  "dim atmospheric underpass light, partial shadow across face, mysterious mood",
}

const BASE = "RAW photo, ultra realistic portrait photograph, shot on 85mm f/1.4, shallow depth of field, detailed natural skin texture, cinematic color grade, head and shoulders, looking at camera, sharp focus on eyes"
const NEG  = "cartoon, painting, illustration, anime, 3d render, cgi, doll, plastic skin, airbrushed, text, watermark, deformed, extra fingers, bad anatomy, lowres, blurry, nudity, nsfw, child"

function genderWord(g?: string) {
  return g === "male" ? "strikingly handsome man with strong features"
       : g === "female" ? "strikingly beautiful young woman with captivating eyes"
       : "striking androgynous fashion model"
}

function buildPrompt(name: string, gender?: string, world?: string, desc?: string) {
  const style = (world && WORLD_STYLE[world]) || WORLD_STYLE.social
  const d = (desc || "").replace(/"/g, "").slice(0, 100)
  return `${BASE}, ${style}, portrait of a ${genderWord(gender)} named ${name}, ${d}`
}

// ── Engines → return PNG/JPEG bytes ──────────────────────────────────────────

// Pull image bytes out of whatever shape a RunPod image worker returns:
// data-URL, bare base64, or a hosted URL — in output.image_url / image / images[].
async function bytesFromRunpodOutput(o: unknown): Promise<Buffer | null> {
  const out = (o || {}) as Record<string, unknown>
  const candidates: unknown[] = [
    out.image_url, out.image, out.image_base64,
    Array.isArray(out.images) ? out.images[0] : undefined,
    Array.isArray(out.images) && out.images[0] && typeof out.images[0] === "object"
      ? (out.images[0] as Record<string, unknown>).image || (out.images[0] as Record<string, unknown>).url
      : undefined,
  ]
  for (const c of candidates) {
    if (typeof c !== "string" || !c) continue
    if (c.startsWith("data:image")) return Buffer.from(c.split(",", 2)[1], "base64")
    if (/^https?:\/\//.test(c)) {
      try { const r = await fetch(c, { signal: AbortSignal.timeout(20000) }); if (r.ok) return Buffer.from(await r.arrayBuffer()) } catch { /* */ }
      continue
    }
    if (/^[A-Za-z0-9+/=\s]+$/.test(c) && c.length > 256) return Buffer.from(c.replace(/\s/g, ""), "base64") // bare base64
  }
  return null
}

async function genRunpod(prompt: string, negative: string, seed: number, endpoint = RP_IMG): Promise<Buffer | null> {
  if (!RP_KEY || !endpoint) return null
  try {
    const res = await fetch(`https://api.runpod.ai/v2/${endpoint}/runsync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${RP_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: { prompt, negative_prompt: negative, width: 768, height: 1024, num_inference_steps: 30, guidance_scale: 6, seed } }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) return null
    return bytesFromRunpodOutput((await res.json())?.output)
  } catch { return null }
}

// Qwen-Image lora (RunPod). Async /run + poll — Qwen image gen is slower and the
// endpoint cold-starts, so don't block on /runsync. Surfaces the worker error.
async function genQwen(prompt: string, negative: string, seed: number): Promise<{ bytes: Buffer | null; error?: string }> {
  if (!RP_KEY || !RP_QWEN) return { bytes: null, error: "qwen not configured" }
  const base = `https://api.runpod.ai/v2/${RP_QWEN}`
  const headers = { Authorization: `Bearer ${RP_KEY}`, "Content-Type": "application/json" }
  try {
    const start = await fetch(`${base}/run`, {
      method: "POST", headers,
      body: JSON.stringify({ input: { prompt, negative_prompt: negative, width: 768, height: 1024, num_inference_steps: 24, true_cfg_scale: 4, guidance_scale: 4, seed } }),
      signal: AbortSignal.timeout(20000),
    })
    if (!start.ok) return { bytes: null, error: `http ${start.status}: ${(await start.text().catch(() => "")).slice(0, 160)}` }
    let data = await start.json()
    const id = data?.id
    let tries = 0
    while ((data?.status === "IN_QUEUE" || data?.status === "IN_PROGRESS") && tries < 40) {
      await new Promise((r) => setTimeout(r, 2500))
      const s = await fetch(`${base}/status/${id}`, { headers })
      if (!s.ok) return { bytes: null, error: `poll http ${s.status}` }
      data = await s.json(); tries++
    }
    if (data?.status !== "COMPLETED") return { bytes: null, error: `status=${data?.status}; ${JSON.stringify(data?.error || "").slice(0, 200)}` }
    return { bytes: await bytesFromRunpodOutput(data?.output) }
  } catch (e) { return { bytes: null, error: e instanceof Error ? e.message : String(e) } }
}

async function genFal(prompt: string, seed: number): Promise<Buffer | null> {
  if (!FAL_KEY) return null
  // Default to FLUX.1-dev (photoreal, top quality). Set FAL_IMAGE_MODEL to
  // "fal-ai/flux-pro/v1.1" for the very strongest tier.
  const model = process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev"
  try {
    const res = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, seed, image_size: "portrait_4_3", num_inference_steps: 30, enable_safety_checker: true }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) return null
    const d = await res.json()
    const imgUrl: string = d?.images?.[0]?.url || ""
    if (!imgUrl) return null
    const img = await fetch(imgUrl, { signal: AbortSignal.timeout(20000) })
    if (!img.ok) return null
    return Buffer.from(await img.arrayBuffer())
  } catch { return null }
}

// Together AI → FLUX.1. Returns image bytes (or null).
async function genTogether(prompt: string, seed: number): Promise<Buffer | null> {
  if (!TOGETHER_KEY) return null
  try {
    const res = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${TOGETHER_KEY}`, "Content-Type": "application/json" },
      // Together returns a hosted URL by default; that's the most compatible path.
      body: JSON.stringify({ model: TOGETHER_MODEL, prompt, seed, width: 768, height: 1024, steps: TOGETHER_STEPS, n: 1 }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) { console.error("together image error", res.status, (await res.text()).slice(0, 300)); return null }
    const d = await res.json()
    const url: string = d?.data?.[0]?.url || ""
    if (url) { const img = await fetch(url, { signal: AbortSignal.timeout(25000) }); if (img.ok) return Buffer.from(await img.arrayBuffer()) }
    const b64: string = d?.data?.[0]?.b64_json || ""
    if (b64) return Buffer.from(b64, "base64")
    console.error("together image: no url/b64 in response", JSON.stringify(d).slice(0, 300))
    return null
  } catch (e) { console.error("together image threw", e instanceof Error ? e.message : String(e)); return null }
}

export async function POST(request: Request) {
  let name = "", gender = "", world = "", desc = "", slug = "", seedKey = ""
  let diverse = false, providerOverride = ""
  try {
    const b = await request.json()
    name = String(b.name || "").trim()
    gender = String(b.gender || "")
    world = String(b.world || "")
    desc = String(b.description || "")
    diverse = b.diverse === true || b.diverse === 1
    providerOverride = String(b.provider || "").toLowerCase()
    seedKey = String(b.seed || b.slug || name)
    slug = String(b.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  } catch { return Response.json({ error: "bad request" }, { status: 400 }) }
  if (!name) return Response.json({ error: "name required" }, { status: 400 })

  const provider = providerOverride || PROVIDER

  // Fast path when this provider isn't usable — return immediately so the client
  // falls back to the monogram identity card instead of hanging on a dead endpoint.
  if (provider === "none"
      || ((provider === "runpod" || provider === "qwen") && !RP_KEY)
      || (provider === "fal" && !FAL_KEY)
      || (provider === "together" && !TOGETHER_KEY)) {
    return Response.json({ error: "image generation disabled", disabled: true }, { status: 503 })
  }
  if (!hasAdmin()) return Response.json({ error: "storage unavailable" }, { status: 503 })

  // DIVERSE builder (AIRRAW): every persona a unique mix of race/age/look/style, no
  // duplicates. Otherwise the legacy single-look builder (kloom create).
  const dp = diverse ? buildPortraitPrompt(seedKey, gender, world, desc) : null
  const prompt = dp ? dp.prompt : buildPrompt(name, gender, world, desc)
  const negative = dp ? dp.negative : NEG
  const seed = dp ? dp.seed : Math.abs(hashStr(seedKey)) % 2147483647

  // Make-once, cache-forever: each unique persona (slug+seed) is generated exactly
  // ONCE across all users. If the file already exists, return it instantly — no
  // regeneration, no cost, and never a duplicate. This is what makes "every face
  // live" affordable.
  const admin = getAdminClient()
  const path = `${slug || "char"}-${seed}.png`
  const existing = admin.storage.from("character-photos").getPublicUrl(path).data.publicUrl
  try {
    const head = await fetch(existing, { method: "HEAD", signal: AbortSignal.timeout(6000) })
    if (head.ok && Number(head.headers.get("content-length") || 0) > 8000) {
      return Response.json({ url: existing, cached: true })
    }
  } catch { /* not cached → generate */ }

  let bytes: Buffer | null = null
  let genErr = ""
  if (provider === "qwen") { const r = await genQwen(prompt, negative, seed); bytes = r.bytes; genErr = r.error || "" }
  else if (provider === "together") bytes = await genTogether(prompt, seed)
  else if (provider === "fal")      bytes = await genFal(prompt, seed)
  else                              bytes = await genRunpod(prompt, negative, seed)
  if (!bytes || bytes.length < 8000) {
    return Response.json({ error: "generation failed", provider, detail: genErr || undefined }, { status: 502 })
  }

  // Persist to the public bucket at the seed-keyed path (computed above).
  const { error } = await admin.storage.from("character-photos").upload(path, bytes, {
    contentType: "image/png", upsert: true,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ url: existing })
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
