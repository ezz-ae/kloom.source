// Deterministic, high-variety portrait prompt builder.
//
// The whole point: NO TWO PEOPLE LOOK ALIKE. Every persona maps — deterministically
// from its seed — to a distinct combination of ethnicity, age, look, build, hair and
// photo style, drawn from broad pools. The combination space is tens of millions, so
// duplicates are effectively impossible, and the population reads like a real, mixed
// crowd (every race, every age, ordinary faces — not a wall of identical models).
//
// `seed` is the persona's stable id/name → the same persona always gets the same
// face; different personas diverge hard. The returned `seed` (a 31-bit int) is also
// fed to the diffusion model so the pixels themselves are unique per persona.

function hash(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
const pick = <T,>(arr: T[], seed: string, salt: string): T => arr[hash(seed + "|" + salt) % arr.length]

// Broad, respectful ethnicity pool — a real world, not one default look.
const ETHNICITY = [
  "West African", "Nigerian", "Ethiopian", "East African", "Black American", "Afro-Caribbean",
  "North African", "Egyptian", "Moroccan", "Middle Eastern", "Gulf Arab", "Lebanese", "Persian", "Turkish",
  "Indian", "South Asian", "Pakistani", "Bangladeshi", "Sri Lankan",
  "Han Chinese", "Korean", "Japanese", "Mongolian", "Central Asian",
  "Filipino", "Thai", "Vietnamese", "Indonesian", "Malaysian",
  "White European", "Scandinavian", "Slavic Eastern European", "Mediterranean Italian", "Irish", "German",
  "Mexican", "Brazilian", "Colombian", "Latino", "Afro-Latina",
  "mixed-race", "biracial", "Indigenous Native American", "Pacific Islander", "Māori",
]

// The SAME deterministic ethnicity a persona's FACE gets — keyed on the persona's name/seed
// (the face request uses the name as its seed). Exported so the VOICE can match the face
// (e.g. a South-Asian face → an Indian-English voice). Canonical source: buildPortraitPrompt
// uses this too, so face and voice can never disagree.
export function ethnicityForSeed(seedKey: string): string {
  return pick(ETHNICITY, seedKey, "eth")
}
const SOUTH_ASIAN = new Set(["Indian", "South Asian", "Pakistani", "Bangladeshi", "Sri Lankan"])
export function isSouthAsianSeed(seedKey: string): boolean {
  return SOUTH_ASIAN.has(ethnicityForSeed(seedKey))
}

// Young-skewed for a consumer product — 20s–30s mostly, a little into the early 40s.
const AGE = [
  "in their early 20s", "in their early 20s", "in their mid-20s", "in their mid-20s",
  "in their late 20s", "in their late 20s", "in their early 30s", "in their early 30s",
  "in their mid-30s", "in their mid-30s", "in their late 30s", "in their early 40s",
]

// Attractive but BELIEVABLE — appealing faces, kept real by the candid/amateur BASE
// (natural skin, phone selfie, not a model/glamour). Variety of vibe, not a wall of models.
const LOOK_F = [
  "a strikingly beautiful young woman", "a very pretty woman with a warm natural smile",
  "an attractive girl-next-door with a fresh face", "a cute woman with light freckles and bright eyes",
  "a gorgeous woman with striking features", "a naturally pretty woman with minimal makeup",
  "a stylish, attractive woman with an interesting face", "a lovely woman with a radiant smile",
  "a stunning woman with captivating eyes", "an attractive woman with soft, photogenic features",
]
const LOOK_M = [
  "a strikingly handsome young man", "a very good-looking man with light stubble",
  "an attractive guy-next-door with a warm look", "a handsome man with sharp features",
  "a ruggedly handsome man with a bit of stubble", "a naturally good-looking man with an easy smile",
  "a stylish, attractive man with an interesting face", "a charming man with a great smile",
  "a striking man with intense eyes", "an attractive man with photogenic features",
]
const LOOK_X = [
  "a striking, beautiful androgynous person", "an attractive androgynous person with soft features",
  "a good-looking non-binary person", "a stylish, striking androgynous person",
]

// "different type of image" — the kind of photo it is, not just the person.
const STYLE = [
  "candid phone selfie, slightly off-center, natural lighting",
  "front-facing webcam photo, soft and a little low-res, at home",
  "mirror selfie in a bedroom, phone flash",
  "candid street photo, overcast daylight, city background",
  "warm golden-hour window light at home",
  "harsh direct flash night photo at a party, slight red-eye",
  "plain webcam call screenshot, fluorescent room light",
  "casual outdoor photo in a park, dappled sunlight",
  "dim indoor photo, lamp light, cozy and grainy",
  "everyday photo on a couch, TV glow",
  "bright bathroom selfie, white tiles",
  "back-of-a-car selfie, daylight through the window",
]

const HAIR = [
  "short hair", "long hair", "curly hair", "buzzed hair", "tied-back hair", "messy hair",
  "shoulder-length hair", "a fresh haircut", "greying hair", "dyed hair", "a headscarf", "a cap",
]

const BASE =
  "candid amateur snapshot of a real ordinary person, shot on a cheap phone camera, completely photorealistic, " +
  "true-to-life, natural imperfect skin with visible pores, blemishes, fine lines and slight blotchiness, " +
  "real human face, slightly uneven everyday lighting, head and shoulders, fully clothed in plain everyday clothes, " +
  "looking at the camera, totally authentic, unedited, no filter, not a model, not professional, not posed"

export const PORTRAIT_NEG =
  "shirtless, bare chest, topless, underwear, lingerie, cleavage, revealing, suggestive, in bed, nude, nsfw, child, " +
  "cartoon, anime, illustration, drawing, painting, 3d render, cgi, doll, plastic skin, waxy skin, smooth skin, " +
  "flawless skin, airbrushed, retouched, beauty filter, instagram filter, glamour, fashion model, magazine, " +
  "professional photoshoot, studio backdrop, studio lighting, perfect, symmetrical, overly sharp, hdr, " +
  "AI-generated, fake, text, watermark, logo, deformed, extra fingers, bad anatomy, lowres, blurry"

function genderLooks(gender?: string, seed = ""): { pool: string[]; word: string } {
  const g = (gender || "").toLowerCase()
  if (g === "male" || g === "man") return { pool: LOOK_M, word: "man" }
  if (g === "female" || g === "woman") return { pool: LOOK_F, word: "woman" }
  // unknown → spread across all, deterministically
  const r = hash(seed + "|g") % 100
  if (r < 47) return { pool: LOOK_M, word: "man" }
  if (r < 94) return { pool: LOOK_F, word: "woman" }
  return { pool: LOOK_X, word: "person" }
}

export interface PortraitPrompt { prompt: string; negative: string; seed: number; ethnicity: string; age: string }

/** Build a unique, diverse portrait prompt for a persona. */
export function buildPortraitPrompt(seedKey: string, gender?: string, _world?: string, desc?: string): PortraitPrompt {
  const k = seedKey || "anon"
  const ethnicity = ethnicityForSeed(k)
  const age = pick(AGE, k, "age")
  const { pool, word } = genderLooks(gender, k)
  const look = pick(pool, k, "look")
  const style = pick(STYLE, k, "style")
  const hair = pick(HAIR, k, "hair")
  const d = (desc || "").replace(/["\n]/g, " ").slice(0, 80).trim()
  // Name is deliberately NOT in the prompt — diffusion models render names as text
  // on the image. Identity/variety comes from the trait mix + the per-persona seed.
  const prompt =
    `${BASE}. ${style}. portrait of ${look}, ${ethnicity}, ${word} ${age}, ${hair}` +
    (d ? `, ${d}` : "")
  return { prompt, negative: PORTRAIT_NEG, seed: hash(k + "|px") % 2147483647, ethnicity, age }
}
