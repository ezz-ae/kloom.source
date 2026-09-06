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
import { buildPortraitPrompt, PROMPT_FINGERPRINT } from "@/lib/airraw/portrait-prompt"
import { isCleanPortrait, validatorReady } from "@/lib/face-validate"
import { rateLimit, clientIp, globalGate } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 120

// TWO SEPARATE QUESTIONS, and conflating them is what broke this.
//
// IMAGE_PROVIDER names the DIFFUSION ENGINE — the fallback chain. It was set to
// "fal" on the AIRRAW deployment, and fal's key is being rejected (403 in the
// live logs), so every new face was failing outright: "generation failed,
// provider: fal". Not ugly — absent.
//
// GOOGLE_FIRST is the separate question of whether to try the good engine before
// that chain. It deliberately does NOT read IMAGE_PROVIDER, because requiring an
// env change to get working faces is how you end up with a dead provider pinned
// in production and nobody noticing. Google runs first on AIRRAW whenever a
// Gemini key exists; whatever IMAGE_PROVIDER names stays exactly where it was,
// as the thing that catches a refusal.
//
// GOOGLE_IMAGE_OFF=1 turns it back off, so this is still an operator decision —
// it just is not one you have to make to get a face at all.
//
// Kloom is excluded: different product, different images, and it should not have
// its engine changed by a fix aimed at the adult floor's faces.
const PROVIDER = (process.env.IMAGE_PROVIDER || "runpod").toLowerCase()
const GOOGLE_FIRST =
  process.env.AIRRAW_HOME === "1"
  && !!process.env.GEMINI_API_KEY
  && process.env.GOOGLE_IMAGE_OFF !== "1"
const RP_KEY   = process.env.RUNPOD_API_KEY || ""
const RP_IMG   = process.env.RUNPOD_IMAGE_ENDPOINT_ID || "6cpprak5lw3tjt" // SDXL we deployed
const RP_QWEN  = process.env.RUNPOD_QWEN_ENDPOINT_ID || "xjxxy35917x09e"  // Qwen-Image lora
const FAL_KEY  = process.env.FAL_KEY || ""
// Together AI hosts FLUX.1 — the simplest "real model" path since TOGETHER_API_KEY
// is already configured. FLUX.1-schnell-Free is free + fast (4 steps).
const TOGETHER_KEY   = process.env.TOGETHER_API_KEY || ""
// The FLOOR is a LIST, not one model.
//
// Together moves models between serverless and dedicated-endpoint-only, and when
// one moves the API answers 400 "Unable to access non-serverless model … please
// create a dedicated endpoint". Pinning a single name meant that the day
// FLUX.1-schnell stopped being serverless, every portrait on the floor failed —
// with a working key and a healthy account. The route now walks candidates and
// remembers which ones the account cannot reach, so a model going dedicated
// costs one failed request per instance instead of the whole feature.
const TOGETHER_FLOOR: string[] = (process.env.TOGETHER_IMAGE_MODEL || "").trim()
  ? [process.env.TOGETHER_IMAGE_MODEL!.trim()]
  : ["black-forest-labs/FLUX.1-schnell-Free", "black-forest-labs/FLUX.1-schnell", "black-forest-labs/FLUX.1-dev"]
const TOGETHER_MODEL = TOGETHER_FLOOR[0]
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
// "The account is throttled" — distinct from "this model failed", because the
// right response is to WAIT, not to ask the next model the same question.
const RATE_LIMITED = Symbol("together-rate-limited")
// How many reachable models one request may try before giving up. Unreachable
// ones are remembered and skipped for free; this bounds the walk on a bad night
// so a single card can't spend its whole 120s and be killed mid-generation.
const WALK_MAX = Math.max(1, Number(process.env.TOGETHER_WALK_MAX || 4))
// FAL with a dead key: 401 on every fallback, forever, one wasted round trip per
// face. Latched off with the same TTL as the Together breaker.
let falOffUntil = 0

