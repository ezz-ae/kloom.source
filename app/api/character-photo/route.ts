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
import { isCleanPortrait, validatorReady } from "@/lib/face-validate"
import { rateLimit, clientIp, globalGate } from "@/lib/rate-limit"

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
// AIRRAW (diverse) wants MAXIMUM realism. The diverse path climbs a LADDER of Together
// FLUX models (best→cheapest) and uses the best the key can actually reach; a 4xx on a
// rung disables just that rung (per warm instance) so we never re-pay to rediscover the
// key's ceiling. Default ladder is FLUX.1-dev, then the schnell base as the floor.
//   • Pin one model with TOGETHER_REAL_MODEL (e.g. black-forest-labs/FLUX.1.1-pro).
//   • Or set TOGETHER_LADDER to a comma list to customise the climb.
const TOGETHER_LADDER: { model: string; steps: number }[] = (() => {
  const pin = process.env.TOGETHER_REAL_MODEL
  if (pin) return [{ model: pin, steps: Number(process.env.TOGETHER_REAL_STEPS || 28) }]
  const env = process.env.TOGETHER_LADDER
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean).map((m) => ({ model: m, steps: /pro/i.test(m) ? 0 : 28 }))
  return [{ model: "black-forest-labs/FLUX.1-dev", steps: 28 }]
})()
const togetherOff = new Set<string>()   // models this key can't use (cached 4xx)

