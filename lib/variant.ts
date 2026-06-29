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
 *
 * Set per deployment:  NEXT_PUBLIC_KLOOM_VARIANT = io | fun | me   (default io)
 * The value is inlined at build time, so each deployment is statically one
 * variant.
 */
export type Variant = "io" | "fun" | "me"

export const VARIANT: Variant = ((): Variant => {
  const v = process.env.NEXT_PUBLIC_KLOOM_VARIANT
  return v === "fun" || v === "me" ? v : "io"
})()

export const isFun = () => VARIANT === "fun"
export const isIo  = () => VARIANT === "io"
export const isMe  = () => VARIANT === "me"

/** Is the unrestricted (.fun) experience deployed & ready to link to from .io?
 *  Off until kloom.fun is live, so the "no-limits" tap stays hidden until then. */
export const funLive = () => process.env.NEXT_PUBLIC_FUN_LIVE === "1"

/** Adult / sexual / zero-restriction content.
 *  True on .fun, OR on any deployment that explicitly sets NEXT_PUBLIC_ADULT_ENABLED=1
 *  (e.g. airraw.com — a dedicated adult platform that still needs premium models,
 *  so it can't use VARIANT=fun which disables premiumModelsEnabled). */
export const adultEnabled = () => VARIANT === "fun" || process.env.NEXT_PUBLIC_ADULT_ENABLED === "1"

/** .fun is anonymous: no account gate, no persisted memory. (.me TBD → safe io default.) */
export const requiresAccountForPay = () => VARIANT !== "fun"
export const memoryEnabled = () => VARIANT !== "fun"

/** .fun runs serverless open weights only — premium model seats fall back. */
export const premiumModelsEnabled = () => VARIANT !== "fun"

export const SITE = {
  io:  { name: "Kloom",     domain: "kloom.io",  tagline: "Every conversation is a room." },
  fun: { name: "Kloom.fun", domain: "kloom.fun", tagline: "No rules. No signup. Just fun." },
  me:  { name: "Kloom.me",  domain: "kloom.me",  tagline: "Make it yours." },
}[VARIANT]
