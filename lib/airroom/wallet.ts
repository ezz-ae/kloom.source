"use client"

// The wallet, browser side. Holds the purse token, mirrors the balance, and runs
// the two flows that touch money: claiming the daily and buying a pack.
//
// THE BALANCE HERE IS A MIRROR, NEVER A SOURCE. Every number in this file came
// from /api/chips and is only good for drawing. Nothing is ever spent, granted or
// decided locally — a client that can edit its own balance has no balance — so
// each function returns what the SERVER said and the UI redraws from that. This
// is the opposite posture to lib/airroom/credits.ts, which is a cosmetic local
// counter for a free visitor; chips are money and live on the server.
//
// The purse token is a bearer credential for a wallet with real value in it, so
// it is treated like the pass: stored under its own key, never logged, never put
// in a URL, and offered to the user to copy so they can carry it to another
// device — the same no-account recovery story the pass already has.

import { getProToken } from "@/lib/airroom/pro"

const PURSE_KEY   = "airraw_purse"
const PENDING_KEY = "airraw_chips_pending"

export interface PendingBuy { id: string; packId: string; t: number; s: string; chips: number; usd: number }

export function getPurse(): string | null {
  try { return localStorage.getItem(PURSE_KEY) } catch { return null }
}
function setPurse(t: string) { try { localStorage.setItem(PURSE_KEY, t) } catch { /* private mode */ } }

export function getPendingBuy(): PendingBuy | null {
  try { const raw = localStorage.getItem(PENDING_KEY); return raw ? JSON.parse(raw) as PendingBuy : null } catch { return null }
}
function setPendingBuy(p: PendingBuy) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)) } catch { /* */ } }
export function clearPendingBuy() { try { localStorage.removeItem(PENDING_KEY) } catch { /* */ } }

// ── the mirrored balance ─────────────────────────────────────────────────────
// One value, one set of subscribers, so a purchase in the sheet updates the bar
// in the corner without either knowing about the other.
let balance = 0
let loaded = false
const listeners = new Set<(n: number) => void>()

export function chipBalance(): number { return balance }
export function walletLoaded(): boolean { return loaded }

export function onChips(fn: (n: number) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function publish(n: number) {
  balance = Math.max(0, Math.round(n))
  loaded = true
  listeners.forEach((f) => { try { f(balance) } catch { /* a bad subscriber must not break the rest */ } })
}

/** Auth for every wallet call: the pass if there is one, plus this browser's purse. */
function ident() {
  return { pass: getProToken() || undefined, purse: getPurse() || undefined }
}

async function post<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const r = await fetch("/api/chips", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ident(), ...body }),
    })
    return await r.json() as T
  } catch { return null }
}

/**
 * Open the wallet: adopt the pass's wallet, or this browser's purse, or mint one.
 * Idempotent and cheap enough to call on every mount — the server only mints when
 * there is genuinely nothing to adopt.
 */
export async function openWallet(): Promise<number> {
  const d = await post<{ purse?: string; balance?: number }>({ action: "open" })
  if (!d) return balance
  if (d.purse) setPurse(d.purse)
  publish(Number(d.balance || 0))
  return balance
}

/**
 * Claim today's chips. `already` is the normal answer for a second visit in a
 * day and is not an error — the UI says "tomorrow", not "failed".
 */
export async function claimDaily(): Promise<{ ok: boolean; granted: number; already: boolean }> {
  const d = await post<{ ok?: boolean; granted?: number; already?: boolean; balance?: number }>({ action: "daily" })
  if (!d) return { ok: false, granted: 0, already: false }
  if (typeof d.balance === "number") publish(d.balance)
  return { ok: !!d.ok, granted: Number(d.granted || 0), already: !!d.already }
}

/**
 * Buy a pack. Stashes the intent (with the server's pack-bound signature) BEFORE
 * redirecting, because after the redirect this page is gone and that stash is the
 * only way back to which purchase was in flight.
 */
export async function buyPack(packId: string): Promise<{ ok: boolean; error?: string }> {
  const d = await post<{ url?: string; intentId?: string; packId?: string; chips?: number; price?: number; t?: number; s?: string; error?: string }>(
    { action: "buy", packId },
  )
  if (!d || d.error || !d.url || !d.intentId) return { ok: false, error: d?.error || "checkout didn't open" }
  setPendingBuy({ id: d.intentId, packId: d.packId || packId, t: Number(d.t || 0), s: String(d.s || ""), chips: Number(d.chips || 0), usd: Number(d.price || 0) })
  window.location.href = d.url
  return { ok: true }
}

/**
 * Claim a purchase after the redirect back. Safe to call on any page load: with
 * no pending buy it does nothing, and the grant itself is keyed on the intent id
 * server-side, so calling it twice credits once.
 */
export async function claimChips(): Promise<{ credited: boolean; granted: number; pendingStill: boolean }> {
  const p = getPendingBuy()
  if (!p?.id) return { credited: false, granted: 0, pendingStill: false }
  const d = await post<{ paid?: boolean; credited?: boolean; granted?: number; balance?: number; status?: string }>(
    { action: "claim", intentId: p.id, packId: p.packId, t: p.t, s: p.s },
  )
  if (!d) return { credited: false, granted: 0, pendingStill: true }
  if (typeof d.balance === "number") publish(d.balance)
  if (d.paid && d.credited) { clearPendingBuy(); return { credited: true, granted: Number(d.granted || 0), pendingStill: false } }
  // Terminal states are forgotten so a buyer isn't told forever about a sale that
  // will never complete. Anything else stays pending for the next page load.
  if (["failed", "canceled", "cancelled", "expired", "refunded", "bad_anchor", "amount_mismatch"].includes(String(d.status))) {
    clearPendingBuy()
    return { credited: false, granted: 0, pendingStill: false }
  }
  return { credited: false, granted: 0, pendingStill: true }
}
