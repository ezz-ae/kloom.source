// Chips — balance, the daily, and buying more.
//
//   GET                              → the offer: packs, what a chip buys, what can be earned
//   POST { action: "open" }          → mint/adopt a wallet, return its balance
//   POST { action: "daily" }         → claim today's grant (once per UTC day)
//   POST { action: "buy", packId }   → a real Ziina checkout for that pack
//   POST { action: "claim", … }      → confirm the payment landed, credit the chips
//
// The pass sells access. Chips sell consumption, and unlike the pass they can be
// bought again the same evening — which is the entire point (lib/airraw/chips.ts).
//
// WHAT STOPS SOMEONE BUYING THE SMALL PACK AND CLAIMING THE LARGE ONE. Two
// independent guards, neither of which depends on a database being reachable:
// the pack id is inside the HMAC the checkout hands back, so the client cannot
// name a different pack on the claim than the one it paid for; and the amount the
// provider says was actually paid must cover that pack's price. Either alone
// would do. Both, because this is the line where money is decided.
import type { NextRequest } from "next/server"
import { SITE_URL } from "@/lib/brand"
import { createPaymentIntent, getPaymentIntent, ziinaConfigured } from "@/lib/ziina"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import { signIntent, verifyIntentSig } from "@/lib/airraw-pro-token"
import { metaPurchase, metaEvent } from "@/lib/meta-capi"
import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"
import { mintPurse, purseConfigured, walletFor } from "@/lib/airraw/purse"
import {
  CHIP_PACKS, CHARS_PER_CHIP, CHIPS_PER_PHOTO, DAILY_CHIPS, REFERRAL_CHIPS,
  packById, grantChips, chipState, utcDay, ledgerReady,
} from "@/lib/airraw/chips"
import { createHash } from "crypto"
import { applyPromo, promoLabel, PROMO_MAX_OFF } from "@/lib/airraw/promo"

export const maxDuration = 30

/** Bind the signature to the pack as well as the intent, so the pack is not a client claim. */
const packAnchor = (intentId: string, packId: string) => `${intentId}:${packId}`


// ── the purse, as a cookie ───────────────────────────────────────────────────
// The wallet has to be readable by endpoints that spend chips — /api/tts most of
// all, which is called from eight places. Threading a token through every one of
// those call sites would be eight chances to forget, and the ninth caller written
// next month would silently bill nobody. A cookie rides along on every same-origin
// request instead, so an endpoint that needs the wallet just asks for it.
//
// Not httpOnly, deliberately and unlike a session cookie: the purse is also the
// user's portability story — the same "copy this and paste it on your other
// device" the pass already has — and a token the page cannot read cannot be
// offered to them. It is a bearer credential either way, which is why it is
// SameSite=Lax (never sent cross-site) and Secure in production.
const PURSE_COOKIE = "airraw_purse"

function purseCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  return `${PURSE_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
}

function cookiePurse(req: NextRequest): string | null {
  const v = req.cookies.get(PURSE_COOKIE)?.value
  return v ? decodeURIComponent(v) : null
}

export async function GET() {
  const ready = await ledgerReady()
  return Response.json({
    // `ready` is false while the ledger is unreachable. The sheet hides the packs
    // rather than offering a button that can only fail.
    ready,
    packs: CHIP_PACKS,
    minutesPerChip: 1,
    charsPerChip: CHARS_PER_CHIP,
    photoChips: CHIPS_PER_PHOTO,
    daily: DAILY_CHIPS,
    referral: REFERRAL_CHIPS,
    methods: ziinaConfigured() ? ["card"] : [],
  }, { headers: { "Cache-Control": "public, max-age=60" } })
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`chips:${ip}`, 40, 60_000)
  if (!rl.ok) return Response.json({ error: "slow down a sec" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

  let body: {
    action?: string; packId?: string; intentId?: string; t?: number; s?: string
    pass?: string; purse?: string; fbp?: string; fbc?: string; promo?: string
  } = {}
  try { body = await req.json() } catch { /* */ }
  const { action, packId, intentId, t: anchorTs, s: anchorSig, pass, purse, fbp, fbc, promo } = body

  // ── open ──
  // Resolve the wallet this browser acts on, minting a purse only when there is
  // no pass and no valid purse already. An unverifiable purse is not adopted and
  // not replaced silently — see walletFor.
  if (action === "open") {
    let token = purse || cookiePurse(req) || ""
    let wallet = walletFor(pass, token)
    if (!wallet) {
      if (!purseConfigured()) return Response.json({ error: "wallets are not configured" }, { status: 503 })
      token = mintPurse()
      wallet = walletFor(pass, token)
    }
    const st = await chipState(wallet)
    return Response.json({
      // Echoed only when we minted one; an existing purse is already held by the client.
      purse: token && token !== purse ? token : undefined,
      balance: st.balance, lifetimeIn: st.lifetimeIn, lifetimeOut: st.lifetimeOut,
      history: st.history, daily: DAILY_CHIPS,
    }, { headers: token ? { "Set-Cookie": purseCookie(token) } : undefined })
  }

  // ── the daily ──
  // Fixed, announced in advance, once per UTC day, and forfeiting nothing if
  // missed. The wallet's own event key makes it idempotent; the IP bound below is
  // what stops one person minting fresh purses all afternoon to farm it.
  if (action === "daily") {
    if (!DAILY_CHIPS) return Response.json({ ok: false, reason: "off" })
    const wallet = walletFor(pass, purse || cookiePurse(req))
    if (!wallet) return Response.json({ error: "no wallet — open one first" }, { status: 400 })
    const day = utcDay()

    if (!(await ipDailyAllowed(ip, day))) {
      return Response.json({ ok: false, reason: "ip-cap", balance: (await chipState(wallet)).balance })
    }
    const mv = await grantChips(wallet, DAILY_CHIPS, "daily", `daily:${wallet}:${day}`)
    if (!mv.ok) return Response.json({ ok: false, reason: mv.reason, balance: mv.balance }, { status: mv.reason === "unavailable" ? 503 : 200 })
    // replay = they already claimed today. Not an error, and not a second grant.
    return Response.json({ ok: true, granted: mv.replay ? 0 : DAILY_CHIPS, already: !!mv.replay, balance: mv.balance })
  }

  // ── buy ──
  if (action === "buy") {
    const pack = packById(packId)
    if (!pack) return Response.json({ error: "unknown pack" }, { status: 400 })
    if (!ziinaConfigured()) return Response.json({ error: "payments not configured" }, { status: 503 })
    // Never take money for chips we cannot deliver. The tables are applied by
    // hand, so "code is live, ledger is not" is a real state — and charging
    // someone during it is the one failure in this flow with no good answer.
    if (!(await ledgerReady())) {
      return Response.json({ error: "chips aren't available for a moment — nothing was charged" }, { status: 503 })
    }
    // Require a wallet BEFORE taking money: chips paid for with nowhere to put
    // them is the one failure here with no clean recovery.
    const wallet = walletFor(pass, purse || cookiePurse(req))
    if (!wallet) return Response.json({ error: "no wallet — open one first" }, { status: 400 })

    const origin = process.env.AIRRAW_ORIGIN || req.nextUrl.origin || SITE_URL
    const ret = process.env.AIRRAW_HOME === "1" ? "/airraw" : "/app"
    try {
      // The discount is computed HERE, from the code the checkout was opened
      // with. A price the browser can name is a price the browser can invent.
      const deal = applyPromo(pack.usd, promo)
      const intent = await createPaymentIntent({
        usd: deal.usd,
        message: `${pack.chips} chips${deal.applied ? ` · ${promoLabel(deal)}` : ""}`,
        successUrl: `${origin}${ret}?chips_ok=1`,
        cancelUrl:  `${origin}${ret}`,
        failureUrl: `${origin}${ret}?chips_fail=1`,
      })
      const url = intent.redirect_url || intent.embedded_url
      if (!url) return Response.json({ error: "no checkout url from provider" }, { status: 502 })
      const anchor = Date.now()
      metaEvent({
        eventName: "InitiateCheckout", value: pack.usd, currency: "USD", eventId: intent.id,
        clientIp: ip, userAgent: req.headers.get("user-agent") || undefined, fbp, fbc,
      }).catch(() => {})
      return Response.json({
        url, intentId: intent.id, packId: pack.id, chips: pack.chips,
        price: deal.usd, listPrice: pack.usd, promo: deal.applied ? deal.code : undefined, saved: deal.saved,
        t: anchor, s: signIntent(packAnchor(intent.id, pack.id), anchor),
        test: (intent as { test?: boolean }).test === true,
      })
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "checkout failed" }, { status: 502 })
    }
  }

  // ── claim ──
  if (action === "claim") {
    if (!intentId || !packId) return Response.json({ error: "missing intentId or packId" }, { status: 400 })
    const pack = packById(packId)
    if (!pack) return Response.json({ error: "unknown pack" }, { status: 400 })
    // Guard one: this signature was issued for THIS intent and THIS pack.
    if (verifyIntentSig(packAnchor(intentId, packId), Number(anchorTs), anchorSig) === null) {
      return Response.json({ paid: false, status: "bad_anchor" }, { status: 400 })
    }
    const wallet = walletFor(pass, purse || cookiePurse(req))
    if (!wallet) return Response.json({ error: "no wallet" }, { status: 400 })

    try {
      const intent = await getPaymentIntent(intentId)
      if (intent.status !== "completed") return Response.json({ paid: false, status: intent.status })
      // Guard two: the money that actually arrived covers this pack. Ziina reports
      // minor units; a cent of tolerance absorbs rounding on conversion.
      const paidUsd = typeof intent.amount === "number" ? intent.amount / 100 : null
      // A promo may legitimately have lowered this, so the floor is the deepest
      // discount any code is allowed to reach — not the list price, which would
      // reject every discounted sale, and not zero, which would accept anything.
      const floor = pack.usd * (1 - PROMO_MAX_OFF / 100)
      if (paidUsd !== null && paidUsd + 0.01 < floor) {
        return Response.json({ paid: false, status: "amount_mismatch" })
      }
      // Idempotent on the intent id: the buyer refreshing the return page, the
      // webhook, and a second tab all credit the same purchase exactly once.
      const mv = await grantChips(wallet, pack.chips, "buy", `buy:${intentId}`)
      if (!mv.ok) return Response.json({ paid: true, credited: false, reason: mv.reason }, { status: 503 })
      if (!mv.replay) {
        metaPurchase({
          value: pack.usd, currency: "USD", eventId: intentId,
          clientIp: ip, userAgent: req.headers.get("user-agent") || undefined, fbp, fbc,
        }).catch(() => {})
      }
      return Response.json({ paid: true, credited: true, granted: mv.replay ? 0 : pack.chips, balance: mv.balance })
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "claim failed" }, { status: 502 })
    }
  }

  return Response.json({ error: "unknown action" }, { status: 400 })
}

/**
 * Bound the daily by IP as well as by wallet.
 *
 * The wallet key alone cannot stop farming, because minting a purse is free and
 * anonymous by design — so someone could mint one per claim. This reuses the
 * pass_spend row-lock as a per-IP-per-day counter, the same primitive the free
 * minute already leans on. A household or a carrier-NAT'd phone network gets a
 * bounded number of dailies rather than one between all of them; and if the
 * counter is unreachable we allow the grant, because the downside is a few cents
 * of speech and the alternative is denying a real returning visitor.
 */
const IP_DAILY_MAX = Math.max(1, Number(process.env.CHIP_DAILY_IP_MAX || 5))

async function ipDailyAllowed(ip: string, day: string): Promise<boolean> {
  if (!hasAdmin()) return true
  const key = `chipday:${createHash("sha256").update(`${ip}:${day}`).digest("hex").slice(0, 24)}`
  try {
    const { data, error } = await getAdminClient().rpc("pass_spend", {
      p_key: key, p_chars: 1, p_cap: IP_DAILY_MAX, p_day_cap: IP_DAILY_MAX,
    })
    if (error) throw new Error(error.message)
    return (data as { ok?: boolean })?.ok !== false
  } catch {
    return true
  }
}
