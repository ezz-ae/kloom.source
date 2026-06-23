// Single-utterance voice capture for tap-to-talk.
//
// PRIMARY path is MediaRecorder + server Whisper (/api/stt) via SpeechSegmenter.
// This is what makes voice work inside in-app webviews — the Instagram / Facebook /
// TikTok browsers — where `webkitSpeechRecognition` simply does not exist, so the
// old "new SR()" path silently did nothing. FALLBACK is the browser recognizer for
// the desktop-Chrome / older cases where the mic-record path can't run.
//
//   const h = listenOnce({ onText, onState, onError, lang, bcp47 })
//   h.cancel()   // tap again to stop without sending
//
// Fires onText at most once (the first finished utterance), then self-tears-down.

import { SpeechSegmenter } from "./speech-segmenter"

export type VoiceOnceState = "listening" | "thinking" | "idle"

export interface VoiceOnceOptions {
  onText: (text: string) => void
  onState?: (s: VoiceOnceState) => void
  onError?: (message: string) => void
  lang?: string        // ISO-639-1 hint for Whisper, e.g. "en", "ar"
  bcp47?: string       // browser SR locale, e.g. "en-US"
  /** Hard cap so a silent mic doesn't hang forever. Default 20s. */
  maxMs?: number
}

export interface VoiceOnceHandle {
  cancel: () => void
  /** Alias — drops into call sites that previously held a SpeechRecognition. */
  stop: () => void
}

/** True when EITHER capture path is available — so the talk button shows up in
 *  in-app browsers (MediaRecorder) as well as desktop Chrome/Safari (browser SR). */
export function canListen(): boolean {
  if (typeof window === "undefined") return false
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
  const sr = !!(w.SpeechRecognition || w.webkitSpeechRecognition)
  const rec = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia
  return sr || rec
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function listenOnce(opts: VoiceOnceOptions): VoiceOnceHandle {
  const maxMs = opts.maxMs ?? 20000
  let done = false
  let cancelled = false
  let seg: SpeechSegmenter | null = null
  let stream: MediaStream | null = null
  let srRec: any = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const teardown = () => {
    if (timer) { clearTimeout(timer); timer = null }
    try { seg?.destroy() } catch { /* */ }
    seg = null
    try { stream?.getTracks().forEach((t) => t.stop()) } catch { /* */ }
    stream = null
    if (srRec) { try { srRec.onend = null; srRec.stop() } catch { /* */ } srRec = null }
  }

  const finish = (text?: string) => {
    if (done) return
    done = true
    teardown()
    opts.onState?.("idle")
    const clean = (text || "").trim()
    if (clean && !cancelled) opts.onText(clean)
  }

  const fail = (msg: string) => { if (!done) { opts.onError?.(msg); finish() } }

  const startBrowserSR = () => {
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) { fail("voice isn’t supported here — tap the keypad to type"); return }
    const rec = new SR()
    rec.lang = opts.bcp47 || "en-US"; rec.interimResults = false; rec.continuous = false
    rec.onresult = (e: any) => finish(e.results?.[0]?.[0]?.transcript)
    rec.onerror = (ev: any) => {
      const er = ev?.error
      if (er === "not-allowed" || er === "service-not-allowed") fail("mic is blocked — allow it, or type")
      else if (er === "no-speech") fail("didn’t catch that — tap and speak")
      else if (er === "aborted") finish()
      else fail("voice hiccuped — tap again, or type")
    }
    rec.onend = () => { if (!done) finish() }
    srRec = rec
    try { rec.start(); opts.onState?.("listening") } catch { fail("couldn’t start the mic — type instead") }
  }

  ;(async () => {
    const canRecord = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia
    if (!canRecord) { startBrowserSR(); return }
    let s: MediaStream
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      startBrowserSR(); return   // mic via getUserMedia unavailable → last resort
    }
    if (cancelled || done) { try { s.getTracks().forEach((t) => t.stop()) } catch { /* */ } return }
    stream = s
    opts.onState?.("listening")
    seg = new SpeechSegmenter({
      stream: s,
      getLanguage: () => opts.lang,
      onText: (t) => { opts.onState?.("thinking"); finish(t) },
      onError: (m) => fail(m),
      onUnavailable: () => {                 // server STT down → swap to browser SR
        try { seg?.destroy() } catch { /* */ } seg = null
        try { stream?.getTracks().forEach((t) => t.stop()) } catch { /* */ } stream = null
        if (!cancelled && !done) startBrowserSR()
      },
    })
    seg.start()
  })()

  timer = setTimeout(() => { if (!done) fail("didn’t catch that — tap and speak") }, maxMs)

  const cancel = () => { cancelled = true; if (!done) { done = true; teardown(); opts.onState?.("idle") } }
  return { cancel, stop: cancel }
}
