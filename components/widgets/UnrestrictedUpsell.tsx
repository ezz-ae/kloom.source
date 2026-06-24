"use client"

/**
 * In-context upsell for THE PASS — $9 / 90 days, fully unrestricted + 6000 voice
 * minutes, anonymous (no account). Shown on 18+ experts and dark/red rooms when the
 * user doesn't already hold it. Routes through the shared /api/airraw-pro flow;
 * the redirect-back is claimed by <ProClaim/> in the root layout. Renders nothing
 * if the user already holds the pass (incl. during the launch-unlimited phase).
 */
import { useState, useEffect } from "react"
import { hasUnrestricted } from "@/lib/account"
import { setPendingIntent } from "@/lib/airroom/pro"
import { track } from "@/lib/track"
import { Flame, Check, X } from "lucide-react"

const PERKS = [
  "Removes every restriction — platform-wide",
  "6000 voice minutes — three months of talking",
  "The full adult category & dark rooms (18+)",
  "No account — tied to this device, instantly",
]

export function UnrestrictedUpsell({ context = "this" }: { context?: string }) {
  const [owned, setOwned] = useState(true) // assume owned until checked (no flash)
  const [open, setOpen]   = useState(false)
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState("")

  useEffect(() => { setOwned(hasUnrestricted()) }, [])
  if (owned) return null

  const go = async () => {
    setBusy(true); setErr("")
    try {
      const r = await fetch("/api/airraw-pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "checkout" }) })
      const d = await r.json()
      if (!r.ok || !d.url) { setErr(d.error || "couldn't start checkout — try again"); setBusy(false); return }
      setPendingIntent(d.intentId)
      try { track("initiate_checkout", { value: 9, currency: "USD", method: "ziina", kind: "pass" }, d.intentId) } catch { /* */ }
      window.location.href = d.url
    } catch { setErr("network hiccup — try again"); setBusy(false) }
  }

  return (
    <div className="rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/40 to-stone-950 p-4">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center shrink-0">
          <Flame size={16} className="text-rose-300" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">Unlock The Pass</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-200 border border-rose-500/30">$9 · 90 days</span>
          </div>
          <p className="text-xs text-foreground/50 mt-0.5">
            Full no-restriction mode + 6000 voice minutes across the whole platform — not just {context}.
          </p>
          {!open && (
            <button onClick={() => setOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 bg-rose-500 hover:bg-rose-400 text-foreground text-xs font-bold px-4 py-2 rounded-xl transition-all hover:scale-[1.02]">
              <Flame size={13} /> Unlock — $9
            </button>
          )}
        </div>
        {open && (
          <button onClick={() => setOpen(false)} className="text-foreground/30 hover:text-foreground shrink-0"><X size={16} /></button>
        )}
      </div>

      {open && (
        <div className="mt-4">
          <ul className="grid grid-cols-1 gap-1.5 mb-4">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2 text-xs text-foreground/60">
                <Check size={13} className="text-rose-400 shrink-0 mt-0.5" /> {p}
              </li>
            ))}
          </ul>
          {err && <div className="text-xs text-rose-300 mb-2">{err}</div>}
          <button onClick={go} disabled={busy}
            className="w-full bg-rose-500 hover:bg-rose-400 text-foreground text-sm font-bold py-3 rounded-xl transition-all disabled:opacity-70">
            {busy ? "opening checkout…" : "Unlock — $9"}
          </button>
          <p className="text-[10px] text-foreground/30 text-center mt-3">Pay by card · one-time, 90 days · no account</p>
        </div>
      )}
    </div>
  )
}
