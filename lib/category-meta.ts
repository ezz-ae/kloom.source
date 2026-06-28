/**
 * Category identity — every category is a different world with its own door.
 * Single source of truth for the browse grid, category pages, and the
 * create-wizard's step 1, so the whole app agrees on what each world feels like.
 *
 * (On the Abuseday variant the same data is presented as "planets" — but the
 * underlying copy here stays brand-neutral so Kloom is unaffected.)
 */

import type { RoomCategory } from "@/lib/rooms"
import { adultEnabled, isAbuseday } from "@/lib/variant"

export interface CategoryMeta {
  id: RoomCategory
  label: string        // display name (door sign)
  emoji: string
  tagline: string      // one line under the door sign
  // Visual identity
  gradient: string     // tailwind gradient classes for the door/hero
  glow: string         // accent ring/shadow classes
  text: string         // accent text color class
  // Capability badges shown on the door
  badges: Array<"18+" | "multi-model" | "tools" | "canvas" | "haptics" | "no-memory" | "live-data">
  adult?: boolean      // gate behind hasUnrestricted()
  vip?: boolean        // VIP planet — visible to all, but entry needs an active Pass (Abuseday)
  abusedayOnly?: boolean // only surfaces on the Abuseday variant (hidden on Kloom)
  order: number        // display order in the browse grid
}

export const CATEGORY_META: Record<RoomCategory, CategoryMeta> = {
  fantasy: {
    id: "fantasy", label: "Fantasy Worlds", emoji: "🗡️",
    tagline: "Twenty realms. Step through, become someone else.",
    gradient: "from-violet-950/80 via-indigo-950/60 to-stone-950",
    glow: "ring-violet-500/30 shadow-violet-900/40",
    text: "text-violet-300",
    badges: ["multi-model", "tools"],
    order: 1,
  },
  romantic: {
    id: "romantic", label: "Romance", emoji: "💋",
    tagline: "Chemistry that remembers you.",
    gradient: "from-rose-950/80 via-pink-950/50 to-stone-950",
    glow: "ring-rose-500/30 shadow-rose-900/40",
    text: "text-rose-300",
    badges: ["18+"],
    adult: true,
    order: 2,
  },
  dark: {
    id: "dark", label: "After Dark", emoji: "🌑",
    tagline: "No filters. No judgment. No record.",
    gradient: "from-stone-950 via-rose-950/40 to-black",
    glow: "ring-rose-500/20 shadow-black/60",
    text: "text-rose-400",
    badges: ["18+", "haptics"],
    adult: true,
    order: 3,
  },
  social: {
    id: "social", label: "Social Club", emoji: "🎭",
    tagline: "The group chat that talks back.",
    gradient: "from-sky-950/70 via-cyan-950/40 to-stone-950",
    glow: "ring-sky-500/30 shadow-sky-900/40",
    text: "text-sky-300",
    badges: [],
    order: 4,
  },
  trading: {
    id: "trading", label: "Trading Floor", emoji: "📈",
    tagline: "A live desk with real market tools.",
    gradient: "from-emerald-950/70 via-teal-950/40 to-stone-950",
    glow: "ring-emerald-500/30 shadow-emerald-900/40",
    text: "text-emerald-300",
    badges: ["tools", "live-data"],
    order: 5,
  },
  workshop: {
    id: "workshop", label: "Workshop", emoji: "🛠️",
    tagline: "Claude, Gemini and the crew build with you.",
    gradient: "from-amber-950/70 via-orange-950/40 to-stone-950",
    glow: "ring-amber-500/30 shadow-amber-900/40",
    text: "text-amber-300",
    badges: ["multi-model", "tools", "canvas"],
    order: 6,
  },
  creator: {
    id: "creator", label: "Creator Studio", emoji: "🎨",
    tagline: "Growth plans, content, monetization — on call.",
    gradient: "from-fuchsia-950/70 via-pink-950/40 to-stone-950",
    glow: "ring-fuchsia-500/30 shadow-fuchsia-900/40",
    text: "text-fuchsia-300",
    badges: ["tools"],
    order: 7,
  },
  "co-intelligence": {
    id: "co-intelligence", label: "Co-Intelligence", emoji: "🧠",
    tagline: "Three models pressure-test your biggest calls.",
    gradient: "from-emerald-950/80 via-stone-950 to-stone-950",
    glow: "ring-emerald-400/40 shadow-emerald-900/50",
    text: "text-emerald-300",
    badges: ["multi-model"],
    vip: true,
    order: 8,
  },
  philosophy: {
    id: "philosophy", label: "Deep Talk", emoji: "🌌",
    tagline: "The 3am conversations, any hour.",
    gradient: "from-indigo-950/80 via-stone-950 to-stone-950",
    glow: "ring-indigo-500/30 shadow-indigo-900/40",
    text: "text-indigo-300",
    badges: [],
    order: 9,
  },
  professional: {
    id: "professional", label: "Professional", emoji: "💼",
    tagline: "Code review, architecture, career moves.",
    gradient: "from-slate-900/80 via-stone-950 to-stone-950",
    glow: "ring-slate-400/30 shadow-slate-900/40",
    text: "text-slate-300",
    badges: ["tools"],
    order: 10,
  },
  "zero-memory": {
    id: "zero-memory", label: "The Vault", emoji: "👻",
    tagline: "Nothing stored. Nothing remembered. Ever.",
    gradient: "from-stone-950 via-stone-900/60 to-black",
    glow: "ring-stone-500/30 shadow-black/60",
    text: "text-stone-300",
    badges: ["no-memory"],
    order: 11,
  },
  arena: {
    id: "arena", label: "The Arena", emoji: "⚔️",
    tagline: "Step in, pick a side, last one standing wins.",
    gradient: "from-red-950/80 via-orange-950/50 to-stone-950",
    glow: "ring-red-500/30 shadow-red-900/40",
    text: "text-red-300",
    badges: ["multi-model"],
    abusedayOnly: true,
    order: 12,
  },
  desert: {
    id: "desert", label: "The Desert", emoji: "🏜️",
    tagline: "Endless dunes, one fire, and the truth at 3am.",
    gradient: "from-amber-950/70 via-orange-950/40 to-stone-950",
    glow: "ring-amber-500/30 shadow-amber-900/40",
    text: "text-amber-200",
    badges: [],
    abusedayOnly: true,
    order: 13,
  },
}

