"use client"

// Credits a chip purchase after the checkout redirects back.
//
// Mounted in app/airraw/layout.tsx, which 404s on every Kloom deployment — so
// this is structurally unreachable there rather than merely unused. It runs on
// every AIRRAW page because the buyer does not necessarily land back on the one
// they left from.
//
// Safe to mount anywhere and safe to run twice: with no pending purchase it does
// nothing at all, and the grant is keyed on the payment intent server-side, so a
// refresh, a second tab and the webhook all credit exactly once.
//
// It retries briefly. A card is usually settled by the time the buyer is back,
// but "usually" leaves someone staring at an unchanged balance seconds after
// paying — the worst screen this product can show — so a handful of attempts
// over half a minute covers the lag, and then it stops and leaves the purchase
// pending for the next page load rather than polling forever.

import { useEffect, useState } from "react"
import { claimChips, getPendingBuy } from "@/lib/airroom/wallet"
import { track } from "@/lib/track"

export function ChipClaim() {
  const [msg, setMsg] = useState("")

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let tries = 0

    try {
      const u = new URLSearchParams(window.location.search)
      const justPaid = u.get("chips_ok") === "1"
      if (u.get("chips_fail") === "1") setMsg("payment didn't go through — you weren't charged.")
      if (justPaid || u.get("chips_fail")) {
        const url = new URL(window.location.href)
        url.searchParams.delete("chips_ok"); url.searchParams.delete("chips_fail")
        window.history.replaceState({}, "", url.pathname + url.search)
      }

      const pending = getPendingBuy()
      if (!pending?.id) return
      // Retry only on the return trip; any later page load gets one quiet attempt.
      const MAX = justPaid ? 8 : 1

      const attempt = () => {
        tries++
        claimChips().then((r) => {
          if (stopped) return
          if (r.credited) {
            setMsg(`+${r.granted} chips ✦ they're in your balance`)
            try { track("purchase", { value: pending.usd, currency: "USD", method: "ziina", kind: "chips" }, pending.id) } catch { /* */ }
            return
          }
          if (!r.pendingStill) { if (justPaid) setMsg("that payment didn't complete — you weren't charged."); return }
          if (tries < MAX) timer = setTimeout(attempt, 4000)
          else if (justPaid) setMsg("payment is still settling — your chips land here on the next refresh.")
        }).catch(() => { if (!stopped && tries < MAX) timer = setTimeout(attempt, 4000) })
      }
      attempt()
    } catch { /* */ }

    return () => { stopped = true; if (timer) clearTimeout(timer) }
  }, [])

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 6000); return () => clearTimeout(t) }, [msg])
  if (!msg) return null

  return (
    <div style={{ position: "fixed", left: "50%", bottom: "calc(env(safe-area-inset-bottom) + 18px)", transform: "translateX(-50%)",
      zIndex: 90, background: "rgba(12,7,20,.96)", border: ".5px solid rgba(244,198,114,.45)", color: "#f4c672",
      fontSize: 13, padding: "10px 16px", borderRadius: 12, maxWidth: "90vw", textAlign: "center",
      fontFamily: "system-ui, sans-serif", boxShadow: "0 12px 40px -12px rgba(0,0,0,.7)" }}>
      {msg}
    </div>
  )
}
