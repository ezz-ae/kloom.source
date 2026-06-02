"use client"

import { useState, useEffect, useRef } from "react"
import { Wind, X as XIcon } from "lucide-react"

// Box breathing: 4s in · 4s hold · 4s out · 4s hold.
const PHASES = [
  { label: "Breathe in", ms: 4000, scale: 1.0 },
  { label: "Hold",       ms: 4000, scale: 1.0 },
  { label: "Breathe out",ms: 4000, scale: 0.55 },
  { label: "Hold",       ms: 4000, scale: 0.55 },
]

interface BreathingRingProps {
  /** Optional live audio level 0..1 (from a call) to make the ring feel alive. */
  level?: number
  onClose?: () => void
  compact?: boolean
}

export function BreathingRing({ level = 0, onClose, compact }: BreathingRingProps) {
  const [phase, setPhase]   = useState(0)
  const [running, setRunning] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!running) return
    timer.current = setTimeout(() => setPhase((p) => (p + 1) % PHASES.length), PHASES[phase].ms)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [phase, running])

  const cur = PHASES[phase]
  const isIn = cur.label === "Breathe in"
  // Ring scale: driven by the breath phase, nudged by live voice level.
  const scale = (cur.scale === 1 ? 1 : 0.55) * (1 + level * 0.08)
  const size = compact ? 120 : 180

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <div
          className="absolute rounded-full bg-gradient-to-br from-amber-500/40 to-emerald-400/40 blur-md"
          style={{
            width: size, height: size,
            transform: `scale(${scale})`,
            transition: `transform ${cur.ms}ms ease-in-out`,
          }}
        />
        <div
          className="absolute rounded-full border-2 border-white/30"
          style={{
            width: size * 0.9, height: size * 0.9,
            transform: `scale(${scale})`,
            transition: `transform ${cur.ms}ms ease-in-out`,
          }}
        />
        <span className="relative text-sm font-semibold text-white/90">{cur.label}</span>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => setRunning((r) => !r)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-white/8 border border-white/10 hover:bg-white/12 px-3 py-1.5 rounded-xl transition-colors">
          <Wind size={13} /> {running ? "Pause" : "Resume"}
        </button>
        {onClose && (
          <button onClick={onClose}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 px-2 py-1.5">
            <XIcon size={13} /> Done
          </button>
        )}
      </div>
      <p className="text-[11px] text-white/30">Box breathing · in 4 · hold 4 · out 4 · hold 4</p>
    </div>
  )
}
