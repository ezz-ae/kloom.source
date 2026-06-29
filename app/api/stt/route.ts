// Server-side speech-to-text. Backend priority:
//   1. Groq Whisper (GROQ_API_KEY) — fast, direct upload, no cold starts
//   2. RunPod faster-whisper serverless (RUNPOD_STT_ENDPOINT_ID)
//   3. OpenAI-compatible /audio/transcriptions (STT_BASE_URL) — last resort
//
// Browser STT fallback is handled client-side when NEXT_PUBLIC_STT_BROWSER=1.

import { rateLimit, clientIp, globalGate } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 300   // RunPod Whisper can cold-start; give it room (capped by plan)

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

// Whisper hallucinates stock phrases ("thank you", "thanks for watching") on silence
// / non-speech — its training data was full of YouTube outros. Drop a transcript that
// is ONLY one of those, so a beat of quiet on the open mic never becomes a phantom
// "thank you" sent to the chat. Real, longer utterances pass through untouched.
const HALLUCINATIONS = new Set([
  "thank you", "thanks", "thankyou", "thank you so much", "thanks so much",
  "thank you very much", "thanks for watching", "thank you for watching",
  "thanks for watching everyone", "thanks for watching the video", "thank you bye",
  "you", "bye", "bye bye", "goodbye", "see you", "see you next time", "okay thank you",
  "please subscribe", "subscribe", "like and subscribe", "youre welcome",
  "music", "silence", "applause", "foreign", "the end",
])
function cleanTranscript(text: string | null | undefined): string {
  const t = (text || "").trim()
  if (!t) return ""
  // Strip non-ASCII to check against English hallucination phrases.
  // If nothing remains after stripping, the text is non-Latin (Arabic, Chinese, etc.)
  // — skip the hallucination filter entirely so real speech isn't silently dropped.
  const n = t.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim()
  if (!n) return t
  if (HALLUCINATIONS.has(n)) return ""
  return t
}

export async function POST(request: Request) {
  // Cost guard: STT bills GPU-seconds per utterance on an open mic. Gate it
  // like the other billable endpoints (generous limit — a live call fires often).
  const gate = globalGate()
  if (!gate.ok) return Response.json({ error: "at capacity" }, { status: 503, headers: { "Retry-After": "120" } })
  const rl = rateLimit(`stt:${clientIp(request)}`, 90, 60_000)
  if (!rl.ok) return Response.json({ error: "slow down" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

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

  // ── Groq Whisper (primary — fast, cheap, direct upload, no cold starts) ──
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    const groqForm = new FormData()
    groqForm.append("file", file, (file as File).name || "audio.webm")
    groqForm.append("model", process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo")
    groqForm.append("response_format", "json")
    if (language) groqForm.append("language", language)
    try {
      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}` },
        body: groqForm,
        signal: AbortSignal.timeout(20000),
      })
      if (res.ok) {
        const data = (await res.json()) as { text?: string }
        return Response.json({ text: cleanTranscript(data.text) }, { headers: { "Cache-Control": "no-store" } })
      }
      console.error("[stt] groq failed:", res.status, (await res.text().catch(() => "")).slice(0, 200))
    } catch (e) {
      console.error("[stt] groq error:", e instanceof Error ? e.message : String(e))
    }
  }

  // ── RunPod Faster-Whisper (secondary) ─────────────────────────────────────
  const rpSTTEndpoint = process.env.RUNPOD_STT_ENDPOINT_ID
  const rpKey         = process.env.RUNPOD_API_KEY
  if (rpSTTEndpoint && rpKey) {
    const r = await runpodWhisper(file, rpSTTEndpoint, rpKey, language)
    if (r.text !== null) {
      return Response.json({ text: cleanTranscript(r.text) }, { headers: { "Cache-Control": "no-store" } })
    }
    if (!process.env.STT_API_KEY && !process.env.OPENAI_API_KEY) {
      return Response.json({ error: `STT failed: ${r.error || "unknown"}` }, { status: 502 })
    }
  }

  // ── OpenAI-compatible fallback ────────────────────────────────────────────
  const baseUrl = (process.env.STT_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")
  const apiKey  = process.env.STT_API_KEY || process.env.OPENAI_API_KEY
  const model   = process.env.STT_MODEL || "whisper-1"

  // Don't attempt the call with no key — an anonymous request to OpenAI returns 401,
  // which the client treats as a permanent failure and destroys the microphone.
  if (!apiKey) {
    return Response.json({ error: "STT temporarily unavailable — try again" }, { status: 503 })
  }

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
  return Response.json({ text: cleanTranscript(data.text) }, { headers: { "Cache-Control": "no-store" } })
}

// RunPod faster-whisper worker. Sends audio as base64, polls if cold-starting.
// Returns the transcript string, or null on any failure (caller falls back).
async function runpodWhisper(
  file: Blob,
  endpointId: string,
  key: string,
  language?: string,
): Promise<{ text: string | null; error?: string }> {
  const base    = `https://api.runpod.ai/v2/${endpointId}`
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
  try {
    const buf    = await file.arrayBuffer()
    const b64    = Buffer.from(buf).toString("base64")
    // faster-whisper model (tiny|base|small|medium|large-v3|turbo). Use a RunPod-specific
    // var so it can't collide with STT_MODEL, which is the OpenAI-compat fallback's model id
    // (e.g. "whisper-1" — an invalid value for this worker).
    const model  = process.env.RUNPOD_STT_MODEL || "large-v3"

    const res = await fetch(`${base}/runsync`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          audio_base64:  b64,                    // worker wants base64 here; `audio` is a URL field
          model:         model,
          language:      language || undefined,  // omit → whisper auto-detects (multilingual)
          transcription: "plain_text",
          word_timestamps: false,
          enable_vad:    true,                   // skip non-speech → far fewer silence hallucinations
          no_speech_threshold: 0.6,              // be stricter about "this segment is silence"
          condition_on_previous_text: false,     // don't let a phantom line prime the next
        },
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) return { text: null, error: `http ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}` }
    let data: any = await res.json()

    // Poll if worker was cold (IN_QUEUE / IN_PROGRESS).
    let tries = 0
    while ((data?.status === "IN_PROGRESS" || data?.status === "IN_QUEUE") && tries < 30) {
      await sleep(2000)
      const s = await fetch(`${base}/status/${data.id}`, { headers })
      if (!s.ok) return { text: null, error: `poll http ${s.status}` }
      data = await s.json()
      tries++
    }
    if (data?.status !== "COMPLETED") return { text: null, error: `status=${data?.status}; ${JSON.stringify(data?.error || data?.output || "").slice(0, 200)}` }

    const o = data?.output
    const text: string | undefined =
      o?.transcription ?? o?.text ?? o?.[0]?.text ??
      (Array.isArray(o?.segments) ? o.segments.map((s: any) => s?.text || "").join(" ") : undefined)

    if (typeof text === "string") return { text: text.trim() }
    return { text: null, error: `no transcript in output: ${JSON.stringify(o).slice(0, 200)}` }
  } catch (e) {
    return { text: null, error: e instanceof Error ? e.message : String(e) }
  }
}

