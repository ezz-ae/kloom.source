"use client"

/**
 * AIRRAW — adult discovery floor.
 * Scrollable map of categories: Stories → Romance → Lesbian → Gay → Groups → BDSM → Wild.
 * Drift by feel. Tap a pin to enter.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ROSTER, ROSTER_COUNT, type Heat } from "@/lib/airroom/roster"
import { AirBubble } from "@/components/airroom/AirBubble"
import { detectLanguage } from "@/lib/languages"

const CLUSTERS = ROSTER
const FLOOR_H = 5400
const GATE_F = 0.40

// Adult heat palette — purple → pink → red
const PIN_COLOR: Record<Heat, string>  = { w: "#c084fc", m: "#f472b6", f: "#fb7185" }
const GLOW_COLOR: Record<Heat, string> = { w: "rgba(192,132,252,.5)", m: "rgba(244,114,182,.5)", f: "rgba(251,113,133,.5)" }
const FILL_COLOR: Record<Heat, string> = { w: "rgba(192,132,252,.12)", m: "rgba(244,114,182,.12)", f: "rgba(251,113,133,.12)" }
const GRAD_BTN: Record<Heat, string>   = {
  w: "linear-gradient(135deg,#a855f7,#c084fc)",
  m: "linear-gradient(135deg,#db2777,#f472b6)",
  f: "linear-gradient(135deg,#e11d48,#fb7185)",
}

// Short label per archetype for the pin circle
const ARCH_ABBR: Record<string, string> = {
  Stories: "S", Romance: "R", Roleplay: "RP", GFE: "GF",
  Lesbian: "L", Gay: "G", Couples: "C", Groups: "GR", BDSM: "BD", Wild: "W",
}

function zoneLabel(f: number): string {
  if (f < 0.15) return "Stories"
  if (f < 0.32) return "Romance"
  if (f < 0.48) return "Roleplay · GFE"
  if (f < 0.60) return "Lesbian"
  if (f < 0.68) return "Gay"
  if (f < 0.78) return "Couples"
  if (f < 0.87) return "Groups"
  if (f < 0.94) return "BDSM"
  return "Wild"
}

export default function FloorPage() {
  const [lang, setLang] = useState("English")
  const langRef = useRef("English")
  useEffect(() => { const d = detectLanguage(); setLang(d); langRef.current = d }, [])
  useEffect(() => { langRef.current = lang }, [lang])
  const [vh, setVh] = useState(720)
  const [depth, setDepth] = useState(0.12 * (FLOOR_H - 720))
  const [entered, setEntered] = useState(false)
  const [soundOn, setSoundOn] = useState(false)
  const [spoken, setSpoken] = useState("")
  const [verified, setVerified] = useState(false)
  const [showGate, setShowGate] = useState(false)
  const dragRef = useRef<{ y: number; d: number } | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const speakTok = useRef(0)

  const maxDepth = Math.max(0, FLOOR_H - vh)
  const center = vh / 2

  useEffect(() => {
    const measure = () => setVh(window.innerHeight)
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  useEffect(() => {
    try { if (localStorage.getItem("airroom_18") === "1") setVerified(true) } catch { /* */ }
  }, [])

  const move = useCallback((d: number) => {
    const gateDepth = Math.max(0, GATE_F * (FLOOR_H - 220) + 110 - vh / 2)
    const cap = verified ? maxDepth : Math.min(maxDepth, gateDepth)
    if (!verified && d > cap + 6) setShowGate(true)
    setDepth(Math.max(0, Math.min(cap, d)))
  }, [maxDepth, vh, verified])

  const { active, lit } = useMemo(() => {
    let best = Infinity, bi = 0
    const lit = CLUSTERS.map((c, i) => {
      const top = c.f * (FLOOR_H - 220) + 110
      const screenY = top - depth
      const dist = Math.abs(screenY - center)
      if (dist < best) { best = dist; bi = i }
      return { top, opacity: Math.max(0.15, Math.min(1, 1.15 - dist / (vh * 0.42))), near: dist < 80 }
    })
    return { active: bi, lit }
  }, [depth, center, vh])

  const f = maxDepth > 0 ? depth / maxDepth : 0
  const a = CLUSTERS[active]
  const displayLine = soundOn ? (spoken || a.lines[0]) : a.lines[0]
  const ac = PIN_COLOR[a.h]
  const ag = GLOW_COLOR[a.h]
  const af = FILL_COLOR[a.h]

  useEffect(() => {
    if (!soundOn || entered) return
    const tok = ++speakTok.current
    const c = CLUSTERS[active]
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    setSpoken(c.lines[0])
    let i = 0
    ;(async () => {
      await wait(500)
      if (speakTok.current !== tok) return
      while (speakTok.current === tok) {
        const line = c.lines[i % c.lines.length]; i++
        setSpoken(line)
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: line, personaName: c.host, gender: c.gender, language: langRef.current }),
          })
          if (speakTok.current !== tok) return
          if (!res.ok) { await wait(1600); continue }
          const url = URL.createObjectURL(await res.blob())
          if (speakTok.current !== tok) { URL.revokeObjectURL(url); return }
          const audio = audioRef.current
          if (audio) {
            audio.src = url
            await audio.play().catch(() => {})
            await new Promise<void>((r) => { audio.onended = () => r(); audio.onerror = () => r() })
          }
          URL.revokeObjectURL(url)
          await wait(700)
        } catch { await wait(1600) }
      }
    })()
    return () => { speakTok.current++; try { audioRef.current?.pause() } catch {} }
  }, [active, soundOn, entered])

  const onWheel = (e: React.WheelEvent) => move(depth + e.deltaY)
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { y: e.clientY, d: depth }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) move(dragRef.current.d + (dragRef.current.y - e.clientY))
  }
  const onPointerUp = () => { dragRef.current = null }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") move(depth + 120)
      if (e.key === "ArrowUp") move(depth - 120)
    }
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [depth, move])

  const gateTop = GATE_F * (FLOOR_H - 220) + 110

  return (
    <div
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#07040f", cursor: "grab", touchAction: "none", userSelect: "none", fontFamily: "var(--font-geist), system-ui, sans-serif" }}
    >
      <style>{`
        @keyframes arbr{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes pinpulse{0%{transform:translate(-50%,-50%) scale(1);opacity:.6}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}
        @keyframes mapgrid{from{opacity:.03}to{opacity:.07}}
        .ar-pin{animation:arbr 2.8s ease-in-out infinite}
        .pin-ring{position:absolute;left:50%;top:50%;border-radius:50%;pointer-events:none;animation:pinpulse 2s ease-out infinite}
      `}</style>

      {/* scrolling floor */}
      <div style={{
        position: "absolute", left: 0, right: 0, top: 0, height: FLOOR_H,
        transform: `translateY(${-depth}px)`,
        background: "linear-gradient(180deg,#08041a 0%,#0f0521 8%,#160630 18%,#1a0828 27%,#1e0c24 36%,#1e0c1e 45%,#1e0c18 54%,#1e0a12 63%,#1a060c 73%,#140407 84%,#0a0204 100%)",
      }}>

        {/* subtle map grid lines */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.05, backgroundImage: "linear-gradient(rgba(200,150,255,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(200,150,255,.4) 1px,transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none" }} />

        {/* 18+ gate line */}
        <div style={{ position: "absolute", left: 0, right: 0, top: gateTop, borderTop: "1px dashed rgba(244,114,182,.35)", textAlign: "center" }}>
          <span style={{ fontSize: 10, color: "#f472b6", background: "#1a0818", padding: "2px 12px", borderRadius: 12, position: "relative", top: -10, letterSpacing: 1 }}>
            18+ · explicit content below
          </span>
        </div>

        {/* cluster map pins */}
        {CLUSTERS.map((c, i) => {
          const isActive = i === active
          const pc = PIN_COLOR[c.h]
          const gc = GLOW_COLOR[c.h]
          const fc = FILL_COLOR[c.h]
          const sz = isActive ? 58 : 40
          const abbr = ARCH_ABBR[c.archetype] || c.archetype.slice(0, 2).toUpperCase()
          return (
            <div
              key={c.name + i}
              onClick={() => setEntered(true)}
              style={{
                position: "absolute", left: 0, right: 0, top: lit[i].top,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
                opacity: lit[i].opacity,
                transform: `scale(${isActive ? 1.08 : 1})`,
                transition: "opacity .14s, transform .18s",
                cursor: "pointer",
              }}
            >
              {/* outer glow ring (active only) */}
              {isActive && (
                <>
                  <div className="pin-ring" style={{ width: sz + 32, height: sz + 32, border: `1px solid ${pc}`, opacity: 0.4 }} />
                  <div className="pin-ring" style={{ width: sz + 14, height: sz + 14, border: `1.5px solid ${pc}`, animationDelay: "0.6s" }} />
                </>
              )}

              {/* pin circle */}
              <div style={{
                position: "relative",
                width: sz, height: sz, borderRadius: "50%",
                border: `${isActive ? 2 : 1.5}px solid ${pc}`,
                background: isActive
                  ? `radial-gradient(circle, ${fc.replace(".12", ".25")} 0%, rgba(10,4,20,.9) 100%)`
                  : `radial-gradient(circle, ${fc} 0%, rgba(8,4,16,.95) 100%)`,
                boxShadow: isActive ? `0 0 28px -4px ${gc}, 0 0 8px -2px ${gc}` : `0 0 10px -4px ${gc}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                transition: "all .18s",
              }}>
                <span className="ar-pin" style={{ fontSize: isActive ? 15 : 11, fontWeight: 700, color: pc, letterSpacing: -0.5 }}>{abbr}</span>
              </div>

              {/* connector stem */}
              <div style={{ width: 1.5, height: isActive ? 10 : 7, background: `linear-gradient(180deg,${pc},transparent)`, opacity: 0.7 }} />

              {/* name + vibe */}
              <div style={{ fontSize: isActive ? 13 : 10.5, fontWeight: isActive ? 600 : 500, color: isActive ? pc : `${pc}99`, letterSpacing: 0.2, lineHeight: 1.2 }}>{c.name}</div>
              <div style={{ fontSize: 9.5, color: isActive ? `${pc}cc` : "rgba(255,255,255,.28)", letterSpacing: 0.5, marginTop: 1 }}>{c.vibe}</div>

              {/* people count */}
              {isActive && (
                <div style={{ marginTop: 5, fontSize: 9, color: pc, background: fc, border: `1px solid ${pc}50`, borderRadius: 99, padding: "2px 8px", letterSpacing: 0.5 }}>
                  {c.n} inside
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* top gradient scrim */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 130, background: "linear-gradient(180deg,rgba(7,4,15,.95) 0%,rgba(7,4,15,0) 100%)", pointerEvents: "none" }} />
      {/* bottom gradient scrim */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 260, background: "linear-gradient(0deg,rgba(7,4,15,.98) 0%,rgba(7,4,15,.6) 60%,rgba(7,4,15,0) 100%)", pointerEvents: "none" }} />

      {/* top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "18px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 5, color: "#f0e8ff" }}>airraw</div>
          <div style={{ fontSize: 11, color: ac, letterSpacing: 1.5, marginTop: 3, transition: "color .3s" }}>
            📍 {zoneLabel(f)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, pointerEvents: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#f0e8ff", background: "rgba(192,132,252,.18)", border: "1px solid rgba(192,132,252,.35)", padding: "5px 12px", borderRadius: 20 }}>18+</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)", letterSpacing: 0.5 }}>{ROSTER_COUNT} people</div>
        </div>
      </div>

      {/* you indicator — the cursor on the map */}
      <div style={{ position: "absolute", top: center, left: "50%", transform: "translate(-50%,-50%)", zIndex: 5, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2px solid rgba(255,255,255,.85)", boxShadow: "0 0 20px rgba(255,255,255,.25), inset 0 0 12px rgba(255,255,255,.08)", background: "rgba(255,255,255,.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,.8)", letterSpacing: 1 }}>you</div>
      </div>

      {/* depth gauge — right side */}
      <div style={{ position: "absolute", right: 14, top: 100, bottom: 200, width: 3, borderRadius: 3, background: "linear-gradient(180deg,#c084fc,#f472b6,#fb7185)", opacity: 0.3, pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: "50%", top: `${f * 100}%`, transform: "translate(-50%,-50%)", width: 10, height: 10, borderRadius: "50%", background: ac, boxShadow: `0 0 8px ${ac}`, transition: "background .3s, box-shadow .3s" }} />
      </div>

      {/* bottom card — active category info + enter button */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 18px 28px" }}>

        {/* category header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            border: `1.5px solid ${ac}`,
            background: af.replace(".12", ".2"),
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: ac, letterSpacing: -0.5,
          }}>
            {ARCH_ABBR[a.archetype] || a.archetype.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#f0e8ff", letterSpacing: -0.3 }}>{a.name}</div>
            <div style={{ fontSize: 11, color: ac, letterSpacing: 0.8, marginTop: 1 }}>{a.vibe} · {a.n} inside</div>
          </div>
          {/* sound toggle */}
          <button
            onClick={() => setSoundOn(s => !s)}
            style={{
              marginLeft: "auto", flexShrink: 0,
              width: 40, height: 40, borderRadius: 12,
              background: soundOn ? af.replace(".12", ".25") : "rgba(255,255,255,.06)",
              border: `1px solid ${soundOn ? ac : "rgba(255,255,255,.12)"}`,
              color: soundOn ? ac : "rgba(255,255,255,.4)",
              fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {soundOn ? "♪" : "○"}
          </button>
        </div>

        {/* quote bubble */}
        <div style={{
          background: "rgba(255,255,255,.05)",
          border: ".5px solid rgba(255,255,255,.09)",
          borderRadius: 14,
          padding: "12px 15px",
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 14, lineHeight: 1.55, color: "#d8c8f0", fontStyle: "italic" }}>
            &ldquo;{displayLine}&rdquo;
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)", marginTop: 6 }}>— {a.host}</div>
        </div>

        {/* action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setSoundOn(s => !s)}
            style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: "rgba(255,255,255,.06)",
              border: ".5px solid rgba(255,255,255,.12)",
              color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 500,
              cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
            }}
          >
            <span style={{ fontSize: 16 }}>{soundOn ? "🔊" : "🔇"}</span>
            <span style={{ fontSize: 9, letterSpacing: 0.5 }}>{soundOn ? "live" : "mute"}</span>
          </button>

          <button
            onClick={() => setEntered(true)}
            style={{
              flex: 1, height: 52, borderRadius: 14,
              background: GRAD_BTN[a.h],
              border: "none",
              color: "#fff",
              fontSize: 15, fontWeight: 700,
              cursor: "pointer",
              boxShadow: `0 10px 28px -10px ${ag}`,
              letterSpacing: 0.3,
              transition: "box-shadow .2s",
            }}
          >
            Enter {a.name}  →
          </button>
        </div>
      </div>

      {/* 18+ gate overlay */}
      {showGate && !verified && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(7,4,15,.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 28, zIndex: 30 }}>
          <div style={{ maxWidth: 340, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔞</div>
            <div style={{ fontSize: 12, letterSpacing: 2, color: "#f472b6", textTransform: "uppercase", marginBottom: 8 }}>adults only</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#f0e8ff", marginBottom: 10, lineHeight: 1.3 }}>explicit content ahead</div>
            <div style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(240,232,255,.65)", marginBottom: 24 }}>kink, groups, explicit roleplay — everything adults actually want. confirm your age to keep going.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => { setVerified(true); setShowGate(false); try { localStorage.setItem("airroom_18", "1") } catch { /* */ } }}
                style={{ fontSize: 15, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#db2777,#f472b6)", border: "none", borderRadius: 14, padding: "14px 0", cursor: "pointer", boxShadow: "0 10px 28px -10px rgba(244,114,182,.6)" }}
              >
                I&apos;m 18 or older — let me in
              </button>
              <button
                onClick={() => setShowGate(false)}
                style={{ fontSize: 14, color: "rgba(240,232,255,.5)", background: "transparent", border: ".5px solid rgba(255,255,255,.12)", borderRadius: 14, padding: "13px 0", cursor: "pointer" }}
              >
                go back
              </button>
            </div>
            <div style={{ marginTop: 14, fontSize: 10, color: "rgba(255,255,255,.25)", letterSpacing: 0.5 }}>by continuing you confirm you are 18+</div>
          </div>
        </div>
      )}

      {entered && (
        <AirBubble cluster={a} tempLabel={zoneLabel(f)} lang={lang} onClose={() => setEntered(false)} />
      )}

      <audio ref={audioRef} style={{ display: "none" }} />
    </div>
  )
}
