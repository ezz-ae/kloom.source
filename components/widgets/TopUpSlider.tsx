"use client"

/**
 * Pricing panel — FlexiCalls + passes.
 *
 * FlexiCalls: drag the bar, watch minutes and money move. Every extra dollar
 * buys more minutes than the last. When the slider crosses the Dayuse price
 * ($7.93) we suggest the pass — same money, unlimited everything.
 */
import { useState } from "react"
import { useSolCredits } from "@/hooks/use-sol-credits"
import {
  FLEXI_MIN_USD, FLEXI_MAX_USD, flexiMinutes, flexiRate,
  PASSES, DAYPASS_SUGGEST_USD, activatePass, activePass, passTimeLeft, type Pass,
} from "@/lib/pricing"
import { setUnlimited } from "@/lib/voice-credits"
import { Loader2, Check, Infinity as InfinityIcon, Mic, CreditCard, Zap, UserPlus, Crown } from "lucide-react"

interface TopUpSliderProps {
  onDone?: () => void
}

export function TopUpSlider({ onDone }: TopUpSliderProps) {
  const { buySol, usdToSol, purchaseState, purchaseError, isWalletConnected } = useSolCredits()
  const [usd, setUsd] = useState(3)
  const [buying, setBuying] = useState<string | null>(null)  // "flexi" | pass id

  const minutes  = flexiMinutes(usd)
  const rate     = flexiRate(usd)
  const suggest  = usd >= DAYPASS_SUGGEST_USD
  const current  = activePass()
  const timeLeft = passTimeLeft()
  const busy     = purchaseState !== "idle" && purchaseState !== "error" && purchaseState !== "done"

  const buyFlexi = async () => {
    setBuying("flexi")
    const ok = await buySol(usd, minutes)
    if (ok) onDone?.()
  }

  const buyPass = async (pass: Pass) => {
    setBuying(pass.id)
    const ok = await buySol(pass.priceUsd, 0)
    if (ok) {
      activatePass(pass.id)
      setUnlimited(true)
      onDone?.()
    }
  }

  return (
    <div className="space-y-6">

      {/* Active pass badge */}
      {current && timeLeft && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-bold text-emerald-300">
          <Crown size={14} /> {PASSES.find((p) => p.id === current.id)?.name} active · {timeLeft}
        </div>
      )}

      {/* ── FlexiCalls ── */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">FlexiCalls</span>
          <span className="text-[11px] text-emerald-400 font-semibold">{rate} min / $</span>
        </div>

        <div className="text-center py-3">
          <div className="text-5xl font-black">{minutes}<span className="text-2xl text-foreground/40"> min</span></div>
          <div className="text-sm text-foreground/50 mt-1">of voice for <span className="text-foreground font-semibold">${usd.toFixed(2)}</span></div>
        </div>

        <input
          type="range"
          min={FLEXI_MIN_USD}
          max={FLEXI_MAX_USD}
          step={0.25}
          value={usd}
          onChange={(e) => setUsd(Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-[11px] text-foreground/35 mt-1">
          <span>${FLEXI_MIN_USD} · 12 min</span>
          <span>more $ → more min per $</span>
        </div>

        {/* Day-pass suggestion — appears once the slider crosses $7.93 */}
        {suggest && (
          <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-3.5 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
              <Zap size={14} /> Same money, no meter.
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ${DAYPASS_SUGGEST_USD} is the Dayuse pass — <span className="text-foreground font-semibold">24h unlimited voice, unrestricted, +1 invitation</span>. Grab that instead.
            </p>
          </div>
        )}

        <button onClick={buyFlexi} disabled={busy}
          className={`mt-3 w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl transition-all text-sm ${
            purchaseState === "done" && buying === "flexi" ? "bg-emerald-500 text-foreground"
            : purchaseState === "error" && buying === "flexi" ? "bg-red-500/20 border border-red-500/40 text-red-300"
            : "bg-foreground/10 border border-border/60 hover:bg-foreground/15 text-foreground hover:scale-[1.01] active:scale-[0.99]"
          } disabled:opacity-60`}>
          {busy && buying === "flexi" ? <Loader2 size={15} className="animate-spin" />
            : purchaseState === "done" && buying === "flexi" ? <Check size={15} />
            : <Mic size={15} />}
          {busy && buying === "flexi" ? "Processing…"
            : purchaseState === "done" && buying === "flexi" ? "Added!"
            : !isWalletConnected ? "Connect wallet to pay"
            : `Pay $${usd.toFixed(2)} · ${minutes} min · ${usdToSol(usd).toFixed(3)} SOL`}
        </button>
      </div>

      {/* ── Passes ── */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Full-access passes</div>
        <div className="space-y-2.5">
          {PASSES.map((pass) => {
            const isCurrent = current?.id === pass.id
            const isBuying  = busy && buying === pass.id
            const bought    = purchaseState === "done" && buying === pass.id
            return (
              <button key={pass.id} onClick={() => buyPass(pass)} disabled={busy || isCurrent}
                className={`w-full text-left rounded-2xl border p-4 transition-all ${
                  isCurrent ? "border-emerald-500/40 bg-emerald-500/[0.07]"
                  : pass.monthly ? "border-amber-500/40 bg-amber-500/[0.07] hover:bg-amber-500/[0.12]"
                  : "border-border/50 bg-foreground/5 hover:bg-foreground/10"
                } disabled:cursor-default`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base">{pass.name}</span>
                      {pass.monthly && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full brand-gradient text-stone-950">Best value</span>
                      )}
                      {isCurrent && <Check size={14} className="text-emerald-400" />}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{pass.tagline}</div>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-foreground/70">
                      <span className="flex items-center gap-1"><InfinityIcon size={11} /> Unlimited voice</span>
                      <span className="flex items-center gap-1"><Zap size={11} /> Unrestricted</span>
                      <span className="flex items-center gap-1">
                        <UserPlus size={11} />
                        {pass.invitations === "unlimited" ? "Unlimited invites" : `${pass.invitations} invitation${pass.invitations === 1 ? "" : "s"}`}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {isBuying ? <Loader2 size={18} className="animate-spin text-muted-foreground" />
                      : bought ? <Check size={18} className="text-emerald-400" />
                      : (
                        <>
                          <div className="text-xl font-black">${pass.priceUsd}</div>
                          <div className="text-[10px] text-muted-foreground">{pass.monthly ? "/ month" : pass.durationHours === 24 ? "24 hours" : "7 days"}</div>
                        </>
                      )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {purchaseError && purchaseState === "error" && (
        <p className="text-xs text-red-400 text-center">{purchaseError}</p>
      )}
      <p className="text-[11px] text-foreground/30 text-center flex items-center justify-center gap-1.5">
        <CreditCard size={11} /> Card or crypto · FlexiCalls minutes never expire
      </p>
    </div>
  )
}
