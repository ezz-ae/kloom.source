// TEXT-TO-MEDIA and VOICE-TO-MEDIA, of a character you already know.
//
// Ask for something — typed, or spoken — and get it back with the SAME person in
// it. The whole difficulty is that last part: diffusion has no memory, so
// "her, on a balcony" and "her, laughing" are two unrelated women unless
// something carries identity between the calls. That something is the frozen
// appearance clause on the saved character (lib/airraw/character.ts), composed
// ahead of whatever scene was asked for.
//
// VOICE costs almost nothing here: /api/stt already turns speech into text
// better than anything this route could do itself (and, for Arabic, through
// Scribe), so voice-to-media is transcribe-then-generate rather than a second
// pipeline. Post audio instead of a prompt and the transcript becomes the scene.
//
// WHAT IT DOES NOT DO: it does not invent an appearance. A scene that names a
// different person, or asks for someone recognisable, is still rendered as the
// SAVED character — identity comes from the stored clause, never from the
// request. That is what makes the feature "her, doing X" rather than a general
// image generator with a person-shaped hole in it.
//
// IMAGES vs VIDEO. An image is one call and comes back inside the request. A clip
// is minutes of GPU time, which is longer than this function may live — so video
// starts a job, waits as long as it safely can, and hands back a job id if it is
// still going. That 202 is not a failure: the GPU keeps working and GET collects
// the result. Nothing is lost by being slow, which is what you want when every
// job costs real money. Finished clips are copied into our own bucket, because a
// worker's storage is temporary and a saved character's media has to still be
// there tomorrow.
//
// Content level is whatever the configured provider permits; this route adds no
// explicit terms of its own and inherits /api/character-photo's gating, its spend
// caps, and its per-IP limit. Video runs on a serverless GPU we rent rather than
// a hosted API precisely so there is no third party's content policy in the loop
// — see lib/airraw/video.ts.

import { rateLimit, clientIp, globalGate } from "@/lib/rate-limit"
import { adultEnabled } from "@/lib/variant"
import { proTokenClaims } from "@/lib/airraw-pro-token"
import { spendPassPhoto, PHOTOS_PER_DAY, PHOTOS_PER_PASS } from "@/lib/airraw/pass-meter"
import { videoConfigured, startVideo, waitVideo, pollVideo } from "@/lib/airraw/video"
import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const maxDuration = 300