/**
 * When the image provider REJECTS THE KEY, stop asking.
 *
 * A rejected key does not recover by being tried again, but every failed
 * generation was answered with a 502 — which reads as transient, so the client
 * re-requested on every render and each one burned a provider round-trip. That
 * is the "character-photo 502s correlated with upstream auth errors" alert: one
 * dead credential turned into sustained traffic against a paid API.
 *
 * Latched with a TTL rather than forever, because the cure (top up the account,
 * rotate the key) happens outside this process and the route must heal on its
 * own without a redeploy.
 */
const AUTH_OFF_MS = 10 * 60_000
let authOffUntil = 0
const providerRejected = () => Date.now() < authOffUntil
function markProviderRejected(provider: string, status: number) {
  authOffUntil = Date.now() + AUTH_OFF_MS
  console.error(`[character-photo] ${provider} rejected the key (${status}) — pausing generation for ${AUTH_OFF_MS / 60000}m`)
}

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
  if (!FAL_KEY || Date.now() < falOffUntil) return null
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
    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.status === 402) {
        falOffUntil = Date.now() + AUTH_OFF_MS
        console.error(`[character-photo] fal rejected the key (${res.status}) — skipping fal for ${AUTH_OFF_MS / 60000}m`)
      }
      return null
    }
    const d = await res.json()
    const imgUrl: string = d?.images?.[0]?.url || ""
    if (!imgUrl) return null
    const img = await fetch(imgUrl, { signal: AbortSignal.timeout(20000) })
    if (!img.ok) return null
    return Buffer.from(await img.arrayBuffer())
  } catch { return null }
}

/**
 * GOOGLE (Gemini / Imagen) — the quality tier.
 *
 * Added because the diffusion output the other engines were producing looked
 * cheap: Together's schnell floor is a fast model, and when the account is
 * throttled off the photoreal ladder (which the live logs show constantly —
 * hundreds of 429s a day) every face falls to it. Google's image models are a
 * long way better at a human face than a 4-step distillation is.
 *
 * ── THE THING TO KNOW BEFORE RELYING ON THIS ─────────────────────────────────
 *
 * Google WILL refuse this product's harder prompts. Their policy prohibits
 * sexual content, and no key or setting opts out of it, so a scene prompt comes
 * back blocked rather than rendered. That is not a bug to work around and it is
 * not something to try to talk past — it is why `REFUSED` is a distinct result
 * from a failure, and why the caller falls straight through to the existing
 * engines when it happens.
 *
 * In practice this splits cleanly: a PORTRAIT is a face, and faces are exactly
 * what Google is best at and happy to draw, so the floor's 2,980 faces get the
 * good engine. Explicit scene media keeps the engines that will actually render
 * it. Nothing is lost by trying Google first, because a refusal costs one
 * request and the fallback is what would have run anyway.
 *
 * ── DETERMINISM ──────────────────────────────────────────────────────────────
 *
 * generateContent takes no seed, so this cannot reproduce a face from a seed the
 * way the diffusion engines can. It does not need to: the route is make-once /
 * cache-forever, keyed on slug+seed+prompt-fingerprint, so a person's face is
 * generated a single time and served from storage ever after. The cache IS the
 * determinism. (Imagen's predict endpoint does take a seed, and it is passed
 * when that is the model in play.)
 */
const REFUSED = Symbol("google-refused")
const GEMINI_KEY = process.env.GEMINI_API_KEY || ""
const G_BASE = "https://generativelanguage.googleapis.com/v1beta"
let googleOffUntil = 0
let googleModelCache: { at: number; model: string } | null = null

/**
 * Which Google image model this key can actually run.
 *
 * Read from the API rather than pinned, for the same reason the Together lookup
 * exists: model names move, availability is per-account, and a hardcoded guess
 * fails as "no images" with nothing in the log explaining why. GOOGLE_IMAGE_MODEL
 * overrides it outright when you know what you want.
 */
