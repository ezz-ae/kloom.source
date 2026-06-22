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

export async function metaPurchase(opts: {
  value: number
  currency?: string
  email?: string
  eventId: string
  clientIp?: string
  userAgent?: string
}): Promise<void> {
  if (!PIXEL || !TOKEN) return
  try {
    const user_data: Record<string, unknown> = {}
    if (opts.email) user_data.em = [sha256(opts.email)]
    if (opts.clientIp) user_data.client_ip_address = opts.clientIp
    if (opts.userAgent) user_data.client_user_agent = opts.userAgent
    await fetch(`https://graph.facebook.com/v19.0/${PIXEL}/events?access_token=${encodeURIComponent(TOKEN)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [{
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: opts.eventId,            // shared with the browser pixel → de-duped
          action_source: "website",
          user_data,
          custom_data: { value: opts.value, currency: opts.currency || "USD" },
        }],
      }),
      signal: AbortSignal.timeout(8000),
    })
  } catch { /* best-effort — never block the grant on a tracking call */ }
}
