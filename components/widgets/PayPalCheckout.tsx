"use client"

/**
 * PayPal Web SDK v6 checkout — "full PayPal power".
 *
 * One PayPal session covers PayPal + Pay Later + card guest checkout (no buyer
 * login, popup not redirect). Venmo is added when the account/buyer is eligible.
 * Apple Pay / Google Pay are available in v6 too but need extra domain-association
 * setup, so they're intentionally left out here until that's configured.
 *
 * Server stays the same: /api/paypal/create-order → /api/paypal/capture-order.
 * The buyer's wallet + what they bought is packed into the order's custom_id.
 */
import { useEffect, useRef, useState } from "react"
import { createPayPalV6Instance, paypalClientId } from "@/lib/paypal-sdk"
import { Loader2, Check } from "lucide-react"

interface Props {
  walletAddress: string
  price: number
  credits?: number
  kind?: string
  label?: string
  onSuccess: (r: any) => void
  onError?: (msg: string) => void
}

type Status = "loading" | "ready" | "unconfigured" | "error" | "paying" | "done"

export function PayPalCheckout({ walletAddress, price, credits, kind, label, onSuccess, onError }: Props) {
  const [status, setStatus] = useState<Status>("loading")
  const [venmo, setVenmo]   = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  const data = useRef({ walletAddress, price, credits, kind, label, onSuccess, onError })
  data.current = { walletAddress, price, credits, kind, label, onSuccess, onError }

  const ppSession = useRef<any>(null)
  const vnSession = useRef<any>(null)

  // create the order on our server → returns the order id the SDK needs
  async function createOrder(): Promise<string> {
    const d = data.current
    const res = await fetch("/api/paypal/create-order", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: d.walletAddress, price: d.price, credits: d.credits, kind: d.kind, label: d.label }),
    })
    const j = await res.json()
    if (!res.ok || !j.id) throw new Error(j.error || "could not start checkout")
    return j.id
  }

  async function capture(orderId: string) {
    setStatus("paying")
    const res = await fetch("/api/paypal/capture-order", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderID: orderId }),
    })
    const j = await res.json()
    if (!res.ok || !j.ok) throw new Error(j.error || "payment_not_completed")
    setStatus("done")
    data.current.onSuccess(j)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!paypalClientId()) { setStatus("unconfigured"); return }
      try {
        const s   = await fetch("/api/paypal/status").then((r) => r.json()).catch(() => ({}))
        const env = s?.env === "sandbox" ? "sandbox" : "live"
        const sdk = await createPayPalV6Instance(env, ["paypal-payments", "venmo-payments"])
        if (cancelled) return

        const handlers = {
          onApprove: async (d: any) => {
            try { await capture(d.orderId || d.orderID) }
            catch (e) { setStatus("ready"); const m = (e as Error).message; setErr(m); data.current.onError?.(m) }
          },
          onCancel: () => setStatus("ready"),
          onError:  (e: any) => { setStatus("ready"); const m = String(e?.message || e); setErr(m); data.current.onError?.(m) },
        }

        ppSession.current = sdk.createPayPalOneTimePaymentSession(handlers)
        try {
          vnSession.current = sdk.createVenmoOneTimePaymentSession(handlers)
          if (!cancelled) setVenmo(true)
        } catch { /* Venmo not eligible (non-US / not enabled) — fine */ }

        if (!cancelled) setStatus("ready")
      } catch (e) {
        if (!cancelled) { setStatus("error"); setErr((e as Error).message) }
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = (session: any) => {
    if (!session) return
    setErr(null)
    try { session.start({ presentationMode: "auto" }, createOrder()) }
    catch (e) { setErr((e as Error).message) }
  }

  if (status === "unconfigured")
    return <p className="text-xs text-amber-300/80">Card payments aren’t configured yet.</p>
  if (status === "error")
    return <p className="text-xs text-red-400">Couldn’t load PayPal{err ? `: ${err}` : ""}.</p>
  if (status === "done")
    return <div className="flex items-center justify-center gap-2 py-3 text-emerald-400 text-sm font-bold"><Check size={16} /> Payment complete</div>

  const busy = status === "loading" || status === "paying"

  return (
    <div className="space-y-2">
      <button
        onClick={() => start(ppSession.current)}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#ffc439] hover:brightness-95 text-[#003087] font-extrabold text-sm transition-all disabled:opacity-60">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <span className="italic font-black">PayPal</span>}
        {!busy && <span className="text-[#003087]/70 font-semibold">· Pay Later · Card</span>}
      </button>

      {venmo && (
        <button
          onClick={() => start(vnSession.current)}
          disabled={busy}
          className="w-full flex items-center justify-center py-3 rounded-xl bg-[#3d95ce] hover:brightness-95 text-white font-extrabold text-sm italic transition-all disabled:opacity-60">
          Venmo
        </button>
      )}

      {err && status === "ready" && <p className="text-xs text-red-400 text-center">{err}</p>}
      <p className="text-[10px] text-white/30 text-center">PayPal, Pay Later &amp; card — no PayPal account needed</p>
    </div>
  )
}
