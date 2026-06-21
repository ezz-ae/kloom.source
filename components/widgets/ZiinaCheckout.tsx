"use client"

/**
 * Ziina checkout — the ONE payment path. One tap opens Ziina's hosted card page
 * (card number · expiry · CVV · pay, no account). The buyer's email is the wallet
 * id stored in the intent mapping; crediting happens server-side on return
 * (/api/ziina-verify) so we never grant before money clears.
 */
import { useState } from "react"
import { currentEmail } from "@/lib/auth"
import { CreditCard } from "lucide-react"

export function ZiinaCheckout({ price, credits = 0, kind, label }: {
  price: number; credits?: number; kind: string; label: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const go = async () => {
    setBusy(true); setErr(null)
    try {
      // Never check out under a shared 'guest' key — two buyers would collide and a
      // grant could land on the wrong account. The paid path is behind AuthGate, so
      // an email should always be present here.
      const email = await currentEmail()
      if (!email || !email.includes("@")) { setErr("Please sign in to pay."); setBusy(false); return }
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
