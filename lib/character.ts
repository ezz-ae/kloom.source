/**
 * The user's own "character" — their profile/preferences, stored on-device.
 * Drives personalization: the Rooms grid is reordered so the categories and
 * interests the user cares about surface first. Purely client-side for now
 * (can mirror to Supabase by wallet later).
 */
import type { RoomCategory } from "@/lib/rooms"

export interface UserCharacter {
  displayName: string
  /** Free-form interest tags used for soft matching against room name/tagline. */
  interests: string[]
  /** Overall vibe the user leans toward. */
  vibe: "" | "chill" | "playful" | "intense" | "deep"
  /** Room categories the user wants surfaced first. */
  preferredCategories: RoomCategory[]
  /** The chat-direction prompt the Vibes quiz produced — how the user wants rooms to talk
   *  to them. Carried into the AI as a steer. Empty until they take the quiz. */
  chatDirection?: string
}

const KEY = "kloom_user_character_v1"

const EMPTY: UserCharacter = { displayName: "", interests: [], vibe: "", preferredCategories: [] }

export function getCharacter(): UserCharacter {
  if (typeof window === "undefined") return EMPTY
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}")
    return {
      displayName: typeof raw.displayName === "string" ? raw.displayName : "",
      interests: Array.isArray(raw.interests) ? raw.interests : [],
      vibe: ["chill", "playful", "intense", "deep"].includes(raw.vibe) ? raw.vibe : "",
      preferredCategories: Array.isArray(raw.preferredCategories) ? raw.preferredCategories : [],
      chatDirection: typeof raw.chatDirection === "string" ? raw.chatDirection : "",
    }
  } catch { return EMPTY }
}

export function saveCharacter(c: UserCharacter): void {
  if (typeof window === "undefined") return
  try { localStorage.setItem(KEY, JSON.stringify(c)) } catch {}
}

export function hasCharacter(): boolean {
  const c = getCharacter()
  return !!(c.displayName || c.interests.length || c.vibe || c.preferredCategories.length)
}

/**
 * Score a room for the current user — higher = more relevant. Used to reorder
 * the Rooms grid. Preferred categories weigh most; interest-word hits in the
 * room name/tagline add a softer boost. Returns 0 when the user has no profile.
 */
export function scoreRoom(room: { category: string; name: string; tagline?: string }, c?: UserCharacter): number {
  const ch = c ?? getCharacter()
  let score = 0
  if (ch.preferredCategories.includes(room.category as RoomCategory)) score += 10
  if (ch.interests.length) {
    const hay = `${room.name} ${room.tagline ?? ""}`.toLowerCase()
    for (const tag of ch.interests) {
      if (tag && hay.includes(tag.toLowerCase())) score += 3
    }
  }
  return score
}
