// Server-side speech-to-text. Two backends supported:
//   1. RunPod faster-whisper serverless (RUNPOD_STT_ENDPOINT_ID) — primary
//   2. OpenAI-compatible /audio/transcriptions (STT_BASE_URL) — fallback
//
// Browser STT fallback is handled client-side when NEXT_PUBLIC_STT_BROWSER=1.

export const runtime = "nodejs"
export const maxDuration = 60

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: "Expected multipart/form-data with an audio file." }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "Missing audio file." }, { status: 400 })
  }

  const language = typeof form.get("language") === "string" ? (form.get("language") as string) : undefined

  // ── RunPod Faster-Whisper (primary) ───────────────────────────────────────
  const rpSTTEndpoint = process.env.RUNPOD_STT_ENDPOINT_ID
  const rpKey         = process.env.RUNPOD_API_KEY
  if (rpSTTEndpoint && rpKey) {
    const text = await runpodWhisper(file, rpSTTEndpoint, rpKey, language)
    if (text !== null) {
      return Response.json({ text }, { headers: { "Cache-Control": "no-store" } })
    }
    // fall through to OpenAI-compatible fallback
  }

  // ── OpenAI-compatible fallback ────────────────────────────────────────────
  const baseUrl = (process.env.STT_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")
  const apiKey  = process.env.STT_API_KEY || process.env.OPENAI_API_KEY || "local"
  const model   = process.env.STT_MODEL || "whisper-1"

  const upstreamForm = new FormData()
  upstreamForm.append("file", file, (file as File).name || "audio.webm")
  upstreamForm.append("model", model)
  upstreamForm.append("response_format", "json")
  if (language) upstreamForm.append("language", language)

  let upstream: Response
  try {
    upstream = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
      signal: AbortSignal.timeout(20000),
    })
  } catch (err) {
    return Response.json(
      { error: `STT service unreachable: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    )
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "")
    return Response.json({ error: `Transcription failed (${upstream.status}): ${detail.slice(0, 300)}` }, { status: upstream.status })
  }

  const data = (await upstream.json().catch(() => ({}))) as { text?: string }
  return Response.json({ text: (data.text || "").trim() }, { headers: { "Cache-Control": "no-store" } })
}

// RunPod faster-whisper worker. Sends audio as base64, polls if cold-starting.
// Returns the transcript string, or null on any failure (caller falls back).
async function runpodWhisper(
  file: Blob,
  endpointId: string,
  key: string,
  language?: string,
): Promise<string | null> {
  const base    = `https://api.runpod.ai/v2/${endpointId}`
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
  try {
    const buf    = await file.arrayBuffer()
    const b64    = Buffer.from(buf).toString("base64")
    const model  = process.env.STT_MODEL || "large-v3"

    const res = await fetch(`${base}/runsync`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          audio:       b64,
          model_size:  model,
          language:    language || "en",
          transcription: "plain_text",
          word_timestamps: false,
        },
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) return null
    let data: any = await res.json()

    // Poll if worker was cold (IN_QUEUE / IN_PROGRESS).
    let tries = 0
    while ((data?.status === "IN_PROGRESS" || data?.status === "IN_QUEUE") && tries < 30) {
      await sleep(2000)
      const s = await fetch(`${base}/status/${data.id}`, { headers })
      if (!s.ok) return null
      data = await s.json()
      tries++
    }
    if (data?.status !== "COMPLETED") return null

    const text: string | undefined =
      data?.output?.transcription ??
      data?.output?.text ??
      data?.output?.[0]?.text

    return typeof text === "string" ? text.trim() : null
  } catch {
    return null
  }
}
