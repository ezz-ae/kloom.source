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
          // Inline ACDC card fields aren't enabled for this account/region (e.g.
          // UAE). Fall back to a CARD-ONLY button (no yellow PayPal button); if the
          // card source itself isn't eligible, render the default funding set so
          // payment still works.
          if (btnRef.current) {
            const onErr = (e: any) => { const m = String(e?.message || e); setErr(m); onError?.(m) }
            // Fixed height so our branded button laid on top lines up pixel-for-pixel.
            const cardOnly = paypal.Buttons({ fundingSource: paypal.FUNDING?.CARD, style: { height: 48 }, createOrder, onApprove, onError: onErr })
            if (cardOnly?.isEligible?.()) cardOnly.render(btnRef.current)
            else paypal.Buttons({ style: { height: 48 }, createOrder, onApprove, onError: onErr }).render(btnRef.current)
          }
          setStatus("ineligible")
          return
        }
        if (numberRef.current) cardField.NumberField({ placeholder: "Card number" }).render(numberRef.current)
        if (expiryRef.current) cardField.ExpiryField({ placeholder: "MM / YY" }).render(expiryRef.current)
        if (cvvRef.current)    cardField.CVVField({ placeholder: "CVV" }).render(cvvRef.current)
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

  const inline = status !== "ineligible"   // ACDC card fields available
  // Once card fields are confirmed, the PayPal overlay is hidden. Until then
  // (loading / ineligible) it stays a sized, opacity-0 layer so PayPal renders
  // into it correctly and can catch the click.
  const cardFieldsLive = status === "ready" || status === "paying" || status === "done"
  const payLabel = status === "loading" ? "Loading…" : status === "paying" ? "Processing…" : status === "done" ? "Paid ✓" : `Pay $${Number(price).toFixed(2)}`

  return (
    <div className="space-y-2.5">
      {/* Inline card fields — only when ACDC is eligible. */}
      {inline && (
        <>
          <div ref={numberRef} className="h-11 rounded-xl border border-border/50 bg-white/5 px-3.5 flex items-center" />
          <div className="grid grid-cols-2 gap-2.5">
            <div ref={expiryRef} className="h-11 rounded-xl border border-border/50 bg-white/5 px-3.5 flex items-center" />
            <div ref={cvvRef} className="h-11 rounded-xl border border-border/50 bg-white/5 px-3.5 flex items-center" />
          </div>
        </>
      )}

      {/* The Pay button. ALWAYS our own brand button. When ACDC is ineligible,
          PayPal's real card button is laid transparently on top (opacity 0) to
          catch the click — so the user only ever sees OUR button, no PayPal
          branding. When ACDC is eligible, our button submits the card fields. */}
      <div className="relative">
        <button
          onClick={inline ? pay : undefined}
          disabled={status === "loading" || status === "paying" || status === "done"}
          className="w-full h-12 rounded-xl brand-gradient text-stone-950 font-bold text-sm disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center"
        >
          {payLabel}
        </button>
        {/* PayPal fallback button — invisible, on top, catching the click. Hidden
            only once the inline card fields are live (then our button submits them). */}
        <div ref={btnRef} className={cardFieldsLive ? "hidden" : "absolute inset-0 opacity-0 z-10"} />
      </div>

      <p className="text-[10px] text-foreground/30 text-center">🔒 Encrypted · your card is never stored</p>
      {err && <p className="text-xs text-red-400 text-center">{err}</p>}
    </div>
  )
}
