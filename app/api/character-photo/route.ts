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

export const runtime = "nodejs"
export const maxDuration = 90

const PROVIDER = (process.env.IMAGE_PROVIDER || "runpod").toLowerCase()
const RP_KEY   = process.env.RUNPOD_API_KEY || ""
const RP_IMG   = process.env.RUNPOD_IMAGE_ENDPOINT_ID || "6cpprak5lw3tjt" // SDXL we deployed
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
async function genRunpod(prompt: string): Promise<Buffer | null> {
  if (!RP_KEY || !RP_IMG) return null
  try {
    const res = await fetch(`https://api.runpod.ai/v2/${RP_IMG}/runsync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${RP_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: { prompt, negative_prompt: NEG, width: 768, height: 1024, num_inference_steps: 30, guidance_scale: 6 } }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return null
    const d = await res.json()
    let url: string = d?.output?.image_url || ""
    if (!url.startsWith("data:image")) {
      const imgs = d?.output?.images
      url = Array.isArray(imgs) && typeof imgs[0] === "string" ? imgs[0] : ""
    }
    if (!url.startsWith("data:image")) return null
    return Buffer.from(url.split(",", 2)[1], "base64")
  } catch { return null }
}

async function genFal(prompt: string): Promise<Buffer | null> {
  if (!FAL_KEY) return null
  // Default to FLUX.1-dev (photoreal, top quality). Set FAL_IMAGE_MODEL to
  // "fal-ai/flux-pro/v1.1" for the very strongest tier.
  const model = process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev"
  try {
    const res = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, image_size: "portrait_4_3", num_inference_steps: 30, enable_safety_checker: true }),
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
async function genTogether(prompt: string): Promise<Buffer | null> {
  if (!TOGETHER_KEY) return null
  try {
    const res = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${TOGETHER_KEY}`, "Content-Type": "application/json" },
      // Together returns a hosted URL by default; that's the most compatible path.
      body: JSON.stringify({ model: TOGETHER_MODEL, prompt, width: 768, height: 1024, steps: TOGETHER_STEPS, n: 1 }),
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
  // Fast path when on-demand photo gen is intentionally off (no funded image
  // provider) — return immediately so the client falls back to the monogram
  // identity card instead of hanging on a dead endpoint.
  if (PROVIDER === "none"
      || (PROVIDER === "runpod" && !RP_KEY)
      || (PROVIDER === "fal" && !FAL_KEY)
      || (PROVIDER === "together" && !TOGETHER_KEY)) {
    return Response.json({ error: "image generation disabled", disabled: true }, { status: 503 })
  }
  if (!hasAdmin()) return Response.json({ error: "storage unavailable" }, { status: 503 })

  let name = "", gender = "", world = "", desc = "", slug = ""
  try {
    const b = await request.json()
    name = String(b.name || "").trim()
    gender = String(b.gender || "")
    world = String(b.world || "")
    desc = String(b.description || "")
    slug = String(b.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  } catch { return Response.json({ error: "bad request" }, { status: 400 }) }
  if (!name) return Response.json({ error: "name required" }, { status: 400 })

  const prompt = buildPrompt(name, gender, world, desc)
  const bytes = PROVIDER === "together" ? await genTogether(prompt)
              : PROVIDER === "fal"      ? await genFal(prompt)
              :                           await genRunpod(prompt)
  if (!bytes || bytes.length < 8000) {
    return Response.json({ error: "generation failed", provider: PROVIDER }, { status: 502 })
  }

  // Persist to the public bucket. Unique path so it never collides.
  const admin = getAdminClient()
  const path = `${slug || "char"}-${bytes.length}-${Math.abs(hashStr(prompt))}.png`
  const { error } = await admin.storage.from("character-photos").upload(path, bytes, {
    contentType: "image/png", upsert: true,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data } = admin.storage.from("character-photos").getPublicUrl(path)
  return Response.json({ url: data.publicUrl })
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
