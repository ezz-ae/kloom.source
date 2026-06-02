/**
 * POST /api/paypal/create-order
 *
 * Creates a PayPal order for the embedded card fields. The buyer's wallet + what
 * they're buying is packed into the order's custom_id, so no mapping table and no
 * PayPal login are needed. Returns { id } for the client SDK.
 *
 * Body: { walletAddress, price (USD), credits?, kind?, label? }
 */
import { NextRequest, NextResponse } from "next/server"
import { createOrder, paypalConfigured } from "@/lib/paypal"

export async function POST(req: NextRequest) {
  if (!paypalConfigured()) return NextResponse.json({ error: "paypal_not_configured" }, { status: 503 })

  const { walletAddress, price, credits, kind, label } = await req.json()
  if (!walletAddress || !price || price <= 0) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 })
  }
  // Pass the kind through verbatim (unlimited / unrestricted / chat-* / creator-* /
  // purchase). The capture route maps any non-"purchase" kind to a subscription row.
  const txnKind = (typeof kind === "string" && kind.trim()) ? kind.trim() : "purchase"

  try {
    const order = await createOrder({
      usd:     Number(price),
      wallet:  String(walletAddress),
      credits: Number(credits) || 0,
      kind:    txnKind,
      label:   label,
    })
    return NextResponse.json({ id: order.id, status: order.status })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
