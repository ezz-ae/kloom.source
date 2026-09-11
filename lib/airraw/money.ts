"use client"

// WHAT ELEVEN DOLLARS LOOKS LIKE TO SOMEONE WHO DOESN'T THINK IN DOLLARS.
//
// The golden room is aimed at Saudi Arabia, and "$11" is a number a Saudi buyer
// has to do arithmetic on before they can decide. Worse, the charge does not
// arrive in dollars either: the gateway is a UAE account and it bills in AED, so
// a card statement shows a third number that matches neither the price on the
// button nor the buyer's own currency. Three numbers and no explanation is how
// a sale becomes a chargeback, and on a merchant-of-record account chargebacks
// are not a support cost — they are the thing that closes the account.
//
// So: show the local number beside the dollar, never instead of it, and say
// which currency actually gets charged. That is the whole module.
//
// ONLY HARD PEGS. Every currency below is fixed to the dollar by its central
// bank and has been for decades, so a rate compiled into the app cannot quietly
// go stale the way a floating one would. A floating currency belongs on a rates
// feed or nowhere, and a wrong price shown confidently is worse than no price —
// so Kuwait (basket peg) and Egypt (floating) are deliberately absent even
// though they are obvious markets. They fall back to dollars, which is honest.

/** Units of the local currency per 1 USD. Central-bank pegs, not market quotes. */
const PEGGED: Record<string, { rate: number; label: string }> = {
  SAR: { rate: 3.75,   label: "SAR" },   // Saudi Arabia — pegged since 1986
  AED: { rate: 3.6725, label: "AED" },   // UAE — pegged since 1997
  QAR: { rate: 3.64,   label: "QAR" },   // Qatar
  BHD: { rate: 0.376,  label: "BHD" },   // Bahrain
  OMR: { rate: 0.3845, label: "OMR" },   // Oman
  JOD: { rate: 0.709,  label: "JOD" },   // Jordan
}

const BY_REGION: Record<string, string> = {
  SA: "SAR", AE: "AED", QA: "QAR", BH: "BHD", OM: "OMR", JO: "JOD",
}

/**
 * Timezone first, locale second.
 *
 * A Saudi phone very often reports `en-US` — the language someone reads in says
 * little about where their card was issued — while the timezone is set by the
 * network and is right far more often. Neither is proof, which is why this only
 * ever decides what an EXTRA line says, never what is charged.
 */
const BY_ZONE: Record<string, string> = {
  "asia/riyadh": "SA", "asia/dubai": "AE", "asia/qatar": "QA",
  "asia/bahrain": "BH", "asia/muscat": "OM", "asia/amman": "JO",
}

function region(): string | null {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (z && BY_ZONE[z.toLowerCase()]) return BY_ZONE[z.toLowerCase()]
  } catch { /* older engines */ }
  try {
    // "ar-SA" → SA. Also handles "ar-Arab-SA" via the region subtag rule.
    const parts = String(navigator.language || "").split("-")
    const last = parts[parts.length - 1]
    if (/^[A-Za-z]{2}$/.test(last)) return last.toUpperCase()
  } catch { /* SSR */ }
  return null
}

export interface LocalPrice {
  /** e.g. "SAR" */
  code: string
  /** Already rounded for display. */
  amount: number
  /** e.g. "SAR 41" — ready to put beside the dollar figure. */
  text: string
}

/**
 * The local equivalent of a USD price, or null when we have no honest answer.
 *
 * Rounds to whole units for the three-decimal Gulf currencies too: nobody needs
 * 41.250 on a button, and the precision would imply a quoted rate rather than a
 * conversion of convenience.
 */
export function localPrice(usd: number, forced?: string): LocalPrice | null {
  const code = forced || (region() ? BY_REGION[region() as string] : undefined)
  const peg = code ? PEGGED[code] : undefined
  if (!peg || !(usd > 0)) return null
  const raw = usd * peg.rate
  // Under ten units the whole-number rounding would distort the price, so keep
  // two decimals there (Bahrain and Oman: $11 is BHD 4.14, not BHD 4).
  const amount = raw >= 10 ? Math.round(raw) : Math.round(raw * 100) / 100
  return { code: peg.label, amount, text: `${peg.label} ${amount}` }
}

/**
 * Just the billing half: "charged in AED".
 *
 * For screens that already show a local figure on every row and only need the
 * statement currency said once at the bottom.
 */
export function chargeNote(charge?: string): string {
  const c = (charge || "").toUpperCase()
  return c && c !== "USD" ? `charged in ${c}` : "charged in USD"
}

/**
 * The sentence that goes under a buy button.
 *
 * Says both true things at once: roughly what it is in their money, and what
 * their statement will actually say. `charge` comes from the server (the
 * gateway's own configured currency) rather than being assumed here — the app
 * should not be the second place that fact is written down.
 */
export function priceFootnote(usd: number, charge?: string, forced?: string): string {
  // `forced` names the buyer's currency outright instead of reading their region
  // off the machine — used by the tests, which otherwise pass or fail depending
  // on the timezone of whoever runs them.
  const local = localPrice(usd, forced)
  const c = (charge || "").toUpperCase()
  const billed = chargeNote(charge)
  if (!local) return billed
  // Someone in the UAE paying an AED-denominated gateway sees one number, not
  // two descriptions of the same number.
  if (local.code === c) return `${local.text}`
  return `about ${local.text} · ${billed}`
}
