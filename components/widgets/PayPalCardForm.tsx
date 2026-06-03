"use client"

/**
 * Embedded PayPal card payment — Advanced Card Fields (ACDC).
 *
 * Renders card number / expiry / CVV INLINE in our UI (PayPal-hosted iframes, PCI
 * handled by PayPal). The buyer pays by card WITHOUT a PayPal account or login.
 * If the merchant account isn't enabled for advanced card processing, it falls
 * back to the standard PayPal Buttons (which still allow guest card checkout).
 *
 * Server does create-order + capture-order; the wallet is packed into the order
 * so crediting is server-authoritative and idempotent.
 */
import { useEffect, useRef, useState, useCallback } from "react"
import { loadPayPalSdk, paypalClientId } from "@/lib/paypal-sdk"

const CLIENT_ID = paypalClientId()

interface Props {
  walletAddress: string
  price: number
  credits?: number
  kind?: string
  label?: string
  onSuccess: (r: any) => void
  onError?: (msg: string) => void
}

type Status = "loading" | "ready" | "paying" | "done" | "error" | "unconfigured" | "ineligible"

export function PayPalCardForm({ walletAddress, price, credits, kind, label, onSuccess, onError }: Props) {
  const [status, setStatus] = useState<Status>("loading")
  const [err, setErr]       = useState<string | null>(null)

  const cardFieldRef = useRef<any>(null)
  const numberRef = useRef<HTMLDivElement>(null)
  const expiryRef = useRef<HTMLDivElement>(null)
  const cvvRef    = useRef<HTMLDivElement>(null)
  const btnRef    = useRef<HTMLDivElement>(null)

  // Latest values for the SDK callbacks (which capture closures once).
  const dataRef = useRef({ walletAddress, price, credits, kind, label })
  dataRef.current = { walletAddress, price, credits, kind, label }

  const createOrder = useCallback(async () => {
    const d = dataRef.current
    const res = await fetch("/api/paypal/create-order", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: d.walletAddress, price: d.price, credits: d.credits, kind: d.kind, label: d.label }),
    })
    const j = await res.json()
    if (!res.ok || !j.id) throw new Error(j.error || "create_failed")
    return j.id
  }, [])

  const onApprove = useCallback(async (data: any) => {
    const res = await fetch("/api/paypal/capture-order", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderID: data.orderID }),
    })
    const j = await res.json()
    if (!res.ok || !j.ok) throw new Error(j.error || "capture_failed")
    setStatus("done")
    onSuccess(j)
  }, [onSuccess])

  useEffect(() => {
    if (!CLIENT_ID) { setStatus("unconfigured"); return }
    let cancelled = false
    loadPayPalSdk()
      .then((paypal) => {
        if (cancelled || !paypal?.CardFields) return
        const cardField = paypal.CardFields({
          createOrder,
          onApprove,
          onError: (e: any) => { const m = String(e?.message || e); setErr(m); setStatus("error"); onError?.(m) },
          style: { input: { color: "#ffffff", "font-size": "15px", "font-family": "inherit" } },
        })
        cardFieldRef.current = cardField

        if (!cardField.isEligible()) {
          // ACDC not enabled on this account → standard buttons (guest card still works).
          if (btnRef.current) {
            paypal.Buttons({ createOrder, onApprove, onError: (e: any) => { const m = String(e?.message || e); setErr(m); onError?.(m) } })
              .render(btnRef.current)
          }
          setStatus("ineligible")
          return
        }
        if (numberRef.current) cardField.NumberField().render(numberRef.current)
        if (expiryRef.current) cardField.ExpiryField().render(expiryRef.current)
        if (cvvRef.current)    cardField.CVVField().render(cvvRef.current)
        setStatus("ready")
      })
      .catch((e) => { const m = String(e?.message || e); setErr(m); setStatus("error") })
    return () => { cancelled = true }
  }, [createOrder, onApprove, onError])

  const pay = useCallback(async () => {
    if (!cardFieldRef.current) return
    setStatus("paying"); setErr(null)
    try { await cardFieldRef.current.submit() }
    catch (e: any) { const m = String(e?.message || e); setErr(m); setStatus("error"); onError?.(m) }
  }, [onError])

  if (status === "unconfigured") {
    return <p className="text-xs text-amber-400/80 text-center">Card payments aren’t live yet — set <code>NEXT_PUBLIC_PAYPAL_CLIENT_ID</code>.</p>
  }

  return (
    <div className="space-y-3">
      {status !== "ineligible" && (
        <>
          <div>
            <label className="text-[11px] text-foreground/40">Card number</label>
            <div ref={numberRef} className="mt-1 h-11 rounded-xl border border-border/50 bg-white/5 px-3 flex items-center" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-foreground/40">Expiry</label>
              <div ref={expiryRef} className="mt-1 h-11 rounded-xl border border-border/50 bg-white/5 px-3 flex items-center" />
            </div>
            <div>
              <label className="text-[11px] text-foreground/40">CVV</label>
              <div ref={cvvRef} className="mt-1 h-11 rounded-xl border border-border/50 bg-white/5 px-3 flex items-center" />
            </div>
          </div>
          <button
            onClick={pay}
            disabled={status === "loading" || status === "paying" || status === "done"}
            className="w-full h-11 rounded-xl bg-white text-stone-950 font-bold text-sm disabled:opacity-50 transition-all hover:bg-white/90"
          >
            {status === "loading" ? "Loading…" : status === "paying" ? "Processing…" : status === "done" ? "Paid ✓" : `Pay $${Number(price).toFixed(2)}`}
          </button>
          <p className="text-[10px] text-foreground/30 text-center">🔒 Secured by PayPal · no account needed · we never see your card</p>
        </>
      )}
      <div ref={btnRef} />
      {err && <p className="text-xs text-red-400 text-center">{err}</p>}
    </div>
  )
}
