"use client"

/**
 * AIRROOM — the room card. Before you open a room, you see who's in it: living
 * portraits (slow ken-burns motion, so each reads like a short clip), the room's
 * vibe, and how many are here. Minimal words — the faces do the talking. "Step in"
 * opens the real room; the cast is the SAME deterministic crowd you'll meet inside.
 */
import { useMemo } from "react"
import { makeCharacter, type Cluster } from "@/lib/airroom/roster"
import { Face } from "@/components/airroom/Face"

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export interface RoomPreview { kind: "voice" | "group"; c: number; seed: number; f: number; count: number; adult: boolean; continent: string; vibe: string; hue: number }

export function RoomCard({ p, onEnter, onClose }: { p: RoomPreview; onEnter: () => void; onClose: () => void }) {
  const members = useMemo<Cluster[]>(() => {
    if (p.kind === "voice") return [makeCharacter((p.seed >>> 0) + 7, p.f)]
    const n = Math.max(1, Math.min(120, Math.round(p.count)))
    return Array.from({ length: n }, (_, i) => makeCharacter(p.seed * 7 + i + 1, clamp01(p.f + ((i / n) - 0.5) * 0.08)))
  }, [p])

  const isVoice = p.kind === "voice"
  const shown = isVoice ? members : members.slice(0, 9)
  const lead = members[0]

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 22, background: "rgba(4,6,12,.74)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto", padding: "max(20px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
      <style>{`@keyframes rcburns{0%{transform:scale(1.06) translate(0,0)}50%{transform:scale(1.2) translate(-2.5%,-3%)}100%{transform:scale(1.06) translate(0,0)}}`}</style>
      <div style={{ width: "min(92vw, 440px)", background: "linear-gradient(180deg, rgba(18,28,40,.96), rgba(8,11,18,.96))", border: ".5px solid rgba(255,255,255,.12)", borderRadius: 22, boxShadow: "0 30px 90px -30px rgba(0,0,0,.8)", overflow: "hidden", color: "#eef4f8" }}>
        {/* header */}
        <div style={{ padding: "18px 20px 12px", textAlign: "center" }}>
          {/* a world is known by its colour + vibe, not a name */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: `hsl(${p.hue},60%,72%)` }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: `hsl(${p.hue},65%,60%)`, boxShadow: `0 0 8px hsl(${p.hue},65%,60%)` }} />{p.vibe}{p.adult ? " · 18+" : ""}
          </div>
          <div style={{ fontSize: 20, fontWeight: 500, marginTop: 6 }}>{isVoice ? `${lead.host} is on the floor` : `${members.length} here right now`}</div>
        </div>

        {/* living portraits */}
        {isVoice ? (
          <div style={{ padding: "4px 20px 8px" }}>
            <div style={{ position: "relative", width: "100%", aspectRatio: "16/11", borderRadius: 16, overflow: "hidden", border: ".5px solid rgba(255,255,255,.12)" }}>
              <Face persona={{ name: lead.host, gender: lead.gender }} lazy={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", animation: "rcburns 10s ease-in-out infinite" }} />
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "26px 14px 12px", background: "linear-gradient(transparent, rgba(4,6,12,.85))" }}>
                <div style={{ fontSize: 18, fontWeight: 500 }}>{lead.host}</div>
                <div style={{ fontSize: 13, color: "#cfe0ee", fontStyle: "italic", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>&ldquo;{lead.lines[0]}&rdquo;</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "4px 16px 8px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
            {shown.map((m, i) => (
              <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 12, overflow: "hidden", border: ".5px solid rgba(255,255,255,.1)" }}>
                <Face persona={{ name: m.host, gender: m.gender }} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", animation: `rcburns ${9 + (i % 4)}s ease-in-out infinite`, animationDelay: `${-i * 1.3}s` }} />
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "16px 6px 4px", background: "linear-gradient(transparent, rgba(4,6,12,.8))", fontSize: 11, fontWeight: 500, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.host}</div>
                {i === 8 && members.length > 9 && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(6,9,16,.6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600 }}>+{members.length - 9}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* actions */}
        <div style={{ padding: "10px 20px 20px", display: "flex", flexDirection: "column", gap: 9 }}>
          <button onClick={onEnter} style={{ width: "100%", minHeight: 50, fontSize: 15, fontWeight: 600, color: "#06121e", background: isVoice ? "#ef7a4d" : "#7fd6c0", border: "none", borderRadius: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
            {isVoice ? `talk to ${lead.host} →` : "step into the room →"}
          </button>
          <button onClick={onClose} style={{ width: "100%", minHeight: 44, fontSize: 13, color: "#9fb2c4", background: "transparent", border: ".5px solid rgba(255,255,255,.16)", borderRadius: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>not now</button>
        </div>
      </div>
    </div>
  )
}
