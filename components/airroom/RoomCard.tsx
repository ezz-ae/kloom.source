"use client"

/**
 * AIRROOM — the room card. NOT a product tile: a room you peek into. A lead host fills
 * the foreground; the rest of the crowd is scattered, overlapping and soft behind them
 * (a room, not a grid). Ambient tinted light drifts, the lead's overheard line murmurs.
 * Only the lead is named — the crowd stays anonymous. The cast is the SAME deterministic
 * crowd you'll meet inside. "Drift in" / "say hi" opens the real room.
 */
import { useMemo, useState, useEffect, useRef } from "react"
import { makeCharacter, type Cluster } from "@/lib/airroom/roster"
import { Face } from "@/components/airroom/Face"

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export interface RoomPreview { kind: "voice" | "group"; c: number; seed: number; f: number; count: number; adult: boolean; continent: string; vibe: string; hue: number }

// Scattered, overlapping spots for the background crowd — deliberately NOT a grid, so a
// group reads as a room full of people rather than a catalog of products.
const BG_SPOTS = [
  { left: 6,  top: 14, scale: 0.64, blur: 1.6, z: 1 },
  { left: 60, top: 8,  scale: 0.72, blur: 1.3, z: 2 },
  { left: 33, top: 4,  scale: 0.58, blur: 2.0, z: 1 },
  { left: 76, top: 30, scale: 0.66, blur: 1.4, z: 3 },
  { left: 2,  top: 44, scale: 0.6,  blur: 1.9, z: 2 },
  { left: 70, top: 56, scale: 0.54, blur: 2.3, z: 1 },
]

