// Mic recorder + voice-activity detection (VAD). Replaces the browser's
// webkitSpeechRecognition: instead of letting the browser transcribe (badly),
// we record each spoken utterance to an audio blob and POST it to /api/stt
// (server-side Whisper) for an accurate transcript.
//
// It exposes the SAME control surface as a SpeechRecognition instance —
// start() / abort() / stop() — so it drops into the existing voice hook with no
// changes to the surrounding barge-in / echo-suppression logic:
//   start()  begin or resume listening
//   abort()  pause listening, discard any in-progress utterance (no transcript)
//   stop()   tear down completely

export interface SegmenterOptions {
  /** Live mic stream (already obtained via getUserMedia). Not stopped on stop(). */
  stream: MediaStream
  /** Called with the transcript of each completed utterance. */
  onText: (text: string) => void
  /** Optional error sink. */
  onError?: (message: string) => void
  /** Fired when the server STT endpoint is unusable (no key / no model access /
   *  auth error) so the caller can fall back to browser speech recognition. */
  onUnavailable?: (reason: string) => void
  /** Optional ISO-639-1 language hint ("en", "ar", …) for Whisper. */
  getLanguage?: () => string | undefined
  /** Live mic level (RMS 0–1) each frame while listening — drives the voice visualizer
   *  so the user can SEE the mic is connected and picking up their voice. */
  onLevel?: (level: number) => void
  /** Silence (ms) after speech that ends an utterance. Default 850. */
  silenceMs?: number
  /** Ignore utterances shorter than this (ms) — coughs, clicks. Default 300. */
  minSpeechMs?: number
  /** RMS (0–1) above which we consider speech to have started. Default 0.015. */
  startRms?: number
  /** RMS (0–1) below which we consider it silence. Default 0.008. */
  endRms?: number
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]
  for (const t of candidates) {
    try { if (MediaRecorder.isTypeSupported(t)) return t } catch {}
  }
  return undefined
}

export class SpeechSegmenter {
  private opts: Required<Omit<SegmenterOptions, "onError" | "onUnavailable" | "getLanguage" | "onLevel">> & Pick<SegmenterOptions, "onError" | "onUnavailable" | "getLanguage" | "onLevel">
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private data: Uint8Array<ArrayBuffer> | null = null
  private raf: number | null = null

  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private mimeType = pickMimeType()

  private running = false          // started and not stopped
  private paused = true            // not currently listening (AI speaking, etc.)
  private speaking = false         // currently inside an utterance
  private speechStartedAt = 0
  private lastVoiceAt = 0
  private destroyed = false

  constructor(options: SegmenterOptions) {
    this.opts = {
      silenceMs: 850,      // end-of-speech after this much silence. Reverted from 650 — 650 cut people off mid-thought AND let the louder ElevenLabs voice echo back in.
      minSpeechMs: 420,    // ignore blips shorter than real speech (coughs, clicks, a breath). Reverted from 300 — 300 let echo fragments register as user speech (feedback loop).
      startRms: 0.02,      // require a bit more energy to START → quiet background won't trigger silence-hallucinations
      endRms: 0.01,
      ...options,
    }
  }

  /** Begin or resume listening. Idempotent. */
  start() {
    if (this.destroyed) return
    this.running = true
    this.paused = false
    this.ensureAnalyser()
    if (this.raf == null) this.loop()
  }

  /** Pause listening and drop any in-progress utterance without transcribing. */
  abort() {
    this.paused = true
    this.discardRecorder()
    this.speaking = false
  }

  /** Stop SpeechRecognition-style — same as abort for our purposes. */
  stop() {
    this.abort()
  }

  /** Full teardown. */
  destroy() {
    this.destroyed = true
    this.running = false
    this.paused = true
    this.discardRecorder()
    if (this.raf != null) { cancelAnimationFrame(this.raf); this.raf = null }
    try { this.source?.disconnect() } catch {}
    this.source = null
    this.analyser = null
    if (this.ctx) { this.ctx.close().catch(() => {}); this.ctx = null }
  }