const WORLD_STYLE: Record<string, string> = {
  // Adult floor categories
  stories:    "warm dim bedroom lamp, intimate close-up, soft focus, sensual atmosphere, late night mood",
  romance:    "golden hour window light, warm intimate evening ambience, soft glow on skin, seductive alluring gaze",
  roleplay:   "dramatic cinematic lighting, mysterious and seductive, costume or character styling, intense look",
  gfe:        "soft warm home lighting, natural intimate selfie vibe, warm smile, genuine connection",
  lesbian:    "soft pink neon accent lighting, feminine intimate setting, close warm gaze, sensual mood",
  gay:        "blue-teal dramatic lighting, masculine confident pose, intense eyes, club or gym setting",
  couples:    "warm candlelight, intimate private setting, confident welcoming expression",
  groups:     "party lighting with colored gels, nightclub or suite setting, bold seductive look",
  bdsm:       "deep red accent lighting, dark dramatic shadows, intense commanding expression, bold",
  wild:       "raw low-light photography, edgy bold look, daring confident expression, underground feel",
  // Original room categories
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

const BASE = "RAW photo, ultra realistic portrait photograph, shot on 85mm f/1.4, shallow depth of field, detailed natural skin texture, cinematic color grade, head and shoulders, looking at camera, sharp focus on eyes, a real ordinary adult"
// Anti-likeness: never resemble a real, recognizable person. Diffusion models reproduce
// famous faces when asked for "strikingly handsome / fashion model"; the ordinary wording
// above + these negatives keep every face a unique fictional stranger (likeness safety).
const NEG  = "celebrity, famous person, public figure, well-known model, recognizable actor, actress, influencer, deepfake, likeness of a real person, lookalike, supermodel, fashion-model face, " +
  "cartoon, painting, illustration, anime, 3d render, cgi, doll, plastic skin, airbrushed, text, watermark, deformed, extra fingers, bad anatomy, lowres, blurry, child, minor, underage"

function genderWord(g?: string) {
  return g === "male" ? "an ordinary attractive man with a normal realistic everyday face"
       : g === "female" ? "an ordinary attractive woman with a normal realistic everyday face"
       : "an ordinary attractive androgynous person with a normal realistic everyday face"
}

function buildPrompt(name: string, gender?: string, world?: string, desc?: string) {
  const style = (world && WORLD_STYLE[world]) || WORLD_STYLE.social
  const d = (desc || "").replace(/"/g, "").slice(0, 100)
  // NOTE: the name is deliberately NOT in the prompt — a fictional label like "Claude"
  // must never bias the face toward anything, and diffusion renders names as on-image text.
  return `${BASE}, ${style}, portrait of ${genderWord(gender)}, a completely fictional unique stranger${d ? `, ${d}` : ""}`
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
      body: JSON.stringify({ prompt, seed, image_size: "portrait_4_3", num_inference_steps: 30, enable_safety_checker: false }),
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
async function genTogether(prompt: string, seed: number, model = TOGETHER_MODEL, steps = TOGETHER_STEPS): Promise<Buffer | null> {
  if (!TOGETHER_KEY) return null
  try {
    // Together returns a hosted URL by default; that's the most compatible path.
    // pro models reject an explicit `steps` — omit it (steps<=0) and let them self-pick.
    const payload: Record<string, unknown> = { model, prompt, seed, width: 768, height: 1024, n: 1 }
    if (steps > 0) payload.steps = steps
    const res = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${TOGETHER_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) {
      // 4xx on a non-base model → the key can't use it; remember so we skip that rung.
      if (model !== TOGETHER_MODEL && res.status >= 400 && res.status < 500) togetherOff.add(model)
      console.error("together image error", model, res.status, (await res.text()).slice(0, 300)); return null
    }
    const d = await res.json()
    const url: string = d?.data?.[0]?.url || ""
    if (url) { const img = await fetch(url, { signal: AbortSignal.timeout(25000) }); if (img.ok) return Buffer.from(await img.arrayBuffer()) }
    const b64: string = d?.data?.[0]?.b64_json || ""
    if (b64) return Buffer.from(b64, "base64")
    console.error("together image: no url/b64 in response", JSON.stringify(d).slice(0, 300))
    return null
  } catch (e) { console.error("together image threw", e instanceof Error ? e.message : String(e)); return null }
}

// ── Realism pass ─────────────────────────────────────────────────────────────
// FLUX output is too smooth / plasticky / AI-vivid. This makes it read as a candid
// amateur phone photo: low-amplitude film grain + chroma noise, a gentle S-curve,
// a touch of desaturation, a soft vignette, a 1px edge chromatic aberration, then a
// JPEG re-encode so the file carries the real 8x8 compression artifacts FLUX lacks.
// @napi-rs/canvas ONLY (sharp unavailable; this lib already runs server-side in
// lib/face-validate.ts). FAIL-OPEN: any error returns the original bytes untouched.
const R_GRAIN      = floor0(process.env.REALISM_GRAIN, 7)     // luma grain amplitude (ISO-800-ish)
const R_CHROMA     = floor0(process.env.REALISM_CHROMA, 3)    // per-channel chroma noise
const R_CONTRAST   = numEnv(process.env.REALISM_CONTRAST, 0.10)
const R_DESAT      = numEnv(process.env.REALISM_DESAT, 0.06)
const R_VIGNETTE   = numEnv(process.env.REALISM_VIGNETTE, 0.16)
const R_ABERRATION = numEnv(process.env.REALISM_ABERRATION, 1) // px R/B split at edges (0 disables)
const R_JPEG_Q     = Math.max(60, Math.min(95, Number(process.env.REALISM_JPEG_QUALITY || 88)))

function numEnv(v: string | undefined, d: number): number { const n = Number(v); return Number.isFinite(n) ? n : d }
function floor0(v: string | undefined, d: number): number { const n = Number(v); return Number.isFinite(n) ? Math.max(0, n) : d }
// Cheap deterministic per-pixel noise (no Math.random over ~3M samples; stable grain).
function hashNoise(x: number): number {
  x = (x ^ 61) ^ (x >>> 16); x = x + (x << 3); x = x ^ (x >>> 4)
  x = Math.imul(x, 0x27d4eb2d); x = x ^ (x >>> 15)
  return ((x >>> 0) / 4294967295) * 2 - 1   // -1..1
}

async function realismPass(input: Buffer): Promise<Buffer> {
  if (!input || input.length < 1000) return input
  try {
    const rcanvas = await import("@napi-rs/canvas")
    const img = await rcanvas.loadImage(input)
    const w = img.width, h = img.height
    if (!w || !h || w > 4096 || h > 4096) return input

    const c = rcanvas.createCanvas(w, h)
    const ctx = c.getContext("2d")
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, w, h)
    const d = imageData.data

    // Gentle symmetric S-curve LUT (lifts mid contrast, soft toes).
    const lut = new Uint8Array(256)
    const k = R_CONTRAST * 4
    const s0 = 1 / (1 + Math.exp(k * 0.5)), s1 = 1 / (1 + Math.exp(-k * 0.5))
    for (let v = 0; v < 256; v++) {
      const x = v / 255
      const s = 1 / (1 + Math.exp(-k * (x - 0.5)))
      const norm = (s - s0) / (s1 - s0)
      const out = x * (1 - R_CONTRAST) + norm * R_CONTRAST
      lut[v] = Math.max(0, Math.min(255, Math.round(out * 255)))
    }

    const cx = (w - 1) / 2, cy = (h - 1) / 2
    const maxd2 = cx * cx + cy * cy
    let i = 0
    for (let y = 0; y < h; y++) {
      const dy = y - cy
      for (let x = 0; x < w; x++, i += 4) {
        let r = lut[d[i]], g = lut[d[i + 1]], b = lut[d[i + 2]]
        if (R_DESAT > 0) {
          const luma = 0.299 * r + 0.587 * g + 0.114 * b
          r += (luma - r) * R_DESAT; g += (luma - g) * R_DESAT; b += (luma - b) * R_DESAT
        }
        const n = hashNoise(i) * R_GRAIN
        r += n; g += n; b += n
        if (R_CHROMA > 0) { r += hashNoise(i + 1) * R_CHROMA; g += hashNoise(i + 7) * R_CHROMA; b += hashNoise(i + 13) * R_CHROMA }
        if (R_VIGNETTE > 0) {
          const dx = x - cx
          const f = 1 - R_VIGNETTE * ((dx * dx + dy * dy) / maxd2)
          r *= f; g *= f; b *= f
        }
        d[i]     = r < 0 ? 0 : r > 255 ? 255 : r
        d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g
        d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b
      }
    }

    // Micro chromatic aberration: edge-weighted 1px R/B split (face is near center → ~0).
    if (R_ABERRATION > 0) {
      const src = Uint8ClampedArray.from(d)
      let p = 0
      for (let y = 0; y < h; y++) {
        const dy = y - cy
        for (let x = 0; x < w; x++, p += 4) {
          const dx = x - cx
          const edge = Math.sqrt((dx * dx + dy * dy) / maxd2)
          const sh = Math.round(R_ABERRATION * edge) * (dx < 0 ? -1 : 1)
          if (sh !== 0) {
            const rx = x - sh, bx = x + sh
            if (rx >= 0 && rx < w) d[p]     = src[(y * w + rx) * 4]
            if (bx >= 0 && bx < w) d[p + 2] = src[(y * w + bx) * 4 + 2]
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
    const out = c.toBuffer("image/jpeg", R_JPEG_Q)   // real JPEG artifacts FLUX never has
    return out && out.length > 1000 ? out : input
  } catch {
    return input   // FAIL-OPEN
  }
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
  // The realism pass re-encodes to JPEG; version the cache key so existing (plastic)
  // PNGs miss the HEAD check and regenerate through the pass. REALISM_OFF=1 keeps PNG.
  const realismOn = process.env.REALISM_OFF !== "1"
  const realismVersion = process.env.REALISM_VERSION || "r3"
  const path = realismOn
    ? `${slug || "char"}-${seed}-${realismVersion}.jpg`
    : `${slug || "char"}-${seed}.png`
  const existing = admin.storage.from("character-photos").getPublicUrl(path).data.publicUrl
  try {
    const head = await fetch(existing, { method: "HEAD", signal: AbortSignal.timeout(6000) })
    if (head.ok && Number(head.headers.get("content-length") || 0) > 8000) {
      return Response.json({ url: existing, cached: true, model: "cached" })
    }
  } catch { /* not cached → generate */ }

  // One generation at a given diffusion seed (the prompt — i.e. the persona — is
  // fixed; only the pixels change with the seed). diverse → try photoreal FLUX.1-dev,
  // fall back to schnell if the key lacks dev.
  let genErr = ""
  let usedModel = ""   // which engine/model actually produced the bytes (diagnostic)
  const genWithSeed = async (dseed: number): Promise<Buffer | null> => {
    if (provider === "qwen") { const r = await genQwen(prompt, negative, dseed); genErr = r.error || ""; if (r.bytes) usedModel = "qwen"; return r.bytes }
    if (provider === "together") {
      // Diverse → climb the photoreal ladder (best the key can reach), then schnell floor.
      if (dp) {
        for (const rung of TOGETHER_LADDER) {
          if (togetherOff.has(rung.model)) continue
          const b = await genTogether(prompt, dseed, rung.model, rung.steps)
          if (b) { usedModel = rung.model; return b }
        }
      }
      // Together can't reach a photoreal model (key schnell-capped) → FAL flux (photoreal,
      // independent of the Together tier). Fires automatically the moment FAL_KEY is set —
      // no provider switch, no rebuild. Falls through to the schnell floor if FAL is absent.
      if (dp && FAL_KEY) {
        const fb = await genFal(prompt, dseed)
        if (fb) { usedModel = process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev"; return fb }
      }
      const b = await genTogether(prompt, dseed)   // schnell base (the floor)
      if (b) usedModel = TOGETHER_MODEL
      return b
    }
    if (provider === "fal") { const b = await genFal(prompt, dseed); if (b) usedModel = process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev"; return b }
    const b = await genRunpod(prompt, negative, dseed); if (b) usedModel = "runpod-sdxl"; return b
  }

  // Generate + quality-gate (AIRRAW only): a good portrait is exactly ONE clean human
  // face. A broken render (no face / two faces / artifacts) gets retried with a new
  // diffusion seed for the SAME persona, so a bad face never gets cached. The face
  // check is fail-open, so it can never block generation.
  //
  // Cost guard — placed HERE (after the cache HEAD check), NOT at the top of the
  // handler: a planet viewport loads MANY faces at once and almost all are cache hits
  // (make-once, deterministic by name), so gating the whole endpoint 429'd legit face
  // loads and made faces vanish/repeat on the floor. Only a real GENERATION (cache miss)
  // is billable, so only it is gated: globalGate = daily kill-cap; the per-IP limit
  // stops an abuser varying the name to force fresh renders. (Hard FAL dashboard spend
  // limit is still the real dollar backstop.)
  const gate = globalGate()
  if (!gate.ok) return Response.json({ error: "at capacity" }, { status: 503, headers: { "Retry-After": "120" } })
  const rl = rateLimit(`imggen:${clientIp(request)}`, 30, 60_000)
  if (!rl.ok) return Response.json({ error: "slow down" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

  let bytes: Buffer | null = null
  const MAX_TRIES = dp ? 3 : 1
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const b = await genWithSeed((seed + attempt * 7919) % 2147483647)
    if (!b || b.length < 8000) continue
    bytes = b                                       // keep the latest good bytes (best-effort)
    if (!dp || (await isCleanPortrait(b))) break    // single clean face (or non-diverse) → done
  }
  if (!bytes || bytes.length < 8000) {
    return Response.json({ error: "generation failed", provider, detail: genErr || undefined }, { status: 502 })
  }

  // Realism pass: make FLUX output read as a candid amateur phone photo. Fail-open.
  if (realismOn) bytes = await realismPass(bytes)

  // Persist to the public bucket at the seed-keyed path (computed above).
  const { error } = await admin.storage.from("character-photos").upload(path, bytes, {
    contentType: realismOn ? "image/jpeg" : "image/png", upsert: true,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(
    { url: existing, model: usedModel || "none", gated: dp ? await validatorReady() : false },
    { headers: { "X-Img-Model": usedModel || "none" } },
  )
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