export function RoomCard({ p, onEnter, onClose, lang }: { p: RoomPreview; onEnter: () => void; onClose: () => void; lang?: string }) {
  // SAME deterministic crowd you'll meet inside (preserve the seed-derived cast).
  const members = useMemo<Cluster[]>(() => {
    if (p.kind === "voice") return [makeCharacter((p.seed >>> 0) + 7, p.f)]
    const n = Math.max(1, Math.min(120, Math.round(p.count)))
    return Array.from({ length: n }, (_, i) => makeCharacter(p.seed * 7 + i + 1, clamp01(p.f + ((i / n) - 0.5) * 0.08)))
  }, [p])

  const isVoice = p.kind === "voice"
  const lead = members[0]
  const crowd = members.slice(1, 1 + BG_SPOTS.length)

  // the room murmurs — the lead's overheard line drifts through a couple of options
  const [lineIdx, setLineIdx] = useState(0)
  useEffect(() => {
    const n = lead?.lines?.length || 0
    if (n < 2) return
    const t = setInterval(() => setLineIdx((i) => (i + 1) % Math.min(3, n)), 3800)
    return () => clearInterval(t)
  }, [lead])
  const overheard = lead?.lines?.[lineIdx] ?? lead?.lines?.[0] ?? ""

  const tint = `hsl(${p.hue},70%,60%)`

  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "playing">("idle")
  const previewTokRef = useRef(0)

  const togglePreview = async () => {
    if (previewState === "playing") {
      previewAudioRef.current?.pause()
      previewAudioRef.current = null
      setPreviewState("idle")
      return
    }
    if (previewState === "loading") return
    setPreviewState("loading")
    const tok = ++previewTokRef.current
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: lead.lines[0], personaName: lead.host, gender: lead.gender, language: lang || "English", voiceId: (lead as any).voiceId }),
      })
      if (!res.ok || tok !== previewTokRef.current) { setPreviewState("idle"); return }
      const url = URL.createObjectURL(await res.blob())
      if (tok !== previewTokRef.current) { URL.revokeObjectURL(url); setPreviewState("idle"); return }
      const audio = new Audio(url)
      previewAudioRef.current = audio
      audio.onended = () => { URL.revokeObjectURL(url); if (tok === previewTokRef.current) setPreviewState("idle") }
      audio.onerror = () => { URL.revokeObjectURL(url); if (tok === previewTokRef.current) setPreviewState("idle") }
      await audio.play().catch(() => {})
      if (tok === previewTokRef.current) setPreviewState("playing")
    } catch {
      if (tok === previewTokRef.current) setPreviewState("idle")
    }
  }

  useEffect(() => {
    return () => { previewTokRef.current++; previewAudioRef.current?.pause(); previewAudioRef.current = null }
  }, [])

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 22, background: "rgba(4,6,12,.74)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto", padding: "max(20px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
      <style>{`@keyframes rcburns{0%{transform:scale(1.06) translate(0,0)}50%{transform:scale(1.2) translate(-2.5%,-3%)}100%{transform:scale(1.06) translate(0,0)}}@keyframes rcdrift{0%{transform:translate(-12%,-6%)}50%{transform:translate(10%,9%)}100%{transform:translate(-12%,-6%)}}@keyframes rcbreathe{0%,100%{opacity:.5}50%{opacity:.95}}`}</style>
      <div style={{ width: "min(92vw, 440px)", background: "linear-gradient(180deg, rgba(18,28,40,.96), rgba(8,11,18,.96))", border: ".5px solid rgba(255,255,255,.12)", borderRadius: 22, boxShadow: "0 30px 90px -30px rgba(0,0,0,.8)", overflow: "hidden", color: "#eef4f8" }}>

        {/* the scene — a room you peek into */}
        <div style={{ padding: "16px 16px 8px" }}>
          <div style={{ position: "relative", width: "100%", aspectRatio: "16/11", borderRadius: 18, overflow: "hidden", border: ".5px solid rgba(255,255,255,.1)", background: "#0a0e16" }}>

            {/* background crowd — scattered, overlapping, soft (group only); anonymous */}
            {!isVoice && crowd.map((m, i) => {
              const s = BG_SPOTS[i]
              return (
                <div key={i} aria-hidden style={{ position: "absolute", left: `${s.left}%`, top: `${s.top}%`, width: `${38 * s.scale}%`, aspectRatio: "1", borderRadius: "50%", overflow: "hidden", zIndex: s.z, filter: `blur(${s.blur}px)`, opacity: 0.72, border: ".5px solid rgba(255,255,255,.08)" }}>
                  <Face persona={{ name: m.host, gender: m.gender, seed: m.key }} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", animation: `rcburns ${10 + (i % 4)}s ease-in-out infinite`, animationDelay: `${-i * 1.4}s` }} />
                </div>
              )
            })}

            {/* lead — large, sharp, foreground */}
            <div style={{ position: "absolute", left: isVoice ? 0 : "50%", right: isVoice ? 0 : "auto", top: isVoice ? 0 : "auto", bottom: 0, transform: isVoice ? "none" : "translateX(-50%)", width: isVoice ? "100%" : "62%", height: isVoice ? "100%" : "88%", zIndex: 5, overflow: "hidden", borderRadius: isVoice ? 0 : "20px 20px 0 0" }}>
              <Face persona={{ name: lead.host, gender: lead.gender, seed: lead.key }} lazy={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", animation: "rcburns 11s ease-in-out infinite" }} />
            </div>

            {/* ambient life — drifting tinted light + a breathing vignette */}
            <div aria-hidden style={{ position: "absolute", inset: "-30%", zIndex: 6, pointerEvents: "none", background: `radial-gradient(42% 42% at 50% 42%, ${tint}, transparent 70%)`, opacity: 0.18, mixBlendMode: "screen", animation: "rcdrift 14s ease-in-out infinite" }} />
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 7, pointerEvents: "none", boxShadow: "inset 0 0 60px 12px rgba(4,6,12,.7)", borderRadius: 18 }} />

            {/* only the lead is named — the crowd stays a crowd */}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 8, padding: "32px 16px 13px", background: "linear-gradient(transparent, rgba(4,6,12,.92))" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: `hsl(${p.hue},65%,78%)` }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: tint, boxShadow: `0 0 8px ${tint}`, animation: "rcbreathe 2.6s ease-in-out infinite" }} />
                {p.adult ? "18+" : ""}
              </div>
              <div style={{ fontSize: 19, fontWeight: 500, marginTop: 3 }}>{lead.host}</div>
              <div style={{ fontSize: 13, color: "#cfe0ee", fontStyle: "italic", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "opacity .4s" }}>&ldquo;{overheard}&rdquo;</div>
            </div>
          </div>
        </div>

        {/* presence, not a counter */}
        {!isVoice && (
          <div style={{ padding: "2px 22px 0", fontSize: 13, color: "#9fb2c4", textAlign: "center" }}>
            {members.length <= 3 ? "a few people in here" : members.length < 12 ? `${members.length} around, talking` : "busy in here tonight"} · and more drifting in
          </div>
        )}

        {/* the threshold — step into a place, not buy a product */}
        <div style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 9 }}>
          <button onClick={onEnter} style={{ width: "100%", minHeight: 50, fontSize: 15, fontWeight: 600, color: "#eef4f8", background: `hsla(${p.hue},60%,52%,.22)`, border: `.5px solid hsla(${p.hue},72%,66%,.5)`, borderRadius: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", backdropFilter: "blur(4px)" }}>
            {isVoice ? `Call ${lead.host}` : "Enter"}
          </button>
          <button onClick={togglePreview} style={{ width: "100%", minHeight: 44, fontSize: 13, color: previewState === "playing" ? tint : "#9fb2c4", background: "transparent", border: `.5px solid ${previewState === "playing" ? `hsla(${p.hue},60%,60%,.35)` : "rgba(255,255,255,.12)"}`, borderRadius: 14, cursor: previewState === "loading" ? "default" : "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "color .2s, border-color .2s" }}>
            {previewState === "loading" ? (
              <><span style={{ display: "inline-block", width: 10, height: 10, border: `1.5px solid rgba(159,178,196,.3)`, borderTopColor: "#9fb2c4", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>loading…</>
            ) : previewState === "playing" ? (
              <>■ stop</>
            ) : (
              <>▶ hear their voice</>
            )}
          </button>
          <button onClick={onClose} style={{ width: "100%", minHeight: 44, fontSize: 13, color: "#6b7d8e", background: "transparent", border: "none", borderRadius: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>not now</button>
        </div>
      </div>
    </div>
  )
}
