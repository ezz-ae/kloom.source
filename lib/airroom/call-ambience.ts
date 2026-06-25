"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Call ambience — a faint, continuous room-tone played DURING a voice call to mask the
 * micro-artifacts of synthetic TTS. In dead digital silence the ear catches every tiny
 * glitch; with a little organic background (a soft room hum) the brain stops noticing.
 * Asset-free (filtered brown-ish noise + two faint warm tones), ~ -33dB, and must be
 * started from a user gesture (the tap that opened the call counts).
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let started = false
const TARGET = 0.022   // very faint — felt, not heard

export function startCallAmbience() {
  if (started) return
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    const c: AudioContext = new AC()
    const m = c.createGain(); m.gain.value = 0; m.connect(c.destination)
    ctx = c; master = m

    // brown-ish noise bed through a lowpass — a soft room hum
    const bufSize = 2 * c.sampleRate
    const buffer = c.createBuffer(1, bufSize, c.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < bufSize; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; data[i] = last * 3.4 }
    const noise = c.createBufferSource(); noise.buffer = buffer; noise.loop = true
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 680
    noise.connect(lp); lp.connect(m); noise.start()

    // two faint detuned tones for warmth so it reads as "a room", not "noise"
    ;[120, 179].forEach((f, i) => {
      const o = c.createOscillator(); o.type = "sine"; o.frequency.value = f * (1 + i * 0.003)
      const g = c.createGain(); g.gain.value = 0.011
      const lfo = c.createOscillator(); lfo.frequency.value = 0.05 + i * 0.02
      const lfg = c.createGain(); lfg.gain.value = 0.005
      lfo.connect(lfg); lfg.connect(g.gain); lfo.start()
      o.connect(g); g.connect(m); o.start()
    })

    started = true
    m.gain.linearRampToValueAtTime(TARGET, c.currentTime + 1.5)
  } catch { /* */ }
}

export function setCallAmbienceMuted(mute: boolean) {
  const c = ctx, m = master
  if (!c || !m) return
  try { m.gain.linearRampToValueAtTime(mute ? 0 : TARGET, c.currentTime + 0.3) } catch { /* */ }
}

export function stopCallAmbience() {
  const c = ctx, m = master
  if (!c) return
  try {
    m?.gain.linearRampToValueAtTime(0, c.currentTime + 0.4)
    setTimeout(() => { try { c.close() } catch { /* */ } }, 500)
  } catch { /* */ }
  ctx = null; master = null; started = false
}
