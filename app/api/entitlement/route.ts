// Entitlement sync — read (GET) and grant (POST) the signed-in account's pass
// or credits. Writes go through the service role so the browser can't grant
// itself anything. The caller must present a valid Supabase access token.

import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"
import { PASSES } from "@/lib/pricing"
import { sendReceipt } from "@/lib/email"

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

  let kind = "", passId = "", addCredits = 0, amountUsd = 0, spendCredits = 0
  try {
    const body = await request.json()
    kind = String(body.kind || "")
    passId = String(body.passId || "")
    addCredits = Number(body.addCredits || 0)
    amountUsd = Number(body.amountUsd || 0)
    spendCredits = Number(body.spendCredits || 0)
  } catch { return Response.json({ error: "bad request" }, { status: 400 }) }

  const admin = getAdminClient()
  const { data: existing } = await admin.from("kloom_entitlements").select("credits").eq("user_id", user.id).maybeSingle()

  const patch: Record<string, unknown> = { user_id: user.id, email: user.email, updated_at: new Date().toISOString() }

  if (kind === "pass") {
    const def = PASSES.find((p) => p.id === passId)
    if (!def) return Response.json({ error: "unknown pass" }, { status: 400 })
    patch.pass_id = passId
    patch.expires_at = new Date(Date.now() + def.durationHours * 3600_000).toISOString()
  } else if (kind === "credits") {
    patch.credits = (existing?.credits ?? 0) + Math.max(0, Math.round(addCredits))
  } else if (kind === "spend") {
    // Voice metering: deduct minutes as they're consumed; never below zero.
    const after = Math.max(0, (existing?.credits ?? 0) - Math.max(0, Math.round(spendCredits)))
    patch.credits = after
    const { error: sErr } = await admin.from("kloom_entitlements").upsert(patch, { onConflict: "user_id" })
    if (sErr) return Response.json({ error: sErr.message }, { status: 500 })
    return Response.json({ ok: true, credits: after })
  } else {
    return Response.json({ error: "unknown kind" }, { status: 400 })
  }

  const { error } = await admin.from("kloom_entitlements").upsert(patch, { onConflict: "user_id" })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Receipt email (no-op until RESEND_API_KEY is set). Fire-and-forget.
  if (user.email) {
    if (kind === "pass") {
      const def = PASSES.find((p) => p.id === passId)!
      const invites = def.invitations === "unlimited" ? "unlimited invitations" : `${def.invitations} invitation${def.invitations === 1 ? "" : "s"}`
      sendReceipt({
        to: user.email,
        itemName: `${def.name} pass`,
        amountUsd: def.priceUsd,
        detail: `Unlimited voice · unrestricted · ${invites}`,
      }).catch(() => {})
    } else if (kind === "credits") {
      const mins = Math.max(0, Math.round(addCredits))
      sendReceipt({
        to: user.email,
        itemName: `${mins} FlexiCalls minutes`,
        amountUsd: amountUsd,
        detail: "Voice minutes added — they never expire",
      }).catch(() => {})
    }
  }

  return Response.json({ ok: true })
}
