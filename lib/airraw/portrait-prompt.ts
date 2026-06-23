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

const AGE = [
  "in their early 20s", "in their mid-20s", "in their late 20s",
  "in their early 30s", "in their mid-30s", "in their late 30s",
  "in their 40s", "in their late 40s", "in their early 50s", "in their late 50s",
  "around 60", "in their 60s",
]

// Ordinary spread — most people are NOT models. Mix of plain, real, striking, rugged.
const LOOK_F = [
  "an ordinary, real-looking woman, girl-next-door", "a plain but warm-faced woman",
  "an average-looking woman with a relatable face", "a strikingly beautiful woman",
  "a cute woman with light freckles and little makeup", "a tired but kind-looking woman",
  "a stylish woman with an unconventional, interesting face", "a heavier-set woman with a lovely smile",
  "a thin woman with sharp features", "a woman with a round, soft face",
]
const LOOK_M = [
  "an ordinary, everyday-looking man", "an average guy with a relatable face",
  "a man with stubble and a real, warm look", "a strikingly handsome man",
  "a regular guy, a little awkward and genuine", "a rugged older man with a character-filled face",
  "a stylish guy with an unconventional face", "a heavier-set man with a friendly face",
  "a thin man with tired eyes", "a balding man with a kind face",
]
const LOOK_X = [
  "an ordinary-looking androgynous person", "a striking androgynous person",
  "a real, everyday non-binary person", "a soft-featured androgynous person",
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
  const ethnicity = pick(ETHNICITY, k, "eth")
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
