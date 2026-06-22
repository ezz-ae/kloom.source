/**
 * POST /api/ziina-webhook   (event: payment_intent.status.updated)
 *
 * Security model: Ziina's webhook payload/signature format is lightly documented,
 * so we do NOT trust the body. We extract the payment_intent id, then RE-FETCH it
 * from Ziina with our API key and act only on the authoritative status. An attacker
 * cannot forge a "completed" payment, and the intent→wallet mapping was created by
 * us at checkout — so a replayed event can only (idempotently) credit the rightful
 * wallet. If ZIINA_WEBHOOK_SECRET is set and a signature header is present, we also
 * verify HMAC as defense-in-depth.
 *
 * Configure in Ziina: register this URL via POST /webhook with your secret, event
 * payment_intent.status.updated.
 */
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getPaymentIntent } from "@/lib/ziina"
import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"

const SECRET = process.env.ZIINA_WEBHOOK_SECRET || ""
const SIG_HEADERS = ["x-ziina-signature", "ziina-signature", "x-signature"]

function pickIntentId(b: any): string | null {
  const cands = [
    b?.data?.id, b?.payment_intent?.id, b?.object?.id, b?.id,
    b?.data?.payment_intent?.id, b?.data?.object?.id, b?.data?.payment_intent_id, b?.payment_intent_id,
  ]
  for (const c of cands) if (typeof c === "string" && c.length > 3) return c
  return null
}

export async function POST(req: NextRequest) {
  const raw = await req.text()

  // Optional HMAC verification (only when a secret AND a known header are present).
  if (SECRET) {
    const header = SIG_HEADERS.map((h) => req.headers.get(h)).find(Boolean)
    if (header) {
      const expected = crypto.createHmac("sha256", SECRET).update(raw).digest("hex")
      let ok = false
      try { ok = crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(header, "hex")) } catch { ok = false }
      if (!ok) return NextResponse.json({ error: "invalid_signature" }, { status: 401 })
    }
  }

  if (!hasAdmin()) return NextResponse.json({ ok: false, error: "admin_unconfigured" })

  let body: any = {}
  try { body = raw ? JSON.parse(raw) : {} } catch {}
  const intentId = pickIntentId(body)
  if (!intentId) return NextResponse.json({ ok: false, error: "no_intent_id" })

  const sb = getAdminClient()

  try {
    // Authoritative status straight from Ziina.
    const intent = await getPaymentIntent(intentId)
    if (intent?.status !== "completed") {
      return NextResponse.json({ ok: true, skipped: `status=${intent?.status}` })
    }

    // Look up our mapping (who paid, for what) — just to confirm it's a real intent.
    const { data: row } = await sb.from("ziina_payments").select("status,wallet,kind").eq("id", intentId).maybeSingle()
    if (!row)                       return NextResponse.json({ ok: false, error: "unknown_intent" })
    if (row.status === "completed") return NextResponse.json({ ok: true, skipped: "already_processed" })

    // The webhook does NOT grant. The authoritative grant into kloom_entitlements
    // (the only store the app reads) happens via the authed reconcile — ziina-verify,
    // which resolves the buyer from their access token and claim+grants ATOMICALLY in
    // a single transaction, seeding the entitlement row if missing. It runs on the
    // payment-success return AND on every app open, so a buyer who paid is granted the
    // moment they're back in the app. Granting here would either need an unauthenticated
    // email→user lookup or write to a store nothing reads — both removed. We only log.
    console.log(`ziina-webhook: confirmed ${intentId} (kind=${row.kind}, ${row.wallet}) — grant deferred to authed reconcile`)
    return NextResponse.json({ ok: true, kind: row.kind, wallet: row.wallet })
  } catch (e) {
    console.error("ziina-webhook: handler error", e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
