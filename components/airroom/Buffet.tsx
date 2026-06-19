"use client"

/**
 * AIRROOM — the buffet. The landing: the whole open spread of characters at
 * once, grazeable, tinted water→fire. You don't make one or search for one —
 * you walk in and pick from the room. Tap anyone to air off with them. The
 * spatial floor (the scroll) is one tap away. Fire (18+) picks are gated.
 */
import { useEffect, useState } from "react"
import { CHARACTERS, type Cluster } from "@/lib/airroom/roster"
import { AirBubble } from "@/components/airroom/AirBubble"

const DOT: Record<string, string> = { w: "#6fd6e6", m: "#ffce7a", f: "#ff7a4d" }
const LAB: Record<string, string> = { w: "#cdeef4", m: "#ffe6bd", f: "#ffc6ad" }

function tempLabelFor(f: number): string {
  if (f < 0.2) return "water · calm"
  if (f < 0.42) return "teal · focused"
  if (f < 0.6) return "warm · social"
  if (f < 0.78) return "amber · loud"
  return "fire · wild"
}

export function Buffet() {
  const [active, setActive] = useState<Cluster | null>(null)
  const [verified, setVerified] = useState(false)
  const [pendingFire, setPendingFire] = useState<Cluster | null>(null)

  useEffect(() => { try { if (localStorage.getItem("airroom_18") === "1") setVerified(true) } catch { /* */ } }, [])

  const pick = (c: Cluster) => {
    if (c.h === "f" && !verified) { setPendingFire(c); return }
    setActive(c)
  }
  const confirm18 = () => {
    setVerified(true)
    try { localStorage.setItem("airroom_18", "1") } catch { /* */ }
    const c = pendingFire; setPendingFire(null); if (c) setActive(c)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#06070e", color: "#eef4f8" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "linear-gradient(180deg,#06070e 60%,rgba(6,7,14,.85))", padding: "20px 18px 14px", borderBottom: ".5px solid rgba(255,255,255,.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: 4 }}>airraw</div>
            <div style={{ fontSize: 12, color: "#9fb2c4", marginTop: 2 }}>it&apos;s the now · {CHARACTERS.length} here · pick anyone</div>
          </div>
          <a href="/floor" style={{ fontSize: 12, color: "#dfeaf2", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.18)", borderRadius: 20, padding: "7px 13px", textDecoration: "none", whiteSpace: "nowrap" }}>walk the floor →</a>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, padding: 16 }}>
        {CHARACTERS.map((c, i) => (
          <button key={i} onClick={() => pick(c)} style={{ textAlign: "left", background: "rgba(255,255,255,.04)", border: `.5px solid ${DOT[c.h]}33`, borderRadius: 14, padding: "12px 13px", cursor: "pointer", color: "#eef4f8", display: "flex", flexDirection: "column", gap: 6, minHeight: 106 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: DOT[c.h], boxShadow: `0 0 7px ${DOT[c.h]}` }} />
              <span style={{ fontSize: 15, fontWeight: 500, color: LAB[c.h] }}>{c.host}</span>
            </div>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: "rgba(255,255,255,.5)" }}>{c.archetype.toLowerCase()} · {c.vibe}</div>
            <div style={{ fontSize: 12, color: "#aebccb", fontStyle: "italic", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>&ldquo;{c.lines[i % c.lines.length]}&rdquo;</div>
          </button>
        ))}
      </div>

      {active && <AirBubble cluster={active} tempLabel={tempLabelFor(active.f)} onClose={() => setActive(null)} />}

      {pendingFire && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,6,4,.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 26, zIndex: 30 }}>
          <div style={{ maxWidth: 340, textAlign: "center", color: "#fbeae3" }}>
            <div style={{ fontSize: 12, letterSpacing: 1, color: "#ff9c73" }}>this one&apos;s on the fire floor</div>
            <div style={{ fontSize: 21, fontWeight: 500, margin: "8px 0 10px" }}>it gets adult</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "#e7c3b6" }}>flirty, late-night, 18+. nothing explicit — but grown. confirm you&apos;re old enough.</div>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 9 }}>
              <button onClick={confirm18} style={{ fontSize: 14, fontWeight: 500, color: "#1a0d08", background: "#ef7a4d", border: "none", borderRadius: 14, padding: "12px 0", cursor: "pointer" }}>i&apos;m 18 or older</button>
              <button onClick={() => setPendingFire(null)} style={{ fontSize: 14, color: "#e7c3b6", background: "transparent", border: ".5px solid rgba(255,160,120,.3)", borderRadius: 14, padding: "12px 0", cursor: "pointer" }}>never mind</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
