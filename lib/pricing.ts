/**
 * Kloom pricing — FlexiCalls + passes.
 *
 * FLEXICALLS — the slider. $1 buys 12 minutes; every next dollar buys MORE
 * minutes than the last (bonus ramps 7% → 20% per dollar), so topping up
 * bigger always feels smarter. At $7.93 the slider's value crosses the Dayuse
 * pass price — that's the moment we suggest going unlimited instead.
 *
 * PASSES — time-boxed full access (unlimited voice + unrestricted + invites):
 *   Dayuse    24h   1 invitation          $7.93
 *   Holyweek  7d    3 invitations         $13.32
 *   Super30   30d   unlimited invitations $21
 */

export const FLEXI_MIN_USD  = 1
export const FLEXI_MAX_USD  = 15
export const FLEXI_BASE_MIN = 12      // minutes the first dollar buys

// Bonus per marginal dollar: 0% on the 1st, 7% on the 2nd, ramping +2.17%/[$]
// until it caps at 20% from the 8th dollar on.
function dollarBonus(n: number): number {
  if (n <= 1) return 0
  return Math.min(0.20, 0.07 + (n - 2) * 0.0217)
}

/** Total FlexiCalls minutes for a USD amount (fractional dollars prorated). */
export function flexiMinutes(usd: number): number {
  const clamped = Math.max(0, usd)
  let minutes = 0
  for (let n = 1; n <= Math.floor(clamped); n++) {
    minutes += FLEXI_BASE_MIN * (1 + dollarBonus(n))
  }
  const frac = clamped - Math.floor(clamped)
  if (frac > 0) {
    minutes += frac * FLEXI_BASE_MIN * (1 + dollarBonus(Math.floor(clamped) + 1))
  }
  return Math.round(minutes)
}

/** Effective rate label, e.g. "13.4 min / $" at the current slider point. */
export function flexiRate(usd: number): number {
  if (usd <= 0) return FLEXI_BASE_MIN
  return Math.round((flexiMinutes(usd) / usd) * 10) / 10
}

// ── Passes ──────────────────────────────────────────────────────────────────

export interface Pass {
  id: "dayuse" | "holyweek" | "super30"
  name: string
  tagline: string
  priceUsd: number
  durationHours: number
  invitations: number | "unlimited"
  monthly?: boolean
}

export const PASSES: Pass[] = [
  {
    id: "dayuse", name: "Dayuse", tagline: "24 hours of everything",
    priceUsd: 7.93, durationHours: 24, invitations: 1,
  },
  {
    id: "holyweek", name: "Holyweek", tagline: "Seven days, fully open",
    priceUsd: 13.32, durationHours: 24 * 7, invitations: 3,
  },
  {
    id: "super30", name: "Super30", tagline: "A month of everything, everyone invited",
    priceUsd: 21, durationHours: 24 * 30, invitations: "unlimited", monthly: true,
  },
]

/** The slider value at which we suggest Dayuse instead. */
export const DAYPASS_SUGGEST_USD = PASSES[0].priceUsd  // 7.93

// ── Active pass state (device-local, validated by expiry) ──────────────────

const PASS_KEY = "kloom_pass"

export interface ActivePass { id: Pass["id"]; expiresAt: number }

export function activePass(): ActivePass | null {
  try {
    const raw = localStorage.getItem(PASS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as ActivePass
    if (!p?.expiresAt || Date.now() > p.expiresAt) {
      localStorage.removeItem(PASS_KEY)
      return null
    }
    return p
  } catch { return null }
}

export function activatePass(id: Pass["id"]) {
  const def = PASSES.find((p) => p.id === id)
  if (!def) return
  const pass: ActivePass = { id, expiresAt: Date.now() + def.durationHours * 3600_000 }
  try { localStorage.setItem(PASS_KEY, JSON.stringify(pass)) } catch {}
}

export function hasActivePass(): boolean {
  return activePass() !== null
}

/** How many humans the current pass lets you invite (0 = none, Infinity = unlimited). */
export function passInviteAllowance(): number {
  const p = activePass()
  if (!p) return 0
  const def = PASSES.find((x) => x.id === p.id)
  if (!def) return 0
  return def.invitations === "unlimited" ? Infinity : def.invitations
}

/** Time left on the active pass, humanized — for badges ("19h left", "6d left"). */
export function passTimeLeft(): string | null {
  const p = activePass()
  if (!p) return null
  const ms = p.expiresAt - Date.now()
  if (ms <= 0) return null
  const hours = Math.ceil(ms / 3600_000)
  return hours <= 48 ? `${hours}h left` : `${Math.ceil(hours / 24)}d left`
}
