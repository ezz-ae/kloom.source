import crypto from "crypto"

/**
 * Meta Conversions API — server-side event delivery. The browser pixel loses a
 * big slice of conversions (ad blockers, iOS/ITP, tab-close on redirect-back);
 * sending Purchase straight from the server (where Ziina confirms the charge) is
 * the reliable signal Meta optimizes on. We pass the SAME event_id the browser
 * pixel uses so Meta de-duplicates and never double-counts.
 *
 * No-op unless both NEXT_PUBLIC_FB_PIXEL_ID and META_CAPI_TOKEN are set.
 */
const PIXEL = process.env.NEXT_PUBLIC_FB_PIXEL_ID || ""
const TOKEN = process.env.META_CAPI_TOKEN || ""

const sha256 = (s: string) => crypto.createHash("sha256").update(s.trim().toLowerCase()).digest("hex")

/**
 * Generic server-side conversion event → Meta CAPI. event_id is shared with the browser
 * pixel so Meta DE-DUPES the browser + server copies. Use for any standard event
 * (Purchase, InitiateCheckout, …). No-op unless the pixel id + CAPI token are set.
 */
export async function metaEvent(opts: {
  eventName: "Purchase" | "InitiateCheckout" | "AddToCart" | "ViewContent" | "Lead"
  value?: number
  currency?: string
  email?: string
  eventId: string
  clientIp?: string
  userAgent?: string
  fbp?: string
  fbc?: string
}): Promise<void> {
  if (!PIXEL || !TOKEN) return
  try {
    const user_data: Record<string, unknown> = {}
    if (opts.email) user_data.em = [sha256(opts.email)]
    if (opts.clientIp) user_data.client_ip_address = opts.clientIp
    if (opts.userAgent) user_data.client_user_agent = opts.userAgent
    // fbp/fbc are Meta's own identifiers — passed UN-hashed (unlike em). Biggest match
    // lever for an anonymous (emailless) buyer.
    if (opts.fbp) user_data.fbp = opts.fbp
    if (opts.fbc) user_data.fbc = opts.fbc
    const custom_data: Record<string, unknown> = {}
    if (typeof opts.value === "number") { custom_data.value = opts.value; custom_data.currency = opts.currency || "USD" }
    await fetch(`https://graph.facebook.com/v19.0/${PIXEL}/events?access_token=${encodeURIComponent(TOKEN)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [{
          event_name: opts.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: opts.eventId,            // shared with the browser pixel → de-duped
          action_source: "website",
          user_data,
          custom_data,
        }],
        // Temporary end-to-end test hook: when META_TEST_EVENT_CODE is set, this real
        // server event routes to Events Manager → Test Events (and is NOT counted as a
        // live conversion). Use it to prove the server path, then UNSET it in production —
        // otherwise real purchases keep landing in Test Events and stop optimizing ads.
        ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    })
  } catch { /* best-effort — never block the flow on a tracking call */ }
}

/** Purchase convenience wrapper (the ad funnel's primary conversion). */
export async function metaPurchase(opts: {
  value: number
  currency?: string
  email?: string
  eventId: string
  clientIp?: string
  userAgent?: string
  fbp?: string
  fbc?: string
}): Promise<void> {
  return metaEvent({ eventName: "Purchase", ...opts })
}
