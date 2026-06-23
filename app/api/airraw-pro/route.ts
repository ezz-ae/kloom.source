import { createPaymentIntent, getPaymentIntent, usdToMinor, ziinaConfigured } from "@/lib/ziina"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import { mintProToken } from "@/lib/airraw-pro-token"

// AIRRAW Pro — anonymous one-time 30-day pass via Ziina hosted checkout.
//   POST { action: "checkout" }            → { url, intentId }  (redirect the user to url)
//   POST { action: "claim", intentId }     → { paid, token, until }  (after they return)
// The token is HMAC-signed server-side (no account needed) and verified ONLY after
// Ziina confirms the intent is "completed" — a client can never fake a paid pass.
export const maxDuration = 30

const PRICE_USD = Number(process.env.AIRRAW_PRO_USD || 9)
const DAYS = Number(process.env.AIRRAW_PRO_DAYS || 30)
const ORIGIN = process.env.AIRRAW_ORIGIN || "https://airraw.com"

export async function POST(req: Request) {
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
        successUrl: `${ORIGIN}/airraw?pro_ok=1`,
        cancelUrl:  `${ORIGIN}/airraw`,
        failureUrl: `${ORIGIN}/airraw?pro_fail=1`,
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
      return Response.json({ paid: true, token: mintProToken(until), until })
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "claim failed" }, { status: 502 })
    }
  }

  return Response.json({ error: "bad action" }, { status: 400 })
}
