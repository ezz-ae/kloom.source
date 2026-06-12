/**
 * Platform variant — one codebase, two products.
 *
 *   kloom.io  (default) — premium models (Claude/Gemini/GPT), community rooms,
 *     work + collaboration. NO sexual content. Accounts + passes.
 *   kloom.fun — gaming, sexuality, zero restrictions. No tracking, no
 *     registration, no memory, no premium models — serverless open weights only.
 *     Happy hours.
 *
 * Set per deployment:  NEXT_PUBLIC_KLOOM_VARIANT = io | fun   (default io)
 * The value is inlined at build time, so each deployment is statically one or
 * the other.
 */
export type Variant = "io" | "fun"

export const VARIANT: Variant =
  (process.env.NEXT_PUBLIC_KLOOM_VARIANT as Variant) === "fun" ? "fun" : "io"

export const isFun = () => VARIANT === "fun"
export const isIo  = () => VARIANT === "io"

/** Adult / sexual / zero-restriction content only exists on .fun. */
export const adultEnabled = () => VARIANT === "fun"

/** .fun is anonymous: no account gate, no persisted memory. */
export const requiresAccountForPay = () => VARIANT === "io"
export const memoryEnabled = () => VARIANT === "io"

/** .fun runs serverless open weights only — premium model seats fall back. */
export const premiumModelsEnabled = () => VARIANT === "io"

export const SITE = {
  io:  { name: "Kloom", domain: "kloom.io",  tagline: "Every conversation is a room." },
  fun: { name: "Kloom.fun", domain: "kloom.fun", tagline: "No rules. No signup. Just fun." },
}[VARIANT]
