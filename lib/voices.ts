/**
 * Fish Audio voice registry. Maps each persona/expert to a real voice
 * reference_id. Female personas pull from the Girls pool, males from Guys
 * (deterministic by name so a persona always sounds the same). Specific
 * personas get dedicated voices (tarot, critique, whisper).
 */

import { FEMALE_PERSONAS, nameHash } from "@/lib/persona-utils"

const GIRLS = [
  "e51c3314b71241a892387e6804b45c2c",
  "6d7ebc02cb674c31a68d7e2a88cf9c9a",
  "62815b53043c4be8adc565a2c7a27117",
  "2e064c4c5f4f4523a69e964c09ef996e",
  "bf7d0567a78e403e99c44bde27a36a9e",
  "a2dbcf12885442a9b68b34d3f1c83699",
  "d0f16d86f51349d59f69a36d25ea64ae",
  "378e8db799294f2193747f825a471a1d",
  "eb5d97bf9f0b414d8809c3197266f280",
  "c1e8cb64140a433da027c21ee81f6ed1",
  "3dea985a29124f079f9099d54134db23",
  "553b2b3665614ff5aac6620eb2962f80",
  "1b3ba2dfb2224bd2a0344d7f1e8f8d79",
  "bfb3a799c9474c28bea76de34c7a4b9a",
  "d0d57d627c044da1ba1f2012a3b15a6a",
  "b0490fe96b0b4d4d8a6cb1cbc8cb6866",
  "5f769d7e89fb40d8a158e16454e03b9f",
]

// Gentle / sweet / nurturing female voices — for soft personas.
const SOFT_GIRLS = [
  // NOTE: first soft-girls ID ("0380774513b1b5f632118b3348") was 26 chars
  // (truncated) — dropped until re-sent.
  "bdd2d13b32614c3e89e05ae5af0b3c6b",
  "22f095fe9dea45d4a8eaab9997be4d7a",
  "6282262063c545a7a78a307b9a1b8a2e",
  "92b2aa4e9c1b450c99ce21011c9a04b1",
]

const GUYS = [
  // NOTE: an earlier Guys ID ("5ba5709d5484462bb634052b8432277") was 31 chars
  // (truncated) — dropped until re-sent.
  "f82cdc6a72b541fa91b008bfdf329748",
  "2d88752727554003b2c42af28d2b9d17",
  "9757c85bfc1147b9851dda6f7f61b68a",
  "6ac384bc5abd45eca19cdb55b340f346",
  "9344dc514b6a47dbb296fea1c0b11312",
  "14c13e72d4644b0dbd2f147df20f6d80",
  "047c93388dc54d2a9039bc7906a9cd9f",
  "949309c754a64dd39f98c61e94828471",
  "da0ffe0ea4894d4c8d98aa08de8291d7",
  "949f3d0bd5544179ae9cc2007e1e9282",
  "cfb868587446408783caf2088a49a33c",
]

const GIRL_WHISPER = "bb1c525033da40da88153a8106144f31"
const TAROT        = "44bef56c84ad458ebe78b8c2eb74bb83"
const CRITIQUE     = "90ce7a70e52e46088217cd4bd383a4a4"

// Female experts not in FEMALE_PERSONAS (those are roleplay personas).
const FEMALE_EXPERTS = new Set<string>([
  "Zara", "Kaia", "Kaia Dev", "Kaia (Engineer)", "Kaia (Reviewer)",
  "Vera", "Coco", "Mira", "Iris", "Nonna Rosa", "Madame Selene",
  // Future Reading characters
  "Esmeray", "Amara", "Fortuna", "The Seer",
  // Intimacy characters
  "Dr. Sienna", "Mara", "Lola", "Nyx", "Mistress Reign",
  // More experts (female)
  "Celeste", "Vesper", "Tess", "Diana", "Penny",
  "Juno", "Hannah", "Aya",
])

// Dedicated voices for specific names.
const OVERRIDES: Record<string, string> = {
  "Madame Selene":   TAROT,
  "Jules":           CRITIQUE,   // music critic
  "Sterling":        CRITIQUE,   // critique expert
  "Mia (Submissive)": GIRL_WHISPER,
  "Whisper":          GIRL_WHISPER,
  "Lola":             GIRL_WHISPER,   // Fantasy Talk — intimate whisper
}

function isFemale(name: string): boolean {
  return FEMALE_PERSONAS.has(name) || FEMALE_EXPERTS.has(name) ||
    // Heuristic for invited/custom female names
    /\b(she|her|girl|woman|miss|mistress|mommy|sister|wife|girlfriend)\b/i.test(name)
}

// Soft / gentle / nurturing female personas — get the soft-girls voices.
const SOFT_NAMES = new Set<string>([
  "Luna (Life Coach)", "Sage (Mentor)", "Nonna Rosa", "Pip (Little)",
  "Mommy June", "Mira", "Sol",
  // Gentle future-reading voices
  "Esmeray", "Amara", "The Seer",
  // Gentle wellness voice
  "Aya",
])
function isSoft(name: string): boolean {
  return SOFT_NAMES.has(name) || /\b(little|mommy|baby|soft|sweet|gentle|nurtur)\b/i.test(name)
}

/**
 * Resolve a Fish Audio reference_id for a persona. STABLE + GENDER-CORRECT:
 *  - the same (name, gender) ALWAYS maps to the same voice (deterministic hash),
 *  - an EXPLICIT gender is authoritative — a "female" character never gets a male
 *    voice (and vice-versa). Name heuristics are only the fallback when no gender
 *    is given. This is what stops a character's voice from shifting or flipping.
 */
export function resolveVoiceId(name?: string, gender?: string): string | undefined {
  if (!name && !gender) return undefined
  if (name && OVERRIDES[name]) return OVERRIDES[name]

  const g = (gender || "").toLowerCase().trim()
  let female: boolean
  if (["female", "f", "woman", "girl"].includes(g))            female = true
  else if (["male", "m", "man", "boy", "nonbinary", "non-binary", "nb"].includes(g)) female = false
  else                                                          female = isFemale(name || "")

  const key = name || gender || "x"          // stable key → never re-rolls
  if (female && isSoft(name || "")) return SOFT_GIRLS[nameHash(key) % SOFT_GIRLS.length]
  const pool = female ? GIRLS : GUYS
  return pool[nameHash(key) % pool.length]
}