/** Scenes are user text. Keep them short, single-line, and free of prompt breaks. */
function cleanScene(s: unknown): string {
  return String(s || "").replace(/[\n\r"]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180)
}

// Where finished clips live. The portrait bucket already exists and is public, so
// video lands there under its own prefix rather than requiring new infrastructure
// before the feature can be tried at all.
// The identity seed and the scene id are both FNV-1a over a string; one keeps the
// person stable across clips, the other keys the cache. Same function, different
// inputs — see the note on seed vs slug further down, which is the same trap.
function hashOf(s: string): number {
  return [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261 >>> 0) | 0
}

// What video models get wrong in ways stills don't: hands and faces drifting
// between frames, and the slideshow failure where nothing actually moves.
const VIDEO_NEG = process.env.AIRRAW_VIDEO_NEG
  || "static image, still frame, no motion, slideshow, flickering, morphing face, "
   + "warping features, extra limbs, deformed hands, watermark, text, subtitles, "
   + "low quality, blurry, jpeg artifacts"

const BUCKET = process.env.AIRRAW_MEDIA_BUCKET || "character-photos"
const videoPath = (sceneId: string) => `video/${sceneId}.mp4`

/**
 * Scene ids are base36 hashes we computed. This is the ONLY thing a client can
 * influence about a storage path, so it is validated rather than escaped: an id
 * that isn't the shape we mint is refused outright.
 */
function safeSceneId(v: unknown): string | null {
  const s = String(v || "")
  return /^[a-z0-9]{1,40}$/.test(s) ? s : null
}

const publicUrl = (path: string) =>
  getAdminClient().storage.from(BUCKET).getPublicUrl(path).data.publicUrl

/** Has this exact clip already been made? Video is expensive enough to always ask. */
async function cachedVideo(sceneId: string): Promise<string | null> {
  if (!hasAdmin()) return null
  const path = videoPath(sceneId)
  const { data } = await getAdminClient().storage.from(BUCKET)
    .list("video", { search: `${sceneId}.mp4`, limit: 1 })
  return data && data.length ? publicUrl(path) : null
}

/** Persist a finished clip and hand back its public URL. */
async function storeVideo(sceneId: string, bytes: Buffer): Promise<string> {
  const path = videoPath(sceneId)
  const { error } = await getAdminClient().storage.from(BUCKET)
    .upload(path, bytes, { contentType: "video/mp4", upsert: true })
  if (error) throw new Error(error.message)
  return publicUrl(path)
}

/**
 * Bring a finished job home: bytes straight from the worker, or fetched from
 * wherever the worker parked them. Either way it ends up in OUR bucket, because a
 * worker's own storage is temporary and the whole point of a saved character is
 * that their media is still there tomorrow.
 */
async function collect(sceneId: string, r: { bytes?: Buffer; url?: string }): Promise<string> {
  if (r.bytes) return storeVideo(sceneId, r.bytes)
  if (r.url) {
    const res = await fetch(r.url, { signal: AbortSignal.timeout(60_000) })
    if (!res.ok) throw new Error(`fetching the clip failed: http ${res.status}`)
    return storeVideo(sceneId, Buffer.from(await res.arrayBuffer()))
  }
  throw new Error("worker returned no video")
}

export async function POST(request: Request) {
  // Media generation is the billable path, so it sits behind the same daily
  // ceiling and per-client limit as portraits rather than inventing its own.
  const gate = globalGate()
  if (!gate.ok) return Response.json({ error: "at capacity" }, { status: 503, headers: { "Retry-After": "120" } })
  const rl = rateLimit(`media:${clientIp(request)}`, 12, 60_000)
  if (!rl.ok) return Response.json({ error: "slow down" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

  // AIRRAW-only. Kloom has no saved characters and no media surface; keeping the
  // route itself gated means it can never become a general image endpoint on the
  // SFW ad domain.
  if (!adultEnabled()) return Response.json({ error: "not available" }, { status: 404 })

  const ct = request.headers.get("content-type") || ""
  let look = "", name = "", gender = "", key = "", scene = "", kind = "image", proToken = ""

  if (ct.includes("multipart/form-data")) {
    // VOICE. The audio is handed to /api/stt rather than transcribed here —
    // one recogniser chain, one place to fix it, and Arabic keeps its tiers.
    const form = await request.formData()
    const file = form.get("audio")
    look = String(form.get("look") || "")
    name = String(form.get("name") || "")
    gender = String(form.get("gender") || "")
    key = String(form.get("key") || "")
    kind = String(form.get("kind") || "image")
    proToken = String(form.get("proToken") || "")
    if (!(file instanceof Blob)) return Response.json({ error: "no audio" }, { status: 400 })
    const sttForm = new FormData()
    sttForm.append("file", file, "ask.webm")
    const lang = String(form.get("language") || "")
    if (lang) sttForm.append("language", lang)
    const origin = new URL(request.url).origin
    const r = await fetch(`${origin}/api/stt`, { method: "POST", body: sttForm })
    if (!r.ok) return Response.json({ error: "couldn't hear that" }, { status: 502 })
    scene = cleanScene((await r.json().catch(() => ({})))?.text)
    if (!scene) return Response.json({ error: "couldn't hear that" }, { status: 422 })
  } else {
    const b = await request.json().catch(() => ({}))
    look = String(b?.look || "")
    name = String(b?.name || "")
    gender = String(b?.gender || "")
    key = String(b?.key || "")
    kind = String(b?.kind || "image")
    proToken = String(b?.proToken || "")
    scene = cleanScene(b?.scene)
  }

  if (!look) return Response.json({ error: "no character" }, { status: 400 })

  // PASS ONLY, AND COUNTED FIRST. A photo is the one thing here that costs cash
  // per unit, so there is no free path and no free teaser — a teaser is two
  // cents spent on someone who has not paid. The pass is verified server-side
  // (a forged token fails here exactly as it does on the chat ceiling), and the
  // photo is charged against the pass BEFORE anything is generated: a request
  // that is refused must cost nothing. Repeats of an identical scene are cache
  // hits downstream but still count — asking twice is asking twice.
  const claims = proTokenClaims(proToken)
  if (!claims) {
    return Response.json({ error: "photos are part of the pass", need: "pass" }, { status: 402 })
  }
  const spend = await spendPassPhoto(proToken)
  if (!spend.ok) {
    const daily = spend.reason === "daily-cap"
    return Response.json(
      { error: daily ? `that's today's ${PHOTOS_PER_DAY} — more tomorrow` : `this pass's ${PHOTOS_PER_PASS} photos are used up`, reason: spend.reason, perDay: PHOTOS_PER_DAY, perPass: PHOTOS_PER_PASS },
      { status: 429 },
    )
  }

  // Identity FIRST and verbatim, scene after — diffusion weights early tokens
  // more heavily, so leading with the person is what keeps them the person.
  const prompt = scene ? `${look}, ${scene}` : look

  // Reuse the portrait pipeline wholesale: the provider ladder, the model
  // discovery, the retry/backoff, the quality gate and the storage cache all
  // live there and none of it should exist twice.
  //
  // The two ids it takes are NOT interchangeable, and getting them the wrong way
  // round breaks this feature in one of two opposite ways:
  //
  //   seed  → drives the APPEARANCE (buildPortraitPrompt re-derives the whole
  //           person from it) and the diffusion noise. Vary it per scene and
  //           every request is a different woman with the same name.
  //   slug  → drives the CACHE PATH only. Hold it constant and the first image
  //           is returned for every scene forever.
  //
  // So: seed is the character, slug is the character AND the scene. Same person,
  // same noise, different moment — and asking for the same thing twice is a
  // cache hit rather than another generation.
  const sceneId = Math.abs([...`${key || name}|${scene}`].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261 >>> 0) | 0).toString(36)
  if (kind === "video") {
    // No provider configured is a 501 and says which env var is missing, because
    // "not built yet" and "built but unconfigured" are different problems and a
    // timeout tells you neither.
    if (!videoConfigured()) {
      return Response.json(
        { error: "video isn't wired to a provider yet", scene, need: "RUNPOD_VIDEO_ENDPOINT_ID" },
        { status: 501 },
      )
    }
    if (!hasAdmin()) return Response.json({ error: "storage unavailable" }, { status: 503 })

    // Ask before spending. A clip is minutes of GPU time; the same request twice
    // should cost that once.
    const hit = await cachedVideo(sceneId).catch(() => null)
    if (hit) return Response.json({ url: hit, kind: "video", scene, cached: true }, { headers: { "Cache-Control": "no-store" } })

    try {
      const job = await startVideo({ prompt, negative: VIDEO_NEG, seed: Math.abs(hashOf(key || name)) % 2_000_000 })
      // Wait, but not past the point where the platform would kill us holding a
      // finished video. Leave headroom for the upload that follows.
      const r = await waitVideo(job.id, 200_000)
      if (r.status === "failed") return Response.json({ error: r.error || "generation failed", scene }, { status: 502 })
      if (r.status === "running") {
        // Still going, and that is fine — the GPU keeps working and the job id is
        // how the client collects it. 202 rather than an error: nothing failed.
        return Response.json({ jobId: job.id, sceneId, kind: "video", scene, pending: true }, { status: 202 })
      }
      return Response.json({ url: await collect(sceneId, r), kind: "video", scene, prompt }, { headers: { "Cache-Control": "no-store" } })
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "generation failed", scene }, { status: 502 })
    }
  }

  const origin = new URL(request.url).origin
  const res = await fetch(`${origin}/api/character-photo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name || "character",
      gender,
      seed: key || name,                       // identity — never varies
      slug: `${(name || "char")}-${sceneId}`,  // cache path — varies per scene
      description: scene,                      // the route's field name for a scene
      diverse: true,
      // Resolve the provider the SAME way the browser does. /api/character-photo
      // falls back to IMAGE_PROVIDER, which is set to a provider that no longer
      // works — the floor only renders because the client overrides it per
      // request. A server-side caller that omits it silently gets the dead one,
      // which is how this route 502'd on its first live call while portraits
      // were generating fine two feet away. Two callers of one endpoint must not
      // resolve its provider differently.
      provider: process.env.NEXT_PUBLIC_AIRRAW_IMG_PROVIDER || "together",
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.url) {
    return Response.json({ error: data?.error || "generation failed", detail: data?.detail, scene }, { status: res.status || 502 })
  }
  return Response.json(
    { url: data.url, kind: "image", scene, prompt, left: Math.max(0, PHOTOS_PER_PASS - (spend.used ?? 0)), perDay: PHOTOS_PER_DAY },
    { headers: { "Cache-Control": "no-store" } },
  )
}

/**
 * GET /api/media?job=<runpod job id>&scene=<sceneId> — collect a clip started earlier.
 *
 * The POST above hands back a job id when a clip outlives its request. This is
 * where it is picked up: poll once, and if the worker has finished, bring the
 * video into our bucket and return its URL. Still running is a 202, not an error.
 *
 * `scene` decides only the FILENAME, and it is validated to the shape we mint
 * rather than trusted — it is the one part of a storage path a client can
 * influence, and "influences a path" is how a cache key becomes an upload
 * primitive. Nothing else here is client-controlled.
 */
export async function GET(request: Request) {
  if (!adultEnabled()) return Response.json({ error: "not available" }, { status: 404 })
  const rl = rateLimit(`media-poll:${clientIp(request)}`, 60, 60_000)
  if (!rl.ok) return Response.json({ error: "slow down" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

  const u = new URL(request.url)
  const jobId = String(u.searchParams.get("job") || "")
  const sceneId = safeSceneId(u.searchParams.get("scene"))
  if (!jobId || !sceneId) return Response.json({ error: "bad request" }, { status: 400 })
  if (!videoConfigured()) return Response.json({ error: "video isn't wired to a provider yet" }, { status: 501 })
  if (!hasAdmin()) return Response.json({ error: "storage unavailable" }, { status: 503 })

  // Already collected — a second poll after a successful one shouldn't re-upload.
  const hit = await cachedVideo(sceneId).catch(() => null)
  if (hit) return Response.json({ url: hit, kind: "video", cached: true }, { headers: { "Cache-Control": "no-store" } })

  const r = await pollVideo(jobId)
  if (r.status === "running") return Response.json({ jobId, sceneId, pending: true }, { status: 202 })
  if (r.status === "failed") return Response.json({ error: r.error || "generation failed" }, { status: 502 })
  try {
    return Response.json({ url: await collect(sceneId, r), kind: "video" }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "collect failed" }, { status: 502 })
  }
}
