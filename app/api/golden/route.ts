// Golden sessions — bought in advance, spent one at a time.
//
//   GET                                → the offer: price, length, how many you hold
//   POST { action: "buy", qty }        → a Ziina checkout for qty × $11
//   POST { action: "claim", … }        → credit the sessions the payment bought
//   POST { action: "open" }            → spend one, and get back a session id
//
// NO NEW TABLE. A golden session is a count, and the chip ledger already holds
// counts atomically and idempotently — so these live in the same wallet under
// their own purse key ("golden:<wallet>"). Same row lock, same event-id replay
// protection, same overdraft refusal, and nothing extra for anyone to run in
// Supabase. Which matters, because the last thing this product needs is a
// second migration waiting on a password nobody can find.
import type { NextRequest } from "next/server"
import { SITE_URL } from "@/lib/brand"
import { createPaymentIntent, getPaymentIntent, ziinaConfigured, chargeCurrency } from "@/lib/ziina"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import { signIntent, verifyIntentSig } from "@/lib/airraw-pro-token"
import { metaPurchase, metaEvent } from "@/lib/meta-capi"
import { walletFor } from "@/lib/airraw/purse"
import { grantChips, spendChips, chipState, ledgerReady } from "@/lib/airraw/chips"
import {
  GOLDEN_USD, GOLDEN_MINUTES, GOLDEN_MAX_BOOKED, GOLDEN_GAMES,
} from "@/lib/airraw/golden"
import { applyPromo, promoLabel } from "@/lib/airraw/promo"
import { randomUUID } from "crypto"

export const maxDuration = 30

const PURSE_COOKIE = "airraw_purse"
function cookiePurse(req: NextRequest): string | null {
  const v = req.cookies.get(PURSE_COOKIE)?.value
  return v ? decodeURIComponent(v) : null
}
/** Sessions live beside chips in the same wallet, under their own key. */
const goldKey = (wallet: string) => `golden:${wallet}`
/** Bind the signature to the quantity, so a claim cannot inflate what it bought. */
const anchorFor = (intentId: string, qty: number) => `${intentId}:g${qty}`

