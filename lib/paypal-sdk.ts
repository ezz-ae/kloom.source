/**
 * Shared, client-side PayPal JS SDK loader (singleton) — so multiple components
 * on the same page (card form + status badge) reuse ONE <script>, never two.
 */
const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ""

let sdkPromise: Promise<any> | null = null

export function paypalClientId(): string { return CLIENT_ID }

export function loadPayPalSdk(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"))
  if (!CLIENT_ID) return Promise.reject(new Error("no client id"))
  if ((window as any).paypal) return Promise.resolve((window as any).paypal)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script")
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(CLIENT_ID)}&components=buttons,card-fields&currency=USD&intent=capture`
    s.onload  = () => resolve((window as any).paypal)
    s.onerror = () => reject(new Error("failed to load PayPal SDK"))
    document.body.appendChild(s)
  })
  return sdkPromise
}

// ── PayPal Web SDK v6 (full power: PayPal, Pay Later, Venmo, card guest, etc.) ──

let v6Promise: Promise<any> | null = null

/** Load the v6 core SDK for the given env and return window.paypal (v6 namespace). */
export function loadPayPalV6(env: "live" | "sandbox" = "live"): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"))
  if ((window as any).paypal?.createInstance) return Promise.resolve((window as any).paypal)
  if (v6Promise) return v6Promise
  const host = env === "sandbox" ? "https://www.sandbox.paypal.com" : "https://www.paypal.com"
  v6Promise = new Promise((resolve, reject) => {
    const s = document.createElement("script")
    s.src = `${host}/web-sdk/v6/core`
    s.onload  = () => resolve((window as any).paypal)
    s.onerror = () => reject(new Error("failed to load PayPal v6 SDK"))
    document.body.appendChild(s)
  })
  return v6Promise
}

/** Create a v6 SDK instance with the given components (client-id auth). */
export async function createPayPalV6Instance(
  env: "live" | "sandbox",
  components: string[],
): Promise<any> {
  const paypal = await loadPayPalV6(env)
  if (!CLIENT_ID) throw new Error("no client id")
  return paypal.createInstance({ clientId: CLIENT_ID, pageType: "checkout", components })
}

/** Is this account eligible for inline Advanced Card Fields (ACDC)? */
export async function checkInlineEligible(): Promise<boolean> {
  const paypal = await loadPayPalSdk()
  if (!paypal?.CardFields) return false
  try {
    const cf = paypal.CardFields({ createOrder: async () => "", onApprove: async () => {} })
    return !!cf.isEligible()
  } catch { return false }
}
