// CRYPTO CHECKOUT (NOWPayments), server-only.
//
// Why this exists: the card rail for an adult platform is a specialist business —
// underwriting, higher fees, and a mainstream processor will close the account if
// it finds this content. Crypto has no content policy to fall foul of and no
// underwriting to wait on, so it can take money today. It is a second rail beside
// Ziina, not a replacement: most buyers still want a card.
//
// ── THE ONE STRUCTURAL DIFFERENCE FROM A CARD ────────────────────────────────
//
// A card intent is a thing you can ask about: "is intent X paid?" — one request,
// authoritative answer, any time. An on-chain payment is not. It arrives when it
// arrives (minutes, sometimes much longer), and the buyer is usually long gone
// from the tab by then. NOWPayments tells you about it by CALLING YOU — a signed
// IPN — and its invoice objects have no status of their own to poll.
//
// So the trust flows the other way round here: the callback is the authority, and
// what we can look up later is our own record of it. Which means:
//
//   • The IPN signature is not optional. It is the only thing standing between a
//     stranger POSTing "paid" at us and a free pass, so an unverifiable callback
//     is refused, never "accepted with a warning".
//   • order_id is OUR id, minted by us, and everything keys off it. Provider ids
//     for an invoice-created payment are not known until the buyer picks a coin.
//   • Checkout REFUSES when there is nowhere to record the callback (see ready()).
//     Selling a pass we could never confirm is worse than not selling one.
//
// Docs: https://documenter.getpostman.com/view/7907941/S1a32n38

import { randomBytes } from "crypto"
import { verifyIpnSignature } from "@/lib/pay/ipn-sig"
import type { Gateway, Checkout, CheckoutArgs, PayStatus } from "@/lib/pay/gateway"
import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"

const BASE = (process.env.NOWPAYMENTS_BASE_URL || "https://api.nowpayments.io/v1").replace(/\/$/, "")
const API_KEY = process.env.NOWPAYMENTS_API_KEY || ""
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || ""

/** Where the callback records land. Reuses the existing payments table. */
const TABLE = "ziina_payments"
const KIND = "airraw_pass_crypto"

/**
 * States that mean the money is really there.
 *
 * `confirmed` and `sending` mean the chain has confirmed the transfer and
 * NOWPayments is settling it to us; `finished` means settled. We grant on all
 * three, because for a digital pass the chain's confirmation is the fact that
 * matters and making a buyer wait on someone else's settlement queue is a
 * support ticket, not security.
 *
 * `partially_paid` is deliberately NOT here. It is the crypto shape of the
 * cheap-intent replay the card path guards against: real money arrived, just not
 * enough of it. The amount check above this file is the second line on that, but
 * the status alone already refuses.
 */
const PAID = new Set(["confirmed", "sending", "finished"])

/** Terminal failures. The client stops polling on these instead of spinning. */
const DEAD = new Set(["failed", "refunded", "expired"])

/** Is this state final? Exported so the waiting screen knows when to give up. */
export function cryptoDead(status: string): boolean {
  return DEAD.has(status)
}

export function cryptoConfigured(): boolean {
  return !!API_KEY && !!IPN_SECRET
}

/**
 * Verify a NOWPayments IPN. The scheme itself lives in lib/pay/ipn-sig.ts, with
 * no project imports, so the tests can run the real thing rather than a copy —
 * see that file. This only supplies the secret.
 */
export function verifyIpn(rawBody: string, signature: string | null): { ok: boolean; body: Record<string, unknown> | null } {
  return verifyIpnSignature(rawBody, signature, IPN_SECRET)
}

async function np(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "x-api-key": API_KEY, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(20_000),
  })
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text } }
  if (!res.ok) throw new Error(`nowpayments ${res.status}: ${String(json?.message || text || "").slice(0, 200)}`)
  return json
}

/**
 * Record what a signed callback told us. Called ONLY from the verified IPN path.
 *
 * Last write wins on purpose: a payment walks waiting → confirming → confirmed →
 * finished and we want the latest, and NOWPayments re-sends callbacks, so this
 * has to be idempotent rather than append-only.
 */
export async function recordIpn(orderId: string, status: string, quotedUsd: number | null) {
  // THROWS on failure, deliberately. This row is the only evidence a crypto sale
  // exists: if it doesn't land, the buyer paid and can never claim. The caller
  // turns that into a non-2xx so the provider RETRIES — which is the entire
  // reason webhooks retry, and worth nothing if we always answer 200.
  if (!hasAdmin()) throw new Error("no store configured — cannot record payment")
  const row: Record<string, unknown> = {
    id: orderId, kind: KIND, status, currency: "USD", wallet: null, credits: 0,
  }
  // Only WRITE the amount when we have one. An upsert sets exactly the columns it
  // is given, so passing null here would erase the quote recorded at checkout —
  // and the claim compares against that quote, so erasing it turns a real sale
  // into an unverifiable one. A callback that omits a usable price leaves the
  // number we already trust alone.
  if (quotedUsd != null) row.amount = Math.round(quotedUsd * 100)
  const { error } = await getAdminClient().from(TABLE).upsert(row)
  if (error) throw new Error(`recording the payment failed: ${error.message}`)
}

export const cryptoGateway: Gateway = {
  key: "crypto",

  /**
   * Configured AND able to finish the job.
   *
   * The store is part of "ready" rather than a nice-to-have: without it the IPN
   * has nowhere to land, so the buyer would pay real money for a pass that could
   * never be claimed. A checkout we cannot honour must not open.
   */
  ready() {
    return cryptoConfigured() && hasAdmin()
  },

  async createCheckout(a: CheckoutArgs): Promise<Checkout> {
    // Our own id, and the only one anything downstream uses. NOWPayments assigns
    // a payment id only once the buyer has chosen a coin — too late to hand back
    // here, and not something we want to be waiting on to know what we sold.
    const orderId = `air_${randomBytes(12).toString("hex")}`

    const inv = await np("/invoice", {
      method: "POST",
      body: JSON.stringify({
        price_amount: a.usd,
        price_currency: "usd",
        order_id: orderId,
        order_description: a.description,
        ipn_callback_url: a.ipnUrl,
        success_url: a.successUrl,
        cancel_url: a.cancelUrl,
      }),
    })

    const url = String(inv?.invoice_url || "")
    if (!url) throw new Error("no invoice url from provider")

    // Open the row now, in the same state the provider starts in, carrying the
    // price we QUOTED. The claim path reads this table: a missing row is
    // indistinguishable from a forged id, so a sale we started must look
    // different from one we never did — and the quote has to be on the row from
    // the start, because it is what the claim checks the price against.
    await recordIpn(orderId, "waiting", a.usd)

    return { id: orderId, url, test: false }
  },

  /**
   * Our own record, written by the verified callback — not a call to the
   * provider. See the header: for crypto the signed IPN is the authority, and a
   * lookup that skipped it would be trusting a weaker source than the one we
   * already have.
   */
  async getStatus(orderId: string): Promise<PayStatus> {
    if (!hasAdmin()) return { paid: false, status: "unavailable" }
    const { data } = await getAdminClient()
      .from(TABLE).select("status, amount").eq("id", orderId).eq("kind", KIND).maybeSingle()
    if (!data) return { paid: false, status: "unknown" }
    const status = String(data.status || "unknown")
    return {
      paid: PAID.has(status),
      status,
      usd: typeof data.amount === "number" ? data.amount / 100 : undefined,
    }
  },
}
