// The product's name, in one place.
//
// It has been AIRRAW and is now FAITALK. It moved once, so it can move again —
// hence a constant rather than a string typed into forty files.
//
// WHAT DELIBERATELY DID NOT RENAME:
//   • localStorage keys  (airraw_pro_token, airraw_air, airraw_talks, …)
//   • env var names      (AIRRAW_HOME, AIRRAW_PRO_SECRET, AIRRAW_DAILY_CALL_CAP, …)
//   • module paths       (lib/airraw/*)
//
// Those are identifiers, not branding. Renaming the storage keys would log out
// every existing visitor and void the Pro passes people have already paid for,
// because the signed token lives under the old key. Renaming the env vars would
// take production down until all twenty-five were re-added in Vercel. Neither is
// worth doing for a name change nobody can see. A rename that costs paying
// customers their purchase is not a rename, it's an outage.
export const BRAND = "FAITALK"
export const BRAND_DOMAIN = "faitalk.com"

/** Canonical origin. Env-driven so the domain can move without a code change —
 *  and so previews and the old domain keep generating correct URLs. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || `https://${BRAND_DOMAIN}`

/** The currency. Kept — it survives the rename intact, and FAITALK already
 *  carries the AI inside the name. */
export const CURRENCY = "AiR"