async function googleImageModel(): Promise<string> {
  const forced = process.env.GOOGLE_IMAGE_MODEL || ""
  if (forced) return forced
  if (googleModelCache && Date.now() - googleModelCache.at < 30 * 60_000) return googleModelCache.model
  let model = "gemini-2.5-flash-image"
  try {
    const res = await fetch(`${G_BASE}/models?key=${encodeURIComponent(GEMINI_KEY)}&pageSize=200`, {
      signal: AbortSignal.timeout(12_000),
    })
    if (res.ok) {
      const d = await res.json()
      const names: string[] = (d?.models || [])
        .filter((m: Record<string, unknown>) => {
          const methods = (m?.supportedGenerationMethods as string[]) || []
          return methods.includes("generateContent") || methods.includes("predict")
        })
        .map((m: Record<string, unknown>) => String(m?.name || "").replace(/^models\//, ""))
      // RANK them. A plain descending sort picked "gemini-3.1-flash-lite-image"
      // out of six candidates — alphabetically it wins, and it is the cheapest,
      // weakest model on the list. Sorting strings is not choosing a model.
      //
      // The ranking is deliberately NOT "best model wins". It is:
      //   flash (stable) > flash (preview) > pro > lite
      // Flash sits above pro on purpose. A face is generated once and cached
      // forever, but the cast is thousands of people, and pro costs several times
      // as much per image — on an account with no budget that is the difference
      // between a nice face and a bill nobody can pay. Lite is bottom because it
      // is what produced the faces this change exists to replace.
      //
      // GOOGLE_IMAGE_MODEL=gemini-3-pro-image takes the top tier deliberately,
      // which is the right call once there is money coming in.
      const imaging = names.filter((n) => /image|imagen/i.test(n) && !/vision|embed/i.test(n))
      const score = (n: string) => {
        let v = 0
        if (/lite/i.test(n)) v -= 400              // the cheap tier, and it looks it
        else if (/flash/i.test(n)) v += 300
        if (/imagen/i.test(n)) v += 200            // dedicated image model
        if (/preview|exp/i.test(n)) v -= 150       // stable beats preview
        const m = n.match(/(\d+(?:\.\d+)?)/)      // version, as a tiebreak only
        if (m) v += Math.min(99, Number(m[1]) * 10)
        return v
      }
      if (imaging.length) {
        imaging.sort((a, b) => score(b) - score(a) || b.localeCompare(a, "en", { numeric: true }))
        model = imaging[0]
      }
      console.log(`[character-photo] google image models: ${imaging.slice(0, 6).join(", ") || "(none listed)"} → using ${model}`)
    }
  } catch { /* keep the default; a failed lookup must not stop generation */ }
  googleModelCache = { at: Date.now(), model }
  return model
}

async function genGoogle(prompt: string, seed: number): Promise<Buffer | null | typeof REFUSED> {
  if (!GEMINI_KEY || Date.now() < googleOffUntil) return null
  const model = await googleImageModel()
  const imagen = /imagen/i.test(model)
  try {
    const res = await fetch(`${G_BASE}/models/${encodeURIComponent(model)}:${imagen ? "predict" : "generateContent"}?key=${encodeURIComponent(GEMINI_KEY)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(imagen
        ? { instances: [{ prompt }], parameters: { sampleCount: 1, seed, aspectRatio: "3:4", personGeneration: "allow_adult" } }
                // ASPECT RATIO has to be asked for. Without imageConfig this endpoint
        // returns whatever shape it likes — a live sample came back 1408x768
        // landscape, which is useless for a face card the whole UI lays out as
        // 3:4 portrait. The diffusion engines were always told the size; this one
        // has to be told too.
        : { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } } }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!res.ok) {
      const txt = (await res.text().catch(() => "")).slice(0, 300)
      if (res.status === 401 || res.status === 403) {
        googleOffUntil = Date.now() + AUTH_OFF_MS
        console.error(`[character-photo] google rejected the key (${res.status}) — skipping google for ${AUTH_OFF_MS / 60000}m`)
        return null
      }
      // A 400 on this API is usually the safety layer, not a malformed request.
      if (res.status === 400 && /safety|blocked|prohibit/i.test(txt)) return REFUSED
      console.error(`[character-photo] google ${res.status}: ${txt}`)
      return null
    }
    const d = await res.json()
    // Refusal comes back as a 200 with no image and a reason, which is why this
    // is checked before the parts are read rather than after they come up empty.
    const reason = String(d?.promptFeedback?.blockReason || d?.candidates?.[0]?.finishReason || "")
    if (/SAFETY|PROHIBITED|BLOCK|RECITATION/i.test(reason)) return REFUSED
    const b64 = imagen
      ? d?.predictions?.[0]?.bytesBase64Encoded
      : (d?.candidates?.[0]?.content?.parts || []).find((x: Record<string, unknown>) => (x as { inlineData?: { data?: string } })?.inlineData?.data)?.inlineData?.data
    if (!b64) return REFUSED   // 200, no image, no stated reason — treat as a refusal and fall through
    return Buffer.from(String(b64), "base64")
  } catch { return null }
}

/**
 * Ask Together which image models THIS ACCOUNT can actually run.
 *
 * The floor was a hardcoded guess, and guessing is how we got here: Together
 * moves models between serverless and dedicated-endpoint-only, availability is
 * per-plan, and the account came back "unable to access non-serverless model"
 * for every FLUX name we knew. Rather than keep pinning names and redeploying to
 * find out, read the list — the key is right here, and /v1/models returns what
 * the account is entitled to.
 *
 * Same shape as the ElevenLabs voice discovery: read-only, cached per instance,
 * and it degrades to the hardcoded list rather than failing shut.
 */
let discovered: string[] | null = null
let discoveredAt = 0
const DISCOVER_TTL = 6 * 60 * 60_000

async function togetherImageModels(): Promise<string[]> {
  if (discovered && Date.now() - discoveredAt < DISCOVER_TTL) return discovered
  try {
    const r = await fetch("https://api.together.xyz/v1/models", {
      headers: { Authorization: `Bearer ${TOGETHER_KEY}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) { console.error("[character-photo] model list", r.status); return [] }
    const raw = (await r.json()) as unknown
    const list = Array.isArray(raw) ? raw : (raw as { data?: unknown[] })?.data || []
    const ids = (list as Array<{ id?: string; type?: string }>)
      .filter((m) => String(m?.type || "").toLowerCase() === "image" && m?.id)
      .map((m) => m.id as string)
    // Rank them. This is not "prefer FLUX" — the live account turned out to hold
    // 29 image models and NONE of the FLUX.1 family the old floor named, which is
    // why guessing failed. What it has is FLUX.2, Seedream, Imagen, Qwen-Image
    // and friends, so the ordering has to be about what makes a good PORTRAIT
    // cheaply, not about a family name:
    //
    //   • kontext is an image EDITING model — it wants an input image, and asking
    //     it for text-to-image is a wasted call. The first live run picked
    //     kontext-pro on name alone. Demoted hard.
    //   • dev / flex tiers before pro / max: this generates a few hundred
    //     portraits, once, and the pro tiers cost several times more for a face
    //     that will be seen at 400px.
    const score = (id: string) => {
      if (/kontext/i.test(id)) return 90              // editing model, not text-to-image
      let n = /flux/i.test(id) ? 0 : /seedream|imagen|qwen-image|ideogram/i.test(id) ? 10 : 30
      if (/flux\.?2/i.test(id)) n -= 2                 // the generation this account actually has
      if (/dev|flex|lightning|fast/i.test(id)) n -= 3  // cheap tiers first
      if (/pro|max|ultra/i.test(id)) n += 4            // capable, and several times the price
      return n
    }
    ids.sort((a, b) => score(a) - score(b) || a.localeCompare(b))
    discovered = ids
    discoveredAt = Date.now()
    console.log(`[character-photo] account image models: ${ids.join(", ") || "(none)"}`)
    return ids
  } catch (e) {
    console.error("[character-photo] model list failed:", e instanceof Error ? e.message : String(e))
    return []
  }
}

// Together AI → FLUX.1. Returns image bytes (or null).
async function genTogether(prompt: string, seed: number, model = TOGETHER_MODEL, steps = TOGETHER_STEPS): Promise<Buffer | null | typeof RATE_LIMITED> {
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
      // Auth/billing, not "this model": the key itself is no good, so nothing
      // will work until a human fixes it. Latch the whole provider off.
      const body = (await res.text()).slice(0, 300)
      if (res.status === 401 || res.status === 403 || res.status === 402) markProviderRejected("together", res.status)
      // "Unable to access non-serverless model" is about THIS model, not the key
      // or the account — remember it even when it is the floor, or the route
      // keeps asking for a model that has moved behind a dedicated endpoint.
      else if (res.status === 429) { /* rate limit: transient, never remembered */ }
      else if (res.status >= 400 && res.status < 500 && (model !== TOGETHER_MODEL || /non-serverless|unable to access|not available/i.test(body))) {
        togetherOff.add(model)
      }
      console.error("together image error", model, res.status, body)
      return res.status === 429 ? RATE_LIMITED : null
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
const R_GRAIN_ENV      = floor0(process.env.REALISM_GRAIN, 10)     // luma grain amplitude (ISO-800-ish)
const R_CHROMA_ENV     = floor0(process.env.REALISM_CHROMA, 3)    // per-channel chroma noise
const R_CONTRAST_ENV   = numEnv(process.env.REALISM_CONTRAST, 0.05)   // was .10 — the grade read as "edited"
const R_DESAT_ENV      = numEnv(process.env.REALISM_DESAT, 0.06)
const R_VIGNETTE_ENV   = numEnv(process.env.REALISM_VIGNETTE, 0.07)  // was .16 — the most obvious "filtered" tell
const R_ABERRATION_ENV = numEnv(process.env.REALISM_ABERRATION, 1) // px R/B split at edges (0 disables)
const R_JPEG_Q_ENV     = Math.max(60, Math.min(95, Number(process.env.REALISM_JPEG_QUALITY || 88)))

function numEnv(v: string | undefined, d: number): number { const n = Number(v); return Number.isFinite(n) ? n : d }
function floor0(v: string | undefined, d: number): number { const n = Number(v); return Number.isFinite(n) ? Math.max(0, n) : d }
// Cheap deterministic per-pixel noise (no Math.random over ~3M samples; stable grain).
function hashNoise(x: number): number {
  x = (x ^ 61) ^ (x >>> 16); x = x + (x << 3); x = x ^ (x >>> 4)
  x = Math.imul(x, 0x27d4eb2d); x = x ^ (x >>> 15)
  return ((x >>> 0) / 4294967295) * 2 - 1   // -1..1
}

/**
 * @param plain  Skip every degradation and just re-encode.
 *
 * The whole pass exists to un-plastic DIFFUSION output — FLUX renders skin like
 * wax, so grain, a soft vignette and a JPEG re-encode are what let it pass for a
 * phone photo. Google's images are already photographs. Running the same
 * treatment over them does not make them more real, it visibly degrades them,
 * and stacked on top of a "harsh light, slightly underexposed" prompt it is what
 * people were reacting to when they said the faces looked ill and grimy.
 *
 * So a Google image still comes through here — the pipeline stays JPEG, the
 * cache path and content type stay consistent — but at high quality with every
 * amount set to zero.
 */
async function realismPass(input: Buffer, plain = false): Promise<Buffer> {
  if (!input || input.length < 1000) return input
  const R_GRAIN = plain ? 0 : R_GRAIN_ENV
  const R_CHROMA = plain ? 0 : R_CHROMA_ENV
  const R_CONTRAST = plain ? 0 : R_CONTRAST_ENV
  const R_DESAT = plain ? 0 : R_DESAT_ENV
  const R_VIGNETTE = plain ? 0 : R_VIGNETTE_ENV
  const R_ABERRATION = plain ? 0 : R_ABERRATION_ENV
  const R_JPEG_Q = plain ? 95 : R_JPEG_Q_ENV
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
    //
    // IDENTITY WHEN THERE IS NO CONTRAST TO APPLY. With R_CONTRAST at 0 the curve
    // below divides by zero — s0 and s1 both collapse to 0.5, norm becomes NaN,
    // and a NaN written into a Uint8Array lands as 0. Every entry reads 0, so the
    // LUT maps the whole image to black. That is not theoretical: adding a plain
    // mode set the contrast to 0 and shipped solid black portraits to production.
    const lut = new Uint8Array(256)
    if (!(R_CONTRAST > 0)) {
      for (let v = 0; v < 256; v++) lut[v] = v
    } else {
    const k = R_CONTRAST * 4
    const s0 = 1 / (1 + Math.exp(k * 0.5)), s1 = 1 / (1 + Math.exp(-k * 0.5))
    for (let v = 0; v < 256; v++) {
      const x = v / 255
      const s = 1 / (1 + Math.exp(-k * (x - 0.5)))
      const norm = (s - s0) / (s1 - s0)
      const out = x * (1 - R_CONTRAST) + norm * R_CONTRAST
      lut[v] = Math.max(0, Math.min(255, Math.round(out * 255)))
    }
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
      || (provider === "together" && !TOGETHER_KEY)
      || (provider === "google" && !GEMINI_KEY && !TOGETHER_KEY && !FAL_KEY && !RP_KEY)
      || providerRejected()) {
    // Same shape as "no key configured", because it is the same situation from
    // the client's side: no photo is coming, show the monogram and stop asking.
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
  // TWO cache dimensions, because there are two ways a cached face goes stale.
  //
  // realismVersion covers the POST-PROCESS (contrast, vignette, grain) and stays
  // env-overridable, which is how it should be — it is a knob to turn.
  //
  // PROMPT_FINGERPRINT covers the PROMPT, and is deliberately NOT overridable.
  // It was a hand-bumped string until this commit, and that failed exactly the
  // way hand-bumped strings do: Vercel pinned REALISM_VERSION=r3, which beat the
  // code default, so two rounds of prompt fixes wrote to a key that never moved
  // and production kept serving faces generated by a prompt that no longer
  // existed. A fingerprint cannot be pinned and cannot be forgotten.
  const realismVersion = process.env.REALISM_VERSION || "r5"
  const path = realismOn
    ? `${slug || "char"}-${seed}-${realismVersion}-${PROMPT_FINGERPRINT}.jpg`
    : `${slug || "char"}-${seed}-${PROMPT_FINGERPRINT}.png`
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
    // GOOGLE FIRST, when it is the chosen engine — then straight on to the rest.
    //
    // A refusal is expected on the harder prompts (see genGoogle) and is not an
    // error state: it costs one request and lands us exactly where we would have
    // started anyway. So there is no latch, no backoff and no retry on it — just
    // a note in the log saying which prompt Google would not draw, and the
    // existing ladder picking it up.
    if (provider === "google" || (GOOGLE_FIRST && !providerOverride)) {
      const g = await genGoogle(prompt, dseed)
      if (g && g !== REFUSED) { usedModel = await googleImageModel(); return g }
      if (g === REFUSED) console.warn("[character-photo] google refused this prompt — falling back to the diffusion engines")
    }
    // Everything below is the fallback chain when google is the provider.
    const engine = provider === "google" ? (TOGETHER_KEY ? "together" : "runpod") : provider
    if (engine === "qwen") { const r = await genQwen(prompt, negative, dseed); genErr = r.error || ""; if (r.bytes) usedModel = "qwen"; return r.bytes }
    if (engine === "together") {
      // Diverse → climb the photoreal ladder (best the key can reach), then schnell floor.
      if (dp) {
        for (const rung of TOGETHER_LADDER) {
          if (togetherOff.has(rung.model)) continue
          const b = await genTogether(prompt, dseed, rung.model, rung.steps)
          if (b === RATE_LIMITED) break   // account throttled — the floor walk below backs off, once
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
      // The floor: what the account actually has, then the hardcoded guesses as
      // a safety net if the model list can't be read.
      const found = await togetherImageModels()
      const floor = found.length ? [...found, ...TOGETHER_FLOOR.filter((m) => !found.includes(m))] : TOGETHER_FLOOR
      const tried: string[] = []
      let limited = false
      let asked = 0
      for (const m of floor) {
        if (togetherOff.has(m)) { tried.push(`${m}(known-unreachable)`); continue }
        if (asked >= WALK_MAX) break
        tried.push(m); asked++
        let b = await genTogether(prompt, dseed, m)
        // A 429 is the ACCOUNT being throttled, not this model. The live logs
        // showed single requests walking twenty models, collecting twenty 429s,
        // and then being killed at 120s — walking on just spends the budget on
        // the same closed door. Back off once (Together's own guidance: ~2s),
        // ask the SAME model again, and if it's still closed stop here; the
        // outer retry loop spaces the next attempt.
        if (b === RATE_LIMITED) {
          await new Promise((r) => setTimeout(r, 2200))
          b = await genTogether(prompt, dseed, m)
          if (b === RATE_LIMITED) { limited = true; break }
        }
        if (b) { usedModel = m; return b }
      }
      // Exhausting the floor used to return null in silence, which is the worst
      // possible failure to debug: a 502 with no log line and no clue which
      // models were even attempted. Say it, in the log AND in the response body.
      genErr = limited
        ? `together rate-limited (429) even after backoff; tried: ${tried.join(", ")}`
        : `together floor exhausted (account lists ${found.length} image model(s)${found.length ? ": " + found.slice(0, 8).join(", ") : ""}); tried: ${tried.join(", ") || "(all known-unreachable)"}`
      console.error(`[character-photo] ${genErr}`)
      return null
    }
    if (engine === "fal") {
      const b = await genFal(prompt, dseed)
      if (b) { usedModel = process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev"; return b }
      // fal's key has been answering 403 in production for days, and this branch
      // used to return that null straight to the caller — so a deployment pinned
      // to IMAGE_PROVIDER=fal produced "generation failed" for every new face
      // with three other working engines sitting right here. A named engine that
      // is not answering is a reason to try the next one, not to end the request.
      if (TOGETHER_KEY) {
        const t = await genTogether(prompt, dseed)
        if (t && t !== RATE_LIMITED) { usedModel = TOGETHER_MODEL; return t }
      }
    }
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
  // Leave the function time to ANSWER. A retry that starts with a minute already
  // spent ends as a runtime kill, which the client reads as a network error and
  // latches for five minutes — a clean 502 now is the better failure.
  const startedAt = Date.now()
  const BUDGET_MS = 80_000
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    if (attempt > 0 && Date.now() - startedAt > BUDGET_MS) break
    // Space the retries. Three generations fired back-to-back is a burst, and
    // Together rate-limits on traffic SHAPE, not just volume — the live logs
    // showed 429 "too many requests in a short window" from a single visitor
    // loading one card. Their own guidance is to retry from ~2s with backoff.
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1200 * attempt))
    const b = await genWithSeed((seed + attempt * 7919) % 2147483647)
    if (!b || b.length < 8000) continue
    bytes = b                                       // keep the latest good bytes (best-effort)
    // THE QUALITY GATE IS A DIFFUSION GATE, AND IT COSTS A WHOLE GENERATION.
    //
    // isCleanPortrait exists to catch what diffusion gets wrong — no face, two
    // faces, melted features — and a rejection means generating the same person
    // again, so a face can cost up to three times what it looks like it costs.
    // That was worth paying when the alternative was shipping a two-headed
    // portrait. It is not worth paying on Google output: it does not produce
    // those artifacts, so nearly every rejection there is the detector being
    // wrong, and the price of it being wrong is another paid image.
    //
    // So Google is accepted on the first pass. The detector still guards every
    // diffusion engine, where it earns its cost.
    if (/gemini|imagen/i.test(usedModel)) break
    if (!dp || (await isCleanPortrait(b))) break    // single clean face (or non-diverse) → done
  }
  if (!bytes || bytes.length < 8000) {
    return Response.json({ error: "generation failed", provider, detail: genErr || undefined }, { status: 502 })
  }

  // Realism pass: make FLUX output read as a candid amateur phone photo. Fail-open.
  // Google output is already a photograph — pass it through without the grit.
  if (realismOn) bytes = await realismPass(bytes, /gemini|imagen/i.test(usedModel))

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
