/**
 * PayPal helper (server-only) — Orders v2 with Advanced Card Fields (ACDC).
 *
 * We use the merchant's OWN PayPal business account to take cards directly inside
 * our UI (no buyer PayPal login). The buyer's wallet + what they bought is packed
 * into the order's `custom_id`, so the capture is self-describing — the webhook /
 * capture handler reads it back and credits the right wallet. Capture is
 * authenticated with our credentials and server-side, so it is authoritative.
 *
 * Amounts are plain USD (PayPal supports USD natively — no FX needed).
 */

const ENV    = (process.env.PAYPAL_ENV || "live").toLowerCase()
const BASE   = ENV === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com"
const CLIENT = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ""
const SECRET = process.env.PAYPAL_CLIENT_SECRET || ""

export function paypalConfigured(): boolean {
  return !!CLIENT && !!SECRET
}
export function paypalBase(): string { return BASE }
export function paypalEnv(): string { return ENV }

/** Validate the credentials by requesting an OAuth token. Proves the keys work. */
export async function verifyCredentials(): Promise<{ ok: boolean; env: string; error?: string }> {
  if (!paypalConfigured()) return { ok: false, env: ENV, error: "missing_client_or_secret" }
  try {
    await getAccessToken()
    return { ok: true, env: ENV }
  } catch (e) {
    return { ok: false, env: ENV, error: (e as Error).message }
  }
}

// ── custom_id packing: "wallet|credits|kind" (<127 chars; base58 wallet is safe) ──
export function packCustom(wallet: string, credits: number, kind: string): string {
  return `${wallet}|${Math.max(0, Math.round(credits || 0))}|${kind || "purchase"}`.slice(0, 127)
}
export function unpackCustom(custom?: string): { wallet: string; credits: number; kind: string } | null {
  if (!custom) return null
  const [wallet, credits, kind] = custom.split("|")
  if (!wallet) return null
  return { wallet, credits: parseInt(credits || "0", 10) || 0, kind: kind || "purchase" }
}

// ── OAuth token (cached until ~60s before expiry) ──
let cachedToken = ""
let tokenExpiry = 0
async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && now < tokenExpiry) return cachedToken
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method:  "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${CLIENT}:${SECRET}`).toString("base64")}`,
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(`paypal token ${res.status}: ${JSON.stringify(data).slice(0, 160)}`)
  }
  cachedToken = data.access_token
  tokenExpiry = now + Math.max(0, (data.expires_in ?? 3000) - 60) * 1000
  return cachedToken
}

async function ppFetch(path: string, init: RequestInit): Promise<any> {
  const token = await getAccessToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  })
  const text = await res.text()
  let json: any = {}
  try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text } }
  if (!res.ok) throw new Error(`paypal ${res.status}: ${(json?.message || text || "").toString().slice(0, 200)}`)
  return json
}

export interface CreateOrderArgs {
  usd: number
  wallet: string
  credits?: number
  kind?: string
  label?: string
}

/** Create a CAPTURE order. Returns the PayPal order id for the client SDK. */
export async function createOrder(args: CreateOrderArgs): Promise<{ id: string; status: string }> {
  const value = Number(args.usd).toFixed(2)
  const order = await ppFetch("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        amount:      { currency_code: "USD", value },
        custom_id:   packCustom(args.wallet, args.credits ?? 0, args.kind ?? "purchase"),
        description: (args.label || "Ora").slice(0, 127),
      }],
      application_context: {
        brand_name:          "Ora",
        shipping_preference: "NO_SHIPPING",
        user_action:         "PAY_NOW",
      },
    }),
  })
  return { id: order.id, status: order.status }
}

export interface CaptureResult {
  ok: boolean
  status: string
  orderId: string
  captureId?: string
  custom?: { wallet: string; credits: number; kind: string } | null
  amount?: string
}

/** Capture a previously-approved order. Authoritative (server-side, our creds). */
export async function captureOrder(orderId: string): Promise<CaptureResult> {
  const data = await ppFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST" })
  const pu      = data?.purchase_units?.[0]
  const capture = pu?.payments?.captures?.[0]
  const custom  = unpackCustom(capture?.custom_id || pu?.custom_id)
  return {
    ok:        data?.status === "COMPLETED",
    status:    data?.status,
    orderId:   data?.id || orderId,
    captureId: capture?.id,
    custom,
    amount:    capture?.amount?.value,
  }
}
