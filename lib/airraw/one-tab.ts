"use client"

// ONE TAB SPENDS. The rest watch.
//
// The room generates on a timer whether or not anyone asked it to, so two tabs
// open on it is two rooms running in parallel — double the model calls, double
// the voice, for one person who can only read one of them. Four tabs left over
// from an afternoon of testing is four. Nothing about the product wants that,
// and everything about the bill does not.
//
// So the room holds a LEASE, and only the holder generates.
//
// The newest tab wins, deliberately. The alternative — first tab keeps it — is
// worse in the case that actually happens: you open the site again, the new tab
// is the one you are looking at, and the old one behind it is the one still
// talking. Claiming on arrival means the tab in front of you is always the live
// one.
//
// A lease is a timestamp, not a lock. A tab that crashes or is closed without
// ceremony cannot release anything, so the holder re-stamps it every couple of
// seconds and any tab may take over one that has gone stale. The worst case is
// a few seconds of two tabs overlapping, not a room that never speaks again.

const KEY = "airraw_room_lease"
/** How often the holder proves it is still alive. */
export const BEAT_MS = 2_000
/** How long a silent lease is honoured before another tab may take it. */
export const STALE_MS = 6_000

const myId =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

interface Lease { id: string; at: number }

function read(): Lease | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    return v && typeof v.id === "string" && typeof v.at === "number" ? v : null
  } catch { return null }
}

function write(l: Lease) {
  try { localStorage.setItem(KEY, JSON.stringify(l)) } catch { /* private mode */ }
}

/**
 * Is this tab the one allowed to spend?
 *
 * Storage being unavailable (private mode, a browser with site data blocked)
 * answers YES. There is then no way to coordinate, and the choice is between one
 * tab spending and none — a product that silently refuses to work in a private
 * window is a worse failure than a rare duplicate.
 */
export function holdsLease(): boolean {
  let supported = true
  try { localStorage.getItem(KEY) } catch { supported = false }
  if (!supported) return true
  const l = read()
  if (!l) return false
  if (l.id === myId) return true
  return Date.now() - l.at > STALE_MS
}

/** Take the lease now. The newest arrival is the one in front of the person. */
export function claimLease() {
  write({ id: myId, at: Date.now() })
}

/**
 * Start holding it. Returns a release function.
 *
 * The heartbeat refreshes our own lease and does nothing to anyone else's, so a
 * tab that has been taken over simply stops being the holder and stays quiet
 * until it is told to claim again.
 */
export function keepLease(onChange?: (mine: boolean) => void): () => void {
  claimLease()
  let last = true
  onChange?.(true)

  const tick = () => {
    const l = read()
    const mine = !l || l.id === myId || Date.now() - l.at > STALE_MS
    if (mine) write({ id: myId, at: Date.now() })
    if (mine !== last) { last = mine; onChange?.(mine) }
  }
  const iv = setInterval(tick, BEAT_MS)

  // Fires in the OTHER tabs only, so a takeover is noticed at once rather than
  // up to a heartbeat later — the losing tab goes quiet before it can spend again.
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) tick() }
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage)

  return () => {
    clearInterval(iv)
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage)
    // Hand it back on the way out so the next tab does not wait out the staleness.
    try { if (read()?.id === myId) localStorage.removeItem(KEY) } catch { /* */ }
  }
}
