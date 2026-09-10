"use client"

/**
 * "Can you hear me?" — answered without asking anyone.
 *
 * The most common failure on a voice product is not the voice, it is a mic that
 * was never granted, was grabbed by another tab, or is pointed at a closed
 * laptop lid. Today the only way to find out is to talk to a character and get
 * silence back, which reads as the PRODUCT being broken — the worst possible
 * misattribution, because the person then leaves instead of fixing a setting.
 *
 * So this answers it directly: it opens the mic, shows the level moving, and
 * says plainly whether anything is arriving. It sends nothing anywhere — no
 * request, no transcription, no recording kept — because a mic test that costs
 * money or leaves a file somewhere is a worse thing than the problem it solves.
 */
import { useEffect, useRef, useState } from "react"
import { useT } from "@/lib/airraw/i18n"

type State = "idle" | "asking" | "listening" | "heard" | "denied" | "nomic"

export function MicTest({ accent }: { accent: string }) {
  const t = useT()
  const [state, setState] = useState<State>("idle")
  const [level, setLevel] = useState(0)
  const stopRef = useRef<(() => void) | null>(null)

  // Whatever happens, let go of the microphone when this unmounts. A test that
  // leaves the mic open is the same bug it exists to find.
  useEffect(() => () => { stopRef.current?.() }, [])

  const start = async () => {
    if (state === "listening" || state === "asking") { stopRef.current?.(); return }
    setState("asking"); setLevel(0)
    try {
      if (!navigator.mediaDevices?.getUserMedia) { setState("nomic"); return }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const Ctx: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      const src = ctx.createMediaStreamSource(stream)
      const an = ctx.createAnalyser()
      an.fftSize = 512
      src.connect(an)
      const buf = new Uint8Array(an.frequencyBinCount)
      let raf = 0
      let peak = 0
      const started = Date.now()

      const stop = () => {
        cancelAnimationFrame(raf)
        stream.getTracks().forEach((t) => t.stop())
        ctx.close().catch(() => { /* already closed */ })
        stopRef.current = null
        setLevel(0)
        setState(peak > 0.06 ? "heard" : "idle")
      }
      stopRef.current = stop
      setState("listening")

      const tick = () => {
        an.getByteTimeDomainData(buf)
        // Peak deviation from silence (128), normalised. Cheap and steady enough
        // for a bar someone watches for a few seconds.
        let max = 0
        for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i] - 128))
        const v = Math.min(1, (max / 128) * 2.2)
        peak = Math.max(peak, v)
        setLevel(v)
        // Six seconds is long enough to say a sentence and short enough that a
        // forgotten test releases the mic on its own.
        if (Date.now() - started > 6000) { stop(); return }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    } catch {
      setState("denied")
    }
  }

  const label =
    state === "listening" ? "say something…"
    : state === "asking" ? "asking…"
    : state === "heard" ? "heard you clearly ✓"
    : state === "denied" ? "the browser blocked the mic"
    : state === "nomic" ? "this browser has no microphone access"
    : t("test your mic")

  return (
    <button onClick={start} aria-label={t("test your microphone")}
      style={{
        width: "100%", minHeight: 44, borderRadius: 10, padding: "8px 12px", cursor: "pointer",
        background: "rgba(255,255,255,.08)", border: `.5px solid ${state === "heard" ? `${accent}66` : "rgba(255,255,255,.10)"}`,
        color: state === "denied" || state === "nomic" ? "#fb7185" : "rgba(240,232,255,.8)",
        fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", textAlign: "left",
        display: "flex", flexDirection: "column", gap: 6, WebkitTapHighlightColor: "transparent",
      }}>
      <span>{label}</span>
      {/* The bar only exists while listening — a dead meter sitting under an
          idle button implies a mic that is on when it is not. */}
      {state === "listening" && (
        <span aria-hidden style={{ display: "block", height: 5, borderRadius: 3, background: "rgba(255,255,255,.10)", overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", width: `${Math.round(level * 100)}%`, background: accent, borderRadius: 3, transition: "width .06s linear" }} />
        </span>
      )}
    </button>
  )
}
