/**
 * Fish Audio voice registry. Maps each persona/expert to a real voice
 * reference_id. Female personas pull from the Girls pool, males from Guys
 * (deterministic by name so a persona always sounds the same). Specific
 * personas get dedicated voices (tarot, critique, whisper).
 */

import { FEMALE_PERSONAS, nameHash } from "@/lib/persona-utils"

// Granular Pools: [Gender, Seriousness, Age]
const POOLS = {
  female_serious_mature: ["c1e8cb64140a433da027c21ee81f6ed1", "3dea985a29124f079f9099d54134db23", "553b2b3665614ff5aac6620eb2962f80", "1b3ba2dfb2224bd2a0344d7f1e8f8d79"],
  female_serious_young:  ["bf7d0567a78e403e99c44bde27a36a9e", "a2dbcf12885442a9b68b34d3f1c83699", "d0f16d86f51349d59f69a36d25ea64ae", "378e8db799294f2193747f825a471a1d"],
  female_casual_mature:  ["e51c3314b71241a892387e6804b45c2c", "6d7ebc02cb674c31a68d7e2a88cf9c9a", "eb5d97bf9f0b414d8809c3197266f280", "bfb3a799c9474c28bea76de34c7a4b9a"],
  female_casual_young:   ["62815b53043c4be8adc565a2c7a27117", "2e064c4c5f4f4523a69e964c09ef996e", "d0d57d627c044da1ba1f2012a3b15a6a"],

  male_serious_mature:   ["9344dc514b6a47dbb296fea1c0b11312", "047c93388dc54d2a9039bc7906a9cd9f", "949309c754a64dd39f98c61e94828471"],
  male_serious_young:    ["6ac384bc5abd45eca19cdb55b340f346", "14c13e72d4644b0dbd2f147df20f6d80"],
  male_casual_mature:    ["f82cdc6a72b541fa91b008bfdf329748", "da0ffe0ea4894d4c8d98aa08de8291d7", "5ba5e709d5484462bb634052b8432277"],
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

const FEMALE_EXPERTS = new Set<string>([])
const OVERRIDES: Record<string, string> = {
  // Add any explicit persona-to-voice overrides here when a specific voice should
  // always be used for a known character name.
}

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

  // Default: spread across the FULL gender pool (15 female / 10 male) so every
  // persona gets a distinct-feeling voice. The tiny trait sub-pools (2-4 voices)
  // collide hard and made everyone sound the same — only use them when a caller
  // explicitly asks for a seriousness/age character.
  const fullPool = isF ? GIRLS : GUYS
  if (!traits?.seriousness && !traits?.age) {
    return fullPool[hash % fullPool.length]
  }

  const gen = isF ? 'female' : 'male'
  const ser = traits?.seriousness || (isSerious(name || "") ? 'serious' : 'casual')
  const age = traits?.age || (isMature(name || "") ? 'mature' : 'young')
  const poolKey = `${gen}_${ser}_${age}` as keyof typeof POOLS
  const pool = POOLS[poolKey] || fullPool
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

// ── Curated voice catalog — human names for the create-wizard voice picker ──
// Every pool voice gets a display identity so users pick "Ember" not a hex id.
export interface VoiceCatalogEntry {
  id: string
  label: string
  gender: "female" | "male"
  vibe: string   // one-line feel, shown under the name
}

export const VOICE_CATALOG: VoiceCatalogEntry[] = [
  // Female — serious, mature
  { id: "c1e8cb64140a433da027c21ee81f6ed1", label: "Maris",   gender: "female", vibe: "Composed, low, in control" },
  { id: "3dea985a29124f079f9099d54134db23", label: "Dahlia",  gender: "female", vibe: "Velvet authority" },
  { id: "553b2b3665614ff5aac6620eb2962f80", label: "Opal",    gender: "female", vibe: "Calm, deliberate, warm steel" },
  { id: "1b3ba2dfb2224bd2a0344d7f1e8f8d79", label: "Sable",   gender: "female", vibe: "Dark, unhurried" },
  // Female — serious, young
  { id: "bf7d0567a78e403e99c44bde27a36a9e", label: "Wren",    gender: "female", vibe: "Sharp, clear, focused" },
  { id: "a2dbcf12885442a9b68b34d3f1c83699", label: "Nova",    gender: "female", vibe: "Bright and precise" },
  { id: "d0f16d86f51349d59f69a36d25ea64ae", label: "Aria",    gender: "female", vibe: "Clean, confident" },
  { id: "378e8db799294f2193747f825a471a1d", label: "Faye",    gender: "female", vibe: "Cool, quietly intense" },
  // Female — casual, mature
  { id: "e51c3314b71241a892387e6804b45c2c", label: "Sienna",  gender: "female", vibe: "Easy, lived-in warmth" },
  { id: "6d7ebc02cb674c31a68d7e2a88cf9c9a", label: "Honey",   gender: "female", vibe: "Soft and inviting" },
  { id: "eb5d97bf9f0b414d8809c3197266f280", label: "Coco",    gender: "female", vibe: "Playful, knowing" },
  { id: "bfb3a799c9474c28bea76de34c7a4b9a", label: "Pearl",   gender: "female", vibe: "Round, friendly, open" },
  // Female — casual, young
  { id: "62815b53043c4be8adc565a2c7a27117", label: "Luna",    gender: "female", vibe: "Light, sweet, close" },
  { id: "2e064c4c5f4f4523a69e964c09ef996e", label: "Ember",   gender: "female", vibe: "Warm spark, a little flirty" },
  { id: "d0d57d627c044da1ba1f2012a3b15a6a", label: "Pip",     gender: "female", vibe: "Young, bubbly, soft" },
  // Female — special
  { id: "bb1c525033da40da88153a8106144f31", label: "Whisper", gender: "female", vibe: "Breath on the mic" },
  { id: "44bef56c84ad458ebe78b8c2eb74bb83", label: "Oracle",  gender: "female", vibe: "Mystic, slow, otherworldly" },
  // Male — serious, mature
  { id: "9344dc514b6a47dbb296fea1c0b11312", label: "Atlas",   gender: "male",   vibe: "Deep, grounded, certain" },
  { id: "047c93388dc54d2a9039bc7906a9cd9f", label: "Onyx",    gender: "male",   vibe: "Dark gravel, slow burn" },
  { id: "949309c754a64dd39f98c61e94828471", label: "Slate",   gender: "male",   vibe: "Measured, executive calm" },
  // Male — serious, young
  { id: "6ac384bc5abd45eca19cdb55b340f346", label: "Jett",    gender: "male",   vibe: "Crisp, fast, switched-on" },
  { id: "14c13e72d4644b0dbd2f147df20f6d80", label: "Cole",    gender: "male",   vibe: "Clear and direct" },
  // Male — casual, mature
  { id: "f82cdc6a72b541fa91b008bfdf329748", label: "Marlow",  gender: "male",   vibe: "Relaxed, charming, worn-in" },
  { id: "da0ffe0ea4894d4c8d98aa08de8291d7", label: "River",   gender: "male",   vibe: "Smooth, unbothered" },
  { id: "5ba5e709d5484462bb634052b8432277", label: "Flint",   gender: "male",   vibe: "Rough edge, good humor" },
  // Male — casual, young
  { id: "2d88752727554003b2c42af28d2b9d17", label: "Ash",     gender: "male",   vibe: "Friendly, quick to laugh" },
  { id: "9757c85bfc1147b9851dda6f7f61b68a", label: "Drift",   gender: "male",   vibe: "Laid-back, late-night" },
  // Male — special
  { id: "90ce7a70e52e46088217cd4bd383a4a4", label: "Critic",  gender: "male",   vibe: "Dry, surgical, unsparing" },
]

export function voiceLabelFor(voiceId?: string): string | undefined {
  if (!voiceId) return undefined
  return VOICE_CATALOG.find((v) => v.id === voiceId)?.label
}

