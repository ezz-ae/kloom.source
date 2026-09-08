"use client"

/**
 * "Something's wrong."
 *
 * Two things make a report screen work. It has to take one sentence, not a form
 * — someone annoyed enough to report a bug will not fill in six fields. And it
 * has to say exactly what it is sending, BEFORE it sends, where they can read
 * it without tapping anything.
 *
 * That second part is not a nicety here. This is an adult product, and the
 * reasonable assumption about "attach my session" is that it means the
 * conversation. It doesn't, it can't, and the only way to be believed about that
 * is to list what goes and what doesn't, in the same size type.
 */
import { useState } from "react"
import { REPORT_INCLUDES, REPORT_EXCLUDES, sendReport, type ReportContext } from "@/lib/airraw/report"

const ACCENT = "#f472b6"

export function ReportSheet({ onClose, ctx }: { onClose: () => void; ctx?: ReportContext }) {
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [err, setErr] = useState("")

  const send = async () => {
    if (!note.trim() || busy) return
    setBusy(true); setErr("")
    const r = await sendReport(note, ctx)
    setBusy(false)
    if (r.ok) setSent(r.id || "sent")
    else setErr(r.error || "couldn't send that")
  }

  return (
    <div role="dialog" aria-label="report an issue" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 88, background: "rgba(6,3,12,.84)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", color: "#f0e8ff",
          background: "linear-gradient(180deg, #170d1f 0%, #0d0714 100%)", border: ".5px solid rgba(255,255,255,.12)",
          borderRadius: "22px 22px 0 0", padding: "20px 18px calc(env(safe-area-inset-bottom) + 22px)", fontFamily: "inherit" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", color: "rgba(240,232,255,.42)" }}>
            {sent ? "thank you" : "something's wrong"}
          </span>
          <button onClick={onClose} aria-label="close"
            style={{ background: "none", border: "none", color: "rgba(240,232,255,.5)", fontSize: 21, cursor: "pointer", padding: "0 3px", lineHeight: 1, fontFamily: "inherit" }}>×</button>
        </div>

        {sent ? (
          <>
            <p style={{ margin: "0 0 8px", fontSize: 16, lineHeight: 1.5 }}>Got it — that&apos;s logged.</p>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "rgba(240,232,255,.5)" }}>
              reference <code style={{ background: "rgba(255,255,255,.07)", padding: "2px 6px", borderRadius: 5 }}>{sent}</code>
            </p>
            <button onClick={onClose}
              style={{ width: "100%", minHeight: 50, borderRadius: 13, border: "none", background: ACCENT, color: "#0d0418",
                fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>back</button>
          </>
        ) : (
          <>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 2000))} rows={4}
              placeholder="what happened? one sentence is plenty." aria-label="what happened"
              style={{ width: "100%", borderRadius: 12, padding: "12px 13px", fontSize: 16, resize: "vertical",
                background: "rgba(255,255,255,.06)", border: ".5px solid rgba(255,255,255,.12)", color: "#f0e8ff",
                outline: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }} />

            {/* Said before sending, at the same size as everything else. */}
            <div style={{ margin: "13px 0 4px", padding: "12px 13px", borderRadius: 12,
              background: "rgba(255,255,255,.04)", border: ".5px solid rgba(255,255,255,.09)" }}>
              <span style={{ display: "block", fontSize: 12.5, color: "rgba(240,232,255,.75)", marginBottom: 6 }}>
                sent with this:
              </span>
              <ul style={{ margin: 0, padding: "0 0 0 16px", display: "grid", gap: 3 }}>
                {REPORT_INCLUDES.map((x) => (
                  <li key={x} style={{ fontSize: 12.5, color: "rgba(240,232,255,.5)", lineHeight: 1.5 }}>{x}</li>
                ))}
              </ul>
              <span style={{ display: "block", marginTop: 9, fontSize: 12.5, lineHeight: 1.5, color: "#7fd6c0" }}>
                not sent: {REPORT_EXCLUDES}.
              </span>
            </div>

            {err && <p style={{ margin: "10px 0 0", fontSize: 13, color: "#fb7185" }}>{err}</p>}

            <button onClick={send} disabled={busy || !note.trim()}
              style={{ width: "100%", minHeight: 50, marginTop: 12, borderRadius: 13, border: "none", background: ACCENT,
                color: "#0d0418", fontSize: 15.5, fontWeight: 700, cursor: busy || !note.trim() ? "default" : "pointer",
                fontFamily: "inherit", opacity: busy || !note.trim() ? .45 : 1 }}>
              {busy ? "sending…" : "send it"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
