"use client"

/**
 * Pricing panel — FlexiCalls + passes, paid by card (PayPal) with an email
 * account. Drag the bar, watch minutes and money move; every extra dollar buys
 * more minutes than the last. At $7.93 we suggest the Dayuse pass instead.
 */
import { useState } from "react"
import {
  FLEXI_MIN_USD, FLEXI_MAX_USD, flexiMinutes,
  PASSES, activePass, passTimeLeft, type Pass,
} from "@/lib/pricing"
import { currentEmail } from "@/lib/auth"
import { AuthGate } from "@/components/widgets/AuthGate"
import { Check, Crown, ChevronLeft, CreditCard } from "lucide-react"

interface TopUpSliderProps { onDone?: () => void }

export function TopUpSlider({ onDone }: TopUpSliderProps) {
  const [usd, setUsd] = useState(3)
  const [checkout, setCheckout] = useState<null | { kind: "flexi" } | { kind: "pass"; pass: Pass }>(null)

  const minutes  = flexiMinutes(usd)
  const current  = activePass()
  const timeLeft = passTimeLeft()

  // ── Checkout — sign in, then one tap to Ziina's clean hosted card page ──
  if (checkout) {
    const price = checkout.kind === "flexi" ? usd : checkout.pass.priceUsd
    const label = checkout.kind === "flexi" ? `${minutes} FlexiCalls minutes` : `${checkout.pass.name} pass`
    return (
      <div className="space-y-4">
        <button onClick={() => setCheckout(null)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={14} /> Back
        </button>
        <div className="rounded-2xl border border-border/50 bg-foreground/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold">{label}</span>
            <span className="text-lg font-black">${price.toFixed(2)}</span>
          </div>
          <AuthGate intent={checkout.kind === "flexi" ? "to add minutes" : "to get this pass"}>
            <ZiinaCheckout price={price} credits={checkout.kind === "flexi" ? minutes : 0}
              kind={checkout.kind === "flexi" ? "credits" : checkout.pass.id} label={label} />
          </AuthGate>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {current && timeLeft && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-bold text-emerald-300">
          <Crown size={14} /> {PASSES.find((p) => p.id === current.id)?.name} active · {timeLeft}
        </div>
      )}

      {/* ── Pay as you go ── */}
      <div>
        <div className="text-center pt-1 pb-3">
          <div className="text-6xl font-black tracking-tight">{minutes}<span className="text-2xl text-foreground/40 font-bold"> min</span></div>
          <div className="text-sm text-foreground/50 mt-1">voice for <span className="text-foreground font-semibold">${usd.toFixed(2)}</span></div>
        </div>
        <input type="range" min={FLEXI_MIN_USD} max={FLEXI_MAX_USD} step={0.25} value={usd}
          onChange={(e) => setUsd(Number(e.target.value))} className="w-full accent-amber-500" />
        <button onClick={() => setCheckout({ kind: "flexi" })}
          className="mt-4 w-full font-bold py-3.5 rounded-2xl text-sm bg-foreground/10 border border-border/60 hover:bg-foreground/15 text-foreground hover:scale-[1.01] active:scale-[0.99] transition-all">
          Add {minutes} min · ${usd.toFixed(2)}
        </button>
      </div>

      {/* ── Passes ── one shared promise, then just what differs ── */}
      <div>
        <div className="flex items-baseline justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Passes</span>
          <span className="text-[11px] text-muted-foreground">Unlimited voice · no limits</span>
        </div>
        <div className="space-y-2">
          {PASSES.map((pass) => {
            const isCurrent = current?.id === pass.id
            const duration  = pass.monthly ? "30 days" : pass.durationHours === 24 ? "24 hours" : "7 days"
            const invites   = pass.invitations === "unlimited" ? "unlimited invites" : `${pass.invitations} invite${pass.invitations === 1 ? "" : "s"}`
            return (
              <button key={pass.id} onClick={() => setCheckout({ kind: "pass", pass })} disabled={isCurrent}
                className={`w-full text-left rounded-2xl border p-4 flex items-center justify-between gap-3 transition-all ${
                  isCurrent ? "border-emerald-500/40 bg-emerald-500/[0.07]"
                  : pass.monthly ? "border-amber-500/40 bg-amber-500/[0.07] hover:bg-amber-500/[0.12]"
                  : "border-border/50 bg-foreground/5 hover:bg-foreground/10"
                } disabled:cursor-default`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base">{pass.name}</span>
                    {pass.monthly && <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full brand-gradient text-stone-950">Best value</span>}
                    {isCurrent && <Check size={14} className="text-emerald-400" />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{duration} · {invites}</div>
                </div>
                <div className="shrink-0 text-xl font-black">${pass.priceUsd}</div>
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-[11px] text-foreground/30 text-center">Card payments · minutes never expire</p>
    </div>
  )
}

/**
 * Ziina checkout — one tap opens Ziina's clean hosted card page (card number ·
 * expiry · CVV · pay, no PayPal, no account). The buyer's email is the wallet id
 * stored in the intent mapping; crediting happens server-side on return
 * (/api/ziina-verify) so we never grant client-side before money clears.
 */
function ZiinaCheckout({ price, credits, kind, label }: {
  price: number; credits: number; kind: string; label: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const go = async () => {
    setBusy(true); setErr(null)
    try {
      const email = (await currentEmail()) || "guest"
      const res = await fetch("/api/ziina-checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: email, price, credits, kind, label }),
      })
      const j = await res.json()
      if (!res.ok || !j.url) throw new Error(j.error || "Could not start checkout")
      window.location.href = j.url   // → Ziina hosted card page
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start checkout"); setBusy(false)
    }
  }

  return (
    <div className="space-y-2.5">
      <button onClick={go} disabled={busy}
        className="w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl text-sm brand-gradient text-stone-950 brand-glow disabled:opacity-60 hover:scale-[1.01] active:scale-[0.99] transition-all">
        <CreditCard size={15} /> {busy ? "Opening secure checkout…" : `Pay $${price.toFixed(2)} by card`}
      </button>
      <p className="text-[10px] text-foreground/30 text-center">🔒 Secure card checkout · no account needed</p>
      {err && <p className="text-xs text-red-400 text-center">{err}</p>}
    </div>
  )
}
