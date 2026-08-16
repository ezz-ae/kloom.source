"use client"

/**
 * AIRROOM — the deep-zoom buffet. You fall INTO the abundance:
 *   20 worlds  →  zoom  →  ~1,000 rooms  →  zoom  →  100,000 voices  →  tap → air off
 * Level-of-detail, like a map: only what's on screen is drawn, the big numbers are
 * the felt population, and a real character is minted the instant you open one
 * (lib/airroom/roster.makeCharacter). Cool→hot temperature runs through every level.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { makeCharacter, type Cluster } from "@/lib/airroom/roster"
import { AirBubble } from "@/components/airroom/AirBubble"
import { GroupRoom } from "@/components/airroom/GroupRoom"
import { usePresence } from "@/lib/airroom/presence"
import { avatarBg, avatarGlow } from "@/lib/airroom/avatar"
import { Face } from "@/components/airroom/Face"
import { startAmbience, setAmbienceDepth, setAmbienceMuted, stopAmbience } from "@/lib/airroom/ambience"
import { track } from "@/lib/airraw/track"

// SFW worlds only — the fire/After-Dark tier is removed so the ad-reachable
// universe stays ad-approvable (the adult tier returns behind real age gating).
const WORLDS = [
  "The Quiet Wing", "The Reading Room", "The Lab", "Founders' Floor", "The War Room",
  "The Classroom", "The Dojo", "The Practice Hall", "The Welcome Floor", "The Commons",
  "The Long Tables", "The Firepit", "The Mixer", "Six Degrees", "The Regulars",
  "Eye Contact", "The Slow Dance",
]
const ROOMS_SHOWN = 140
const VOICES_SHOWN = 360

const frac = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
function colorFor(f: number) { return f < 0.4 ? "#6fd6e6" : f < 0.72 ? "#ffce7a" : "#ff7a4d" }
function labFor(f: number) { return f < 0.4 ? "#cdeef4" : f < 0.72 ? "#ffe6bd" : "#ffc6ad" }
function tempLabelFor(f: number) {
  if (f < 0.2) return "water · calm"; if (f < 0.42) return "teal · focused"
  if (f < 0.6) return "warm · social"; if (f < 0.78) return "amber · loud"; return "fire · wild"
}

// Pure, stable temperature math (module scope so memoized orb grids don't bust).
// Scaled into the SFW band (max ~0.56) so no voice ever lands in the fire/18+ tier.
const worldF = (i: number) => ((i + 0.5) / WORLDS.length) * 0.58
const roomF = (w: number, rm: number) => clamp01(worldF(w) + (frac(w * 131 + rm * 7) - 0.5) * 0.12)
const voiceF = (w: number, rm: number, v: number) => clamp01(roomF(w, rm) + (frac(w * 9311 + rm * 131 + v) - 0.5) * 0.1)

export function ZoomBuffet() {
  const [level, setLevel] = useState(0)
  const [world, setWorld] = useState(0)
  const [room, setRoom] = useState(0)
  const [active, setActive] = useState<Cluster | null>(null)
  const [verified, setVerified] = useState(false)
  const [pending, setPending] = useState<Cluster | null>(null)
  const [group, setGroup] = useState<{ seed: number; f: number } | null>(null)
  const [voicesCount, setVoicesCount] = useState(VOICES_SHOWN)
  const audioOn = useRef(false)

  useEffect(() => { try { if (localStorage.getItem("airroom_18") === "1") setVerified(true) } catch { /* */ } }, [])
  useEffect(() => { track("airraw_land", { surface: "universe" }) }, [])

  // live presence — where you are in the universe, and who else is here right now
  const loc = group ? `g-${group.seed}` : level === 0 ? "buffet" : level === 1 ? `w-${world}` : `w-${world}-r-${room}`
  const presence = usePresence(loc)

  // ambience — the universe is never silent. Muffled & layered when zoomed out,
  // brighter as you go deeper, and it drops away inside a real room so the live
  // voices come through clear.
  // The bed follows your zoom depth while you BROWSE — but a call (a 1:1 air-off or
  // a room) is not a browse: it goes fully silent so the voices are clean, then
  // fades back to the floor when you step out.
  const inCall = !!(active || group)
  useEffect(() => { setAmbienceDepth(level) }, [level])
  useEffect(() => { setAmbienceMuted(inCall) }, [inCall])
  useEffect(() => () => stopAmbience(), [])
  const wake = () => { if (!audioOn.current) { audioOn.current = true; startAmbience(); setAmbienceDepth(level); setAmbienceMuted(inCall) } }

  // infinity — the voices never run out; the field keeps growing as you scroll
  useEffect(() => { setVoicesCount(VOICES_SHOWN) }, [level, world, room])
  useEffect(() => {
    if (level !== 2) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (window.innerHeight + window.scrollY > document.body.offsetHeight - 700) setVoicesCount((c) => Math.min(c + 240, 2400))
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [level])

  const openVoice = useCallback((c: Cluster) => { if (c.h === "f" && !verified) setPending(c); else setActive(c) }, [verified])
  const confirm18 = () => {
    setVerified(true); try { localStorage.setItem("airroom_18", "1") } catch { /* */ }
    const c = pending; setPending(null); if (c) setActive(c)
  }

  const crumb = level === 0 ? "20 worlds" : level === 1 ? `${WORLDS[world]} · ~1,000 rooms` : "∞ voices · tap one"

  // The deep-zoom field, memoized so the frequent presence ticks don't rebuild
  // the up-to-2,400 orbs — only world/room/voicesCount (or the gate) do. Each orb
  // opens the SAME seeded character its face was drawn from (avatarBg(seed,f)).
  const voiceOrbs = useMemo(() => Array.from({ length: voicesCount }).map((_, v) => {
    const f = voiceF(world, room, v)
    const seed = (world * 100003 + room) * 100003 + v
    const char = makeCharacter(seed, f)
    return (
      <button key={v} onClick={() => openVoice(char)} aria-label="a voice" style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", background: avatarBg(seed, f), border: "1px solid rgba(255,255,255,.14)", cursor: "pointer", boxShadow: `0 0 6px ${avatarGlow(f)}55`, padding: 0 }}>
        <Face persona={{ name: char.host, gender: char.gender, seed: char.key }} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </button>
    )
  }), [world, room, voicesCount, openVoice])

  return (
    <div onPointerDown={wake} style={{ minHeight: "100vh", background: "#06070e", color: "#eef4f8" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "linear-gradient(180deg,#06070e 55%,rgba(6,7,14,.85))", padding: "18px 18px 12px", borderBottom: ".5px solid rgba(255,255,255,.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {level > 0 && (
              <button onClick={() => setLevel(level - 1)} style={{ fontSize: 13, color: "#dfeaf2", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.18)", borderRadius: 12, padding: "6px 11px", cursor: "pointer", whiteSpace: "nowrap" }}>← zoom out</button>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: 3 }}>airraw</div>
              <div style={{ fontSize: 11, color: "#9fb2c4", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                it&apos;s the now · {crumb}
                {presence.total > 0 && <span style={{ color: "#7fd6c0" }}> · {presence.total} live{presence.here > 1 ? ` · ${presence.here} right here` : ""}</span>}
              </div>
            </div>
          </div>
          <a href="/airraw" style={{ fontSize: 12, color: "#dfeaf2", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.18)", borderRadius: 20, padding: "6px 12px", textDecoration: "none", whiteSpace: "nowrap" }}>← lobby</a>
        </div>
      </div>

      {/* LEVEL 0 — 20 worlds */}
      {level === 0 && (
        <div key="l0" className="zb-in" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, padding: 16 }}>
          {WORLDS.map((w, i) => {
            const f = worldF(i); const col = colorFor(f)
            return (
              <button key={i} onClick={() => { setWorld(i); setLevel(1) }} style={{ position: "relative", minHeight: 116, textAlign: "left", background: `${col}10`, border: `.5px solid ${col}44`, borderRadius: 16, padding: "14px 14px", cursor: "pointer", color: "#eef4f8", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>
                <span style={{ position: "absolute", top: 12, right: 12, width: 10, height: 10, borderRadius: "50%", background: col, boxShadow: `0 0 9px ${col}` }} />
                <div style={{ fontSize: 16, fontWeight: 500, color: labFor(f), maxWidth: "85%" }}>{w}</div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>{tempLabelFor(f)}{f >= 0.72 ? " · 18+" : ""}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)", marginTop: 2 }}>~1,000 rooms inside</div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* LEVEL 1 — ~1,000 rooms in a world (a sample, drawn dense) */}
      {level === 1 && (
        <div key={`l1-${world}`} className="zb-in" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(58px, 1fr))", gap: 7, padding: 16 }}>
          {Array.from({ length: ROOMS_SHOWN }).map((_, rm) => {
            const f = roomF(world, rm); const col = colorFor(f)
            const k = 1 + Math.floor(frac(world * 53 + rm) * 4)
            return (
              <button key={rm} onClick={() => { setRoom(rm); setLevel(2) }} title={`room ${rm + 1}`} style={{ aspectRatio: "1", background: `${col}12`, border: `.5px solid ${col}33`, borderRadius: 10, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, color: labFor(f) }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: col, boxShadow: `0 0 5px ${col}` }} />
                <span style={{ fontSize: 9, color: "rgba(255,255,255,.4)" }}>{k}.{Math.floor(frac(rm) * 9)}k</span>
              </button>
            )
          })}
        </div>
      )}

      {/* LEVEL 2 — step into the room (group), or tap a single voice (1:1) */}
      {level === 2 && (
        <div key={`l2-${world}-${room}`} className="zb-in">
          <div style={{ padding: "16px 16px 0", textAlign: "center" }}>
            <button onClick={() => setGroup({ seed: world * 100003 + room, f: roomF(world, room) })} style={{ fontSize: 13, fontWeight: 500, color: "#06201a", background: "#7fd6c0", border: "none", borderRadius: 14, padding: "11px 18px", cursor: "pointer" }}>step into the room — a few of them, together →</button>
            <div style={{ fontSize: 11, color: "#7f93a5", marginTop: 8 }}>…or tap a single voice for a 1:1</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, padding: 16, alignContent: "flex-start" }}>
            {voiceOrbs}
          </div>
        </div>
      )}

      {active && <AirBubble cluster={active} tempLabel={tempLabelFor(active.f)} onClose={() => setActive(null)} onTalked={() => track("airraw_talk", { surface: "universe" })} />}

      {group && <GroupRoom seed={group.seed} f={group.f} tempLabel={tempLabelFor(group.f)} onClose={() => setGroup(null)} />}

      {pending && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,6,4,.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 26, zIndex: 30 }}>
          <div style={{ maxWidth: 340, textAlign: "center", color: "#fbeae3" }}>
            <div style={{ fontSize: 12, letterSpacing: 1, color: "#ff9c73" }}>this one&apos;s in the fire</div>
            <div style={{ fontSize: 21, fontWeight: 500, margin: "8px 0 10px" }}>it gets adult</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "#e7c3b6" }}>flirty, late-night, 18+. nothing explicit — but grown. confirm you&apos;re old enough.</div>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 9 }}>
              <button onClick={confirm18} style={{ fontSize: 14, fontWeight: 500, color: "#1a0d08", background: "#ef7a4d", border: "none", borderRadius: 14, padding: "12px 0", cursor: "pointer" }}>i&apos;m 18 or older</button>
              <button onClick={() => setPending(null)} style={{ fontSize: 14, color: "#e7c3b6", background: "transparent", border: ".5px solid rgba(255,160,120,.3)", borderRadius: 14, padding: "12px 0", cursor: "pointer" }}>never mind</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes zbIn{from{opacity:0;transform:scale(1.12)}to{opacity:1;transform:scale(1)}}.zb-in{animation:zbIn .22s ease-out;transform-origin:center top}`}</style>
    </div>
  )
}
