/**
 * On-device wellness signal — the consented, private half of the safety stack.
 *
 * Design rules (these are what keep it legal AND ethical — mental-health state
 * is "special category" data under GDPR Art. 9 and similar regimes):
 *   1. ON-DEVICE ONLY. Everything lives in localStorage. It is NEVER sent to a
 *      server, never joined to ad/identity data, never monetized. The chat route
 *      emits a transient X-Wellness header per reply; we read it client-side and
 *      forget it. No wellness data crosses the network.
 *   2. CONSENTED + TRANSPARENT. On by default but disclosed on first use and
 *      switch-off-able any time. Subtle ≠ secret.
 *   3. ERASABLE. clearWellnessData() wipes everything instantly (right to erase).
 *   4. PRO-USER ONLY. Used to offer support (Breathe, a resource, a softer tone)
 *      — never to gate, restrict, or judge what the user may say.
 */

export type WellnessSignal = "calm" | "distress" | "crisis"

interface WellnessEvent {
  signal: Exclude<WellnessSignal, "calm">
  ts:     number
}

export interface WellnessState {
  /** Worst recent read over the trailing window. */
  level:        WellnessSignal
  distress7d:   number
  crisis7d:     number
  lastEventTs:  number | null
  /** Coarse trend for a gentle UI nudge — never shown as a diagnosis. */
  trend:        "steady" | "rough-patch"
}

const ENABLED_KEY    = "kloom_wellness_enabled_v1"
const EVENTS_KEY      = "kloom_wellness_events_v1"
const DISCLOSURE_KEY  = "kloom_wellness_disclosed_v1"
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MAX_EVENTS = 200

const canStore = () => typeof window !== "undefined"

export function isWellnessEnabled(): boolean {
  if (!canStore()) return false
  // Default ON (disclosed). Only an explicit "0" disables it.
  return localStorage.getItem(ENABLED_KEY) !== "0"
}

export function setWellnessEnabled(on: boolean): void {
  if (!canStore()) return
  localStorage.setItem(ENABLED_KEY, on ? "1" : "0")
  if (!on) clearWellnessData() // turning off erases history — privacy by default
}

export function hasSeenWellnessDisclosure(): boolean {
  return canStore() && localStorage.getItem(DISCLOSURE_KEY) === "1"
}

export function markWellnessDisclosureSeen(): void {
  if (canStore()) localStorage.setItem(DISCLOSURE_KEY, "1")
}

function loadEvents(): WellnessEvent[] {
  if (!canStore()) return []
  try {
    const raw = JSON.parse(localStorage.getItem(EVENTS_KEY) ?? "[]")
    return Array.isArray(raw) ? raw : []
  } catch { return [] }
}

/** Record a wellness read from a chat reply. No-op if the user opted out. */
export function recordWellness(signal: WellnessSignal): void {
  if (!canStore() || !isWellnessEnabled()) return
  if (signal === "calm") return // we only persist the notable reads
  const now = Date.now()
  const events = loadEvents()
    .filter((e) => now - e.ts < WEEK_MS * 4)        // keep ~4 weeks max
    .concat({ signal, ts: now })
    .slice(-MAX_EVENTS)
  try { localStorage.setItem(EVENTS_KEY, JSON.stringify(events)) } catch {}
}

/** Compute the current private wellness state for UI nudges. */
export function getWellnessState(): WellnessState {
  const now = Date.now()
  const recent = loadEvents().filter((e) => now - e.ts < WEEK_MS)
  const crisis7d   = recent.filter((e) => e.signal === "crisis").length
  const distress7d = recent.filter((e) => e.signal === "distress").length
  const lastEventTs = recent.length ? Math.max(...recent.map((e) => e.ts)) : null
  const level: WellnessSignal = crisis7d > 0 ? "crisis" : distress7d > 0 ? "distress" : "calm"
  // "rough-patch" = repeated distress signals in the window. Deliberately coarse;
  // this is a nudge to offer Breathe/support, NOT a clinical assessment.
  const trend = crisis7d > 0 || distress7d >= 3 ? "rough-patch" : "steady"
  return { level, distress7d, crisis7d, lastEventTs, trend }
}

export function clearWellnessData(): void {
  if (!canStore()) return
  localStorage.removeItem(EVENTS_KEY)
}
