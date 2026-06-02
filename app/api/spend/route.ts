/**
 * POST /api/spend
 * Deduct voice credits server-side (service role). The browser must NEVER call
 * credit_wallet directly — that path is revoked for anon to prevent free minting.
 *
 * Body: { walletAddress, amount, kind }
 *
 * NOTE: this is keyed by wallet only. Before real money flows, add Sign-In-With-
 * Solana so a user can't spend another wallet's credits. Minting (the money
 * risk) is already locked to the server; this closes the persistence gap for spends.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"

export async function POST(req: NextRequest) {
  if (!hasAdmin()) return NextResponse.json({ ok: false, error: "admin_unconfigured" }, { status: 503 })

  const { walletAddress, amount, kind } = await req.json()
  if (!walletAddress || !amount || amount <= 0) {
    return NextResponse.json({ ok: false, error: "invalid_params" }, { status: 400 })
  }
  const k = ["call_billing", "gift_sent"].includes(kind) ? kind : "call_billing"

  try {
    const sb = getAdminClient()
    const { data, error } = await sb.rpc("credit_wallet", {
      p_wallet:     walletAddress,
      p_credits:    -Math.abs(Math.round(amount)),
      p_tx_sig:     `${k}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      p_amount_sol: 0,
      p_kind:       k,
    })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, result: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
