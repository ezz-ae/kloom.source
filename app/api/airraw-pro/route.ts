import { SITE_URL } from "@/lib/brand"
import type { NextRequest } from "next/server"
import { createPaymentIntent, getPaymentIntent, usdToMinor, ziinaConfigured } from "@/lib/ziina"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import { mintProToken, signIntent, verifyIntentSig } from "@/lib/airraw-pro-token"
import { metaPurchase, metaEvent } from "@/lib/meta-capi"
import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"
import { cryptoGateway } from "@/lib/pay/crypto"

// AIRRAW Pro — anonymous one-time 30-day pass via Ziina hosted checkout.
//   POST { action: "checkout", method? }   → { url, intentId }  (redirect the user to url)
//   POST { action: "claim", intentId }     → { paid, token, until }  (after they return)
//   GET                                    → the offer, and which rails are live
//
// TWO RAILS, ONE PASS. `method: "crypto"` sells the same thing through
// NOWPayments (lib/pay/crypto.ts) — no content policy to fall foul of and no
// underwriting to wait on, which matters for this platform. Everything that makes
// the sale SAFE stays here, above both rails and identical for both: the pass is
// minted only on a confirmed payment, the amount is checked so a cheaper sale
// can't be replayed into a pass, and the window is anchored to purchase time.
// A rail answers "did they pay, and how much"; it never decides what that buys.
// The token is HMAC-signed server-side (no account needed) and minted ONLY after
// the relevant rail confirms the money arrived — a client can never fake a paid
// pass on either one.
export const maxDuration = 30

const PRICE_USD = Number(process.env.AIRRAW_PRO_USD || 9)
const DAYS = Number(process.env.AIRRAW_PRO_DAYS || 90)   // the ONE pass: 3 months
const PASS_MINUTES = Number(process.env.AIRRAW_PASS_MINUTES || 6000)  // voice allowance

// The offer, for display. The ProSheet renders THIS instead of hardcoding numbers,
// so changing the env price/duration can never leave the UI selling one thing and
// the checkout charging another.
export async function GET() {
  // `methods` is what the sheet renders its buttons from. A rail that isn't
  // configured is not offered at all, rather than offered and then failing at the
  // moment someone tries to pay.
  const methods = [
    ...(ziinaConfigured() ? ["card"] : []),
    ...(cryptoGateway.ready() ? ["crypto"] : []),
  ]
  return Response.json(
    { price: PRICE_USD, days: DAYS, minutes: PASS_MINUTES, methods },
    { headers: { "Cache-Control": "public, max-age=300" } },
  )
}

