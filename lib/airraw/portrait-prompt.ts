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

// Sexy and attractive — adult platform, adults looking appealing and sensual.
const LOOK_F = [
  "a strikingly beautiful young woman with sultry eyes and full lips",
  "a gorgeous sexy woman with a seductive smile and captivating gaze",
  "a hot girl-next-door with a flirtatious look and perfect skin",
  "a beautiful woman with a curvy figure and alluring expression",
  "a stunning woman with bedroom eyes and a natural seductive presence",
  "a pretty woman with an inviting smile and confident sensual look",
  "an incredibly attractive woman with a teasing playful expression",
  "a sexy woman with smoldering eyes and a flirtatious smirk",
  "a drop-dead gorgeous woman with a confident intimate gaze",
  "a beautiful seductive woman with soft lips and magnetic presence",
  "a ravishing woman with natural curves and a come-hither look",
  "a hot young woman with perfect features and a bold flirty attitude",
]
const LOOK_M = [
  "a strikingly handsome muscular man with intense eyes",
  "a very good-looking man with a chiseled jaw and magnetic presence",
  "a ruggedly attractive man with a confident sexy look",
  "a hot guy with sharp features and a smoldering gaze",
  "a handsome well-built man with a seductive confident smile",
  "a strikingly attractive man with deep eyes and strong features",
  "a sexy man with a sculpted face and charismatic bold expression",
  "a gorgeous man with a flirtatious charming look",
  "a tall dark handsome man with intense penetrating eyes",
  "an incredibly attractive man with a powerful confident aura",
]
const LOOK_X = [
  "a strikingly beautiful androgynous person with an alluring mysterious look",
  "a gorgeous androgynous person with soft sensual features",
  "a sexy non-binary person with a captivating bold presence",
  "a stunning androgynous person with smoldering eyes and perfect bone structure",
]

// Photo style — mix of real/candid with intimate/sensual settings.
const STYLE = [
  "mirror selfie in a bedroom, phone flash, intimate setting",
  "low-light boudoir photo, warm lamp glow, sensual mood",
  "candid phone selfie, slightly off-center, natural lighting",
  "warm golden-hour bedroom window light, soft and intimate",
  "dim indoor photo, lamp light, cozy bedroom atmosphere",
  "bathroom selfie after a shower, steamy mirror, wrapped in a towel",
  "night club photo, neon lighting, glamorous and seductive",
  "hotel room selfie, professional look, confident",
  "evening webcam photo, ring light, flirtatious expression",
  "couch selfie at night, phone glow, relaxed intimate mood",
  "rooftop party photo at night, city lights bokeh",
  "beach photo, golden sunlight, relaxed and confident",
]

const HAIR = [
  "short hair", "long hair", "curly hair", "buzzed hair", "tied-back hair", "messy hair",
  "shoulder-length hair", "a fresh haircut", "greying hair", "dyed hair", "a headscarf", "a cap",
]

const BASE =
  "ultra realistic portrait photograph, completely photorealistic, true-to-life, natural skin with visible pores, " +
  "one single real human face with two clear symmetric correctly-placed eyes and natural undistorted features, " +
  "head and shoulders or bust shot, looking at the camera, authentic, cinematic color grade, sharp focus on eyes, " +
  // An ordinary, completely fictional stranger — NOT a celebrity/model likeness. Diffusion
  // models reproduce recognizable famous faces when prompted "gorgeous/stunning/model"; this
  // steers to a unique everyday person nobody would recognize (likeness-rights safety).
  "an ordinary attractive everyday adult, a completely fictional unique stranger with a normal realistic face, intimate mood"

export const PORTRAIT_NEG =
  "child, minor, underage, teenager, young-looking, " +
  // Anti-likeness: keep generated faces from resembling any real, recognizable person.
  "celebrity, famous person, public figure, well-known model, recognizable actor, actress, " +
  "influencer, deepfake, likeness of a real person, lookalike, supermodel, fashion-model face, " +
  "cartoon, anime, illustration, drawing, painting, 3d render, cgi, doll, plastic skin, waxy skin, " +
  "airbrushed, retouched, text, watermark, logo, deformed, disfigured, distorted face, melted features, " +
  "asymmetric eyes, misaligned eyes, extra eye, mutated, glitch, double face, extra fingers, bad anatomy, lowres, blurry"

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
