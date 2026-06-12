/**
 * User-created rooms. The Room Builder produces a standard `Room` object and
 * stores it locally — so a built room runs through the EXACT same room engine
 * (multi-AI chat + voice) as the built-in rooms. Free to create for everyone;
 * only voice calls cost money.
 */
import type { Room, RoomPersona, RoomCategory, RoomTool } from "@/lib/rooms"
import { resolveVoiceId } from "@/lib/voices"

// ── World toolkits — every custom room inherits its category's tools ────────
// Same MCP tool ids the built-in rooms use; the engine's Tools tab lights up
// for wizard-built rooms exactly like flagship ones.
const WORLD_TOOLS: Partial<Record<RoomCategory, RoomTool[]>> = {
  trading: [
    { id: "kloom_get_crypto_price", label: "Live prices",     icon: "📊" },
    { id: "kloom_analyze_market",   label: "Market analysis", icon: "📈" },
    { id: "kloom_financial_calc",   label: "Position calc",   icon: "🧮" },
    { id: "kloom_web_search",       label: "Web search",      icon: "🔎" },
  ],
  workshop: [
    { id: "kloom_generate_code", label: "Generate code", icon: "💻" },
    { id: "kloom_build_html",    label: "Build a page",  icon: "🛠️" },
    { id: "kloom_canva_design",  label: "Design",        icon: "🎨" },
    { id: "kloom_web_search",    label: "Web search",    icon: "🔎" },
  ],
  creator: [
    { id: "kloom_content_ideas",     label: "Content ideas", icon: "💡" },
    { id: "kloom_instagram_caption", label: "Captions",      icon: "✍️" },
    { id: "kloom_generate_hashtags", label: "Hashtags",      icon: "#️⃣" },
  ],
  professional: [
    { id: "kloom_analyze_code", label: "Code review", icon: "🧑‍💻" },
    { id: "kloom_web_search",   label: "Web search",  icon: "🔎" },
    { id: "kloom_calculate",    label: "Calculate",   icon: "🧮" },
  ],
  philosophy: [
    { id: "kloom_web_search", label: "Web search", icon: "🔎" },
  ],
  "co-intelligence": [
    { id: "kloom_web_search", label: "Research",  icon: "🔎" },
    { id: "kloom_calculate",  label: "Calculate", icon: "🧮" },
  ],
  fantasy: [
    { id: "kloom_content_ideas", label: "Story ideas", icon: "✨" },
  ],
}

const WORLD_SKILLS: Partial<Record<RoomCategory, string[]>> = {
  trading:           ["Live data", "Market calls"],
  workshop:          ["Builds with you", "Multi-AI"],
  creator:           ["Growth", "Content"],
  professional:      ["Code review", "Analysis"],
  philosophy:        ["Deep dives"],
  "co-intelligence": ["Decision support"],
  fantasy:           ["Immersive RP"],
}

const KEY = "kloom_custom_rooms"

export type Gender = "female" | "male" | "nonbinary"

export interface BuilderMember {
  name: string
  gender: Gender
  personality: string      // free text or a preset
  relation: string         // their relationship to the others / the user
  voiceId?: string         // explicit voice pick from the wizard (catalog or YouTube clone)
  speakingStyle?: string   // preset speaking style, carried through when picked
  model?: RoomPersona["model"] // AI seat backend, for multi-model rooms
  unrestricted?: boolean   // persona starts unrestricted (adult categories)
  photoUrl?: string        // generated portrait (Supabase Storage url)
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

/**
 * Persist a fully-formed Room (e.g. one that arrived inside an invite link's
 * `#r=` fragment — see lib/room-share.ts). Idempotent by id.
 */
export function importCustomRoom(room: Room) {
  const all = read()
  if (all.some((r) => r.id === room.id)) return
  all.unshift(room)
  write(all)
}

/**
 * Clone any room into the user's own editable copy. Deep-copies the room with a
 * fresh `u-` id (so it's theirs to keep, edit, re-share) and persists it.
 * Returns the new id.
 */
export function cloneRoom(room: Room): string {
  const id = `u-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
  const copy: Room = JSON.parse(JSON.stringify(room))
  copy.id = id
  copy.tags = Array.from(new Set([...(copy.tags ?? []), "cloned"]))
  const all = read()
  all.unshift(copy)
  write(all)
  return id
}

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
    speakingStyle: m.speakingStyle || "Natural, in-character, present. Talks like a real person, not a bot.",
    voice:         VOICE_BY_GENDER[m.gender],
    gender:        m.gender,
    // Lock in ONE concrete voice now: wizard's explicit pick wins (catalog or
    // YouTube clone), else deterministic pool by name+gender. Stored on the
    // persona so every call uses the exact same voice — it can never drift.
    voiceId:       m.voiceId?.trim() || resolveVoiceId(m.name, m.gender),
    avatarSeed:    m.name,
    ...(m.photoUrl ? { photoUrl: m.photoUrl } : {}),
    ...(m.model ? { model: m.model } : {}),
    ...(m.unrestricted ? { unrestricted: true } : {}),
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
    capabilities: {
      voice: true, chat: true,
      tools:   WORLD_TOOLS[input.category]  ?? [],
      options: [],
      skills:  WORLD_SKILLS[input.category] ?? ["custom"],
    },
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
