/**
 * GET /api/account-status?wallet=<address>
 *
 * Server truth for a wallet's paid state — credits balance + subscription/premium.
 * Reads via the public anon client (both tables have public-read RLS), so it works
 * even before the service-role key is set. The client mirrors `premium` into
 * localStorage so the synchronous isSubscribed() stays correct without trusting
 * the browser to mint its own premium.
 *
 * Returns: { ok, credits, unlimited, premium, subscription }
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim()
  if (!wallet) return NextResponse.json({ ok: false, error: "missing_wallet" }, { status: 400 })
  if (!URL || !ANON) return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 })

  const sb = createClient(URL, ANON, { auth: { persistSession: false } })

  try {
    const [{ data: credRow }, { data: subRow }] = await Promise.all([
      sb.from("bloom_credits").select("balance").eq("wallet_address", wallet).maybeSingle(),
      sb.from("bloom_subscriptions").select("plan,status,renews_at").eq("wallet", wallet).maybeSingle(),
    ])

    const credits = Number(credRow?.balance ?? 0)

    // Premium = an active subscription, OR a cancelled one still inside its paid
    // period (renews_at in the future). Expired/paused → not premium.
    let premium = false
    if (subRow) {
      if (subRow.status === "active") premium = true
      else if (subRow.status === "cancelled" && subRow.renews_at) {
        premium = new Date(subRow.renews_at).getTime() > Date.now()
      }
    }
    const unlimited = premium && (subRow?.plan === "voice-unlimited" || subRow?.status === "active")
    // The $95 tier — full no-restriction mode across the whole platform.
    const unrestricted = premium && subRow?.plan === "unrestricted"

    return NextResponse.json({
      ok: true, credits, premium, unlimited, unrestricted,
      subscription: subRow ? { plan: subRow.plan, status: subRow.status, renewsAt: subRow.renews_at } : null,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