export async function POST(req: NextRequest) {
  // return the buyer to the public host they're on (proxy-aware), like the kloom flow
  const origin = process.env.AIRRAW_ORIGIN || req.nextUrl.origin || SITE_URL
  // Gate on "can we sell AT ALL", not on the card rail specifically. This read
  // `!ziinaConfigured()` when there was only one rail; leaving it that way would
  // have made crypto unreachable on any deploy without Ziina keys — the exact
  // deploy most likely to be leaning on crypto.
  if (!ziinaConfigured() && !cryptoGateway.ready()) {
    return Response.json({ error: "payments not configured" }, { status: 503 })
  }
  const rl = rateLimit(`airrawpro:${clientIp(req)}`, 20, 60_000)
  if (!rl.ok) return Response.json({ error: "slow down a sec" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

  let body: { action?: string; method?: string; intentId?: string; t?: number; s?: string; fbp?: string; fbc?: string } = {}
  try { body = await req.json() } catch { /* */ }
  const { action, method, intentId, t: claimTs, s: claimSig, fbp, fbc } = body

  // ── crypto rail ──
  // Same product, same guards, different plumbing. It gets its own branch rather
  // than a shared one because almost nothing is shared: no Ziina intent, no
  // currency conversion, and the purchase anchor is signed over OUR order id.
  if (action === "checkout" && method === "crypto") {
    if (!cryptoGateway.ready()) {
      return Response.json({ error: "crypto checkout isn't available" }, { status: 503 })
    }
    try {
      const ret = process.env.AIRRAW_HOME === "1" ? "/airraw" : "/app"
      const anchor = Date.now()
      const co = await cryptoGateway.createCheckout({
        usd: PRICE_USD,
        description: `The Pass · ${DAYS} days`,
        successUrl: `${origin}${ret}?pro_ok=1`,
        cancelUrl: `${origin}${ret}`,
        // The provider calls US, and that call is the only proof this rail has,
        // so it has to reach a public host — a preview URL will take the money
        // and never be told about it.
        ipnUrl: `${origin}/api/crypto-webhook`,
      })
      metaEvent({
        eventName: "InitiateCheckout", value: PRICE_USD, currency: "USD", eventId: co.id,
        clientIp: clientIp(req), userAgent: req.headers.get("user-agent") || undefined, fbp, fbc,
      }).catch(() => {})
      return Response.json({
        url: co.url, intentId: co.id, price: PRICE_USD, days: DAYS, method: "crypto",
        t: anchor, s: signIntent(co.id, anchor),
        // Crypto does not land while the buyer watches. The client uses this to
        // show a "waiting for the chain" state and keep polling the claim, rather
        // than reading the first unpaid answer as a failure.
        async: true,
        test: false,
      })
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "checkout failed" }, { status: 502 })
    }
  }

  if (action === "checkout") {
    try {
      // Return the buyer to a route that EXISTS on this domain and runs the <ProClaim/>
      // effect (mounted in the root layout): /airraw on the AIRRAW deploy, /app on kloom.io.
      const ret = process.env.AIRRAW_HOME === "1" ? "/airraw" : "/app"
      // Purchase-time anchor, signed so the client can't roll it forward. Returned
      // to the client alongside intentId and stored for the claim — this pins the
      // pass to expire DAYS after PURCHASE regardless of when/how often it's claimed,
      // killing the "re-claim mints a fresh 90 days forever" replay.
      const anchor = Date.now()
      const intent = await createPaymentIntent({
        usd: PRICE_USD,
        message: `The Pass · ${DAYS} days`,
        successUrl: `${origin}${ret}?pro_ok=1`,
        cancelUrl:  `${origin}${ret}`,
        failureUrl: `${origin}${ret}?pro_fail=1`,
      })
      const url = intent.redirect_url || intent.embedded_url
      if (!url) return Response.json({ error: "no checkout url from provider" }, { status: 502 })
      // Record the intent so the webhook can confirm payment + report the Meta conversion
      // even if the buyer never returns to claim (closed tab / cleared localStorage). The
      // anonymous pass has no account, so the webhook is the only GUARANTEED capture point —
      // without this row the webhook sees "unknown_intent" and the paid conversion is lost.
      try {
        // wallet is NOT NULL on the table; a null here made the insert fail silently
        // (it's in a try/catch by design), so the webhook answered "unknown_intent"
        // for every pass and its guaranteed-capture Purchase never fired. The pass
        // has no account, so the wallet is a constant that can never collide with
        // an email — ziina-verify keys its reconcile on the buyer's email.
        if (hasAdmin()) await getAdminClient().from("ziina_payments").insert({
          id: intent.id, wallet: "anon", credits: 0, kind: "airraw_pass",
          amount: intent.amount ?? null, currency: intent.currency_code ?? null, status: "pending",
        })
      } catch { /* never block checkout on the bookkeeping row */ }
      // Mirror InitiateCheckout server-side (event_id=intent.id → de-duped against the
      // browser fbq IC). The browser IC is the one most lost to iOS/ITP/ad-blockers, so a
      // server copy keeps the dense mid-funnel signal a low-AOV pixel optimizes on.
      metaEvent({
        eventName: "InitiateCheckout", value: PRICE_USD, currency: "USD", eventId: intent.id,
        clientIp: clientIp(req), userAgent: req.headers.get("user-agent") || undefined, fbp, fbc,
      }).catch(() => {})
      // `test` surfaces Ziina's per-intent mode — the launch check that money is REAL.
      // true here means ZIINA_TEST=1 and every "sale" is a test payment (no money moves).
      // t/s = signed purchase anchor the client stores and returns on claim.
      return Response.json({
        url, intentId: intent.id, price: PRICE_USD, days: DAYS,
        t: anchor, s: signIntent(intent.id, anchor),
        test: (intent as { test?: boolean }).test === true,
      })
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "checkout failed" }, { status: 502 })
    }
  }

  if (action === "claim") {
    if (!intentId) return Response.json({ error: "missing intentId" }, { status: 400 })

    // Which rail sold this? The id itself says so: crypto order ids are minted by
    // us with an "air_" prefix (lib/pay/crypto.ts) and Ziina's never look like
    // that. Routing on the id rather than a client-supplied `method` means a
    // caller cannot ask for the wrong rail's verification of their id.
    if (intentId.startsWith("air_")) {
      try {
        const st = await cryptoGateway.getStatus(intentId)
        if (!st.paid) return Response.json({ paid: false, status: st.status })
        // The same amount guard the card path applies: the sale must have been
        // opened at (at least) the current price, so an old cheap invoice can't
        // be replayed into today's pass. Underpayment within a sale is caught
        // upstream by the provider's status — see the webhook.
        if (typeof st.usd === "number" && st.usd + 0.01 < PRICE_USD) {
          return Response.json({ paid: false, status: "amount_mismatch" })
        }
        const anchor = verifyIntentSig(intentId, Number(claimTs), claimSig) ?? Date.now()
        const until = anchor + DAYS * 86_400_000
        if (until <= Date.now()) return Response.json({ paid: false, status: "expired" })
        metaPurchase({
          value: PRICE_USD, currency: "USD", eventId: intentId,
          clientIp: clientIp(req), userAgent: req.headers.get("user-agent") || undefined, fbp, fbc,
        }).catch(() => {})
        return Response.json({ paid: true, token: mintProToken(until, PASS_MINUTES), until, minutes: PASS_MINUTES })
      } catch (e) {
        return Response.json({ error: e instanceof Error ? e.message : "claim failed" }, { status: 502 })
      }
    }
    try {
      const intent = await getPaymentIntent(intentId)
      if (intent?.status !== "completed") return Response.json({ paid: false, status: intent?.status || "unknown" })
      // guard: the intent must actually be for (at least) the Pro price, so a cheaper
      // intent id can't be replayed to claim Pro.
      if (typeof intent.amount === "number" && intent.amount + 2 < usdToMinor(PRICE_USD)) {
        return Response.json({ paid: false, status: "amount_mismatch" })
      }
      // Anchor the pass to PURCHASE time (signed `t`), not claim time — so re-claiming
      // the same intent can't roll the 90-day window forward indefinitely (a $9
      // lifetime pass). Fall back to now only for legacy intents with no signature
      // (pre-anchor purchases), which are one-time by the localStorage claim flow.
      const anchor = verifyIntentSig(intentId, Number(claimTs), claimSig) ?? Date.now()
      const until = anchor + DAYS * 86_400_000
      if (until <= Date.now()) return Response.json({ paid: false, status: "expired" })
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
        fbp, fbc,   // browser match keys forwarded from the claim → server Purchase actually matches
      }).catch(() => {})
      return Response.json({ paid: true, token: mintProToken(until, PASS_MINUTES), until, minutes: PASS_MINUTES })
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "claim failed" }, { status: 502 })
    }
  }

  return Response.json({ error: "bad action" }, { status: 400 })
}
