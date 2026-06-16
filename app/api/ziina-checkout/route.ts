/**
 * POST /api/ziina-checkout
 *
 * Creates a Ziina hosted-checkout payment intent and returns { url } to redirect to.
 * Because Ziina has no metadata field, we persist the intent→wallet mapping in
 * `ziina_payments`; the webhook reads it back to credit the right wallet.
 *
 * Body: { walletAddress, price (USD), credits?, kind?, label?, plan? }
 *   kind: "purchase" (credit pack, default) | "unlimited" ($60 pass) | "subscription"
 *   plan: subscription plan id when kind === "subscription"
 */
import { NextRequest, NextResponse } from "next/server"
import { createPaymentIntent, ziinaConfigured } from "@/lib/ziina"
import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"

export async function POST(req: NextRequest) {
  if (!ziinaConfigured()) return NextResponse.json({ error: "ziina_not_configured" }, { status: 503 })
  if (!hasAdmin())        return NextResponse.json({ error: "admin_unconfigured" }, { status: 503 })

  const { walletAddress, price, credits, kind, label, plan } = await req.json()
  if (!walletAddress || !price || price <= 0) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 })
  }

  const txnKind = kind === "unlimited" ? "unlimited"
                : kind === "subscription" ? (plan || "subscription")
                : "purchase"
  const origin  = req.nextUrl.origin
  // Always return to the hub; the verify-on-return handler there credits both
  // packs and passes from the intent→wallet mapping. One return path for all.
  const success = `${origin}/app?payment=success`

  try {
    const intent = await createPaymentIntent({
      usd:        Number(price),
      message:    label ? `Kloom — ${label}` : "Kloom",
      successUrl: success,
      cancelUrl:  `${origin}/app?payment=cancelled`,
      failureUrl: `${origin}/app?payment=failed`,
    })

    if (!intent?.id || !intent?.redirect_url) {
      return NextResponse.json({ error: "no_redirect_url" }, { status: 502 })
    }

    // Persist the mapping the webhook needs (Ziina can't echo custom data back).
    const sb = getAdminClient()
    const { error } = await sb.from("ziina_payments").insert({
      id:       intent.id,
      wallet:   walletAddress,
      credits:  Number(credits) || 0,
      kind:     txnKind,
      amount:   intent.amount ?? null,
      currency: intent.currency_code ?? null,
      status:   "pending",
    })
    if (error) {
      console.error("ziina-checkout: mapping insert failed", error)
      return NextResponse.json({ error: "mapping_failed" }, { status: 500 })
    }

    return NextResponse.json({ url: intent.redirect_url, id: intent.id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
