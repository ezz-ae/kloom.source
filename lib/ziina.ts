/**
 * Ziina payment helper (server-only).
 *
 * Ziina (https://docs.ziina.com) is a UAE Merchant-of-Record style gateway —
 * hosted card/Apple Pay/etc checkout, no business license needed to take cards.
 *
 * Two important constraints shape our integration:
 *  1. The create-payment-intent body has NO metadata field, so we cannot stash
 *     the buyer's wallet on Ziina. We store the mapping ourselves in the
 *     `ziina_payments` table (id → wallet/credits/kind) and look it up in the
 *     webhook.
 *  2. Ziina only does ONE-TIME payment intents (no native recurring). "Subscriptions"
 *     are sold as one-time 30-day premium passes.
 *
 * Amount is in MINOR units of `currency_code` (e.g. AED 10.50 → 1050 fils).
 * Our app prices are in USD; AED is pegged to USD at 3.6725, so we convert with a
 * configurable rate (override ZIINA_CURRENCY=USD + ZIINA_USD_RATE=1 if your Ziina
 * account is USD-denominated).
 */

const BASE     = (process.env.ZIINA_BASE_URL || "https://api-v2.ziina.com/api").replace(/\/$/, "")
const API_KEY  = process.env.ZIINA_API_KEY || ""
const CURRENCY = (process.env.ZIINA_CURRENCY || "AED").toUpperCase()
const USD_RATE = Number(process.env.ZIINA_USD_RATE || (CURRENCY === "AED" ? "3.6725" : "1"))
const TEST     = process.env.ZIINA_TEST === "1"

export function ziinaConfigured(): boolean {
  return !!API_KEY
}

/** USD price → minor units of the configured Ziina currency. $1 → 367 fils (AED). */
export function usdToMinor(usd: number): number {
  return Math.max(1, Math.round(usd * USD_RATE * 100))
}

export interface CreateIntentArgs {
  usd: number
  message?: string
  successUrl?: string
  cancelUrl?: string
  failureUrl?: string
}

export interface ZiinaIntent {
  id: string
  status: string
  redirect_url?: string
  embedded_url?: string
  amount?: number
  currency_code?: string
}

async function ziinaFetch(path: string, init: RequestInit): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type":  "application/json",
      "Accept":        "application/json",
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let json: any = {}
  try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text } }
  if (!res.ok) {
    throw new Error(`ziina ${res.status}: ${(json?.message || text || "").toString().slice(0, 200)}`)
  }
  return json
}

/** Create a hosted-checkout payment intent. Returns { id, redirect_url, ... }. */
export async function createPaymentIntent(args: CreateIntentArgs): Promise<ZiinaIntent> {
  const body: Record<string, unknown> = {
    amount:        usdToMinor(args.usd),
    currency_code: CURRENCY,
    message:       args.message,
    success_url:   args.successUrl,
    cancel_url:    args.cancelUrl,
    failure_url:   args.failureUrl,
    test:          TEST,
  }
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k]
  return ziinaFetch("/payment_intent", { method: "POST", body: JSON.stringify(body) })
}

/** Authoritatively fetch an intent — used in the webhook to confirm real status. */
export async function getPaymentIntent(id: string): Promise<ZiinaIntent> {
  return ziinaFetch(`/payment_intent/${encodeURIComponent(id)}`, { method: "GET" })
}
