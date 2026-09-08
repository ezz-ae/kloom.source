"use client"

// Golden sessions, browser side. Holds nothing authoritative: how many you have
// is whatever /api/golden last said, and spending one is a server call whose
// answer is the truth. The only thing kept locally is which session is OPEN and
// who is in it — because that is a fact about this tab, not about the wallet.

import { getProToken } from "@/lib/airroom/pro"
import { getPurse } from "@/lib/airroom/wallet"
import type { GoldenSession, GoldenGuest } from "@/lib/airraw/golden"

const OPEN_KEY = "airraw_golden_open"
const PENDING_KEY = "airraw_golden_pending"

export interface PendingGold { id: string; qty: number; t: number; s: string; usd: number }

let held = 0
let loaded = false
const listeners = new Set<(n: number) => void>()
export const goldHeld = () => held
export const goldLoaded = () => loaded
export function onGold(fn: (n: number) => void) { listeners.add(fn); return () => { listeners.delete(fn) } }
function publish(n: number) {
  held = Math.max(0, Math.round(n)); loaded = true
  listeners.forEach((f) => { try { f(held) } catch { /* one bad subscriber must not break the rest */ } })
}

const ident = () => ({ pass: getProToken() || undefined, purse: getPurse() || undefined })
async function post<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const r = await fetch("/api/golden", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ident(), ...body }),
    })
    return await r.json() as T
  } catch { return null }
}

export async function refreshGold(): Promise<number> {
  const d = await post<{ held?: number }>({ action: "held" })
  if (d && typeof d.held === "number") publish(d.held)
  return held
}

/** Buy `qty` sessions. Stashes the intent before redirecting — after that this page is gone. */
export async function buyGold(qty: number, promo?: string): Promise<{ ok: boolean; error?: string }> {
  const d = await post<{ url?: string; intentId?: string; qty?: number; price?: number; t?: number; s?: string; error?: string }>(
    { action: "buy", qty, promo },
  )
  if (!d || d.error || !d.url || !d.intentId) return { ok: false, error: d?.error || "checkout didn't open" }
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ id: d.intentId, qty: d.qty || qty, t: Number(d.t || 0), s: String(d.s || ""), usd: Number(d.price || 0) }))
  } catch { /* private mode */ }
  window.location.href = d.url
  return { ok: true }
}

export function getPendingGold(): PendingGold | null {
  try { const raw = localStorage.getItem(PENDING_KEY); return raw ? JSON.parse(raw) as PendingGold : null } catch { return null }
}
export function clearPendingGold() { try { localStorage.removeItem(PENDING_KEY) } catch { /* */ } }

export async function claimGold(): Promise<{ credited: boolean; granted: number; pendingStill: boolean }> {
  const p = getPendingGold()
  if (!p?.id) return { credited: false, granted: 0, pendingStill: false }
  const d = await post<{ paid?: boolean; credited?: boolean; granted?: number; held?: number; status?: string }>(
    { action: "claim", intentId: p.id, qty: p.qty, t: p.t, s: p.s },
  )
  if (!d) return { credited: false, granted: 0, pendingStill: true }
  if (typeof d.held === "number") publish(d.held)
  if (d.paid && d.credited) { clearPendingGold(); return { credited: true, granted: Number(d.granted || 0), pendingStill: false } }
  if (["failed", "canceled", "cancelled", "expired", "refunded", "bad_anchor", "amount_mismatch"].includes(String(d.status))) {
    clearPendingGold(); return { credited: false, granted: 0, pendingStill: false }
  }
  return { credited: false, granted: 0, pendingStill: true }
}

/**
 * Spend one and open a room with THIS person.
 *
 * The guest is passed in from the conversation you are already having and is
 * written down as-is. Nothing here re-derives a character, which is the whole
 * contract: you brought Sami, so Sami is who is in the room.
 */
export async function openGolden(guest: GoldenGuest): Promise<{ ok: boolean; session?: GoldenSession; reason?: string }> {
  if (!guest?.key) return { ok: false, reason: "no-guest" }
  const d = await post<{ ok?: boolean; id?: string; held?: number; reason?: string }>({ action: "open" })
  if (!d) return { ok: false, reason: "offline" }
  if (typeof d.held === "number") publish(d.held)
  if (!d.ok || !d.id) return { ok: false, reason: d.reason || "none-held" }
  const session: GoldenSession = {
    id: d.id,
    guest: { key: guest.key, host: guest.host, gender: guest.gender },
    startedAt: Date.now(),
    boughtWith: "",
  }
  try { localStorage.setItem(OPEN_KEY, JSON.stringify(session)) } catch { /* */ }
  return { ok: true, session }
}

/** The session this tab has open, if any. */
export function openSession(): GoldenSession | null {
  try { const raw = localStorage.getItem(OPEN_KEY); return raw ? JSON.parse(raw) as GoldenSession : null } catch { return null }
}
export function closeSession() { try { localStorage.removeItem(OPEN_KEY) } catch { /* */ } }
