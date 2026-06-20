"use client"
/**
 * The soft wall — shown AFTER the aha (you've actually talked to someone), never
 * before. Captures a founding-access email. Skippable; this is validation, not a
 * paygate. Fires the airraw_lead conversion event on success.
 */
import { useState } from "react"
import { track } from "@/lib/airraw/track"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function CaptureWall({ source, onClose }: { source: string; onClose: () => void }) {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle")

  const submit = async () => {
    const e = email.trim().toLowerCase()
    if (!EMAIL.test(e)) { setState("error"); return }
    setState("saving")
    try {
      const res = await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, source }) })
      if (!res.ok) throw new Error("lead failed")
      track("airraw_lead", { source })
      setState("done")
      setTimeout(onClose, 1700)
    } catch { setState("error") }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(4,6,12,.82)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 22, zIndex: 40 }}>
      <div style={{ width: "100%", maxWidth: 360, background: "linear-gradient(180deg,#0d1018,#070910)", border: ".5px solid rgba(255,255,255,.12)", borderRadius: 20, padding: "26px 22px", textAlign: "center", color: "#eef4f8" }}>
        {state === "done" ? (
          <>
            <div style={{ fontSize: 30, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 19, fontWeight: 600 }}>you&apos;re in.</div>
            <div style={{ fontSize: 13, color: "#9fb2c4", marginTop: 6 }}>founding access saved. we&apos;ll call you when the floor opens.</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, letterSpacing: 1, color: "#7fd6c0" }}>you felt it.</div>
            <div style={{ fontSize: 21, fontWeight: 600, margin: "8px 0 8px", lineHeight: 1.25 }}>get in before the floor fills.</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#aebccb" }}>airraw opens with a $1 day-pass. drop your email — founding access, free, and you&apos;re first through the door.</div>
            <input
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle") }}
              onKeyDown={(e) => { if (e.key === "Enter") submit() }}
              type="email" inputMode="email" autoComplete="email" placeholder="you@email.com"
              style={{ width: "100%", marginTop: 16, fontSize: 15, color: "#eef4f8", background: "rgba(255,255,255,.06)", border: `.5px solid ${state === "error" ? "rgba(239,122,77,.7)" : "rgba(255,255,255,.18)"}`, borderRadius: 13, padding: "13px 14px", outline: "none", textAlign: "center" }}
            />
            {state === "error" && <div style={{ fontSize: 11.5, color: "#ff9c73", marginTop: 7 }}>that email looks off — try again?</div>}
            <button onClick={submit} disabled={state === "saving"} style={{ width: "100%", marginTop: 12, fontSize: 15, fontWeight: 600, color: "#06140f", background: "#7fd6c0", border: "none", borderRadius: 13, padding: "13px 0", cursor: "pointer", opacity: state === "saving" ? 0.65 : 1 }}>
              {state === "saving" ? "saving…" : "save my spot"}
            </button>
            <button onClick={onClose} style={{ marginTop: 10, fontSize: 12.5, color: "#7f93a5", background: "transparent", border: "none", cursor: "pointer" }}>maybe later</button>
          </>
        )}
      </div>
    </div>
  )
}
