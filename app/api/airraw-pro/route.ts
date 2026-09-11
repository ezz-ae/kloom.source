import { SITE_URL } from "@/lib/brand"
import type { NextRequest } from "next/server"
import { createPaymentIntent, getPaymentIntent, usdToMinor, ziinaConfigured } from "@/lib/ziina"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import { mintProToken, signIntent, verifyIntentSig, proTokenClaims, proTokenRefusal } from "@/lib/airraw-pro-token"
import { metaPurchase, metaEvent } from "@/lib/meta-capi"
import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"
import { cryptoGateway } from "@/lib/pay/crypto"
import { walletFor } from "@/lib/airraw/purse"
import { grantChips, PASS_CHIPS } from "@/lib/airraw/chips"
import { claimDevice, PASS_DEVICES } from "@/lib/airraw/pass-meter"

// AIRRAW Pro — anonymous one-time 30-day pass via Ziina hosted checkout.
//   POST { action: "checkout", method? }   → { url, intentId }  (redirect the user to url)
//   POST { action: "claim", intentId }     → { paid, token, until }  (after they return)
//   POST { action: "verify", token }       → { valid, until, minutes } | { valid: false, reason }
//   POST { action: "restore_by_email", email, visitorId }
//                                          → { paid, token, until } | { paid: false, reason }
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

/**
 * Mint the pass, and put chips in it.
 *
 * The pass and chips are one economy, not two products: a pass IS a wallet
 * (lib/airraw/purse.ts keys off the signed token), so the buyer walks in holding
 * a balance instead of meeting a second price the moment they want a photo.
 *
 * Idempotent twice over, which is what makes it safe on a path that is re-claimed
 * on every refresh: the token is derived from the purchase-time anchor so the same
 * intent always mints the same token and therefore the same wallet, and the grant
 * is keyed on the intent id so it applies exactly once.
 *
 * It never blocks the pass. A ledger that is down must not cost someone the thing
 * they actually paid for — the chips are recoverable later, the pass in front of
 * them is not.
 */
async function mintPassWithChips(until: number, intentId: string) {
  const token = mintProToken(until, PASS_MINUTES)
  if (PASS_CHIPS > 0) {
    try {
      await grantChips(walletFor(token, null), PASS_CHIPS, "pass", `pass:${intentId}`)
    } catch { /* never block a paid pass on the ledger */ }
  }
  return token
}

