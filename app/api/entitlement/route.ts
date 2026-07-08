// Entitlement sync — read (GET) and grant (POST) the signed-in account's pass
// or credits. Writes go through the service role so the browser can't grant
// itself anything. The caller must present a valid Supabase access token.

import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

async function userFromToken(token: string) {
  const admin = getAdminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

function bearer(request: Request): string | null {
  const h = request.headers.get("authorization") || ""
  return h.startsWith("Bearer ") ? h.slice(7) : null
}

export async function GET(request: Request) {
  if (!hasAdmin()) return Response.json({ error: "unavailable" }, { status: 503 })
  const token = bearer(request)
  if (!token) return Response.json({ error: "no token" }, { status: 401 })
  const user = await userFromToken(token)
  if (!user) return Response.json({ error: "invalid token" }, { status: 401 })

  const admin = getAdminClient()
  const { data } = await admin.from("kloom_entitlements").select("pass_id,expires_at,credits,unrestricted_until").eq("user_id", user.id).maybeSingle()
  return Response.json({ ok: true, entitlement: data ?? { pass_id: null, expires_at: null, credits: 0, unrestricted_until: null } })
}

export async function POST(request: Request) {
  if (!hasAdmin()) return Response.json({ error: "unavailable" }, { status: 503 })
  const token = bearer(request)
  if (!token) return Response.json({ error: "no token" }, { status: 401 })
  const user = await userFromToken(token)
  if (!user) return Response.json({ error: "invalid token" }, { status: 401 })

  let kind = "", spendCredits = 0
  try {
    const body = await request.json()
    kind = String(body.kind || "")
    spendCredits = Number(body.spendCredits || 0)
  } catch { return Response.json({ error: "bad request" }, { status: 400 }) }

  // SECURITY: the "pass" and "credits" GRANT paths are client-trusted — they took
  // the caller's word that a payment happened. They have ZERO legitimate callers
  // (grantPass/grantCredits in lib/auth.ts are dead code); the real paid grant runs
  // through /api/ziina-verify's atomic claim_and_grant RPC, which verifies the
  // charge with Ziina first. Left open, any signed-in (free) account could POST
  // {kind:"pass"} and mint itself the pass for free. Grants are refused here; only
  // "spend" (deduct-only, cannot escalate) and GET (read-only) remain.
  if (kind === "pass" || kind === "credits") {
    return Response.json({ error: "grants require a verified payment (use the checkout flow)" }, { status: 403 })
  }

  const admin = getAdminClient()
  const { data: existing } = await admin.from("kloom_entitlements").select("credits").eq("user_id", user.id).maybeSingle()

  const patch: Record<string, unknown> = { user_id: user.id, email: user.email, updated_at: new Date().toISOString() }

  if (kind === "spend") {
    // Voice metering: deduct minutes as they're consumed; never below zero.
    const after = Math.max(0, (existing?.credits ?? 0) - Math.max(0, Math.round(spendCredits)))
    patch.credits = after
    const { error: sErr } = await admin.from("kloom_entitlements").upsert(patch, { onConflict: "user_id" })
    if (sErr) return Response.json({ error: sErr.message }, { status: 500 })
    return Response.json({ ok: true, credits: after })
  }

  return Response.json({ error: "unknown kind" }, { status: 400 })
}
