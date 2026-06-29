"use client"

/**
 * ABUSEDAY — situations.
 * One person you shape once. Then the whole app is mini situations: pick a
 * moment, your person plays it out (voice, memory across days). Not characters,
 * not vibes — situations. "Today" leads; the rest are yours to choose.
 */
import { useEffect, useState } from "react"
import { SITUATIONS, situationOfDay, type Situation } from "@/lib/airroom/situations"
import { getPerson, savePerson, hasPerson, personCluster, type YourPerson } from "@/lib/airroom/you"
import type { Heat } from "@/lib/airroom/roster"
import { AirBubble } from "@/components/airroom/AirBubble"

const HC: Record<Heat, string> = { w: "#c084fc", m: "#f472b6", f: "#fb7185" }
const HG: Record<Heat, string> = {
  w: "linear-gradient(135deg,#a855f7,#c084fc)",
  m: "linear-gradient(135deg,#db2777,#f472b6)",
  f: "linear-gradient(135deg,#e11d48,#fb7185)",
}

export default function SituationsPage() {
  const [person, setPerson] = useState<YourPerson | null>(null)
  const [editing, setEditing] = useState(false)
  const [active, setActive] = useState<Situation | null>(null)
  const [today, setToday] = useState<Situation | null>(null)

  useEffect(() => {
    setPerson(getPerson())
    // Client-only day index (avoid SSR/hydration drift from Date).
    const day = Math.floor(Date.now() / 86_400_000)
    setToday(situationOfDay(day))
    if (!hasPerson()) setEditing(true) // first visit → shape your person
  }, [])

  if (!person) return <div style={{ minHeight: "100vh", background: "#0a0710" }} />

  const rest = SITUATIONS.filter((s) => s.id !== today?.id)

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(120% 90% at 50% -10%, #1a0f24 0%, #0a0710 55%)", color: "#f0e8ff", fontFamily: "-apple-system,Segoe UI,Roboto,sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "max(20px, env(safe-area-inset-top)) 18px 120px" }}>

        {/* Brand + your person */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div style={{ fontWeight: 900, letterSpacing: -0.5, fontSize: 19 }}>
            abuse<span style={{ color: "#f472b6" }}>day</span>
          </div>
          <button onClick={() => setEditing(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.05)", border: ".5px solid rgba(255,255,255,.12)", borderRadius: 999, padding: "6px 12px 6px 6px", color: "#e8dcff", cursor: "pointer" }}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: HG.m, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, color: "#fff" }}>{person.name[0]?.toUpperCase()}</span>
            <span style={{ fontSize: 13 }}>with <b>{person.name}</b></span>
            <span style={{ opacity: .4, fontSize: 12 }}>✎</span>
          </button>
        </div>

        {/* Today */}
        {today && (
          <div style={{ marginBottom: 30 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: "rgba(240,232,255,.45)", marginBottom: 10 }}>Today with {person.name}</div>
            <button onClick={() => setActive(today)}
              style={{ width: "100%", textAlign: "left", border: `1px solid ${HC[today.h]}55`, borderRadius: 24, padding: 22, cursor: "pointer", color: "#f0e8ff", position: "relative", overflow: "hidden", background: `linear-gradient(160deg, ${HC[today.h]}22, rgba(10,7,16,.6))` }}>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(80% 60% at 80% 0%, ${HC[today.h]}22, transparent)`, pointerEvents: "none" }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.15 }}>{today.title}</div>
                <div style={{ fontSize: 14, color: "rgba(240,232,255,.62)", marginTop: 8, lineHeight: 1.5 }}>{today.setup}</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, background: HG[today.h], color: "#fff", fontWeight: 800, fontSize: 14, padding: "11px 20px", borderRadius: 999 }}>
                  Step in →
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Pick a situation */}
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: "rgba(240,232,255,.45)", marginBottom: 12 }}>Or choose your moment</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
          {rest.map((s) => (
            <button key={s.id} onClick={() => setActive(s)}
              style={{ textAlign: "left", border: `.5px solid ${HC[s.h]}33`, borderRadius: 18, padding: 15, cursor: "pointer", color: "#f0e8ff", background: "rgba(255,255,255,.025)", minHeight: 124, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: HC[s.h], marginBottom: 9 }} />
                <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.2 }}>{s.title}</div>
              </div>
              <div style={{ fontSize: 12, color: "rgba(240,232,255,.5)", lineHeight: 1.4, marginTop: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.setup}</div>
            </button>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 26, fontSize: 11, color: "rgba(240,232,255,.3)" }}>
          One person. A new situation every day. She remembers.
        </div>
      </div>

      {/* Shape your person */}
      {editing && (
        <PersonSheet person={person} onSave={(p) => { savePerson(p); setPerson(p); setEditing(false) }} onClose={() => setEditing(false)} />
      )}

      {/* Enter the situation — your person plays it out */}
      {active && (
        <AirBubble
          cluster={personCluster(person, active.title, active.h)}
          tempLabel={active.title}
          situation={active.setup}
          opening={active.opener}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  )
}

function PersonSheet({ person, onSave, onClose }: { person: YourPerson; onSave: (p: YourPerson) => void; onClose: () => void }) {
  const [name, setName] = useState(person.name)
  const [gender, setGender] = useState(person.gender)
  const [who, setWho] = useState(person.who)
  const input: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,.05)", border: ".5px solid rgba(255,255,255,.14)", borderRadius: 14, padding: "13px 15px", color: "#f0e8ff", fontSize: 15, outline: "none", boxSizing: "border-box" }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#140d1e", borderTop: "1px solid rgba(255,255,255,.1)", borderRadius: "26px 26px 0 0", padding: "26px 20px max(26px, env(safe-area-inset-bottom))" }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>Your person</div>
        <div style={{ fontSize: 13, color: "rgba(240,232,255,.5)", marginTop: 4, marginBottom: 18 }}>Shape them once. Every situation is them.</div>

        <label style={{ fontSize: 12, color: "rgba(240,232,255,.55)" }}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mara" style={{ ...input, marginTop: 6, marginBottom: 14 }} />

        <label style={{ fontSize: 12, color: "rgba(240,232,255,.55)" }}>Who they are to you</label>
        <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="the one who always pulls you back in" style={{ ...input, marginTop: 6, marginBottom: 16 }} />

        <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
          {(["female", "male"] as const).map((g) => (
            <button key={g} onClick={() => setGender(g)}
              style={{ flex: 1, padding: "11px 0", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 700, textTransform: "capitalize", border: gender === g ? "none" : ".5px solid rgba(255,255,255,.14)", background: gender === g ? HG.m : "rgba(255,255,255,.04)", color: gender === g ? "#fff" : "#cfc0e8" }}>
              {g}
            </button>
          ))}
        </div>

        <button onClick={() => onSave({ name: name.trim() || "Mara", gender, who: who.trim() || "the one who always pulls you back in" })}
          style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 800, background: HG.m, color: "#fff" }}>
          That's her
        </button>
      </div>
    </div>
  )
}
