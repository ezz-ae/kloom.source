/**
 * Shared room sessions — real multi-human group chat over Supabase Realtime.
 *
 * Each room session is an ephemeral broadcast channel. Humans in the same
 * session see each other's messages and the same AI replies in real time.
 * The sender of a human message "owns" the AI turn (runs it, broadcasts the
 * reply) so the model isn't called N times.
 */

import { supabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"

export interface WireMessage {
  id: string
  kind: "human" | "ai"
  handle: string          // sender display name (human) or AI persona name
  content: string
  ts: number
}

export interface Participant {
  handle: string
  color: string
  isYou?: boolean
}

const COLORS = ["#a78bfa", "#34d399", "#f472b6", "#fbbf24", "#60a5fa", "#fb923c", "#22d3ee", "#c084fc"]

export function colorFor(handle: string): string {
  let h = 0
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

export function makeSessionId(): string {
  const a = "abcdefghijklmnopqrstuvwxyz0123456789"
  let s = ""
  // crypto-random where available, fallback to time-seeded
  const buf = typeof crypto !== "undefined" && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint8Array(8))
    : null
  for (let i = 0; i < 8; i++) {
    const n = buf ? buf[i] : (Date.now() + i) % 256
    s += a[n % a.length]
  }
  return s
}

export function inviteUrl(roomId: string, sessionId: string): string {
  if (typeof window === "undefined") return ""
  return `${window.location.origin}/app/rooms/${roomId}?session=${sessionId}`
}

/** Stable per-tab handle. Uses wallet if provided, else a guest name. */
export function resolveHandle(walletAddress?: string | null): string {
  if (walletAddress) return walletAddress.slice(0, 4) + "…" + walletAddress.slice(-4)
  try {
    const k = "ora_guest_handle"
    let h = sessionStorage.getItem(k)
    if (!h) { h = "Guest-" + makeSessionId().slice(0, 4); sessionStorage.setItem(k, h) }
    return h
  } catch {
    return "Guest"
  }
}

export interface SessionHandlers {
  onMessage: (m: WireMessage) => void
  onPresence: (people: Participant[]) => void
}

/**
 * Join a room session channel. Returns the channel + a send function.
 * Safe to call client-side only.
 */
export function joinSession(
  roomId: string,
  sessionId: string,
  handle: string,
  handlers: SessionHandlers,
): { channel: RealtimeChannel; broadcast: (m: WireMessage) => void; leave: () => void } {
  const topic = `ora-room-${roomId}-${sessionId}`

  // Remove any stale channel with the same topic first. React Strict Mode
  // mounts effects twice; without this, supabase.channel() returns the already
  // -subscribed cached instance and adding .on() handlers throws
  // ("cannot add presence callbacks after subscribe()").
  for (const ch of supabase.getChannels()) {
    if (ch.topic === topic || ch.topic === `realtime:${topic}`) {
      try { supabase.removeChannel(ch) } catch {}
    }
  }

  const channel = supabase.channel(topic, {
    config: { broadcast: { self: false }, presence: { key: handle } },
  })

  channel
    .on("broadcast", { event: "msg" }, ({ payload }) => {
      handlers.onMessage(payload as WireMessage)
    })
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState()
      const people: Participant[] = Object.keys(state).map((h) => ({
        handle: h, color: colorFor(h), isYou: h === handle,
      }))
      handlers.onPresence(people)
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ handle, at: Date.now() })
      }
    })

  const broadcast = (m: WireMessage) => {
    channel.send({ type: "broadcast", event: "msg", payload: m })
  }
  const leave = () => { supabase.removeChannel(channel) }

  return { channel, broadcast, leave }
}
