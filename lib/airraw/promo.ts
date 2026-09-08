// Promo codes.
//
// Server-side only in effect: the client may type a code and see a price, but
// the price that is CHARGED is computed here, on the server, from the code the
// checkout was opened with. A discount the browser can name is a discount the
// browser can invent.
//
// Codes live in one env var so they can be created, changed and killed without
// a deploy — the only sane arrangement for something you want to hand out in a
// story at midnight. Format is a comma-separated list of CODE:PERCENT, e.g.
//
//   AIRRAW_PROMOS="FIRST:25,GOLD10:10,RAMADAN:40"
//
// Percentages only, no fixed amounts. A percentage cannot accidentally make
// something free, and a floor below is the second guard against that.
//
// Dependency-free so the checkout, the UI copy and the tests share one copy.

/** Nothing is ever discounted below this share of list. */
export const PROMO_MAX_OFF = Math.min(90, Math.max(1, Number(process.env.PROMO_MAX_OFF || 60)))

export interface Deal {
  /** What to actually charge, rounded to the cent. */
  usd: number
  /** What it would have been. Only ever the real list price. */
  list: number
  saved: number
  applied: boolean
  code?: string
  percent?: number
}

function table(): Map<string, number> {
  const m = new Map<string, number>()
  for (const part of String(process.env.AIRRAW_PROMOS || "").split(",")) {
    const [rawCode, rawPct] = part.split(":")
    const code = (rawCode || "").trim().toUpperCase()
    const pct = Math.round(Number(rawPct))
    if (!code || !Number.isFinite(pct) || pct <= 0) continue
    m.set(code, Math.min(PROMO_MAX_OFF, pct))
  }
  return m
}

/** Is a code real? Used to tell someone their code is wrong BEFORE checkout. */
export function promoPercent(code?: string | null): number {
  if (!code) return 0
  return table().get(code.trim().toUpperCase()) || 0
}

/**
 * Price a purchase.
 *
 * An unknown code is not an error — it just does not apply, and the caller
 * charges list. Silently charging list while showing a discount would be the
 * unforgivable version, so `applied` is returned and the UI says which happened.
 */
export function applyPromo(listUsd: number, code?: string | null): Deal {
  const list = Math.round(Math.max(0, listUsd) * 100) / 100
  const pct = promoPercent(code)
  if (!pct) return { usd: list, list, saved: 0, applied: false }
  const usd = Math.max(1, Math.round(list * (1 - pct / 100) * 100) / 100)
  return {
    usd,
    list,
    saved: Math.round((list - usd) * 100) / 100,
    applied: usd < list,
    code: (code || "").trim().toUpperCase(),
    percent: pct,
  }
}

/** How a deal reads on a receipt line. */
export function promoLabel(d: Deal): string {
  return d.applied && d.code ? `${d.code} −${d.percent}%` : ""
}