  private ensureAnalyser() {
    if (this.analyser) return
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      this.ctx = new Ctx()
      // Contexts can start suspended (autoplay policy) — that would freeze VAD.
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {})
      this.source = this.ctx.createMediaStreamSource(this.opts.stream)
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 512
      this.source.connect(this.analyser)
      this.data = new Uint8Array(new ArrayBuffer(this.analyser.fftSize))
    } catch (err) {
      this.opts.onError?.(err instanceof Error ? err.message : "Could not start mic analysis")
    }
  }

  /** Root-mean-square amplitude (0–1) of the current frame. */
  private rms(): number {
    if (!this.analyser || !this.data) return 0
    this.analyser.getByteTimeDomainData(this.data)
    let sum = 0
    for (let i = 0; i < this.data.length; i++) {
      const v = (this.data[i] - 128) / 128
      sum += v * v
    }
    return Math.sqrt(sum / this.data.length)
  }

  private loop = () => {
    if (this.destroyed || !this.running) { this.raf = null; return }
    this.raf = requestAnimationFrame(this.loop)
    if (this.paused) return

    const now = performance.now()
    const level = this.rms()
    this.opts.onLevel?.(level)   // feed the live visualizer (only while listening, i.e. not paused)

    if (!this.speaking) {
      if (level >= this.opts.startRms) {
        this.speaking = true
        this.speechStartedAt = now
        this.lastVoiceAt = now
        this.beginRecorder()
      }
      return
    }

    // In an utterance: track when we last heard voice; flush on sustained silence.
    if (level >= this.opts.endRms) this.lastVoiceAt = now
    if (now - this.lastVoiceAt >= this.opts.silenceMs) {
      const duration = now - this.speechStartedAt
      this.speaking = false
      if (duration >= this.opts.minSpeechMs) this.flushRecorder()
      else this.discardRecorder()
    }
  }

  private beginRecorder() {
    try {
      this.chunks = []
      this.recorder = this.mimeType
        ? new MediaRecorder(this.opts.stream, { mimeType: this.mimeType })
        : new MediaRecorder(this.opts.stream)
      this.recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) this.chunks.push(e.data) }
      this.recorder.start()
    } catch (err) {
      this.opts.onError?.(err instanceof Error ? err.message : "Could not start recording")
      this.recorder = null
    }
  }

  /** Stop the recorder and transcribe the collected audio. */
  private flushRecorder() {
    const rec = this.recorder
    if (!rec) return
    this.recorder = null
    const mime = this.mimeType || "audio/webm"
    rec.onstop = () => {
      const blob = new Blob(this.chunks, { type: mime })
      this.chunks = []
      if (blob.size > 0) this.transcribe(blob)
    }
    try { rec.stop() } catch { this.chunks = [] }
  }

  /** Stop and throw away the current recording (no transcript). */
  private discardRecorder() {
    const rec = this.recorder
    this.recorder = null
    this.chunks = []
    if (rec) { rec.ondataavailable = null as any; rec.onstop = null as any; try { rec.stop() } catch {} }
  }

  private async transcribe(blob: Blob) {
    try {
      const ext = (this.mimeType || "").includes("mp4") ? "mp4" : (this.mimeType || "").includes("ogg") ? "ogg" : "webm"
      const form = new FormData()
      form.append("file", blob, `utterance.${ext}`)
      const lang = this.opts.getLanguage?.()
      if (lang) form.append("language", lang)
      // Generous timeout: the server STT worker can cold-start (~20s). Past that,
      // give up on this utterance rather than hang the live call forever.
      const res = await fetch("/api/stt", { method: "POST", body: form, signal: AbortSignal.timeout(35000) })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "" }))
        const msg = error || `Transcription failed (${res.status})`
        // "unusable" means the server STT can NEVER work (auth/config) → switch to
        // the browser recognizer. It must be NARROW: a transient hiccup (cold/failed
        // worker → 5xx "RunPod STT failed", a timeout) is NOT unusable — skip just this
        // utterance and keep the live call listening. The old check matched "STT" in
        // "RunPod STT failed" and treated 404/500 as permanent, so one blip dropped
        // hands-free on iOS (no browser fallback there) — the "mic turns off" bug.
        const unusable =
          res.status === 401 || res.status === 403 ||
          /missing.?permission|does not have access|invalid api key|no .{0,12}key|not configured|disabled/i.test(msg)
        if (unusable) this.opts.onUnavailable?.(msg)
        else this.opts.onError?.(msg)   // transient → caller keeps listening
        return
      }
      const { text } = (await res.json()) as { text?: string }
      const clean = (text || "").trim()
      if (clean) this.opts.onText(clean)
    } catch (err) {
      this.opts.onError?.(err instanceof Error ? err.message : "Transcription request failed")
    }
  }
}