export async function POST(req: NextRequest) {
  // return the buyer to the public host they're on (proxy-aware), like the kloom flow
  const origin = process.env.AIRRAW_ORIGIN || req.nextUrl.origin || SITE_URL
  const rl = rateLimit(`airrawpro:${clientIp(req)}`, 20, 60_000)
  if (!rl.ok) return Response.json({ error: "slow down a sec" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

  let body: { action?: string; method?: string; intentId?: string; t?: number; s?: string; fbp?: string; fbc?: string; token?: string; email?: string; visitorId?: string } = {}
  try { body = await req.json() } catch { /* */ }
  const { action, method, intentId, t: claimTs, s: claimSig, fbp, fbc } = body

  // ── is this pass real? ──
  // Before the rails gate: checking a signature needs no rail, and a deploy with
  // no payment keys must still be able to restore a pass that was bought on one
  // that had them.
  // The client stores a pass and reads its expiry, but cannot check its
  // signature. "Restore" therefore accepted anything shaped like a pass, showed
  // it as active, and let every voice request be refused afterwards. This is
  // the same check /api/tts makes, answered up front, so a bad code is refused
  // at the box it was typed into. It mints nothing and reveals nothing beyond
  // what the token itself carries.
  if (action === "verify") {
    const token = typeof body.token === "string" ? body.token.trim() : ""
    const claims = proTokenClaims(token)
    if (claims) return Response.json({ valid: true, until: claims.until, minutes: claims.minutes ?? PASS_MINUTES }, { headers: { "Cache-Control": "no-store" } })
    return Response.json({ valid: false, reason: proTokenRefusal(token) || "rejected" }, { headers: { "Cache-Control": "no-store" } })
  }

  // ── the email IS the way back in ──
  //
  // The pass is anonymous and its only credential is a long signed code shown
  // once, in a toast, at the moment of purchase. Miss it and the pass lives on
  // exactly one browser until that browser is cleared — "I made a new account
  // and got no code, so I can't use it anywhere and it will be lost".
  //
  // So the email given at checkout opens it again, with no password. That is a
  // deliberate trade: anyone who knows the address can claim the pass. What
  // bounds it is the device budget — three phones, counted in the meter — so a
  // guessed address cannot be spread around, and the owner's own phones are
  // free to return to. For a nine dollar anonymous pass that is the right
  // balance; a password on it would lose more buyers than it protects.
  //
  // The re-minted token is anchored to the PURCHASE row, so the window is the
  // one that was paid for and cannot be rolled forward by restoring again.
  if (action === "restore_by_email") {
    const email = (body.email || "").trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ paid: false, reason: "bad-email" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }
    if (!hasAdmin()) return Response.json({ paid: false, reason: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } })
    try {
      // The newest paid purchase on this address, either rail.
      const { data } = await getAdminClient()
        .from("ziina_payments")
        .select("id,created_at,status,kind")
        .eq("wallet", email)
        .in("kind", ["airraw_pass", "airraw_pass_crypto"])
        .order("created_at", { ascending: false })
        .limit(10)
      const rows = (data || []) as Array<{ id: string; created_at: string; status: string; kind: string }>
      const PAID = ["completed", "finished", "confirmed", "paid"]
      let paidRow = rows.find((r) => PAID.includes(String(r.status).toLowerCase()))

      // OUR "completed" IS ONLY AS GOOD AS A WEBHOOK THAT MAY NEVER HAVE FIRED.
      //
      // The row is written "pending" at checkout and nothing moves it except
      // /api/ziina-webhook. If that is not registered with the gateway, or a
      // delivery is lost, a buyer who really paid is stored as pending forever —
      // and this door, which only looked at our own column, would refuse them
      // their own pass with "no pass found". A first real payment sat in that
      // exact state.
      //
      // So when nothing is marked paid, ASK THE RAIL about the recent attempts
      // on this address. The rail is the authority on whether money moved; our
      // column is a cache of its answer, and this is where the cache is filled.
      if (!paidRow) {
        for (const r of rows.slice(0, 5)) {
          try {
            if (r.id.startsWith("air_")) {
              const st = await cryptoGateway.getStatus(r.id)
              if (st.paid) { paidRow = r; break }
            } else {
              const intent = await getPaymentIntent(r.id)
              if (intent?.status === "completed") { paidRow = r; break }
            }
          } catch { /* one unanswerable attempt must not hide a paid one behind it */ }
        }
        if (paidRow) {
          try { await getAdminClient().from("ziina_payments").update({ status: "completed" }).eq("id", paidRow.id) } catch { /* the pass matters, the bookkeeping can catch up */ }
        }
      }
      if (!paidRow) {
        // Never say whether the address is known — that would make this an
        // oracle for which addresses bought.
        return Response.json({ paid: false, reason: "no-pass" }, { headers: { "Cache-Control": "no-store" } })
      }
      const anchor = Date.parse(paidRow.created_at)
      const until = (Number.isFinite(anchor) ? anchor : Date.now()) + DAYS * 86_400_000
      if (until <= Date.now()) return Response.json({ paid: false, reason: "expired" }, { headers: { "Cache-Control": "no-store" } })
      const dev = await claimDevice(email, String(body.visitorId || "").slice(0, 80))
      if (!dev.ok) {
        return Response.json({ paid: false, reason: "device-limit", limit: dev.limit }, { headers: { "Cache-Control": "no-store" } })
      }
      return Response.json(
        { paid: true, token: await mintPassWithChips(until, paidRow.id), until, minutes: PASS_MINUTES, devices: dev.devices, limit: dev.limit },
        { headers: { "Cache-Control": "no-store" } },
      )
    } catch (e) {
      return Response.json({ paid: false, reason: e instanceof Error ? e.message : "failed" }, { status: 502, headers: { "Cache-Control": "no-store" } })
    }
  }
  // Gate on "can we sell AT ALL", not on the card rail specifically. This read
  // `!ziinaConfigured()` when there was only one rail; leaving it that way would
  // have made crypto unreachable on any deploy without Ziina keys — the exact
  // deploy most likely to be leaning on crypto.
  if (!ziinaConfigured() && !cryptoGateway.ready()) {
    return Response.json({ error: "payments not configured" }, { status: 503 })
  }

  // The address the buyer can come back with. "anon" where they gave none, which
  // is the column's old constant and is not a valid address, so it can never be
  // matched by restore_by_email.
  const rawEmail = (body.email || "").trim().toLowerCase()
  const buyerEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : "anon"

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
      // The same bookkeeping row the card rail writes, for the same two reasons.
      // recordIpn already reasons about "the quote recorded at checkout" and
      // deliberately avoids erasing it — but nothing was writing one, so a
      // callback that omits a usable price left the sale with no amount at all
      // and the claim's price guard quietly skipped. It is also the only list of
      // who bought on this rail: without it a crypto buyer is invisible to
      // db/reissue-pass.mjs, which is the tool that exists to rescue them.
      let recorded: string = hasAdmin() ? "yes" : "no-db"
      try {
        if (hasAdmin()) {
          const { error } = await getAdminClient().from("ziina_payments").upsert({
            id: co.id, wallet: buyerEmail, credits: 0, kind: "airraw_pass_crypto",
            amount: Math.round(PRICE_USD * 100), currency: "USD", status: "pending",
          })
          if (error) { recorded = `failed: ${error.message.slice(0, 80)}`; console.error("[pass] crypto row NOT written:", error.message) }
        }
      } catch (e) { recorded = `threw: ${(e instanceof Error ? e.message : String(e)).slice(0, 60)}`; console.error("[pass] crypto row threw:", e) }
      metaEvent({
        eventName: "InitiateCheckout", value: PRICE_USD, currency: "USD", eventId: co.id,
        clientIp: clientIp(req), userAgent: req.headers.get("user-agent") || undefined, fbp, fbc,
      }).catch(() => {})
      return Response.json({
        url: co.url, intentId: co.id, price: PRICE_USD, days: DAYS, method: "crypto", recorded,
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
        // THE BUYER MUST SEE THE NAME THEY CAME FOR.
        //
        // Ziina renders the merchant's account name on the payment page, and this
        // account is registered as "Entrestate" — a name with no connection to
        // anything the buyer has been looking at. So someone who clicked an AIRRAW
        // ad, browsed airraw.com and tapped pay lands on a page branded for a
        // company they have never heard of, being asked for a card. Five people
        // reached that page in six weeks and none of them entered one.
        //
        // The account name is a dashboard setting and cannot be fixed from here.
        // The line item can: it is the one piece of text on that page we control,
        // so it carries the name and what is being bought.
        message: `AIRRAW — the pass · ${DAYS} days`,
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
      let recorded: string = hasAdmin() ? "yes" : "no-db"
      try {
        // wallet is NOT NULL on the table; a null here made the insert fail silently
        // (it's in a try/catch by design), so the webhook answered "unknown_intent"
        // for every pass and its guaranteed-capture Purchase never fired. The pass
        // has no account, so the wallet is a constant that can never collide with
        // an email — ziina-verify keys its reconcile on the buyer's email.
        if (hasAdmin()) {
          const { error } = await getAdminClient().from("ziina_payments").insert({
            id: intent.id, wallet: buyerEmail, credits: 0, kind: "airraw_pass",
            amount: intent.amount ?? null, currency: intent.currency_code ?? null, status: "pending",
          })
          // THE ROW IS THE WHOLE RECOVERY STORY, AND IT WAS WRITTEN BLIND.
          //
          // This insert carries the buyer's email, and that email is the only
          // way they get their pass back on another phone. It has always been
          // wrapped in a catch that says nothing — which is correct (a
          // bookkeeping failure must not cost someone a checkout) and was also
          // how a null wallet once broke every webhook for weeks without a
          // sound. So the checkout now REPORTS whether it landed, on the
          // response and in the log.
          if (error) { recorded = `failed: ${error.message.slice(0, 80)}`; console.error("[pass] purchase row NOT written:", error.message) }
        }
      } catch (e) { recorded = `threw: ${(e instanceof Error ? e.message : String(e)).slice(0, 60)}`; console.error("[pass] purchase row threw:", e) }
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
        url, intentId: intent.id, price: PRICE_USD, days: DAYS, recorded,
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
        return Response.json({ paid: true, token: await mintPassWithChips(until, intentId), until, minutes: PASS_MINUTES, chips: PASS_CHIPS })
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
      // Ziina has just told us this intent is completed, which is the same thing
      // the webhook would have said — so record it here rather than leaving the
      // row "pending" until a webhook that may never arrive. restore_by_email
      // reads this column, and a buyer who claimed on their phone and then tried
      // their email on another one used to be told they had never bought.
      if (hasAdmin()) {
        try { await getAdminClient().from("ziina_payments").update({ status: "completed" }).eq("id", intentId) } catch { /* never block the pass on bookkeeping */ }
      }
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
      return Response.json({ paid: true, token: await mintPassWithChips(until, intentId), until, minutes: PASS_MINUTES, chips: PASS_CHIPS })
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "claim failed" }, { status: 502 })
    }
  }

  return Response.json({ error: "bad action" }, { status: 400 })
}
