// POST /api/paypal/webhook — PayPal event receiver (defense in depth).
//
// Captures are credited synchronously in /api/paypal/capture-order; this
// webhook is the safety net: it confirms completed captures out-of-band and
// surfaces refunds/disputes in logs. Every event's signature is verified with
// PayPal's verify-webhook-signature API before being trusted.

export const runtime = "nodejs"
export const maxDuration = 30

const API_BASE   = process.env.PAYPAL_API_BASE || "https://api-m.paypal.com"
const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || ""

async function paypalToken(): Promise<string | null> {
  const id  = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
  const sec = process.env.PAYPAL_CLIENT_SECRET
  if (!id || !sec) return null
  const res = await fetch(`${API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${sec}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })
  if (!res.ok) return null
  const data = (await res.json()) as { access_token?: string }
  return data.access_token ?? null
}

export async function POST(request: Request) {
  const bodyText = await request.text()
  let event: any
  try { event = JSON.parse(bodyText) } catch { return new Response("bad json", { status: 400 }) }

  // ── Verify the signature with PayPal before trusting anything ──
  if (WEBHOOK_ID) {
    const token = await paypalToken()
    if (!token) return new Response("auth unavailable", { status: 503 })
    const verifyRes = await fetch(`${API_BASE}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo:         request.headers.get("paypal-auth-algo"),
        cert_url:          request.headers.get("paypal-cert-url"),
        transmission_id:   request.headers.get("paypal-transmission-id"),
        transmission_sig:  request.headers.get("paypal-transmission-sig"),
        transmission_time: request.headers.get("paypal-transmission-time"),
        webhook_id:        WEBHOOK_ID,
        webhook_event:     event,
      }),
    })
    const verify = (await verifyRes.json().catch(() => ({}))) as { verification_status?: string }
    if (verify.verification_status !== "SUCCESS") {
      console.warn("[paypal-webhook] signature verification FAILED", event?.id)
      return new Response("invalid signature", { status: 400 })
    }
  }

  // ── Log the events that matter; crediting already happened at capture ──
  const type = event?.event_type as string
  const resource = event?.resource ?? {}
  switch (type) {
    case "PAYMENT.CAPTURE.COMPLETED":
      console.log("[paypal-webhook] capture completed", resource?.id, resource?.amount?.value, resource?.amount?.currency_code)
      break
    case "PAYMENT.CAPTURE.DENIED":
      console.warn("[paypal-webhook] capture DENIED", resource?.id)
      break
    case "PAYMENT.CAPTURE.REFUNDED":
      console.warn("[paypal-webhook] capture REFUNDED", resource?.id, resource?.amount?.value)
      break
    case "CUSTOMER.DISPUTE.CREATED":
      console.warn("[paypal-webhook] DISPUTE created", resource?.dispute_id ?? resource?.id)
      break
    default:
      console.log("[paypal-webhook] event", type)
  }

  return Response.json({ ok: true })
}
