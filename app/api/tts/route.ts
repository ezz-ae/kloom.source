import { resolveVoiceId } from "@/lib/voices"

export async function POST(request: Request) {
  const { text, voice, voiceId, personaName, gender } = (await request.json()) as {
    text: string
    voice?: string
    voiceId?: string
    personaName?: string
    gender?: string
  }

  if (!text || typeof text !== "string") {
    return Response.json({ error: "Missing text" }, { status: 400 })
  }

  const apiKey = process.env.FISH_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: "FISH_API_KEY is not configured" },
      { status: 500 }
    )
  }

  // Priority: explicit fixed voiceId (set per persona — never shifts) → resolve by
  // name + EXPLICIT gender (so a female char never gets a male voice) → slot → env.
  const referenceId = voiceId?.trim() || resolveVoiceId(personaName, gender) || resolveReferenceId(voice)

  // Fish's inference backend occasionally returns 502 with "empty audio" or
  // similar transient errors. Retry up to 3 times with short backoff before
  // surfacing the failure to the client — without this, a single bad call
  // makes one sentence in the middle of a reply silently drop.
  const body = JSON.stringify({
    text,
    reference_id: referenceId,
    format: "mp3",
    mp3_bitrate: 128,
    normalize: true,
    latency: process.env.FISH_LATENCY || "balanced",
  })

  let fishResponse: Response | null = null
  let lastErrorText = ""
  for (let attempt = 1; attempt <= 3; attempt++) {
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
      // Some Fish failures still return 200 but with an empty body. Detect.
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
    // Only retry on transient errors (5xx and 429). 4xx with body = config bug.
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
