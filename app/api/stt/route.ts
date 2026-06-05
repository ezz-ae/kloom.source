// Server-side speech-to-text — proxies one utterance of recorded audio to a
// Whisper endpoint and returns the transcript. Far more accurate than the
// browser's webkitSpeechRecognition (which mangles names like "Claude").
//
// OpenAI-compatible, so it works against the hosted Whisper API today and a
// self-hosted GPU Whisper server (faster-whisper / whisper.cpp with an
// OpenAI-shaped /audio/transcriptions route) later — just point the env at it.
//   STT_BASE_URL  default https://api.openai.com/v1
//   STT_API_KEY   default OPENAI_API_KEY, else "local"
//   STT_MODEL     default whisper-1

export const runtime = "nodejs"

export async function POST(request: Request) {
  const baseUrl = (process.env.STT_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")
  const apiKey = process.env.STT_API_KEY || process.env.OPENAI_API_KEY || "local"
  const model = process.env.STT_MODEL || "whisper-1"

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

  // Forward to the Whisper endpoint. language is an optional ISO-639-1 hint
  // ("en", "ar", …) — improves accuracy when we know the persona's language.
  const language = form.get("language")
  const upstreamForm = new FormData()
  upstreamForm.append("file", file, (file as File).name || "audio.webm")
  upstreamForm.append("model", model)
  upstreamForm.append("response_format", "json")
  if (typeof language === "string" && language) upstreamForm.append("language", language)

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
      { error: `Could not reach the speech-to-text service at ${baseUrl}. (${err instanceof Error ? err.message : String(err)})` },
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
