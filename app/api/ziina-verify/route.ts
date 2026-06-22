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
import { PASSES } from "@/lib/pricing"

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

  // The buyer's entitlement row (seeded at signup, keyed by email). We grant into
  // it SERVER-SIDE right after the atomic claim, so a flaky client can never strand
  // a paid charge (the old flow granted client-side after a network round-trip).
  const { data: ent } = await sb.from("kloom_entitlements").select("user_id,credits").eq("email", wallet).maybeSingle()
  let runningCredits = Number(ent?.credits) || 0

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
      const credits = Number(row.credits) || 0
      const kind = String(row.kind || "credits")
      // Grant into kloom_entitlements here — the store the voice paywall reads.
      if (ent?.user_id) {
        if (kind === "credits" && credits > 0) {
          runningCredits += credits
          await sb.from("kloom_entitlements").update({ credits: runningCredits, updated_at: new Date().toISOString() }).eq("user_id", ent.user_id)
        } else if (kind !== "credits" && kind !== "unrestricted") {
          const def = PASSES.find((p) => p.id === kind)
          if (def) await sb.from("kloom_entitlements").update({ pass_id: kind, expires_at: new Date(Date.now() + def.durationHours * 3600_000).toISOString(), updated_at: new Date().toISOString() }).eq("user_id", ent.user_id)
        }
        // 'unrestricted' has no server column yet — the client still persists that one.
      }
      grants.push({ credits, kind })
    } catch { /* skip this one, try the next */ }
  }

  return NextResponse.json({ ok: true, grants })
}
