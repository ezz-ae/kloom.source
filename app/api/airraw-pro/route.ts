import type { NextRequest } from "next/server"
import { createPaymentIntent, getPaymentIntent, usdToMinor, ziinaConfigured } from "@/lib/ziina"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import { mintProToken } from "@/lib/airraw-pro-token"
import { metaPurchase } from "@/lib/meta-capi"

// AIRRAW Pro — anonymous one-time 30-day pass via Ziina hosted checkout.
//   POST { action: "checkout" }            → { url, intentId }  (redirect the user to url)
//   POST { action: "claim", intentId }     → { paid, token, until }  (after they return)
// The token is HMAC-signed server-side (no account needed) and verified ONLY after
// Ziina confirms the intent is "completed" — a client can never fake a paid pass.
export const maxDuration = 30

const PRICE_USD = Number(process.env.AIRRAW_PRO_USD || 9)
const DAYS = Number(process.env.AIRRAW_PRO_DAYS || 30)

export async function POST(req: NextRequest) {
  // return the buyer to the public host they're on (proxy-aware), like the kloom flow
  const origin = process.env.AIRRAW_ORIGIN || req.nextUrl.origin || "https://airraw.com"
  if (!ziinaConfigured()) return Response.json({ error: "payments not configured" }, { status: 503 })
  const rl = rateLimit(`airrawpro:${clientIp(req)}`, 20, 60_000)
  if (!rl.ok) return Response.json({ error: "slow down a sec" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

  let body: { action?: string; intentId?: string } = {}
  try { body = await req.json() } catch { /* */ }
  const { action, intentId } = body

  if (action === "checkout") {
    try {
      const intent = await createPaymentIntent({
        usd: PRICE_USD,
        message: `AIRRAW Pro · ${DAYS} days`,
        successUrl: `${origin}/airraw?pro_ok=1`,
        cancelUrl:  `${origin}/airraw`,
        failureUrl: `${origin}/airraw?pro_fail=1`,
      })
      const url = intent.redirect_url || intent.embedded_url
      if (!url) return Response.json({ error: "no checkout url from provider" }, { status: 502 })
      return Response.json({ url, intentId: intent.id, price: PRICE_USD, days: DAYS })
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "checkout failed" }, { status: 502 })
    }
  }

  if (action === "claim") {
    if (!intentId) return Response.json({ error: "missing intentId" }, { status: 400 })
    try {
      const intent = await getPaymentIntent(intentId)
      if (intent?.status !== "completed") return Response.json({ paid: false, status: intent?.status || "unknown" })
      // guard: the intent must actually be for (at least) the Pro price, so a cheaper
      // intent id can't be replayed to claim Pro.
      if (typeof intent.amount === "number" && intent.amount + 2 < usdToMinor(PRICE_USD)) {
        return Response.json({ paid: false, status: "amount_mismatch" })
      }
      const until = Date.now() + DAYS * 86_400_000
      // Server-side Purchase → Meta CAPI. This is the AIRRAW ad funnel's ACTUAL
      // conversion (the $9 Pro pass) — without it, ad traffic that buys is invisible
      // to Meta and can't be optimized for. event_id = intentId so a repeated claim
      // (effect re-run / refresh) or a matching browser-pixel Purchase is de-duplicated
      // by Meta, never double-counted. Best-effort — never block the grant on tracking.
      metaPurchase({
        value: PRICE_USD,
        currency: "USD",
        eventId: intentId,
        clientIp: clientIp(req),
        userAgent: req.headers.get("user-agent") || undefined,
      }).catch(() => {})
      return Response.json({ paid: true, token: mintProToken(until), until })
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "claim failed" }, { status: 502 })
    }
  }

  return Response.json({ error: "bad action" }, { status: 400 })
}
