"use client"

/**
 * AIRRAW Pro paywall. Self-contained: pitches Pro, then opens a real Ziina hosted
 * checkout (POST /api/airraw-pro). We stash the intent id before redirecting so the
 * planet can claim the pass when the buyer returns (?pro_ok=1).
 */
import { useState } from "react"
import { setPendingIntent } from "@/lib/airroom/pro"

const PERKS: [string, string][] = [
  ["✦  fully unrestricted", "the whole floor wide open — no limits, no gates, nothing held back"],
  ["✦  6000 voice minutes", "three months of talking out loud — across every room"],
  ["✦  AIR", "tap once and your best matches light up across the whole floor"],
  ["✦  set the vibe", "steer any room — flirty, hyped, brutally honest — and the voices follow"],
]

export function ProSheet({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  const go = async () => {
    setBusy(true); setErr("")
    try {
      const r = await fetch("/api/airraw-pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "checkout" }) })
      const d = await r.json()
      if (!r.ok || !d.url) { setErr(d.error || "couldn’t start checkout — try again"); setBusy(false); return }
      setPendingIntent(d.intentId)
      window.location.href = d.url
    } catch { setErr("network hiccup — try again"); setBusy(false) }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(6,5,16,.82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto", padding: "max(20px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
      <div style={{ width: "min(92vw, 420px)", background: "linear-gradient(180deg, rgba(26,20,42,.97), rgba(9,8,16,.97))", border: ".5px solid rgba(199,179,255,.3)", borderRadius: 22, boxShadow: "0 30px 90px -30px rgba(0,0,0,.85)", overflow: "hidden", color: "#eef4f8" }}>
        <div style={{ padding: "22px 22px 6px", textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: "#ffd98a", fontWeight: 600 }}>airraw pro</div>
          <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>unlock the floor</div>
        </div>
        <div style={{ padding: "10px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {PERKS.map(([t, d], i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#e9deff" }}>{t}</div>
              <div style={{ fontSize: 13, lineHeight: 1.45, color: "#9fb2c4" }}>{d}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", padding: "8px 22px 4px" }}>
          <span style={{ fontSize: 30, fontWeight: 700, color: "#fff" }}>$9</span>
          <span style={{ fontSize: 14, color: "#9fb2c4" }}> / 90 days</span>
        </div>
        {err && <div style={{ fontSize: 12.5, color: "#ffb59c", textAlign: "center", padding: "2px 22px 6px" }}>{err}</div>}
        <div style={{ padding: "10px 22px 22px", display: "flex", flexDirection: "column", gap: 9 }}>
          <button onClick={go} disabled={busy} style={{ width: "100%", minHeight: 52, fontSize: 16, fontWeight: 600, color: "#1a0d2a", background: "linear-gradient(180deg,#ffe1a0,#e9b6ff)", border: "none", borderRadius: 14, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>{busy ? "opening checkout…" : "unlock — $9"}</button>
          <button onClick={onClose} style={{ width: "100%", minHeight: 44, fontSize: 13, color: "#9fb2c4", background: "transparent", border: ".5px solid rgba(255,255,255,.16)", borderRadius: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>not now</button>
          <div style={{ fontSize: 11, color: "#6b7d8e", textAlign: "center", marginTop: 2 }}>secure checkout · card / apple pay · one-time, 90 days</div>
        </div>
      </div>
    </div>
  )
}
