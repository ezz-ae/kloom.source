/**
 * POST /api/ziina-verify   Body: { wallet }
 *
 * Verify-on-return for the Ziina hosted checkout. When the buyer lands back on
 * the app after paying, the client calls this with their wallet (email). We find
 * their recent PENDING intents and hand each id to the webhook handler, which
 * re-fetches the authoritative status from Ziina and credits idempotently. This
 * means crediting works WITHOUT a webhook configured in the Ziina dashboard — and
 * if one IS configured, the shared idempotency guard prevents double-crediting.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"

export async function POST(req: NextRequest) {
  if (!hasAdmin()) return NextResponse.json({ ok: false, error: "admin_unconfigured" }, { status: 503 })
  const { wallet } = await req.json().catch(() => ({}))
  if (!wallet) return NextResponse.json({ ok: false, error: "missing_wallet" }, { status: 400 })

  const sb = getAdminClient()
  // Most recent still-pending intents for this buyer (a completed payment whose
  // webhook hasn't fired yet will still read "pending" in our table).
  const { data: rows } = await sb
    .from("ziina_payments")
    .select("id")
    .eq("wallet", wallet)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5)

  let credited = 0
  for (const row of rows ?? []) {
    try {
      // Reuse the webhook's authoritative verify + idempotent credit.
      const res = await fetch(`${req.nextUrl.origin}/api/ziina-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      })
      const j = await res.json().catch(() => ({}))
      if (j?.ok && typeof j.credits === "number") credited += j.credits
    } catch { /* try the next one */ }
  }

  return NextResponse.json({ ok: true, credited })
}
