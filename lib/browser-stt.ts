// Browser-native speech-to-text fallback. Used when server-side Whisper is
// unavailable (no STT key / project lacks audio-model access). Wraps the
// Web Speech API (webkitSpeechRecognition) behind the SAME control surface as
// SpeechSegmenter — start() / abort() / stop() / destroy() + onText — so the
// voice hook can swap to it with no other changes.
//
// Tradeoff vs server Whisper: less accurate on proper nouns ("Claude"), and
// only supported in Chrome/Edge/Safari over a secure context (https/localhost).
// But it needs no API key and works immediately.

export interface BrowserSttOptions {
  onText: (text: string) => void
  onError?: (message: string) => void
  /** Returns a BCP-47 lang tag, e.g. "en-US". */
  getLang?: () => string
}

function getSR(): any {
  if (typeof window === "undefined") return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

export function browserSttSupported(): boolean {
  return !!getSR()
}

export class BrowserSpeechSegmenter {
  private rec: any = null
  private opts: BrowserSttOptions
  private running = false
  private paused = true
  private destroyed = false

  constructor(opts: BrowserSttOptions) {
    this.opts = opts
  }

  start() {
    if (this.destroyed) return
    this.running = true
    this.paused = false
    this.ensure()
    try { this.rec?.start() } catch {/* already started */}
  }

  abort() {
    this.paused = true
    try { this.rec?.abort() } catch {}
  }

  stop() {
    this.abort()
  }

  destroy() {
    this.destroyed = true
    this.running = false
    this.paused = true
    if (this.rec) {
      this.rec.onresult = null
      this.rec.onerror = null
      this.rec.onend = null
      try { this.rec.abort() } catch {}
      this.rec = null
    }
  }

  private ensure() {
    if (this.rec) return
    const SR = getSR()
    if (!SR) {
      this.opts.onError?.("This browser can't do speech recognition. Try Chrome, Edge, or Safari.")
      return
    }
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = this.opts.getLang?.() || "en-US"

    rec.onresult = (e: any) => {
      if (this.paused) return
      let finalText = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript
      }
      const clean = finalText.trim()
      if (clean) this.opts.onText(clean)
    }

    rec.onerror = (e: any) => {
      // "no-speech"/"aborted" are normal; surface only real failures.
      if (e?.error && e.error !== "no-speech" && e.error !== "aborted") {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          this.opts.onError?.("Microphone permission was blocked. Allow mic access and reload.")
        } else {
          this.opts.onError?.(`Speech recognition error: ${e.error}`)
        }
      }
    }

    rec.onend = () => {
      // Chrome stops continuous recognition after a pause — auto-restart while
      // we're meant to be listening.
      if (this.running && !this.paused && !this.destroyed) {
        try { this.rec?.start() } catch {}
      }
    }

    this.rec = rec
  }
}
