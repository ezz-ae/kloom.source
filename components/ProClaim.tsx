"use client"

// Universal pass-claim. Mounted in the root layout so it runs on EVERY page of BOTH
// domains — after a redirect-back (?pro_ok=1) it claims the anonymous pass and
// stores the signed token. The AIRRAW planet has its own copy of this effect for its
// in-canvas toast; this one covers kloom.io and every non-planet route. Both are
// idempotent (claim is no-op once isPro() / the pending intent is cleared).
//
// CARD vs CRYPTO. A card is already settled when the buyer lands back here, so one
// claim answers. An on-chain payment is not: the buyer returns while the network is
// still confirming, so the first claim says "not paid" about a payment that is
// perfectly real and thirty seconds away. Claiming once would leave them looking at
// a locked app having just paid — the single worst screen this product can show.
//
// So a crypto claim RETRIES, briefly and with an end: every few seconds for a couple
// of minutes, which covers most confirmations, then it stops and leaves the pending
// intent in place so any later page load picks the pass up. It does not poll forever
// — an unbounded retry on every mounted page is a battery drain and a self-inflicted
// load test.

import { useEffect, useState } from "react"
import { getPending, clearPendingIntent, isPro, setProToken, getProToken, fbCookies } from "@/lib/airroom/pro"
import { track } from "@/lib/track"

export function ProClaim() {
  const [msg, setMsg] = useState("")
  // A "waiting for the chain" message must not be swept away by the 5s
  // auto-dismiss below — it is a live status, not a notification.
  const [sticky, setSticky] = useState(false)
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
      const pending = getPending()
      if (!pending?.id || isPro()) {
        // Returned from a successful pay but this browser has no pending intent
        // (Apple Pay / 3DS handed off to another browser, or storage was cleared):
        // don't leave the buyer in silence — point them at recovery.
        if (justPaid && !isPro()) setMsg("payment received ✦ if it's still locked, reopen this link in the browser you paid in, or email m@ezz.ae with your Ziina receipt.")
        return
      }
      const { id, t, s } = pending
      // Crypto order ids are minted by us with this prefix (lib/pay/crypto.ts).
      const isCrypto = String(id).startsWith("air_")
      // Retry only on the RETURN TRIP. On any later page load a single claim is
      // right: it still picks the pass up the moment the chain has confirmed,
      // without every mounted page settling into a two-minute poll.
      const MAX_TRIES = isCrypto && justPaid ? 24 : 1   // ~2 min at 5s
      let tries = 0
      let timer: ReturnType<typeof setTimeout> | undefined
      let stopped = false

      const attempt = () => {
        tries++
        fetch("/api/airraw-pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "claim", intentId: id, t, s, ...fbCookies() }) })
          .then((r) => r.json())
          .then((d) => {
            if (stopped) return
            if (d?.paid && d?.token) {
              setProToken(d.token); clearPendingIntent()
              setSticky(false)
              setMsg("you're in ✦ — tap here to copy your restore code & save it (gets you back in on any device)")
              try { track("purchase", { value: d?.price ?? 9, currency: "USD", method: isCrypto ? "nowpayments" : "ziina", kind: "pass" }, id) } catch { /* */ }
              return
            }
            // Terminal: stop and forget it, or the buyer keeps being told about a
            // sale that is never going to complete.
            if (["failed", "canceled", "cancelled", "expired", "refunded"].includes(String(d?.status))) { setSticky(false); clearPendingIntent(); return }
            if (tries < MAX_TRIES) {
              if (isCrypto) { setSticky(true); setMsg("payment seen — waiting for the network to confirm. this can take a few minutes.") }
              timer = setTimeout(attempt, 5000)
            } else if (justPaid) {
              setSticky(false)
              // Out of patience, not out of hope: the pending intent survives, so
              // the next page load claims it.
              setMsg(isCrypto
                ? "still confirming on-chain — your pass unlocks itself here as soon as it lands."
                : "payment is still processing — reopen in a moment.")
            }
          })
          .catch(() => { if (!stopped && tries < MAX_TRIES) timer = setTimeout(attempt, 5000) })
      }
      attempt()
      return () => { stopped = true; setSticky(false); if (timer) clearTimeout(timer) }
    } catch { /* */ }
  }, [])
  useEffect(() => { if (!msg || sticky) return; const t = setTimeout(() => setMsg(""), 5000); return () => clearTimeout(t) }, [msg, sticky])
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
