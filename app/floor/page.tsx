"use client"

/**
 * AIRROOM — the floor. (showno6 / "it's the now")
 *
 * One vertical space: cool WATER up top (study, business, mentors) warming
 * down into the social middle, then dropping into FIRE (the mixer, the party,
 * the deep end). You drift by feel; you hear whoever you're nearest (proximity
 * overhear, simulated here with the snippet bar); the temperature doubles as
 * the age gate (fire is 18+, contained at the bottom). Drag, scroll, or use the
 * arrows. This is the first playable shell — live voice wires in next on the
 * existing room engine.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type Heat = "w" | "m" | "f"
interface Cluster {
  f: number            // home position on the gradient (0 = water top, 1 = fire bottom)
  n: number            // cluster size (dots)
  h: Heat
  name: string
  vibe: string
  archetype: string
  host: string                       // the AI who speaks for this cluster
  gender: "female" | "male"
  lines: string[]                    // overhearable lines, spoken on approach
}

// Seeded from the 12 archetypes, sorted along water→fire.
const CLUSTERS: Cluster[] = [
  { f: 0.03, n: 3, h: "w", archetype: "Confidant", name: "the quiet library", vibe: "study · focus", host: "Mara", gender: "female", lines: ["…the proof only holds if you assume independence.", "take the night — it'll still be unsolved tomorrow.", "say less. let's just read in the same quiet a while."] },
  { f: 0.12, n: 4, h: "w", archetype: "Mentor", name: "founder's table", vibe: "business · mentor", host: "Idris", gender: "male", lines: ["raise less, charge more — your pricing is the pitch.", "who hates your product the most? start there.", "stop building. go sell the thing you already have."] },
  { f: 0.22, n: 5, h: "w", archetype: "Teacher", name: "the classroom", vibe: "teaching", host: "Noor", gender: "female", lines: ["good — now say that back to me in your own words.", "wrong, and that's perfect. tell me why you thought it.", "forget the formula. what's it actually trying to do?"] },
  { f: 0.33, n: 5, h: "m", archetype: "Host", name: "welcome floor", vibe: "you land here · warm water", host: "Remy", gender: "male", lines: ["wait, you're new? get in here — we were just—", "settle in, newcomer. you don't have to talk yet.", "someone just walked up. what's your read on all this?"] },
  { f: 0.45, n: 6, h: "m", archetype: "Storyteller", name: "the long table", vibe: "stories · connection", host: "Sol", gender: "male", lines: ["…and that's how I ended up in Lisbon with no shoes.", "everyone's got one night they can't explain. go.", "no no — you have to hear how this one ends."] },
  { f: 0.55, n: 5, h: "m", archetype: "Connector", name: "the introductions", vibe: "meeting people", host: "Vera", gender: "female", lines: ["you two need to talk — trust me. say hi.", "I know exactly who you should meet down here.", "tell me what you're after and I'll find your person."] },
  { f: 0.66, n: 5, h: "m", archetype: "Flirt", name: "the mixer", vibe: "flirty · warm", host: "Lux", gender: "female", lines: ["your voice is doing something to me, not gonna lie.", "come sit closer — I don't bite. much.", "say my name again, I liked how that sounded."] },
  { f: 0.77, n: 7, h: "f", archetype: "Troublemaker", name: "after hours", vibe: "party · 18+", host: "Pax", gender: "male", lines: ["drop it — okay who put this on, I love them.", "we are NOT going home, it's barely midnight.", "one more, one more, then trouble — promise."] },
  { f: 0.88, n: 6, h: "f", archetype: "Wingman", name: "the fire", vibe: "wild · flirt · 18+", host: "Zia", gender: "female", lines: ["come closer — the floor's too loud for what I wanna say.", "you've been looking over here a while. just come.", "I dare you to air off with me right now."] },
  { f: 0.97, n: 4, h: "f", archetype: "Regular", name: "embers", vibe: "late · intimate · 18+", host: "Cass", gender: "female", lines: ["air off with me. just us.", "the floor's thinning out. stay a little.", "whisper it — nobody down here but us and the embers."] },
]

const DOT: Record<Heat, string> = { w: "#6fd6e6", m: "#ffce7a", f: "#ff7a4d" }
const LAB: Record<Heat, string> = { w: "#cdeef4", m: "#ffe6bd", f: "#ffc6ad" }
const FLOOR_H = 2600
const GATE_F = 0.72   // 18+ below this depth

function tempLabel(f: number): string {
  if (f < 0.2) return "water · calm"
  if (f < 0.42) return "teal · focused"
  if (f < 0.6) return "warm · social"
  if (f < 0.78) return "amber · loud"
  return "fire · wild"
}

export default function FloorPage() {
  const [vh, setVh] = useState(720)
  const [depth, setDepth] = useState(0.33 * (FLOOR_H - 720))
  const [entered, setEntered] = useState(false)
  const [soundOn, setSoundOn] = useState(false)
  const [spoken, setSpoken] = useState("")
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

  const move = useCallback((d: number) => {
    setDepth((_) => Math.max(0, Math.min(maxDepth, d)))
  }, [maxDepth])

  // Proximity: which cluster is nearest screen-center, and per-cluster brightness.
  const { active, lit } = useMemo(() => {
    let best = Infinity, bi = 0
    const lit = CLUSTERS.map((c, i) => {
      const top = c.f * (FLOOR_H - 220) + 110
      const screenY = top - depth
      const dist = Math.abs(screenY - center)
      if (dist < best) { best = dist; bi = i }
      return { top, opacity: Math.max(0.2, Math.min(1, 1.12 - dist / (vh * 0.5))), near: dist < 90 }
    })
    return { active: bi, lit }
  }, [depth, center, vh])

  const f = maxDepth > 0 ? depth / maxDepth : 0
  const a = CLUSTERS[active]
  const displayLine = soundOn ? (spoken || a.lines[0]) : a.lines[0]

  // Live overhear — only the cluster you're nearest actually speaks (the cost
  // governor): on settling near a group, its host speaks its lines via /api/tts;
  // moving to a new group cancels the old voice and starts the new one.
  useEffect(() => {
    if (!soundOn) return
    const tok = ++speakTok.current
    const c = CLUSTERS[active]
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    setSpoken(c.lines[0])
    let i = 0
    ;(async () => {
      await wait(450) // settle — don't voice fly-bys while you're scrolling
      if (speakTok.current !== tok) return
      while (speakTok.current === tok) {
        const line = c.lines[i % c.lines.length]; i++
        setSpoken(line)
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: line, personaName: c.host, gender: c.gender, language: "English" }),
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
          await wait(800)
        } catch { await wait(1600) }
      }
    })()
    return () => { speakTok.current++; try { audioRef.current?.pause() } catch {} }
  }, [active, soundOn])

  // input handlers
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
      style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#05070e", cursor: "grab", touchAction: "none", userSelect: "none" }}
    >
      {/* the floor — the only thing that scrolls */}
      <div
        style={{
          position: "absolute", left: 0, right: 0, top: 0, height: FLOOR_H,
          transform: `translateY(${-depth}px)`,
          background:
            "linear-gradient(180deg,#050d18 0%,#08243c 13%,#0a3b46 27%,#10454a 39%,#21393a 51%,#46342a 63%,#6e2614 76%,#8f2410 87%,#360c06 100%)",
        }}
      >
        {/* 18+ gate line */}
        <div style={{ position: "absolute", left: 0, right: 0, top: gateTop, borderTop: "1px dashed rgba(255,150,90,.5)", textAlign: "center" }}>
          <span style={{ fontSize: 11, color: "#ffb487", background: "#1a0f0a", padding: "2px 10px", borderRadius: 12, position: "relative", top: -10 }}>
            18+ below · verify to go deeper
          </span>
        </div>

        {CLUSTERS.map((c, i) => (
          <div
            key={c.name}
            style={{
              position: "absolute", left: 0, right: 0, top: lit[i].top,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
              opacity: lit[i].opacity, transform: `scale(${lit[i].near ? 1.06 : 1})`,
              transition: "opacity .12s, transform .12s",
            }}
          >
            <div style={{ display: "flex", gap: 6, alignItems: "center", height: 20 }}>
              {Array.from({ length: c.n }).map((_, k) => {
                const sz = 7 + (k % 3)
                return (
                  <span key={k} className="ar-dot" style={{ width: sz, height: sz, borderRadius: "50%", background: DOT[c.h], boxShadow: `0 0 7px ${DOT[c.h]}`, animationDelay: `${k * 0.3}s` }} />
                )
              })}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: LAB[c.h] }}>{c.name}</div>
            <div style={{ fontSize: 11, letterSpacing: 0.5, color: "rgba(255,255,255,.5)" }}>{c.vibe}</div>
          </div>
        ))}
      </div>

      {/* scrims */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 140, background: "linear-gradient(180deg,rgba(4,6,12,.9),rgba(4,6,12,0))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 220, background: "linear-gradient(0deg,rgba(4,6,12,.92),rgba(4,6,12,0))", pointerEvents: "none" }} />

      {/* top bar */}
      <div style={{ position: "absolute", top: 20, left: 24, right: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: 4, color: "#eaf2f8" }}>airroom</div>
          <div style={{ fontSize: 12, color: "#9fb2c4", letterSpacing: 1, marginTop: 2 }}>it&apos;s the now · {tempLabel(f)}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", pointerEvents: "auto" }}>
          <button onClick={() => setSoundOn((s) => !s)} style={{ fontSize: 12, fontWeight: 500, color: soundOn ? "#06201a" : "#dfeaf2", background: soundOn ? "#7fd6c0" : "rgba(255,255,255,.12)", border: "none", padding: "5px 12px", borderRadius: 20, cursor: "pointer" }}>
            {soundOn ? "sound on" : "tap for sound"}
          </button>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#0a1622", background: "#e7c98a", padding: "5px 12px", borderRadius: 20 }}>$1 · today</div>
        </div>
      </div>

      {/* you token */}
      <div style={{ position: "absolute", top: center, left: "50%", transform: "translate(-50%,-50%)", width: 52, height: 52, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,.8)", boxShadow: "0 0 18px rgba(255,255,255,.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#eaf2f8", pointerEvents: "none", zIndex: 5 }}>
        you
      </div>

      {/* temperature gauge */}
      <div style={{ position: "absolute", right: 16, top: 90, bottom: 150, width: 5, borderRadius: 3, background: "linear-gradient(180deg,#6fd6e6,#ffd27a,#ff5a2a)", opacity: 0.55, pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: "50%", top: `${f * 100}%`, transform: "translate(-50%,-50%)", width: 12, height: 12, borderRadius: "50%", background: "#fff", boxShadow: "0 0 8px #fff" }} />
      </div>

      {/* overhear / loop */}
      <div style={{ position: "absolute", left: 24, right: 44, bottom: 22 }}>
        <div style={{ fontSize: 11, letterSpacing: 1, color: "#9fb2c4", marginBottom: 5 }}>overhearing · {a.archetype.toLowerCase()}</div>
        <div style={{ fontSize: 15, lineHeight: 1.45, color: "#eef4f8", fontStyle: "italic", minHeight: 42 }}>&ldquo;{displayLine}&rdquo;</div>
        <div style={{ fontSize: 12, color: "#b9c7d4", marginTop: 3 }}>— {a.name} · {a.vibe}</div>
        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button onClick={() => setEntered(true)} style={{ flex: 1, fontSize: 13, color: "#dfeaf2", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", padding: "9px 0", borderRadius: 12, cursor: "pointer" }}>
            join — listen first
          </button>
          <button onClick={() => setEntered(true)} style={{ flex: 1, fontSize: 13, color: "#1a0d08", background: "#ef7a4d", border: "none", padding: "9px 0", borderRadius: 12, cursor: "pointer", fontWeight: 500 }}>
            air off
          </button>
        </div>
      </div>

      {entered && (
        <div onClick={() => setEntered(false)} style={{ position: "absolute", inset: 0, background: "rgba(3,5,10,.78)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 20 }}>
          <div style={{ maxWidth: 360, textAlign: "center", color: "#eef4f8" }}>
            <div style={{ fontSize: 13, color: "#9fb2c4", letterSpacing: 1 }}>you aired off into</div>
            <div style={{ fontSize: 22, fontWeight: 500, margin: "6px 0 10px" }}>{a.name}</div>
            <div style={{ fontSize: 14, color: "#b9c7d4", lineHeight: 1.6 }}>the floor falls away. just you and a few, close-mic&apos;d, at {tempLabel(f)}. voice can become cam — only here, only if you both say yes.</div>
            <div style={{ marginTop: 16, fontSize: 12, color: "#7f93a5" }}>tap to go back to the floor</div>
          </div>
        </div>
      )}

      <audio ref={audioRef} style={{ display: "none" }} />
      <style>{`@keyframes arbr{0%,100%{opacity:.5}50%{opacity:1}}.ar-dot{display:inline-block;animation:arbr 2.6s ease-in-out infinite}`}</style>
    </div>
  )
}