// Adult worlds (romantic, dark) only appear on the .fun variant; .io is clean.
// Abuseday-only planets (arena, desert) are stripped on every Kloom variant.
export const CATEGORY_ORDER: RoomCategory[] = (Object.values(CATEGORY_META) as CategoryMeta[])
  .filter((m) => (adultEnabled() || !m.adult) && (isAbuseday() || !m.abusedayOnly))
  .sort((a, b) => a.order - b.order)
  .map((m) => m.id)

/** True for planets that only exist on the Abuseday brand (hidden on Kloom). */
export function isAbusedayOnlyCategory(c: RoomCategory): boolean {
  return !!CATEGORY_META[c]?.abusedayOnly
}

/** True for worlds that hold sexual / zero-restriction content (.fun only). */
export function isAdultCategory(c: RoomCategory): boolean {
  return !!CATEGORY_META[c]?.adult
}

/**
 * True for any room with sexual / zero-restriction content — adult category,
 * an unrestricted persona, or haptic/vibration options. Used to keep these out
 * of the .io variant entirely (they live on .fun).
 */
export function isAdultRoom(room: {
  category: RoomCategory
  personas?: Array<{ unrestricted?: boolean }>
  capabilities?: { options?: Array<{ id: string }> }
}): boolean {
  if (isAdultCategory(room.category)) return true
  if (room.personas?.some((p) => p.unrestricted)) return true
  if (room.capabilities?.options?.some((o) => o.id === "haptic_sync" || o.id === "vibration")) return true
  return false
}

/** True for VIP planets — the whole Co-Intelligence planet is behind the rope. */
export function isVipCategory(c: RoomCategory): boolean {
  return !!CATEGORY_META[c]?.vip
}

/**
 * True for any planet behind the velvet rope — a VIP category, or a single
 * room flagged `vip`. VIP is an ABUSEDAY-only monetization concept, so this is
 * always false on Kloom (io/fun/me) — no VIP badges or locks ever appear there.
 * VIP planets are visible to everyone but require an active Pass to enter.
 */
export function isVipRoom(room: { category: RoomCategory; vip?: boolean }): boolean {
  if (!isAbuseday()) return false
  return !!room.vip || isVipCategory(room.category)
}

export const BADGE_LABELS: Record<CategoryMeta["badges"][number], string> = {
  "18+": "18+",
  "multi-model": "Multi-AI",
  tools: "Tools",
  canvas: "Canvas",
  haptics: "Haptics",
  "no-memory": "No memory",
  "live-data": "Live data",
}
