"use client"
/**
 * Generic conversion tracking — platform-agnostic.
 *
 * Fires whatever pixel is installed (Meta `fbq`, TikTok `ttq`, Google `gtag`) and
 * is a silent no-op when none are. Pixels are page-level + funnel/purchase events
 * ONLY — never conversation content. The pixel <script> tags live in
 * components/airroom/PixelScripts (rendered from the root layout, env-gated), so
 * this is dark until NEXT_PUBLIC_*_PIXEL_ID is set on the deployment.
 *
 * Funnel we care about for paid traffic:
 *   start_voice  — they started the free voice (the engaged moment)
 *   paywall_view — they hit the pay wall (intent)
 *   purchase     — they paid (value + currency) ← the one that matters for ROAS
 *   lead         — they left an email (AIRRAW)
 */
type Props = Record<string, string | number | boolean>

// Map our events to each platform's recognized standard event, so ad delivery can
// optimize toward them and value-based bidding works on `purchase`.
const STD: Record<string, { fb?: string; tt?: string; ga?: string }> = {
  start_voice:  { fb: "ViewContent",    tt: "ViewContent",     ga: "select_content" },
  paywall_view: { fb: "AddToCart",      tt: "AddToCart",       ga: "add_to_cart" },
  purchase:     { fb: "Purchase",       tt: "CompletePayment", ga: "purchase" },
  lead:         { fb: "Lead",           tt: "SubmitForm",      ga: "generate_lead" },
  airraw_talk:  { fb: "ViewContent",    tt: "ClickButton",     ga: "select_content" },
  airraw_lead:  { fb: "Lead",           tt: "SubmitForm",      ga: "generate_lead" },
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function track(event: string, props: Props = {}) {
  if (typeof window === "undefined") return
  const w = window as any
  const std = STD[event]
  try { (w.dataLayer = w.dataLayer || []).push({ event, ...props }) } catch { /* */ }
  try {
    if (typeof w.fbq === "function") {
      if (std?.fb) w.fbq("track", std.fb, props)
      w.fbq("trackCustom", event, props)
    }
  } catch { /* */ }
  try { if (w.ttq && typeof w.ttq.track === "function") w.ttq.track(std?.tt || event, props) } catch { /* */ }
  try { if (typeof w.gtag === "function") w.gtag("event", std?.ga || event, props) } catch { /* */ }
  if (process.env.NODE_ENV !== "production") { try { console.debug("[track]", event, props) } catch { /* */ } }
}
