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
      signal: AbortSignal.timeout(80000),
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
  try {
    const res = await fetch("https://fal.run/fal-ai/flux/dev", {
      method: "POST",
      headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, image_size: "portrait_4_3", num_inference_steps: 28, enable_safety_checker: true }),
      signal: AbortSignal.timeout(80000),
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

export async function POST(request: Request) {
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
  const bytes = PROVIDER === "fal" ? await genFal(prompt) : await genRunpod(prompt)
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
