/**
 * Platform variant — one codebase, multiple products.
 *
 *   kloom.io  (default) — premium models (Claude/Gemini/GPT), community rooms,
 *     work + collaboration. NO sexual content. Accounts + passes.
 *   kloom.fun — gaming, sexuality, zero restrictions. No tracking, no
 *     registration, no memory, no premium models — serverless open weights only.
 *     Happy hours.
 *   kloom.me  — its own standalone build (image-forward, playful). Behavior is
 *     still being defined; until then it mirrors the safe .io gating.
 *   abuseday  — a SEPARATE brand built from the same codebase. "A galaxy of
 *     planets": its own name, domain, cosmic look and "planet" vocabulary. It
 *     behaves like .io (clean, premium, accounts + Passes) but every
 *     Abuseday-specific surface is gated behind this variant, so the Kloom
 *     variants above are completely unaffected by it.
 *
 * Set per deployment:  NEXT_PUBLIC_KLOOM_VARIANT = io | fun | me | abuseday
 * (default io). The value is inlined at build time, so each deployment is
 * statically one variant.
 */
export type Variant = "io" | "fun" | "me" | "abuseday"

export const VARIANT: Variant = ((): Variant => {
  const v = process.env.NEXT_PUBLIC_KLOOM_VARIANT
  return v === "fun" || v === "me" || v === "abuseday" ? v : "io"
})()

export const isFun = () => VARIANT === "fun"
export const isIo  = () => VARIANT === "io"
export const isMe  = () => VARIANT === "me"
/** The standalone Abuseday brand (planets). Gates ALL Abuseday-only surfaces. */
export const isAbuseday = () => VARIANT === "abuseday"

/** Is the unrestricted (.fun) experience deployed & ready to link to from .io?
 *  Off until kloom.fun is live, so the "no-limits" tap stays hidden until then. */
export const funLive = () => process.env.NEXT_PUBLIC_FUN_LIVE === "1"

/** Adult / sexual / zero-restriction content only exists on .fun. */
export const adultEnabled = () => VARIANT === "fun"

/** .fun is anonymous: no account gate, no persisted memory. (.me TBD → safe io default.) */
export const requiresAccountForPay = () => VARIANT !== "fun"
export const memoryEnabled = () => VARIANT !== "fun"

/** .fun runs serverless open weights only — premium model seats fall back. */
export const premiumModelsEnabled = () => VARIANT !== "fun"

export const SITE = {
  io:       { name: "Kloom",     domain: "kloom.io",     tagline: "Every conversation is a room." },
  fun:      { name: "Kloom.fun", domain: "kloom.fun",    tagline: "No rules. No signup. Just fun." },
  me:       { name: "Kloom.me",  domain: "kloom.me",     tagline: "Make it yours." },
  abuseday: { name: "Abuseday",  domain: "abuseday.com", tagline: "A galaxy of planets. Pick yours." },
}[VARIANT]

/**
 * Brand vocabulary — variant-aware so the SAME shared components read correctly
 * on every brand. Kloom speaks "rooms / worlds"; Abuseday speaks
 * "planets / galaxy". One source of truth so no copy is hardcoded to a brand.
 */
export const LEX = isAbuseday()
  ? {
      unit: "planet", unitPlural: "planets", Unit: "Planet", UnitPlural: "Planets",
      collection: "galaxy", Collection: "Galaxy",
      enter: "Land", Enter: "Land", summon: "Beam in",
    }
  : {
      unit: "room", unitPlural: "rooms", Unit: "Room", UnitPlural: "Rooms",
      collection: "world", Collection: "World",
      enter: "Enter", Enter: "Enter", summon: "Kloomer",
    }
