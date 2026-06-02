/**
 * User-created rooms. The Room Builder produces a standard `Room` object and
 * stores it locally — so a built room runs through the EXACT same room engine
 * (multi-AI chat + voice) as the built-in rooms. Free to create for everyone;
 * only voice calls cost money.
 */
import type { Room, RoomPersona, RoomCategory } from "@/lib/rooms"
import { resolveVoiceId } from "@/lib/voices"

const KEY = "ora_custom_rooms"

export type Gender = "female" | "male" | "nonbinary"

export interface BuilderMember {
  name: string
  gender: Gender
  personality: string      // free text or a preset
  relation: string         // their relationship to the others / the user
}

function read(): Room[] {
  try {
    const rooms: Room[] = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    // Self-heal rooms built before voices were gender-locked: backfill a fixed
    // voiceId (and gender, inferred from the persona's pronoun) so their voices
    // stop shifting / flipping. Persist the upgrade once.
    let changed = false
    for (const r of rooms) {
      for (const p of (r.personas ?? [])) {
        if (!p.voiceId) {
          if (!p.gender) {
            const t = p.personality ?? ""
            p.gender = /\bShe\b/.test(t) ? "female" : /\bHe\b/.test(t) ? "male" : "nonbinary"
          }
          p.voiceId = resolveVoiceId(p.name, p.gender)
          changed = true
        }
      }
    }
    if (changed) write(rooms)
    return rooms
  } catch { return [] }
}
function write(rooms: Room[]) {
  try { localStorage.setItem(KEY, JSON.stringify(rooms)) } catch {}
}

export function listCustomRooms(): Room[] { return read() }
export function getCustomRoom(id: string): Room | undefined {
  return read().find((r) => r.id === id)
}
export function deleteCustomRoom(id: string) { write(read().filter((r) => r.id !== id)) }

// Gender → a voice slot so calls sound right (TTS also resolves by name as fallback).
const VOICE_BY_GENDER: Record<Gender, RoomPersona["voice"]> = {
  female:    "coral",
  male:      "echo",
  nonbinary: "sage",
}

const GRADIENTS: Record<string, { gradient: string; accent: string }> = {
  social:    { gradient: "from-sky-900/30 to-stone-950",     accent: "sky" },
  romantic:  { gradient: "from-rose-900/30 to-stone-950",    accent: "rose" },
  creator:   { gradient: "from-orange-900/30 to-stone-950", accent: "fuchsia" },
  trading:   { gradient: "from-amber-900/30 to-stone-950",   accent: "amber" },
  dark:      { gradient: "from-rose-950/50 to-stone-950",    accent: "rose" },
  professional:{ gradient:"from-emerald-900/30 to-stone-950",accent: "emerald" },
}

/** Build a standard Room from the builder inputs and persist it. Returns the id. */
export function createCustomRoom(input: {
  name: string
  topic: string
  category: RoomCategory
  members: BuilderMember[]
}): string {
  const id = `u-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
  const g  = GRADIENTS[input.category] ?? GRADIENTS.social

  const personas: RoomPersona[] = input.members.map((m) => ({
    name:          m.name,
    role:          m.relation || "member of the room",
    personality:   `${m.personality}. ${m.gender === "female" ? "She" : m.gender === "male" ? "He" : "They"} ${m.relation ? `relate to the others as: ${m.relation}.` : ""}`.trim(),
    speakingStyle: "Natural, in-character, present. Talks like a real person, not a bot.",
    voice:         VOICE_BY_GENDER[m.gender],
    gender:        m.gender,
    // Lock in ONE concrete Fish voice now, chosen by the member's explicit gender.
    // Stored on the persona so every call/note uses the exact same voice — it can
    // never drift or flip male/female later.
    voiceId:       resolveVoiceId(m.name, m.gender),
    avatarSeed:    m.name,
  }))

  // The "relationship" string is injected into the system prompt — it sets the scene.
  const cast = input.members
    .map((m) => `${m.name} (${m.gender}, ${m.personality}${m.relation ? `, ${m.relation}` : ""})`)
    .join("; ")
  const relationship =
    `This room is about: ${input.topic || input.name}. The people here: ${cast}. ` +
    `Everyone stays fully in character and relates to each other and the user as described. Keep it natural and alive.`

  const room: Room = {
    id,
    name:        input.name,
    tagline:     input.topic || "A room you built",
    description: input.topic || `A custom room with ${input.members.length} characters.`,
    relationship,
    personas,
    capabilities: { voice: true, chat: true, tools: [], options: [], skills: [] },
    category:    input.category,
    tags:        ["custom"],
    gradient:    g.gradient,
    accentColor: g.accent,
  }

  const all = read()
  all.unshift(room)
  write(all)
  return id
}
