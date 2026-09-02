import { createClient } from "@supabase/supabase-js"

/**
 * SERVER-ONLY Supabase client using the service_role key.
 *
 * credit_wallet() (which mints/deducts credits) must ONLY ever be reachable
 * through this — never the public anon key, or anyone could grant themselves
 * unlimited credits from the browser console.
 *
 * Set SUPABASE_SERVICE_ROLE_KEY in your environment (Supabase dashboard →
 * Settings → API → service_role secret). Never expose it to the client.
 */
// The placeholders keep createClient() from throwing at import time on a deploy
// with no Supabase — but they must NEVER be mistaken for configuration, which is
// exactly what hasAdmin() used to do (see below).
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const url        = rawUrl || "https://placeholder-url.supabase.co"
const serviceKey = rawKey || "placeholder-service-key"

export function getAdminClient() {
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — crediting is disabled. " +
      "Add it from the Supabase dashboard (Settings → API → service_role)."
    )
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

/**
 * Is Supabase actually usable?
 *
 * Every caller uses this to decide whether to attempt a write or return a clean
 * "unavailable" — so it has to be able to say NO. It read `!!serviceKey`, which
 * is the placeholder-defaulted constant above and therefore ALWAYS truthy: the
 * function could not return false, and every guard built on it was decorative.
 *
 * What that cost: instead of a 503 saying storage is unconfigured, callers went
 * ahead and failed further downstream — and a payment callback "recorded" a row
 * into nothing and returned success, leaving a real buyer unable to ever claim
 * what they paid for. Read the environment, not the fallback.
 */
export function hasAdmin(): boolean {
  return !!rawKey && !!rawUrl
}
