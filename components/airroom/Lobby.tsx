"use client"
/**
 * AIRRAW — the living field (the ad landing).
 *
 * Not a catalog of cards: one immersive water→fire world where the characters
 * float as glowing orbs, breathing and drifting like a real crowd. You drop in,
 * a hero tells you what this is, and you tap any face to talk out loud — instantly.
 * The deep-zoom universe is a continuation downward (/universe); a call dims the
 * world but never leaves it. SFW only, mobile-first, tuned for cold traffic.
 *
 * Funnel: land → tap a face → talk (voice) → soft email wall.
 */
import { useMemo, useEffect, useRef, useState } from "react"
import { makeCharacter, type Cluster } from "@/lib/airroom/roster"
import { avatarBg, avatarGlow } from "@/lib/airroom/avatar"
import { AirBubble } from "@/components/airroom/AirBubble"
import { CaptureWall } from "@/components/airroom/CaptureWall"
import { usePresence } from "@/lib/airroom/presence"
import { startAmbience, setAmbienceDepth, setAmbienceMuted, stopAmbience } from "@/lib/airroom/ambience"
import { track } from "@/lib/airraw/track"

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const hsh = (n: number) => { const x = Math.sin(n * 99.73) * 4391.37; return x - Math.floor(x) } // deterministic, SSR-safe
function tempLabelFor(f: number) {
  if (f < 0.2) return "water · calm"; if (f < 0.42) return "teal · focused"; return "warm · social"
}
function nameColor(f: number) { return f < 0.4 ? "#dff1f6" : f < 0.62 ? "#fbf0dd" : "#ffe2d3" }

// A stable SFW cast spread across water→warm (never fire). Deterministic seeds so
// the face you tap is the exact person (and voice) you meet.
const FIELD = Array.from({ length: 30 }, (_, i) => {
  const seed = (i + 1) * 1009
  const f = clamp01(0.1 + ((seed % 100) / 100) * 0.46) // 0.10 … 0.56
  const size = 54 + Math.round(hsh(seed * 1.3) * 24)   // 54 … 78
  return { seed, f, c: makeCharacter(seed, f), size, fdelay: (hsh(seed) * 5).toFixed(2), bdelay: (hsh(seed * 2.1) * 4).toFixed(2), drop: Math.round(hsh(seed * 3.7) * 26) }
})

