/**
 * Platform variant — one codebase, multiple products.
 *
 *   abuseday.com (default) — the full galaxy. Premium models (Claude/Gemini/GPT),
 *     community-built planets, work + play. Accounts + Passes. The clean,
 *     mainstream front door.
 *   abuseday.fun — zero restrictions. No tracking, no registration, no memory,
 *     no premium models — serverless open weights only. The no-rules planets.
 *   abuseday.me  — its own standalone build (image-forward, playful). Behavior
 *     is still being defined; until then it mirrors the safe .com gating.
 *
 * Set per deployment:  NEXT_PUBLIC_KLOOM_VARIANT = io | fun | me   (default io)
 * The value is inlined at build time, so each deployment is statically one
 * variant. (The env var name keeps its legacy `KLOOM` key so existing
 * deployments don't need re-configuring.)
 */
export type Variant = "io" | "fun" | "me"

export const VARIANT: Variant = ((): Variant => {
  const v = process.env.NEXT_PUBLIC_KLOOM_VARIANT
  return v === "fun" || v === "me" ? v : "io"
})()

export const isFun = () => VARIANT === "fun"
export const isIo  = () => VARIANT === "io"
export const isMe  = () => VARIANT === "me"

/** Is the unrestricted (.fun) experience deployed & ready to link to from the
 *  main site? Off until abuseday.fun is live, so the "no-limits" tap stays
 *  hidden until then. */
export const funLive = () => process.env.NEXT_PUBLIC_FUN_LIVE === "1"

/** Adult / sexual / zero-restriction content only exists on .fun. */
export const adultEnabled = () => VARIANT === "fun"

/** .fun is anonymous: no account gate, no persisted memory. (.me TBD → safe .com default.) */
export const requiresAccountForPay = () => VARIANT !== "fun"
export const memoryEnabled = () => VARIANT !== "fun"

/** .fun runs serverless open weights only — premium model seats fall back. */
export const premiumModelsEnabled = () => VARIANT !== "fun"

export const SITE = {
  io:  { name: "Abuseday",     domain: "abuseday.com", tagline: "A galaxy of planets. Pick yours." },
  fun: { name: "Abuseday.fun", domain: "abuseday.fun", tagline: "No rules. No signup. No limits." },
  me:  { name: "Abuseday.me",  domain: "abuseday.me",  tagline: "Your universe. Your rules." },
}[VARIANT]

/**
 * Brand vocabulary — one source of truth for the metaphor so the whole app
 * speaks the same language. A "planet" is the unit a user steps onto (what the
 * code still calls a Room internally); the "galaxy" is the whole collection.
 */
export const LEXICON = {
  /** A single destination (internally a Room). */
  unit: "planet",
  unitPlural: "planets",
  Unit: "Planet",
  UnitPlural: "Planets",
  /** The whole collection of destinations. */
  collection: "galaxy",
  Collection: "Galaxy",
  /** Verb for entering one. */
  enter: "Land",
  /** Bring any character / person in (the old "Kloomer"). */
  summon: "Beam in",
}
