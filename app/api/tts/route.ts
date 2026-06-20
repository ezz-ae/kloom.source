import { resolveVoiceId, getFallbackVoiceId, voiceForLanguage } from "@/lib/voices"
import { isoForLanguage } from "@/lib/languages"
import { rateLimit, clientIp, globalGate } from "@/lib/rate-limit"

// CosyVoice3 cold starts poll up to ~45s; don't let Vercel kill the request.
export const maxDuration = 60

export async function POST(request: Request) {
  // Global spend ceiling / kill-switch first — protects total budget under ad traffic.
  const gate = globalGate()
  if (!gate.ok) return Response.json({ error: "at capacity" }, { status: 503, headers: { "Retry-After": "120" } })
  // Per-client guard on the open TTS endpoint.
  const rl = rateLimit(`tts:${clientIp(request)}`, 80, 60_000)
  if (!rl.ok) return Response.json({ error: "Slow down a sec." }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

  const { text, voice, voiceId, personaName, gender, language } = (await request.json()) as {
    text: string
    voice?: string
    voiceId?: string
    personaName?: string
    gender?: string
    language?: string
  }

  if (!text || typeof text !== "string") {
    return Response.json({ error: "Missing text" }, { status: 400 })
  }
  // A spoken line is short; cap it so a huge payload can't be forwarded to (and
  // billed by) the TTS provider.
  const ttsText = text.slice(0, 1000)

  // ── CosyVoice3 (RunPod serverless) — primary TTS ──────────────────────────
  // High-quality, natural-sounding TTS. Runs first when the endpoint is configured.
  // Falls through to fish.audio on any failure.
  const cvEndpoint = process.env.COSYVOICE_ENDPOINT_ID
  const rpKey      = process.env.RUNPOD_API_KEY
  // CosyVoice only ships English speakers, so route English here and let every
  // other language fall through to Fish's multilingual model (which also honors
  // a curated voiceForLanguage). Without this gate, a configured CosyVoice would
  // speak non-English text with an English voice and never reach the Fish chain.
  if (cvEndpoint && rpKey && isoForLanguage(language) === "en") {
    // Pick speaker by gender: female → English Female, male → English Male.
    const speaker = gender === "male"
      ? (process.env.COSYVOICE_SPEAKER_MALE   || "English Male")
      : (process.env.COSYVOICE_SPEAKER_FEMALE || "English Female")

    const wav = await cosyvoiceTTS(ttsText, cvEndpoint, rpKey, speaker)
    if (wav) {
      return new Response(wav, {
        status: 200,
        headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
      })
    }
    // fall through to fish.audio
  }

  // ── Fish Audio (cloud) — fallback TTS ────────────────────────────────────
  const apiKey = process.env.FISH_API_KEY
  if (!apiKey) {
    return Response.json({ error: "No TTS configured (COSYVOICE_ENDPOINT_ID or FISH_API_KEY required)" }, { status: 500 })
  }

  // Priority: explicit voiceId on the persona → FISH_VOICE_ID env → pool lookup.
  // Priority: explicit pinned voiceId → gender+name POOL (varied per persona) →
  // env default as a last resort. The pool MUST come before resolveReferenceId,
  // or every persona collapses to the single FISH_VOICE_ID and all voices sound
  // the same.
  // Priority: explicit pinned voice → a curated language-native voice (non-EN)
  // → the gender/name pool → env default. The language-native step only fires
  // when FISH_VOICE_<ISO> is configured for that language (see voiceForLanguage).
  let referenceId = voiceId?.trim() || voiceForLanguage(language, gender) || resolveVoiceId(personaName, gender) || resolveReferenceId(voice)

  let fishResponse: Response | null = null
  let lastErrorText = ""

  for (let attempt = 1; attempt <= 4; attempt++) {
    if (attempt === 3 && referenceId) {
      referenceId = getFallbackVoiceId(referenceId)
    }

    const body = JSON.stringify({
      text: ttsText,
      reference_id: referenceId,
      format: "mp3",
      mp3_bitrate: 128,
      normalize: true,
      latency: process.env.FISH_LATENCY || "balanced",
    })

    try {
      fishResponse = await fetch("https://api.fish.audio/v1/tts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "model": process.env.FISH_MODEL || "s1",
        },
        body,
      })
    } catch (err) {
      lastErrorText = err instanceof Error ? err.message : String(err)
      await sleep(150 * attempt)
      continue
    }

    if (fishResponse.ok) {
      const buf = await fishResponse.arrayBuffer()
      if (buf.byteLength > 0) {
        return new Response(buf, {
          status: 200,
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        })
      }
      lastErrorText = "Fish returned 200 with empty audio"
      await sleep(150 * attempt)
      continue
    }

    lastErrorText = await fishResponse.text()
    if (fishResponse.status < 500 && fishResponse.status !== 429) break
    await sleep(150 * attempt)
  }

  return Response.json(
    { error: `Fish Audio error after retries: ${lastErrorText}` },
    { status: fishResponse?.status || 502 }
  )
}

function resolveReferenceId(voice?: string): string | undefined {
  if (voice) {
    const perVoiceEnv = process.env[`FISH_VOICE_${voice.toUpperCase()}`]
    if (perVoiceEnv) return perVoiceEnv
  }
  return process.env.FISH_VOICE_ID || undefined
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// CosyVoice3 RunPod serverless endpoint.
// Input:  { tts_text, spk_id, speed }
// Output: { audio_base64 } (WAV, 22050 Hz)
// Returns the WAV bytes, or null on any failure (caller falls back to fish.audio).
async function cosyvoiceTTS(
  text: string,
  endpointId: string,
  key: string,
  speaker: string,
): Promise<ArrayBuffer | null> {
  const base    = `https://api.runpod.ai/v2/${endpointId}`
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
  try {
    const res = await fetch(`${base}/runsync`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          tts_text: text,
          spk_id:   speaker,
          speed:    1.0,
        },
      }),
    })
    if (!res.ok) return null
    let data: any = await res.json()

    // Poll if cold-start (IN_QUEUE / IN_PROGRESS) — 3 idle workers so usually instant.
    let tries = 0
    while ((data?.status === "IN_PROGRESS" || data?.status === "IN_QUEUE") && tries < 30) {
      await sleep(1500)
      const s = await fetch(`${base}/status/${data.id}`, { headers })
      if (!s.ok) return null
      data = await s.json()
      tries++
    }
    if (data?.status !== "COMPLETED") return null

    const b64: string | undefined = data?.output?.audio_base64 ?? data?.output?.audio
    if (!b64) return null
    const bin = Buffer.from(b64, "base64")
    return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)
  } catch {
    return null
  }
}