export function Lobby() {
  const [active, setActive] = useState<{ seed: number; f: number; c: Cluster } | null>(null)
  const [talked, setTalked] = useState(false)
  const [capture, setCapture] = useState(false)
  const [leadDone, setLeadDone] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const audioOn = useRef(false)

  const presence = usePresence("lobby")

  useEffect(() => { track("airraw_land", { surface: "lobby" }) }, [])
  useEffect(() => { setAmbienceDepth(1) }, [])
  useEffect(() => { setAmbienceMuted(!!active) }, [active])
  useEffect(() => () => stopAmbience(), [])

  const wake = () => { if (!audioOn.current) { audioOn.current = true; startAmbience(); setAmbienceDepth(1); setAmbienceMuted(!!active) } }
  const closeBubble = () => { setActive(null); if (talked && !leadDone) setCapture(true) }
  const onTalked = () => { if (!talked) { setTalked(true); track("airraw_talk", { surface: "lobby" }) } }

  const orbs = useMemo(() => FIELD.map((p, i) => {
    const { seed, f, c, size, fdelay, bdelay, drop } = p
    const glow = avatarGlow(f)
    const isHover = hover === seed
    return (
      <button
        key={seed}
        onClick={() => setActive({ seed, f, c })}
        onMouseEnter={() => setHover(seed)}
        onMouseLeave={() => setHover((h) => (h === seed ? null : h))}
        aria-label={`talk to ${c.host}`}
        className="orb-cell"
        style={{ marginTop: drop, animationDelay: `${fdelay}s` }}
      >
        <span
          className="orb"
          style={{ width: size, height: size, background: avatarBg(seed, f), ["--glow" as string]: glow, animationDelay: `${bdelay}s`, transform: isHover ? "scale(1.12)" : undefined } as React.CSSProperties}
        />
        <span className="orb-name" style={{ color: nameColor(f) }}>{c.host}</span>
        <span className="orb-line" style={{ opacity: isHover ? 1 : 0.62, maxHeight: isHover ? 60 : 32 }}>&ldquo;{c.lines[0]}&rdquo;</span>
      </button>
    )
  }), [hover])

  return (
    <div onPointerDown={wake} className="field-root">
      {/* immersive world: water at the top, ember at the bottom */}
      <div className="world-bg" aria-hidden />
      <div className="world-glow-top" aria-hidden />
      <div className="world-glow-bot" aria-hidden />

      <div className="topbar">
        <div className="wordmark">airraw</div>
        <button onClick={() => setCapture(true)} className="pass-cta">get the pass</button>
      </div>

      <header className="hero">
        <div className="hero-now">it&apos;s the now</div>
        <h1 className="hero-h1">tap a face — and talk, out loud, right now.</h1>
        <div className="live">
          <span className="live-dot" />
          {presence.total > 0 ? `${presence.total} here right now` : "a room full of voices, live"}
        </div>
      </header>

      <div className="field">{orbs}</div>

      <div className="deeper">
        <a href="/universe" className="deeper-link">fall deeper into the universe ↓</a>
        <div className="legal">
          <a href="/airraw/privacy">privacy</a><span>·</span><a href="/airraw/terms">terms</a><span>·</span>some here are AI · some are real
        </div>
      </div>

      {active && <AirBubble cluster={active.c} tempLabel={tempLabelFor(active.f)} onClose={closeBubble} onTalked={onTalked} />}
      {capture && <CaptureWall source="lobby" onClose={() => { setCapture(false); setLeadDone(true) }} />}

      <style>{`
        .field-root { position: relative; min-height: 100vh; overflow-x: hidden; color: #eef4f8; }
        .world-bg { position: fixed; inset: 0; z-index: -3; background: linear-gradient(180deg,#04111b 0%,#070912 34%,#0f0810 66%,#1b0a07 100%); }
        .world-glow-top { position: fixed; inset: 0; z-index: -2; background: radial-gradient(120% 75% at 50% -12%, rgba(64,182,205,.20), transparent 60%); animation: drift 14s ease-in-out infinite alternate; }
        .world-glow-bot { position: fixed; inset: 0; z-index: -2; background: radial-gradient(110% 55% at 50% 114%, rgba(255,96,42,.16), transparent 58%); }
        @keyframes drift { from { transform: translateX(-3%); opacity:.85 } to { transform: translateX(3%); opacity:1 } }

        .topbar { position: sticky; top: 0; z-index: 6; display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; backdrop-filter: blur(6px); background: linear-gradient(180deg, rgba(4,10,18,.6), transparent); }
        .wordmark { font-size: 20px; font-weight: 700; letter-spacing: 5px; }
        .pass-cta { font-size: 12.5px; font-weight: 600; color: #06140f; background: #7fe0c6; border: none; border-radius: 22px; padding: 9px 16px; cursor: pointer; box-shadow: 0 0 18px rgba(127,224,198,.45); }

        .hero { text-align: center; padding: 30px 22px 26px; }
        .hero-now { font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: #7fe0c6; }
        .hero-h1 { font-size: clamp(26px, 6.4vw, 44px); font-weight: 700; line-height: 1.12; margin: 12px auto 16px; max-width: 14ch; background: linear-gradient(180deg,#ffffff,#bcd7e2); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .live { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: #9fb4c4; }
        .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #6fe0b0; box-shadow: 0 0 0 0 rgba(111,224,176,.7); animation: pulse 2s infinite; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(111,224,176,.55) } 70% { box-shadow: 0 0 0 9px rgba(111,224,176,0) } 100% { box-shadow: 0 0 0 0 rgba(111,224,176,0) } }

        .field { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 8px 6px; padding: 8px 14px 12px; align-items: start; }
        @media (min-width: 720px) { .field { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 18px 10px; max-width: 1100px; margin: 0 auto; } }
        .orb-cell { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 10px 6px 14px; color: inherit; animation: floaty 6s ease-in-out infinite; }
        @keyframes floaty { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
        .orb { border-radius: 50%; border: 1px solid rgba(255,255,255,.16); box-shadow: 0 0 14px var(--glow), inset 0 0 6px rgba(255,255,255,.12); animation: breathe 4.5s ease-in-out infinite; transition: transform .25s ease; }
        @keyframes breathe { 0%,100% { box-shadow: 0 0 12px var(--glow), inset 0 0 6px rgba(255,255,255,.1); filter: brightness(1) } 50% { box-shadow: 0 0 30px var(--glow), inset 0 0 8px rgba(255,255,255,.18); filter: brightness(1.12) } }
        .orb-name { font-size: 14px; font-weight: 600; }
        .orb-line { font-size: 11.5px; font-style: italic; color: #aebccb; line-height: 1.35; text-align: center; max-width: 16ch; overflow: hidden; transition: opacity .25s ease, max-height .25s ease; }

        .deeper { text-align: center; padding: 10px 18px 40px; }
        .deeper-link { display: inline-block; font-size: 13.5px; color: #ffd2b0; text-decoration: none; border: .5px solid rgba(255,150,90,.3); background: rgba(255,120,60,.08); border-radius: 24px; padding: 11px 20px; }
        .legal { margin-top: 18px; font-size: 11px; color: #5e6f80; }
        .legal a { color: #7f93a5; text-decoration: none; } .legal span { margin: 0 8px; }
      `}</style>
    </div>
  )
}
