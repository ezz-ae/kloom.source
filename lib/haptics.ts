/**
 * Haptics — real device vibration driven by the scene.
 *
 * Uses the Web Vibration API (navigator.vibrate). It drives the phone's own
 * motor; a paired Bluetooth toy can mirror the phone in apps that support it.
 * The room feeds two things in:
 *   - intensity 0–10  (the "Vibration intensity" slider — a floor)
 *   - pattern         (Follow scene / Steady / Pulse / Wave / Escalate)
 * and calls pulseForSpeech() whenever a character speaks, so the buzz follows
 * the voice. A steady floor (intensity>0, pattern Steady) runs continuously.
 *
 * iOS Safari blocks the Vibration API entirely, so we feature-detect and report
 * support — the UI shows an honest "not supported on this browser" instead of
 * a toggle that silently does nothing.
 */

export function hapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
}

let steadyTimer: ReturnType<typeof setInterval> | null = null

/** Stop everything immediately. */
export function stopHaptics() {
  if (steadyTimer) { clearInterval(steadyTimer); steadyTimer = null }
  if (hapticsSupported()) navigator.vibrate(0)
}

// intensity 0–10 → motor on-time per pulse (ms). Higher = longer, stronger feel.
function onMs(intensity: number): number {
  return Math.round(40 + Math.max(0, Math.min(10, intensity)) * 26) // 40–300ms
}

/**
 * One speech-synced burst. `pattern` shapes it; `intensity` scales it;
 * `durationMs` is how long the character is expected to speak (so Wave/Escalate
 * can ramp across the line). Returns immediately; the motor runs async.
 */
export function pulseForSpeech(opts: {
  intensity: number
  pattern: string
  durationMs?: number
}) {
  if (!hapticsSupported()) return
  const i = Math.max(0, Math.min(10, opts.intensity || 0))
  if (i <= 0 && opts.pattern === "Steady") return
  const on = onMs(i || 4)
  const dur = Math.max(600, Math.min(8000, opts.durationMs ?? 1800))

  switch (opts.pattern) {
    case "Steady":
      navigator.vibrate(dur)
      break
    case "Pulse": {
      const gap = Math.round(on * 1.2)
      const reps = Math.max(1, Math.floor(dur / (on + gap)))
      navigator.vibrate(Array.from({ length: reps }, () => [on, gap]).flat())
      break
    }
    case "Wave": {
      // soft → strong → soft across the line
      const steps = [on * 0.5, 120, on, 100, on * 1.4, 100, on, 120, on * 0.5].map(Math.round)
      navigator.vibrate(steps)
      break
    }
    case "Escalate": {
      const reps = 5
      const seq: number[] = []
      for (let r = 0; r < reps; r++) { seq.push(Math.round(on * (0.5 + r * 0.25)), 90) }
      navigator.vibrate(seq)
      break
    }
    case "Follow scene":
    default: {
      // a natural double-tap that tracks the cadence of speech
      navigator.vibrate([on, 90, Math.round(on * 0.7)])
      break
    }
  }
}

/** Continuous floor while a scene is live (intensity>0, pattern Steady). */
export function startSteadyFloor(intensity: number) {
  stopHaptics()
  if (!hapticsSupported()) return
  const i = Math.max(0, Math.min(10, intensity))
  if (i <= 0) return
  const on = onMs(i)
  const period = 1200
  navigator.vibrate(on)
  steadyTimer = setInterval(() => navigator.vibrate(on), period)
}

/** A short confirmation buzz — used when the user toggles haptics on. */
export function testBuzz(intensity = 6) {
  if (!hapticsSupported()) return
  navigator.vibrate([onMs(intensity), 80, onMs(intensity)])
}
