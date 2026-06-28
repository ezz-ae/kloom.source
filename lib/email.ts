// Transactional email — receipts + welcome, sent via Resend's HTTP API.
//
// Env-gated: with RESEND_API_KEY unset every send is a no-op (logged), so the
// app runs fine without it. Add the key (free tier at resend.com) and verify
// the kloom.io sending domain to turn real emails on — no code change.
//
//   RESEND_API_KEY=re_xxx
//   EMAIL_FROM="Kloom <noreply@kloom.io>"   (must be a Resend-verified domain)

import { SITE, isAbuseday } from "@/lib/variant"

const BRAND       = SITE.name
const DOMAIN_TXT  = isAbuseday() ? "abuseday.com" : "www.kloom.io"
const RESEND_KEY  = process.env.RESEND_API_KEY || ""
const EMAIL_FROM  = process.env.EMAIL_FROM || (isAbuseday() ? "Abuseday <noreply@abuseday.com>" : "Kloom <noreply@kloom.io>")
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || (isAbuseday() ? "https://abuseday.com" : "https://www.kloom.io")

export function emailEnabled(): boolean {
  return !!RESEND_KEY
}

async function send(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_KEY) {
    console.log(`[email] (disabled — no RESEND_API_KEY) would send "${subject}" to ${to}`)
    return false
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    })
    if (!res.ok) {
      console.warn(`[email] send failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
      return false
    }
    return true
  } catch (err) {
    console.warn(`[email] send error: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

// ── Branded shell ────────────────────────────────────────────────────────────
function shell(heading: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0c0a10;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#f5f3f0;">
  <div style="max-width:480px;margin:0 auto;padding:40px 28px;">
    <div style="font-size:13px;letter-spacing:6px;text-transform:uppercase;color:#f59e0b;font-weight:700;margin-bottom:28px;">${BRAND}</div>
    <h1 style="font-size:26px;font-weight:800;margin:0 0 16px;line-height:1.2;">${heading}</h1>
    <div style="font-size:15px;line-height:1.65;color:rgba(245,243,240,0.8);">${body}</div>
    <div style="margin-top:36px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:rgba(245,243,240,0.4);">
      ${BRAND} · <a href="${APP_URL}" style="color:#f59e0b;text-decoration:none;">${DOMAIN_TXT}</a><br/>
      Questions? Just reply to this email.
    </div>
  </div></body></html>`
}

// ── Payment receipt ──────────────────────────────────────────────────────────
export async function sendReceipt(opts: {
  to: string
  itemName: string       // "Dayuse pass" / "120 FlexiCalls minutes"
  amountUsd: number
  detail?: string        // "24 hours of unlimited voice · 1 invitation"
}): Promise<boolean> {
  const body = `
    <p>Thanks for your purchase — you're all set.</p>
    <div style="margin:24px 0;padding:18px 20px;border:1px solid rgba(245,158,11,0.25);border-radius:16px;background:rgba(245,158,11,0.06);">
      <div style="font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#f59e0b;font-weight:700;">${opts.itemName}</div>
      ${opts.detail ? `<div style="font-size:13px;color:rgba(245,243,240,0.6);margin-top:4px;">${opts.detail}</div>` : ""}
      <div style="font-size:30px;font-weight:800;margin-top:8px;">$${opts.amountUsd.toFixed(2)}</div>
    </div>
    <a href="${APP_URL}/app" style="display:inline-block;background:linear-gradient(90deg,#fbbf24,#f97316);color:#0c0a10;font-weight:800;text-decoration:none;padding:13px 24px;border-radius:14px;">Enter ${BRAND} →</a>
    <p style="font-size:12px;color:rgba(245,243,240,0.45);margin-top:20px;">Need a refund? See our <a href="${APP_URL}/legal/payments" style="color:#f59e0b;">payments policy</a> — unused credits are refundable within 14 days.</p>`
  return send(opts.to, `Your ${BRAND} receipt — ${opts.itemName}`, shell("Payment confirmed", body))
}

// ── Welcome on account creation ──────────────────────────────────────────────
export async function sendWelcome(to: string): Promise<boolean> {
  const body = `
    <p>Your ${BRAND} account is ready. Your passes and credits now follow you on any device — just sign in.</p>
    <p>${isAbuseday()
      ? "Every world on Abuseday is a planet: build a cast of AI characters with real voices, go solo or beam friends onto the same planet with one link, and travel a galaxy of unique planets."
      : "Every conversation on Kloom is a room: build a cast of AI characters with real voices, drop friends in with one link, and talk across 11 worlds."}</p>
    <a href="${APP_URL}/app" style="display:inline-block;background:linear-gradient(90deg,#fbbf24,#f97316);color:#0c0a10;font-weight:800;text-decoration:none;padding:13px 24px;border-radius:14px;margin-top:8px;">${isAbuseday() ? "Enter Abuseday" : "Open Kloom"} →</a>`
  return send(to, `Welcome to ${BRAND}`, shell("You're in.", body))
}
