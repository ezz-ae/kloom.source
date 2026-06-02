"use client"

/**
 * Compact PayPal readiness badge for the Settings page. Shows at a glance whether
 * card payments are live and whether INLINE card fields (ACDC) are eligible.
 * Full detail lives at /paypal-status.
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import { checkInlineEligible, paypalClientId } from "@/lib/paypal-sdk"

type State =
  | { kind: "loading" }
  | { kind: "unconfigured" }
  | { kind: "invalid"; error?: string }
  | { kind: "ready"; env: string; inline: boolean }

export function PayPalStatusBadge() {
  const [state, setState] = useState<State>({ kind: "loading" })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await fetch("/api/paypal/status").then((r) => r.json())
        if (cancelled) return
        if (!s.configured)        { setState({ kind: "unconfigured" }); return }
        if (!s.credentialsValid)  { setState({ kind: "invalid", error: s.error }); return }
        let inline = false
        if (paypalClientId()) { try { inline = await checkInlineEligible() } catch {} }
        if (!cancelled) setState({ kind: "ready", env: s.env, inline })
      } catch {
        if (!cancelled) setState({ kind: "invalid", error: "status_failed" })
      }
    })()
    return () => { cancelled = true }
  }, [])

  let dot = "bg-white/30", text = "Checking PayPal…", sub = ""
  if (state.kind === "unconfigured") { dot = "bg-white/30"; text = "Card payments: not configured"; sub = "set PayPal keys" }
  else if (state.kind === "invalid") { dot = "bg-red-400";  text = "PayPal keys invalid";          sub = state.error ?? "check credentials" }
  else if (state.kind === "ready") {
    if (state.inline) { dot = "bg-emerald-400"; text = "PayPal ready · inline cards"; sub = `${state.env} · no buyer login` }
    else              { dot = "bg-amber-400";   text = "PayPal ready · button fallback"; sub = `${state.env} · enable Advanced Card Payments for inline` }
  }

  return (
    <Link href="/paypal-status"
      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 hover:bg-white/[0.06] transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot} ${state.kind === "loading" ? "animate-pulse" : ""}`} />
        <div className="min-w-0">
          <div className="text-xs font-bold truncate">{text}</div>
          {sub && <div className="text-[10px] text-white/40 truncate">{sub}</div>}
        </div>
      </div>
      <span className="text-[10px] text-white/40 shrink-0">details →</span>
    </Link>
  )
}
