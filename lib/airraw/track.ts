"use client"
/**
 * AIRRAW funnel events — platform-agnostic.
 *
 * Fires whatever pixel happens to be installed (Meta `fbq`, TikTok `ttq`,
 * Google `gtag`) and is a silent no-op when none are. Also pushes to a generic
 * dataLayer so a tag manager can pick events up. The three funnel events we care
 * about for the validation launch:
 *   airraw_land  — someone arrived on the landing
 *   airraw_talk  — they actually talked (the aha moment)
 *   airraw_lead  — they gave an email
 */
type Props = Record<string, string | number | boolean>

// Map our events to each platform's recognized standard event, so ad delivery
// can optimize toward them (custom events optimize worse).
const STD: Record<string, { fb?: string; tt?: string; ga?: string }> = {
  airraw_talk: { fb: "ViewContent", tt: "ClickButton", ga: "select_content" },
  airraw_lead: { fb: "Lead", tt: "SubmitForm", ga: "generate_lead" },
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
  try {
    if (w.ttq && typeof w.ttq.track === "function") w.ttq.track(std?.tt || event, props)
  } catch { /* */ }
  try {
    if (typeof w.gtag === "function") w.gtag("event", std?.ga || event, props)
  } catch { /* */ }
  if (process.env.NODE_ENV !== "production") { try { console.debug("[track]", event, props) } catch { /* */ } }
}
