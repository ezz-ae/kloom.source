"use client"

/**
 * The Pass — ONE offer, anonymous (no account). $9 · 90 days · 6000 voice minutes ·
 * fully unrestricted. Pays by card via Ziina hosted checkout through the shared
 * /api/airraw-pro flow; the redirect-back is claimed by <ProClaim/> in the root
 * layout. Replaces the old FlexiCalls slider + tiered passes + account gate.
 */
import { useState } from "react"
import { setPendingIntent, fbCookies, isPro } from "@/lib/airroom/pro"
import { track } from "@/lib/track"

interface TopUpSliderProps { onDone?: () => void }

const PERKS = [
  "Fully unrestricted — every room, every character, no limits",
  "6000 voice minutes — three months of talking out loud",
  "No account — it's tied to this device, instantly",
]

export function TopUpSlider({ onDone: _onDone }: TopUpSliderProps) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  const go = async () => {
    // Don't sell the flat pass to someone who already holds it (they'd be charged
    // twice and the second claim is skipped while the first is still valid).
    if (isPro()) { setErr("you already have the pass ✦ — it resets daily at midnight"); return }
    setBusy(true); setErr("")
    try {
      const r = await fetch("/api/airraw-pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "checkout", ...fbCookies() }) })
      const d = await r.json()
      if (!r.ok || !d.url) { setErr(d.error || "couldn't start checkout — try again"); setBusy(false); return }
      setPendingIntent(d.intentId, d.t, d.s)
      try { track("initiate_checkout", { value: 9, currency: "USD", method: "ziina", kind: "pass" }, d.intentId) } catch { /* */ }
      window.location.href = d.url
    } catch { setErr("network hiccup — try again"); setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-base font-black">The Pass</span>
          <span className="text-2xl font-black">$9</span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">90 days · everything open · no account</div>
        <ul className="mt-3 space-y-1.5">
          {PERKS.map((p, i) => (
            <li key={i} className="text-sm text-foreground/80 flex gap-2"><span className="text-amber-400 shrink-0">✦</span><span>{p}</span></li>
          ))}
        </ul>
        {err && <div className="text-xs text-rose-300 mt-2">{err}</div>}
        <button onClick={go} disabled={busy}
          className="mt-4 w-full font-bold py-3.5 rounded-2xl text-sm brand-gradient text-stone-950 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-70">
          {busy ? "opening checkout…" : "Unlock — $9"}
        </button>
        <div className="text-[11px] text-foreground/40 text-center mt-2">card / apple pay · one-time, 90 days</div>
      </div>
    </div>
  )
}
