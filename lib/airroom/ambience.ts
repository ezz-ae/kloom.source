/**
 * AIRROOM ambience — the universe is never silent.
 *
 * A soft, synthesised crowd-bed (detuned pad through a lowpass) so that from the
 * most zoomed-OUT view you hear "a lot, all at once" — muffled, distant, not
 * disturbing. As you zoom in it brightens; at the ROOM level the bed drops away
 * so the real voices come through clear. Asset-free, and must be started from a
 * user gesture (browser autoplay). depth: 0 = all the way out … 2 = inside a room.
 */
"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let filter: BiquadFilterNode | null = null
let started = false

export function startAmbience() {
  if (started) return
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain(); master.gain.value = 0
    filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 380
    filter.connect(master); master.connect(ctx.destination)
    const tones = [110, 138.6, 164.8, 196, 220, 261.6, 293.7]
    tones.forEach((base, i) => {
      const o = ctx!.createOscillator()
      o.type = i % 2 ? "sine" : "triangle"
      o.frequency.value = base * (0.992 + i * 0.0035)
      const g = ctx!.createGain(); g.gain.value = 0.05
      const lfo = ctx!.createOscillator(); lfo.frequency.value = 0.04 + i * 0.017
      const lfg = ctx!.createGain(); lfg.gain.value = 0.035
      lfo.connect(lfg); lfg.connect(g.gain); lfo.start()
      o.connect(g); g.connect(filter!); o.start()
    })
    started = true
    master.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 2.5)
  } catch { /* */ }
}

export function setAmbienceDepth(depth: number) {
  if (!ctx || !master || !filter) return
  const t = ctx.currentTime
  const cutoff = depth <= 0 ? 360 : depth === 1 ? 850 : 1500   // muffled out → brighter in
  const gain = depth <= 0 ? 0.16 : depth === 1 ? 0.12 : 0.045   // fade at room level so voices are clear
  filter.frequency.linearRampToValueAtTime(cutoff, t + 0.7)
  master.gain.linearRampToValueAtTime(gain, t + 0.7)
}

/** tiny shimmer on hover — you brush past a cluster and the air shifts */
export function brush() {
  if (!ctx || !master) return
  const t = ctx.currentTime
  const g = master.gain.value
  master.gain.cancelScheduledValues(t)
  master.gain.setValueAtTime(g, t)
  master.gain.linearRampToValueAtTime(Math.min(0.22, g + 0.05), t + 0.08)
  master.gain.linearRampToValueAtTime(g, t + 0.45)
}

export function stopAmbience() {
  if (!ctx) return
  try {
    master?.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
    const c = ctx
    setTimeout(() => { try { c.close() } catch { /* */ } }, 600)
  } catch { /* */ }
  ctx = null; master = null; filter = null; started = false
}
