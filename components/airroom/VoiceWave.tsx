"use client"

import { useEffect, useRef } from "react"

/**
 * Live mic visualizer — animated equalizer bars that react to the user's actual voice
 * so they can SEE the mic is connected and picking up sound (the "is my mic even
 * working?" feedback). `getLevel()` returns the current mic RMS (0–1, from the
 * SpeechSegmenter). When active + speaking the bars dance to the voice; when quiet they
 * breathe at a low idle; when the mic is off they go flat. Self-animates via rAF off a
 * ref, so it never re-renders React at 60fps. Hue-tinted to the room.
 */
export function VoiceWave({
  getLevel,
  active,
  hue = 165,
  bars = 27,
  height = 38,
}: {
  getLevel: () => number
  active: boolean
  hue?: number
  bars?: number
  height?: number
}) {
  const refs = useRef<(HTMLSpanElement | null)[]>([])
  const raf = useRef(0)
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    let t = 0
    let smooth = 0
    const tick = () => {
      t += 0.16
      const on = activeRef.current
      // RMS is small (~0–0.15 for normal speech) — amplify, then smooth so bars glide.
      const raw = on ? Math.min(1, getLevel() * 7) : 0
      smooth += (raw - smooth) * 0.25
      const n = refs.current.length
      for (let i = 0; i < n; i++) {
        const el = refs.current[i]
        if (!el) continue
        const center = 1 - Math.abs(i - (n - 1) / 2) / (n / 2) // 0..1, peaks in the middle
        const sine = (Math.sin(t + i * 0.55) + 1) / 2          // 0..1 travelling wave
        // Keep the resting shimmer FAINT — an animated idle was masquerading as "I hear
        // you" even when nothing was being captured. Real mic level must dominate so the
        // bars only truly jump when your voice is registering.
        const idle = 0.06 + sine * 0.025
        const h = on ? idle + smooth * (0.7 + center * 0.7) : 0.07
        el.style.transform = `scaleY(${Math.max(0.06, Math.min(1, h))})`
        el.style.opacity = String(on ? 0.45 + h * 0.55 : 0.25)
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [getLevel, bars])

  return (
    <div aria-hidden style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height }}>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          ref={(el) => { refs.current[i] = el }}
          style={{
            width: 3,
            height: "100%",
            borderRadius: 3,
            transformOrigin: "center",
            background: `linear-gradient(180deg, hsl(${hue},88%,70%), hsl(${(hue + 45) % 360},82%,55%))`,
            boxShadow: `0 0 6px hsla(${hue},85%,62%,.5)`,
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  )
}
