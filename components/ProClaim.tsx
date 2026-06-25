"use client"

// Universal pass-claim. Mounted in the root layout so it runs on EVERY page of BOTH
// domains — after a Ziina redirect-back (?pro_ok=1) it claims the anonymous pass and
// stores the signed token. The AIRRAW planet has its own copy of this effect for its
// in-canvas toast; this one covers kloom.io and every non-planet route. Both are
// idempotent (claim is no-op once isPro() / the pending intent is cleared).

import { useEffect, useState } from "react"
import { getPendingIntent, clearPendingIntent, isPro, setProToken, getProToken, fbCookies } from "@/lib/airroom/pro"
import { track } from "@/lib/track"

export function ProClaim() {
  const [msg, setMsg] = useState("")
  useEffect(() => {
    try {
      const u = new URLSearchParams(window.location.search)
      const justPaid = u.get("pro_ok") === "1"
      if (u.get("pro_fail") === "1") setMsg("payment didn't go through — you weren't charged.")
      if (justPaid || u.get("pro_fail")) {
        const url = new URL(window.location.href)
        url.searchParams.delete("pro_ok"); url.searchParams.delete("pro_fail")
        window.history.replaceState({}, "", url.pathname + url.search)
      }
      const id = getPendingIntent()
      if (!id || isPro()) return
      fetch("/api/airraw-pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "claim", intentId: id, ...fbCookies() }) })
        .then((r) => r.json())
        .then((d) => {
          if (d?.paid && d?.token) { setProToken(d.token); clearPendingIntent(); setMsg("you're in ✦ — tap here to copy your restore code & save it (gets you back in on any device)"); try { track("purchase", { value: 9, currency: "USD", method: "ziina", kind: "pass" }, id) } catch { /* */ } }
          else if (["failed", "canceled", "cancelled", "expired"].includes(String(d?.status))) clearPendingIntent()
          else if (justPaid) setMsg("payment is still processing — reopen in a moment.")
        })
        .catch(() => {})
    } catch { /* */ }
  }, [])
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 5000); return () => clearTimeout(t) }, [msg])
  if (!msg) return null
  return (
    <div
      onClick={() => {
        const tk = getProToken()
        if (tk && navigator.clipboard) navigator.clipboard.writeText(tk).then(() => setMsg("restore code copied — keep it somewhere safe ✦")).catch(() => setMsg(""))
        else setMsg("")
      }}
      style={{ position: "fixed", left: "50%", bottom: "calc(env(safe-area-inset-bottom) + 18px)", transform: "translateX(-50%)", zIndex: 60, background: "rgba(10,12,18,.96)", border: ".5px solid rgba(127,214,192,.45)", color: "#cfe9df", fontSize: 13, padding: "10px 16px", borderRadius: 12, maxWidth: "90vw", textAlign: "center", cursor: "pointer", fontFamily: "system-ui, sans-serif", boxShadow: "0 12px 40px -12px rgba(0,0,0,.7)" }}
    >
      {msg}
    </div>
  )
}
