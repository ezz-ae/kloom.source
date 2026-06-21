"use client"

/**
 * In-context upsell for the $10/mo "Unrestricted" tier — full no-restriction mode
 * across the whole platform. Shown on 18+ experts and dark/red rooms when the user
 * doesn't already hold it. Expands inline to Ziina's hosted card checkout.
 * Renders nothing if the user is already unrestricted (incl. during the
 * launch-unlimited build phase).
 */
import { useState, useEffect } from "react"
import { hasUnrestricted } from "@/lib/account"
import { AuthGate } from "@/components/widgets/AuthGate"
import { ZiinaCheckout } from "@/components/widgets/ZiinaCheckout"
import { Flame, Check, X } from "lucide-react"

const PERKS = [
  "Removes every restriction — platform-wide",
  "Unlocks the full adult category & dark rooms",
  "Consensual adult content, no limits (18+)",
]

export function UnrestrictedUpsell({ context = "this" }: { context?: string }) {
  const [owned, setOwned] = useState(true) // assume owned until checked (no flash)
  const [open, setOpen]   = useState(false)

  useEffect(() => { setOwned(hasUnrestricted()) }, [])
  if (owned) return null

  return (
    <div className="rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/40 to-stone-950 p-4">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center shrink-0">
          <Flame size={16} className="text-rose-300" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">Unlock Unrestricted</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-200 border border-rose-500/30">$10/mo</span>
          </div>
          <p className="text-xs text-foreground/50 mt-0.5">
            Full no-restriction mode across the whole platform — not just {context}.
          </p>
          {!open && (
            <button onClick={() => setOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 bg-rose-500 hover:bg-rose-400 text-foreground text-xs font-bold px-4 py-2 rounded-xl transition-all hover:scale-[1.02]">
              <Flame size={13} /> Unlock — $10/mo
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
          <AuthGate intent="to unlock unrestricted">
            <ZiinaCheckout price={10} kind="unrestricted" label="Unrestricted — 30-day pass" />
          </AuthGate>
          <p className="text-[10px] text-foreground/30 text-center mt-3">Pay by card · cancel anytime</p>
        </div>
      )}
    </div>
  )
}
