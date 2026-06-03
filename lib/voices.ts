/**
 * Fish Audio voice registry. Maps each persona/expert to a real voice
 * reference_id. Female personas pull from the Girls pool, males from Guys
 * (deterministic by name so a persona always sounds the same). Specific
 * personas get dedicated voices (tarot, critique, whisper).
 */

import { FEMALE_PERSONAS, nameHash } from "@/lib/persona-utils"

// Granular Pools: [Gender, Seriousness, Age]
const POOLS = {
  female_serious_mature: ["c1e8cb64140a433da027c21ee81f6ed1", "3dea985a29124f079f9099d54134db23"],
  female_serious_young:  ["bf7d0567a78e403e99c44bde27a36a9e", "a2dbcf12885442a9b68b34d3f1c83699"],
  female_casual_mature:  ["e51c3314b71241a892387e6804b45c2c", "6d7ebc02cb674c31a68d7e2a88cf9c9a"],
  female_casual_young:   ["bdd2d13b32614c3e89e05ae5af0b3c6b", "22f095fe9dea45d4a8eaab9997be4d7a", "6282262063c545a7a78a307b9a1b8a2e"],
  
  male_serious_mature:   ["9344dc514b6a47dbb296fea1c0b11312", "047c93388dc54d2a9039bc7906a9cd9f"],
  male_serious_young:    ["6ac384bc5abd45eca19cdb55b340f346", "14c13e72d4644b0dbd2f147df20f6d80"],
  male_casual_mature:    ["f82cdc6a72b541fa91b008bfdf329748", "da0ffe0ea4894d4c8d98aa08de8291d7"],
  male_casual_young:     ["2d88752727554003b2c42af28d2b9d17", "9757c85bfc1147b9851dda6f7f61b68a"],
}

const GIRLS = [
  ...POOLS.female_serious_mature, ...POOLS.female_serious_young,
  ...POOLS.female_casual_mature,  ...POOLS.female_casual_young
]
const GUYS = [
  ...POOLS.male_serious_mature, ...POOLS.male_serious_young,
  ...POOLS.male_casual_mature,  ...POOLS.male_casual_young
]

const SOFT_GIRLS = POOLS.female_casual_young
const SERIOUS_VOICES = [...POOLS.female_serious_mature, ...POOLS.male_serious_mature]

const GIRL_WHISPER = "bb1c525033da40da88153a8106144f31"
const TAROT        = "44bef56c84ad458ebe78b8c2eb74bb83"
const CRITIQUE     = "90ce7a70e52e46088217cd4bd383a4a4"

/** Premium Vibe Tags — available for autocomplete in room settings */
export const VIBE_TAGS = [
  "Seductive", "Brutally Honest", "Sarcastic", "Hyper-Active", "Whimsical",
  "Melancholy", "Dominant", "Submissive", "Stoic", "Chaotic", "Nurturing",
  "Cold", "Warm", "Intense", "Playful", "Cynical", "Naive", "Mysterious",
  "Bubbly", "Deadpan", "Flirty", "Aggressive", "Poetic", "Vulgar", "Proper",
  "Slang-heavy", "Whispery", "Breathless", "Confident", "Shy", "Clumsy",
]

function isFemale(name: string): boolean {
  return FEMALE_PERSONAS.has(name) || FEMALE_EXPERTS.has(name) ||
    // Heuristic for invited/custom female names
    /\b(she|her|girl|woman|miss|mistress|mommy|sister|wife|girlfriend|female)\b/i.test(name)
}

function isMale(name: string): boolean {
  return /\b(he|him|guy|man|boy|brother|husband|boyfriend|male)\b/i.test(name)
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

function isSerious(name: string): boolean {
  return /\b(expert|auditor|reviewer|strategist|archit|engineer|serious|professional|cold)\b/i.test(name)
}

function isMature(name: string): boolean {
  return /\b(boss|mistress|mommy|mentor|archit|strategist|mature|older|senior)\b/i.test(name)
}

/**
 * Returns a stable voice ID for a name. If that voice is reported as broken,
 * we can rotate to another in the same pool.
 */
export function resolveVoiceId(name?: string, gender?: string, traits?: { seriousness?: 'serious'|'casual', age?: 'mature'|'young' }): string | undefined {
  if (!name && !gender) return undefined
  if (name && OVERRIDES[name]) return OVERRIDES[name]

  const hash = nameHash(name || gender || "x")
  const isF = gender === "female" || (gender !== "male" && isFemale(name || ""))
  const isM = gender === "male" || (gender !== "female" && isMale(name || ""))

  const gen = isF ? 'female' : 'male'
  const ser = traits?.seriousness || (isSerious(name || "") ? 'serious' : 'casual')
  const age = traits?.age || (isMature(name || "") ? 'mature' : 'young')

  const poolKey = `${gen}_${ser}_${age}` as keyof typeof POOLS
  const pool = POOLS[poolKey] || (isF ? GIRLS : GUYS)

  return pool[hash % pool.length]
}

/**
 * Premium failover: if a specific voice ID is failing, the API can call this
 * to get a sibling voice from the same pool.
 */
export function getFallbackVoiceId(currentId: string): string {
  // Find which pool it belongs to and return the next one
  const pools = Object.values(POOLS)
  for (const pool of pools) {
    const idx = pool.indexOf(currentId)
    if (idx !== -1) return pool[(idx + 1) % pool.length]
  }
  return GIRLS[0]
}

