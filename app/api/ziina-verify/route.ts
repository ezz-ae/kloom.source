/**
 * POST /api/ziina-verify   Body: { wallet }
 *
 * Verify-on-return for Ziina. Finds the buyer's PENDING intents, confirms each is
 * "completed" straight from Ziina (authoritative — the client can't fake it), and
 * ATOMICALLY claims it (pending → completed). It returns the grants the client
 * should apply to its account (credits / pass) via the authed /api/entitlement
 * route — so the purchase lands in kloom_entitlements, the store the UI reads.
 * The atomic claim is the idempotency guard: a refresh can't double-grant.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"
import { getPaymentIntent } from "@/lib/ziina"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  if (!hasAdmin()) return NextResponse.json({ ok: false, error: "admin_unconfigured" }, { status: 503 })
  const { wallet } = await req.json().catch(() => ({}))
  if (!wallet) return NextResponse.json({ ok: false, error: "missing_wallet" }, { status: 400 })

  const sb = getAdminClient()
  const { data: rows } = await sb
    .from("ziina_payments")
    .select("id,credits,kind")
    .eq("wallet", wallet)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(8)

  const grants: { credits: number; kind: string }[] = []
  for (const row of rows ?? []) {
    try {
      const intent = await getPaymentIntent(row.id)
      if (intent?.status !== "completed") continue
      // Atomic claim: only the first verify to flip pending→completed grants.
      const { data: claimed } = await sb
        .from("ziina_payments")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle()
      if (!claimed) continue
      grants.push({ credits: Number(row.credits) || 0, kind: String(row.kind || "credits") })
    } catch { /* skip this one, try the next */ }
  }

  return NextResponse.json({ ok: true, grants })
}
