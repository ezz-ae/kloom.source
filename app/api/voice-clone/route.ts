// POST /api/voice-clone
// Accepts a YouTube URL, downloads the audio, uploads to Fish Audio,
// and returns the resulting voice model ID ready to use in TTS.

import ytdl from "@distube/ytdl-core"
import { rateLimit, clientIp, globalGate } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  // This is the single most expensive anonymous op (YouTube download + Fish model
  // upload). Left ungated it's a budget/bandwidth bomb under ad-scale bot traffic.
  const gate = globalGate()
  if (!gate.ok) return Response.json({ error: "at capacity" }, { status: 503, headers: { "Retry-After": "120" } })
  const rl = rateLimit(`clone:${clientIp(request)}`, 3, 60_000)
  if (!rl.ok) return Response.json({ error: "slow down — a few clones per minute max" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

  const { url, name } = (await request.json()) as { url: string; name?: string }

  if (!url || !ytdl.validateURL(url)) {
    return Response.json({ error: "Invalid YouTube URL" }, { status: 400 })
  }

  const apiKey = process.env.FISH_API_KEY
  if (!apiKey) {
    return Response.json({ error: "FISH_API_KEY not configured" }, { status: 500 })
  }

  // Download audio-only stream, cap at 5 MB (~2 min at 128 kbps — plenty for cloning)
  let audioBuffer: Buffer
  try {
    audioBuffer = await downloadAudio(url)
  } catch (err) {
    return Response.json(
      { error: `Could not download YouTube audio: ${err instanceof Error ? err.message : String(err)}` },
      { status: 422 }
    )
  }

  if (audioBuffer.length < 10_000) {
    return Response.json({ error: "Audio too short — try a longer clip" }, { status: 422 })
  }

  // Upload to Fish Audio model creation API
  const form = new FormData()
  form.append("visibility", "private")
  form.append("type", "tts")
  form.append("title", name || "YouTube Clone")
  form.append("train_mode", "fast")
  form.append("enhance_audio_quality", "true")
  form.append("voices", new Blob([audioBuffer], { type: "audio/mpeg" }), "voice.mp3")

  let fishRes: Response
  try {
    fishRes = await fetch("https://api.fish.audio/model", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    return Response.json({ error: `Fish Audio unreachable: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 })
  }

  if (!fishRes.ok) {
    const detail = await fishRes.text().catch(() => "")
    return Response.json({ error: `Fish Audio error (${fishRes.status}): ${detail.slice(0, 300)}` }, { status: fishRes.status })
  }

  const data = (await fishRes.json()) as { _id?: string }
  const voiceId = data._id
  if (!voiceId) {
    return Response.json({ error: "Fish Audio returned no model ID" }, { status: 502 })
  }

  return Response.json({ voiceId })
}

function downloadAudio(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalSize = 0
    const MAX_BYTES = 5 * 1024 * 1024

    const stream = ytdl(url, {
      quality: "lowestaudio",
      filter: "audioonly",
    })

    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk)
      totalSize += chunk.length
      if (totalSize >= MAX_BYTES) stream.destroy()
    })

    stream.on("end",  () => resolve(Buffer.concat(chunks)))
    stream.on("close", () => resolve(Buffer.concat(chunks)))
    stream.on("error", reject)
  })
}
