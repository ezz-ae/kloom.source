// Mic recorder + voice-activity detection (VAD). Replaces the browser's
// webkitSpeechRecognition: instead of letting the browser transcribe (badly),
// we record each spoken utterance to an audio blob and POST it to /api/stt
// (server-side Whisper) for an accurate transcript.
//
// Capture works like a phone line: the recorder rolls CONTINUOUSLY while
// listening (rotated every few seconds while idle), so the start of speech is
// already recorded when VAD detects it — no clipped first syllable. The speech
// gates adapt to the measured ambient noise floor of the room.
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
  /** Fired when a real utterance was captured and is about to be sent to STT (with the
   *  recorded byte size). Lets the UI confirm the mic actually recorded audio — so a
   *  silent "nothing happened" (never recorded) can be told apart from "recorded fine but
   *  the transcript came back empty". */
  onCapture?: (bytes: number) => void
  /** Silence (ms) after speech that ends an utterance. Default 850. */
  silenceMs?: number
  /** Ignore utterances shorter than this (ms) — coughs, clicks. Default 300. */
  minSpeechMs?: number
  /** Baseline RMS (0–1) for start-of-speech. Default 0.015. The effective gate
   *  adapts around this using the measured ambient noise floor. */
  startRms?: number
  /** Baseline RMS (0–1) for silence. Default 0.008. Adapts like startRms. */
  endRms?: number
  /** Hard cap (ms) on one utterance — flush even if a continuous noise floor means
   *  silence never registers (otherwise the recorder stays open forever and nothing is
   *  ever transcribed). Default 13000. */
  maxUtteranceMs?: number
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]
  for (const t of candidates) {
    try { if (MediaRecorder.isTypeSupported(t)) return t } catch {}
  }
  return undefined
}

/** getUserMedia audio constraints for phone-call-grade capture — the one set every
 *  voice surface should request. Mono 48k with the device's own call DSP (hardware
 *  echo cancellation, noise suppression, auto gain — the same chain a native phone
 *  call uses) plus voice isolation where the browser supports it. All values are
 *  hints (`ideal`/booleans, never `exact`), so an unsupported key is simply ignored
 *  rather than failing getUserMedia on older browsers. */
export function phoneMicAudio(): MediaTrackConstraints {
  return {
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48000 },
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...({ voiceIsolation: true } as any),
  }
}

export class SpeechSegmenter {
  private opts: Required<Omit<SegmenterOptions, "onError" | "onUnavailable" | "getLanguage" | "onLevel" | "onCapture">> & Pick<SegmenterOptions, "onError" | "onUnavailable" | "getLanguage" | "onLevel" | "onCapture">
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
  private recStartedAt = 0         // when the current (continuous) recorder began
  // Ambient noise floor (RMS EMA) measured between utterances — drives the adaptive
  // speech gates. Starts near a quiet room and re-learns fast when the room quiets.
  private noiseFloor = 0.004
  // While idle, rotate the always-on recorder this often so an utterance never
  // carries more than ~3s of leading room tone into the STT request.
  private static readonly PREROLL_WINDOW_MS = 3000

  constructor(options: SegmenterOptions) {
    this.opts = {
      silenceMs: 800,      // end-of-speech after this much silence.
      minSpeechMs: 350,    // ignore blips shorter than real speech (coughs, clicks, a breath).
      startRms: 0.015,     // start-of-speech energy. 0.02 was too high: quieter mics/voices never crossed it, so capture never began while the visualizer still danced ("reads the mic but nothing sends"). Echo is handled by PAUSING the mic while the host speaks — not by a high gate.
      endRms: 0.008,
      maxUtteranceMs: 13000,
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

    // PHONE-LINE CAPTURE: the recorder rolls the whole time we're listening, so by
    // the time VAD notices speech the onset is already on tape. The old design
    // started the recorder only AFTER the level crossed the gate, which cut the
    // first syllable off every utterance ("…at do you want") — the single biggest
    // transcript-quality bug. Whisper handles the bit of leading room tone fine.
    if (!this.recorder) this.beginRecorder()

    const now = performance.now()
    const level = this.rms()
    this.opts.onLevel?.(level)   // feed the live visualizer (only while listening, i.e. not paused)

    // Adaptive gates: ride the measured ambient floor so quiet mics/voices still
    // trigger and a noisy room (fan, music, street) still registers end-of-speech.
    // Floor falls fast and rises slowly, so speech onsets don't drag it up.
    const startGate = Math.min(0.06, Math.max(this.opts.startRms * 0.6, this.noiseFloor * 3 + 0.004))
    const endGate   = Math.min(0.04, Math.max(this.opts.endRms * 0.6,  this.noiseFloor * 1.8 + 0.002))

    if (!this.speaking) {
      const capped = Math.min(level, 0.05)
      this.noiseFloor += (capped - this.noiseFloor) * (capped < this.noiseFloor ? 0.2 : 0.02)
      if (level >= startGate) {
        this.speaking = true
        this.speechStartedAt = now
        this.lastVoiceAt = now
      } else if (now - this.recStartedAt >= SpeechSegmenter.PREROLL_WINDOW_MS) {
        // Rotate the idle recorder — keeps the pre-roll short without ever gapping
        // the line (a new recorder is armed on the very next frame).
        this.discardRecorder()
        this.beginRecorder()
      }
      return
    }

    // In an utterance: flush on sustained silence OR when it has simply run too long.
    // A continuous noise floor (room tone, a fan, music, mic echo) can keep level above
    // the end gate forever — without the hard cap the recorder never stops and nothing
    // is ever transcribed ("I talk but nothing goes there").
    if (level >= endGate) this.lastVoiceAt = now
    const silent = now - this.lastVoiceAt >= this.opts.silenceMs
    const tooLong = now - this.speechStartedAt >= this.opts.maxUtteranceMs
    if (silent || tooLong) {
      const duration = now - this.speechStartedAt
      this.speaking = false
      if (duration >= this.opts.minSpeechMs) this.flushRecorder()
      else this.discardRecorder()
      // the loop re-arms a fresh recorder on the next frame — the line never drops
    }
  }

  private beginRecorder() {
    try {
      this.chunks = []
      // 128kbps opus — browsers default well below this, and Whisper's accuracy on
      // quiet/accented/Arabic speech drops with the muddier encode. If a browser
      // rejects the options object, fall back to a bare recorder rather than dying.
      const options = this.mimeType
        ? { mimeType: this.mimeType, audioBitsPerSecond: 128_000 }
        : { audioBitsPerSecond: 128_000 }
      try {
        this.recorder = new MediaRecorder(this.opts.stream, options)
      } catch {
        this.recorder = this.mimeType
          ? new MediaRecorder(this.opts.stream, { mimeType: this.mimeType })
          : new MediaRecorder(this.opts.stream)
      }
      this.recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) this.chunks.push(e.data) }
      this.recorder.start()
      this.recStartedAt = performance.now()
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
      if (blob.size > 0) { this.opts.onCapture?.(blob.size); this.transcribe(blob) }
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
