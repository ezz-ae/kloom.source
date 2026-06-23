"use client"

/**
 * AIRRAW profile — who you are on the floor (anonymous), plus your credit balance.
 * Avatar + name are local (lib/airroom/profile); credits are the soft balance that
 * AIR spends (lib/airroom/credits). When you're out / want unlimited, it routes to
 * the Pro sheet via onUpgrade.
 */
import { useState } from "react"
import { getProfile, setProfileName, rerollAvatar, type Profile } from "@/lib/airroom/profile"
import { getCredits, FREE_GRANT } from "@/lib/airroom/credits"
import { isPro, proUntil } from "@/lib/airroom/pro"

export function ProfileSheet({ onClose, onUpgrade }: { onClose: () => void; onUpgrade: () => void }) {
  const [p, setP] = useState<Profile>(() => getProfile())
  const [name, setName] = useState(p.name)
  const pro = isPro()
  const until = proUntil()
  const credits = getCredits()

  const saveName = () => { const np = setProfileName(name); setP({ ...np }); setName(np.name) }
  const reroll = () => { const np = rerollAvatar(); setP({ ...np }) }

  const avatarBg = `radial-gradient(120% 120% at 30% 25%, hsl(${p.hue},78%,64%), hsl(${(p.hue + 40) % 360},70%,40%))`
  const untilStr = until ? new Date(until).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""
  const pct = Math.max(0, Math.min(1, credits / FREE_GRANT))

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(6,5,16,.82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto", padding: "max(20px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
      <div style={{ width: "min(92vw, 420px)", background: "linear-gradient(180deg, rgba(20,24,34,.97), rgba(8,9,14,.97))", border: ".5px solid rgba(127,214,192,.28)", borderRadius: 22, boxShadow: "0 30px 90px -30px rgba(0,0,0,.85)", overflow: "hidden", color: "#eef4f8" }}>

        {/* avatar + name */}
        <div style={{ padding: "24px 22px 8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <button onClick={reroll} aria-label="reshuffle avatar" style={{ width: 76, height: 76, borderRadius: "50%", border: "none", background: avatarBg, color: "rgba(255,255,255,.95)", fontSize: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: `0 12px 34px -10px hsla(${p.hue},80%,55%,.7)`, WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>{p.glyph}</button>
          <div style={{ fontSize: 11, color: "#6b7d8e", marginTop: 7 }}>tap to reshuffle</div>
          <div style={{ display: "flex", gap: 7, marginTop: 12, width: "100%", maxWidth: 280 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
              maxLength={24}
              aria-label="your name on the floor"
              style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 17, fontWeight: 600, color: "#eef4f8", background: "rgba(255,255,255,.06)", border: ".5px solid rgba(255,255,255,.16)", borderRadius: 12, padding: "10px 12px", minHeight: 44, boxSizing: "border-box", outline: "none" }}
            />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, letterSpacing: 1, padding: "5px 12px", borderRadius: 999, color: pro ? "#ffd98a" : "#7fd6c0", background: pro ? "rgba(255,217,138,.12)" : "rgba(127,214,192,.12)", border: `.5px solid ${pro ? "rgba(255,217,138,.4)" : "rgba(127,214,192,.34)"}` }}>
            {pro ? `✦ AIRRAW PRO${untilStr ? ` · until ${untilStr}` : ""}` : "FREE · ON THE FLOOR"}
          </div>
        </div>

        {/* credits */}
        <div style={{ margin: "14px 22px 6px", padding: "16px", borderRadius: 16, background: "rgba(255,217,138,.06)", border: ".5px solid rgba(255,217,138,.22)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, letterSpacing: 1, color: "#ffd98a", fontWeight: 600 }}>CREDITS</span>
            <span style={{ fontSize: 26, fontWeight: 700, color: "#fff" }}>{pro ? "∞" : credits}</span>
          </div>
          {!pro && (
            <div style={{ marginTop: 10, height: 6, borderRadius: 4, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
              <div style={{ width: `${pct * 100}%`, height: "100%", background: "linear-gradient(90deg,#ffd98a,#ef9a4d)", borderRadius: 4, transition: "width .3s" }} />
            </div>
          )}
          <div style={{ marginTop: 9, fontSize: 12.5, lineHeight: 1.45, color: "#9fb2c4" }}>
            {pro ? "unlimited — tap AIR as much as you like, the whole floor lights up." : "each AIR lights up your best matches across the floor. one credit a tap."}
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: "8px 22px 22px", display: "flex", flexDirection: "column", gap: 9 }}>
          {!pro && (
            <button onClick={onUpgrade} style={{ width: "100%", minHeight: 52, fontSize: 16, fontWeight: 600, color: "#1a0d2a", background: "linear-gradient(180deg,#ffe1a0,#e9b6ff)", border: "none", borderRadius: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
              {credits > 0 ? "go unlimited — AIRRAW Pro" : "out of credits — go Pro"}
            </button>
          )}
          <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "#6b7d8e", textAlign: "center" }}>some voices here are real people — they see this name.</div>
          <button onClick={onClose} style={{ width: "100%", minHeight: 44, fontSize: 13, color: "#9fb2c4", background: "transparent", border: ".5px solid rgba(255,255,255,.16)", borderRadius: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>done</button>
        </div>
      </div>
    </div>
  )
}
