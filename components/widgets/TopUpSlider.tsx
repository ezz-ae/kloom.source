"use client"

import { useState } from "react"
import { useSolCredits } from "@/hooks/use-sol-credits"
import {
  MIN_TOPUP_USD, MAX_TOPUP_USD, UNLIMITED_USD,
  usdToMinutes, isUnlimitedTier, setUnlimited,
} from "@/lib/voice-credits"
import { Loader2, Check, Infinity as InfinityIcon, Mic, CreditCard } from "lucide-react"

interface TopUpSliderProps {
  onDone?: () => void
}

export function TopUpSlider({ onDone }: TopUpSliderProps) {
  const { buySol, usdToSol, purchaseState, purchaseError, isWalletConnected } = useSolCredits()
  const [usd, setUsd]   = useState(5)
  const unlimited       = isUnlimitedTier(usd)
  const minutes         = usdToMinutes(usd)
  const busy            = purchaseState !== "idle" && purchaseState !== "error"

  const buy = async () => {
    if (unlimited) {
      const ok = await buySol(UNLIMITED_USD, usdToMinutes(UNLIMITED_USD))
      if (ok) { setUnlimited(true); onDone?.() }
    } else {
      const ok = await buySol(usd, usdToMinutes(usd))
      if (ok) onDone?.()
    }
  }

  return (
    <div className="space-y-5">
      {/* Big readout */}
      <div className="text-center">
        {unlimited ? (
          <>
            <div className="flex items-center justify-center gap-2 text-4xl font-black text-emerald-400">
              <InfinityIcon size={34} /> Unlimited
            </div>
            <div className="text-sm text-foreground/50 mt-1">Unlimited voice calls · ${UNLIMITED_USD} flat</div>
          </>
        ) : (
          <>
            <div className="text-5xl font-black">{minutes}<span className="text-2xl text-foreground/40"> min</span></div>
            <div className="text-sm text-foreground/50 mt-1">of voice for <span className="text-foreground font-semibold">${usd}</span></div>
          </>
        )}
      </div>

      {/* Slider */}
      <div>
        <input
          type="range"
          min={MIN_TOPUP_USD}
          max={MAX_TOPUP_USD}
          step={1}
          value={usd}
          onChange={(e) => setUsd(Number(e.target.value))}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-[11px] text-foreground/35 mt-1">
          <span>${MIN_TOPUP_USD}</span>
          <span className="text-emerald-400 font-semibold">${UNLIMITED_USD} · unlimited</span>
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex gap-2">
        {[1, 5, 15, 60].map((v) => (
          <button key={v} onClick={() => setUsd(v)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
              usd === v ? "bg-white text-stone-950 border-transparent" : "bg-white/5 border-border/50 text-foreground/60 hover:bg-white/10"
            }`}>
            {v === 60 ? "∞" : `$${v}`}
          </button>
        ))}
      </div>

      {/* Buy */}
      <button onClick={buy} disabled={busy || purchaseState === "done"}
        className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl transition-all text-sm ${
          purchaseState === "done" ? "bg-emerald-500 text-foreground"
          : purchaseState === "error" ? "bg-red-500/20 border border-red-500/40 text-red-300"
          : "bg-amber-500 hover:bg-amber-400 text-foreground hover:scale-[1.02] active:scale-[0.98]"
        } disabled:opacity-60`}>
        {busy ? <Loader2 size={15} className="animate-spin" />
          : purchaseState === "done" ? <Check size={15} />
          : unlimited ? <InfinityIcon size={15} /> : <Mic size={15} />}
        {busy ? "Processing…"
          : purchaseState === "done" ? "Added!"
          : !isWalletConnected ? "Connect wallet to pay"
          : unlimited ? `Get Unlimited — $${UNLIMITED_USD}`
          : `Pay $${usd} · ${usdToSol(usd).toFixed(3)} SOL`}
      </button>

      {purchaseError && purchaseState === "error" && (
        <p className="text-xs text-red-400 text-center">{purchaseError}</p>
      )}
      <p className="text-[11px] text-foreground/30 text-center flex items-center justify-center gap-1.5">
        <CreditCard size={11} /> Pay with SOL or card · credits never expire
      </p>
    </div>
  )
}
