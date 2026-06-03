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
const url        = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co"
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key"

export function getAdminClient() {
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — crediting is disabled. " +
      "Add it from the Supabase dashboard (Settings → API → service_role)."
    )
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

export function hasAdmin(): boolean {
  return !!serviceKey
}
