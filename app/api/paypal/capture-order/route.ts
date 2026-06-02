/**
 * POST /api/paypal/capture-order
 *
 * Captures an approved PayPal order (server-side, our credentials → authoritative),
 * reads the wallet/credits/kind back out of custom_id, and credits the wallet via
 * the same server-only credit_wallet path. Idempotent (tx_sig = paypal_<captureId>).
 *
 * Body: { orderID }
 */
import { NextRequest, NextResponse } from "next/server"
import { captureOrder } from "@/lib/paypal"
import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"

export async function POST(req: NextRequest) {
  if (!hasAdmin()) return NextResponse.json({ ok: false, error: "admin_unconfigured" }, { status: 503 })

  const { orderID } = await req.json()
  if (!orderID) return NextResponse.json({ ok: false, error: "missing_order" }, { status: 400 })

  try {
    const cap = await captureOrder(String(orderID))
    if (!cap.ok || !cap.custom) {
      return NextResponse.json({ ok: false, status: cap.status, error: "not_completed" }, { status: 402 })
    }

    const { wallet, credits, kind } = cap.custom
    const txSig = `paypal_${cap.captureId || cap.orderId}`
    const sb = getAdminClient()

    // 1) Credit packs → balance (idempotent).
    if (credits > 0) {
      const { data, error } = await sb.rpc("credit_wallet", {
        p_wallet: wallet, p_credits: credits, p_tx_sig: txSig, p_amount_sol: 0, p_kind: "purchase",
      })
      if (error) { console.error("paypal-capture: credit error", error); return NextResponse.json({ ok: false, error: error.message }, { status: 500 }) }
      if (data?.error !== "duplicate_tx") {
        fetch(`${req.nextUrl.origin}/api/distribute-bloom`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: wallet, amount: credits }),
        }).catch(() => {})
      }
    }

    // 2) Unlimited pass or premium plan → subscription row (PayPal order = one-time,
    //    so a plan is a 30-day pass).
    if (kind === "unlimited" || kind.startsWith("chat-") || kind.startsWith("creator-") || (kind !== "purchase" && credits === 0)) {
      const plan     = kind === "unlimited" ? "voice-unlimited" : kind
      const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      await sb.from("bloom_subscriptions").upsert({
        wallet, plan, status: "active",
        ls_subscription_id: txSig,
        renews_at: kind === "unlimited" ? null : renewsAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "wallet" })
    }

    console.log(`paypal-capture: ${cap.orderId} → ${credits} credits, kind=${kind}, ${wallet}`)
    return NextResponse.json({ ok: true, credits, kind, wallet })
  } catch (e) {
    console.error("paypal-capture: handler error", e)
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
