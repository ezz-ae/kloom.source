/**
 * POST /api/ziina-verify   Auth: Bearer <supabase access token>
 *
 * Verify-on-return / reconcile for Ziina. The caller MUST be the signed-in buyer
 * (we resolve their account from the access token — never from a body field the
 * client could spoof). We find that account's PENDING intents, confirm each is
 * "completed" straight from Ziina (authoritative — the client can't fake it), and
 * then claim+grant ATOMICALLY in a single DB transaction via claim_and_grant_ziina:
 *
 *   - The grant runs in the SAME transaction as the claim, and SEEDS the
 *     entitlement row if missing — so a paid charge can never be stranded
 *     (charged with nothing granted) even if the buyer had no entitlement row.
 *   - The claim is the idempotency guard: a refresh / double-submit returns false
 *     and never double-grants. Credits are incremented in-tx (no read-modify-write
 *     race across concurrent /app loads).
 *
 * Returns the grants the client should REPORT (conversion tracking) — the actual
 * credits/pass/unrestricted state is already persisted server-side here.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"
import { getPaymentIntent } from "@/lib/ziina"
import { PASSES, usdForMinutes } from "@/lib/pricing"
import { metaPurchase } from "@/lib/meta-capi"

export const runtime = "nodejs"

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") || ""
  return h.startsWith("Bearer ") ? h.slice(7) : null
}

export async function POST(req: NextRequest) {
  if (!hasAdmin()) return NextResponse.json({ ok: false, error: "admin_unconfigured" }, { status: 503 })

  const sb = getAdminClient()

  // Identity comes from the access token, NOT the request body — so a caller can
  // only ever reconcile their OWN payments (the pending rows are keyed by email).
  const token = bearer(req)
  if (!token) return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 })
  const { data: au, error: aerr } = await sb.auth.getUser(token)
  if (aerr || !au.user?.email) return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 })
  const userId = au.user.id
  const email = au.user.email.trim().toLowerCase()

  const { data: rows } = await sb
    .from("ziina_payments")
    .select("id,credits,kind")
    .eq("wallet", email)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(8)

  // For the Conversions API server-side Purchase event.
  const ua = req.headers.get("user-agent") || undefined
  const ip = ((req.headers.get("x-real-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0]) || "").trim() || undefined

  const grants: { credits: number; kind: string; eventId: string }[] = []
  for (const row of rows ?? []) {
    try {
      const intent = await getPaymentIntent(row.id)
      if (intent?.status !== "completed") continue

      const credits = Number(row.credits) || 0
      const kind = String(row.kind || "credits")
      const def = kind !== "credits" && kind !== "unrestricted" ? PASSES.find((p) => p.id === kind) : null
      // Unknown pass kind — don't claim what we can't grant (leave it pending so a
      // human can reconcile, rather than consuming the charge for nothing).
      if (kind !== "credits" && kind !== "unrestricted" && !def) continue

      const passExpires = def ? new Date(Date.now() + def.durationHours * 3600_000).toISOString() : null
      const unrestrictedUntil = kind === "unrestricted" ? new Date(Date.now() + 30 * 24 * 3600_000).toISOString() : null

      // Atomic: claim + seed-if-missing + grant, all in one transaction.
      const { data: granted, error } = await sb.rpc("claim_and_grant_ziina", {
        p_intent_id: row.id,
        p_user_id: userId,
        p_email: email,
        p_credits: kind === "credits" ? credits : 0,
        p_kind: kind,
        p_pass_id: def ? kind : null,
        p_pass_expires: passExpires,
        p_unrestricted_until: unrestrictedUntil,
      })
      // granted === true only when THIS call performed the claim+grant. false/error
      // → already processed or a transient failure (left pending, no double-grant).
      if (error || granted !== true) continue

      // Server-side Purchase to Meta (reliable) — same event_id the browser fires
      // so Meta de-dupes. Best-effort; never blocks.
      const value = kind === "credits" ? usdForMinutes(credits)
                  : kind === "unrestricted" ? 10
                  : (def?.priceUsd ?? 0)
      metaPurchase({ value, currency: "USD", email, eventId: String(row.id), clientIp: ip, userAgent: ua }).catch(() => {})
      grants.push({ credits, kind, eventId: String(row.id) })
    } catch { /* skip this one, try the next */ }
  }

  return NextResponse.json({ ok: true, grants })
}