export async function GET() {
  return Response.json({
    price: GOLDEN_USD,
    minutes: GOLDEN_MINUTES,
    maxBooked: GOLDEN_MAX_BOOKED,
    games: GOLDEN_GAMES.map(({ id, name, blurb }) => ({ id, name, blurb })),
    ready: await ledgerReady(),
    methods: ziinaConfigured() ? ["card"] : [],
    // What the statement will say. The sheet shows it under the button.
    charge: chargeCurrency(),
  }, { headers: { "Cache-Control": "public, max-age=60" } })
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`golden:${ip}`, 30, 60_000)
  if (!rl.ok) return Response.json({ error: "slow down a sec" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

  let body: {
    action?: string; qty?: number; promo?: string; intentId?: string; t?: number; s?: string
    pass?: string; purse?: string; fbp?: string; fbc?: string
  } = {}
  try { body = await req.json() } catch { /* */ }
  const { action, qty: rawQty, promo, intentId, t: anchorTs, s: anchorSig, pass, purse, fbp, fbc } = body

  const wallet = walletFor(pass, purse || cookiePurse(req))
  if (!wallet) return Response.json({ error: "no wallet — open one first" }, { status: 400 })

  // ── how many are held ──
  if (action === "held" || !action) {
    const st = await chipState(goldKey(wallet), 6)
    return Response.json({ held: st.balance, minutes: GOLDEN_MINUTES, price: GOLDEN_USD })
  }

  // ── buy ──
  if (action === "buy") {
    const qty = Math.min(GOLDEN_MAX_BOOKED, Math.max(1, Math.round(Number(rawQty) || 1)))
    if (!ziinaConfigured()) return Response.json({ error: "payments not configured" }, { status: 503 })
    // Never take money for sessions that cannot be credited — same guard the
    // chip packs use, and for the same reason: the tables are applied by hand.
    if (!(await ledgerReady())) {
      return Response.json({ error: "the golden room is closed for a moment — nothing was charged" }, { status: 503 })
    }
    const deal = applyPromo(GOLDEN_USD * qty, promo)
    const origin = process.env.AIRRAW_ORIGIN || req.nextUrl.origin || SITE_URL
    const ret = process.env.AIRRAW_HOME === "1" ? "/airraw" : "/app"
    try {
      const intent = await createPaymentIntent({
        usd: deal.usd,
        message: `${qty} golden ${qty === 1 ? "session" : "sessions"}${deal.applied ? ` · ${promoLabel(deal)}` : ""}`,
        successUrl: `${origin}${ret}?gold_ok=1`,
        cancelUrl: `${origin}${ret}`,
        failureUrl: `${origin}${ret}?gold_fail=1`,
      })
      const url = intent.redirect_url || intent.embedded_url
      if (!url) return Response.json({ error: "no checkout url from provider" }, { status: 502 })
      const anchor = Date.now()
      metaEvent({
        eventName: "InitiateCheckout", value: deal.usd, currency: "USD", eventId: intent.id,
        clientIp: ip, userAgent: req.headers.get("user-agent") || undefined, fbp, fbc,
      }).catch(() => {})
      return Response.json({
        url, intentId: intent.id, qty, price: deal.usd, listPrice: GOLDEN_USD * qty,
        promo: deal.applied ? deal.code : undefined, saved: deal.saved,
        t: anchor, s: signIntent(anchorFor(intent.id, qty), anchor),
        test: (intent as { test?: boolean }).test === true,
      })
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "checkout failed" }, { status: 502 })
    }
  }

  // ── claim ──
  if (action === "claim") {
    const qty = Math.min(GOLDEN_MAX_BOOKED, Math.max(1, Math.round(Number(rawQty) || 1)))
    if (!intentId) return Response.json({ error: "missing intentId" }, { status: 400 })
    // The quantity is inside the signature, so a claim cannot ask for ten
    // sessions against a payment for one.
    if (verifyIntentSig(anchorFor(intentId, qty), Number(anchorTs), anchorSig) === null) {
      return Response.json({ paid: false, status: "bad_anchor" }, { status: 400 })
    }
    try {
      const intent = await getPaymentIntent(intentId)
      if (intent.status !== "completed") return Response.json({ paid: false, status: intent.status })
      const paidUsd = typeof intent.amount === "number" ? intent.amount / 100 : null
      // A promo may legitimately have lowered the price, so the floor is what a
      // single session costs — never zero, and never below one session's worth.
      if (paidUsd !== null && paidUsd + 0.01 < GOLDEN_USD) {
        return Response.json({ paid: false, status: "amount_mismatch" })
      }
      const mv = await grantChips(goldKey(wallet), qty, "golden", `golden:${intentId}`)
      if (!mv.ok) return Response.json({ paid: true, credited: false, reason: mv.reason }, { status: 503 })
      if (!mv.replay) {
        metaPurchase({
          value: paidUsd ?? GOLDEN_USD * qty, currency: "USD", eventId: intentId,
          clientIp: ip, userAgent: req.headers.get("user-agent") || undefined, fbp, fbc,
        }).catch(() => {})
      }
      return Response.json({ paid: true, credited: true, granted: mv.replay ? 0 : qty, held: mv.balance })
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "claim failed" }, { status: 502 })
    }
  }

  // ── open one ──
  // Spending is what starts a session. The id is minted here so the event key is
  // ours: a client that retries the same open does not burn two sessions, and a
  // client cannot mint an id that replays someone else's.
  if (action === "open") {
    const id = randomUUID()
    const mv = await spendChips(goldKey(wallet), 1, "golden-open", `gopen:${id}`)
    if (!mv.ok) {
      return Response.json(
        { ok: false, reason: mv.reason === "insufficient" ? "none-held" : mv.reason, held: mv.balance },
        { status: mv.reason === "insufficient" ? 402 : 503 },
      )
    }
    return Response.json({ ok: true, id, held: mv.balance, minutes: GOLDEN_MINUTES })
  }

  return Response.json({ error: "unknown action" }, { status: 400 })
}
