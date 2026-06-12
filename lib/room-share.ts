/**
 * Portable rooms — a custom room travels INSIDE its invite link.
 *
 * Custom rooms live in the creator's localStorage, so a bare
 * `/app/rooms/<id>` link 404s for everyone else. Fix: serialize the whole
 * Room into the URL fragment (`#r=<payload>`). Fragments never hit the
 * server, survive copy-paste, and a 2–4 KB room fits comfortably.
 *
 * On the room page: if the id isn't found locally, decode the fragment,
 * validate, persist via importCustomRoom, and the invitee owns a copy.
 */

import type { Room } from "@/lib/rooms"

// UTF-8 safe base64url (btoa alone breaks on non-Latin persona text).
function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/** Encode a room for transport in a URL fragment. */
export function encodeRoomPayload(room: Room): string {
  return b64urlEncode(JSON.stringify(room))
}

/** Decode + minimally validate a `#r=` payload. Returns null on anything off. */
export function decodeRoomPayload(payload: string): Room | null {
  try {
    const room = JSON.parse(b64urlDecode(payload)) as Room
    if (!room || typeof room !== "object") return null
    if (typeof room.id !== "string" || !room.id.startsWith("u-")) return null
    if (typeof room.name !== "string" || !room.name) return null
    if (!Array.isArray(room.personas) || room.personas.length < 1 || room.personas.length > 6) return null
    for (const p of room.personas) {
      if (typeof p.name !== "string" || !p.name) return null
      if (p.gender !== "female" && p.gender !== "male" && p.gender !== "nonbinary") return null
    }
    if (!room.capabilities || room.capabilities.voice !== true || room.capabilities.chat !== true) return null
    // Engine iterates these unconditionally — heal rather than reject.
    room.capabilities.tools   = Array.isArray(room.capabilities.tools)   ? room.capabilities.tools   : []
    room.capabilities.options = Array.isArray(room.capabilities.options) ? room.capabilities.options : []
    room.capabilities.skills  = Array.isArray(room.capabilities.skills)  ? room.capabilities.skills  : []
    room.tags = Array.isArray(room.tags) ? room.tags : ["custom"]
    if (typeof room.gradient !== "string")    room.gradient    = "from-stone-900/40 to-stone-950"
    if (typeof room.accentColor !== "string") room.accentColor = "amber"
    return room
  } catch {
    return null
  }
}

/** Read a portable room out of the current page's URL fragment, if present. */
export function roomFromLocationHash(): Room | null {
  if (typeof window === "undefined") return null
  const m = window.location.hash.match(/[#&]r=([A-Za-z0-9_-]+)/)
  return m ? decodeRoomPayload(m[1]) : null
}

/**
 * Full shareable invite for a room.
 * Built-ins share by id; custom rooms carry themselves in the fragment.
 * Optional topic + guest name personalize the landing.
 */
export const FUN_ORIGIN = "https://kloom.fun"

export function buildInviteUrl(opts: {
  room: Room
  sessionId: string
  topic?: string      // topic slug
  guestName?: string
  origin?: string     // force a host (e.g. kloom.fun for adult rooms on .io)
}): string {
  const origin = opts.origin ?? (typeof window !== "undefined" ? window.location.origin : "")
  const params = new URLSearchParams({ session: opts.sessionId })
  if (opts.topic) params.set("t", opts.topic)
  if (opts.guestName) params.set("name", opts.guestName)
  const base = `${origin}/app/rooms/${opts.room.id}?${params.toString()}`
  const isCustom = opts.room.id.startsWith("u-")
  return isCustom ? `${base}#r=${encodeRoomPayload(opts.room)}` : base
}
