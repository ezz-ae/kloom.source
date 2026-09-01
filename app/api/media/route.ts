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
// Content level is whatever the configured image provider permits; this route
// adds no explicit terms of its own and inherits /api/character-photo's gating,
// its spend caps, and its per-IP limit.

import { rateLimit, clientIp, globalGate } from "@/lib/rate-limit"
import { adultEnabled } from "@/lib/variant"

export const runtime = "nodejs"
export const maxDuration = 300

/** Scenes are user text. Keep them short, single-line, and free of prompt breaks. */
function cleanScene(s: unknown): string {
  return String(s || "").replace(/[\n\r"]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180)
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
  let look = "", name = "", gender = "", key = "", scene = "", kind = "image"

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
    scene = cleanScene(b?.scene)
  }

  if (!look) return Response.json({ error: "no character" }, { status: 400 })

  if (kind === "video") {
    // Not wired to a provider yet, and saying so beats a timeout. Every
    // mainstream text-to-video API prohibits the content this platform is for,
    // so the honest options are a permissive host or a self-hosted GPU — the
    // RunPod plumbing this repo already has (RUNPOD_IMAGE_ENDPOINT_ID) is the
    // shape it would take. The route accepts the request so the client contract
    // is settled and only the backend has to arrive.
    return Response.json(
      { error: "video isn't wired to a provider yet", scene, need: "VIDEO_ENDPOINT_ID" },
      { status: 501 },
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
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.url) {
    return Response.json({ error: data?.error || "generation failed", detail: data?.detail, scene }, { status: res.status || 502 })
  }
  return Response.json({ url: data.url, kind: "image", scene, prompt }, { headers: { "Cache-Control": "no-store" } })
}
