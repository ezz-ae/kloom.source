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
// WHO THEY LOOK LIKE.
//
// These used to be superlatives — "strikingly beautiful", "drop-dead gorgeous",
// "perfect features", "perfect bone structure". Those words ARE the plastic AI
// look: a diffusion model reads them as "render the average of every retouched
// magazine cover", and returns flawless symmetric skin under studio light that
// nobody believes for a second. The floor is meant to feel like real people who
// happen to be attractive, not like a stock library.
//
// So: attractive, specific, and IMPERFECT. A crooked smile and a gap in the
// teeth do more for "she's real" than any amount of "stunning".
const LOOK_F = [
  "an attractive woman with a warm crooked smile and slightly uneven eyebrows",
  "a good-looking woman with freckles across her nose and tired kind eyes",
  "a pretty woman with a small gap in her front teeth and a lopsided grin",
  "an attractive woman with a soft round face and a mole on her cheek",
  "a good-looking woman with strong brows, bare skin and a direct look",
  "an attractive woman with slightly frizzy hair and no makeup",
  "a pretty woman with a sharp nose, thin lips and an amused expression",
  "an attractive woman with faint acne scars and a genuine open smile",
  "a good-looking woman with heavy eyelids and a knowing half-smile",
  "an attractive woman with a wide jaw, faint laugh lines and warm eyes",
]
const LOOK_M = [
  "an attractive man with stubble, a crooked nose and tired eyes",
  "a good-looking man with a receding hairline and an easy grin",
  "an attractive man with a heavy brow and a small scar through one eyebrow",
  "a good-looking man with uneven stubble and slightly gapped teeth",
  "an attractive man with a soft jaw, freckles and a quiet expression",
  "a good-looking man with laugh lines and a broken-looking nose",
  "an attractive man with thick messy eyebrows and a lopsided smile",
  "a good-looking man with a shaved head and a faint chin scar",
  "an attractive man with a round face, warm eyes and no styling",
  "a good-looking man with sun-damaged skin and an unpolished look",
]
const LOOK_X = [
  "an attractive androgynous person with bare skin and an unreadable expression",
  "a good-looking androgynous person with a crooked smile and messy hair",
  "an attractive non-binary person with freckles and heavy eyelids",
  "a good-looking androgynous person with strong brows and a faint scar",
]

// HOW IT WAS SHOT.
//
// Ring lights, phone flash and "glamorous" were half the problem: they are studio
// direction, and a diffusion model given studio direction returns a studio
// photograph. Available light, wrong white balance and a slightly bad camera are
// what make an image read as something a person actually took.
const STYLE = [
  "snapshot on an old phone, available light, slightly underexposed",
  "candid photo, harsh overhead kitchen light, unflattering and real",
  "bedroom photo at night, one lamp, heavy shadow on one side",
  "mirror selfie, smudged mirror, mixed indoor light, mildly blurry",
  "photo taken by a friend, off-centre, motion blur on the edges",
  "early morning light through a dirty window, no makeup",
  "photo in a car, overcast daylight through the windscreen",
  "hallway light at 2am, grainy, slightly out of focus",
  "sofa photo, television glow, casual and unposed",
  "photo on a balcony, flat grey daylight, wind in the hair",
  "back of a taxi at night, passing streetlights, uneven exposure",
  "bathroom light, cold white bulb, plain and unretouched",
]

const HAIR = [
  "short hair", "long hair", "curly hair", "buzzed hair", "tied-back hair", "messy hair",
  "shoulder-length hair", "a fresh haircut", "greying hair", "dyed hair", "a headscarf", "a cap",
]

const BASE =
  // "cinematic color grade" and "sharp focus" were asking for the exact glossy
  // render the floor is trying not to look like. A real photo has one plane in
  // focus, imperfect skin, and whatever colour the room happened to be.
  "amateur photograph, shot on a phone, unretouched, natural uneven skin with pores, blemishes and stray hairs, " +
  "one single real human face with two clear symmetric correctly-placed eyes and natural undistorted features, " +
  "head and shoulders, imperfect framing, available light, slight sensor noise, " +
  // An ordinary, completely fictional stranger — NOT a celebrity/model likeness. Diffusion
  // models reproduce recognizable famous faces when prompted "gorgeous/stunning/model"; this
  // steers to a unique everyday person nobody would recognize (likeness-rights safety).
  "an ordinary everyday adult, a completely fictional unique stranger with a normal realistic asymmetric face"

export const PORTRAIT_NEG =
  "child, minor, underage, teenager, young-looking, " +
  // Anti-likeness: keep generated faces from resembling any real, recognizable person.
  "celebrity, famous person, public figure, well-known model, recognizable actor, actress, " +
  "influencer, deepfake, likeness of a real person, lookalike, supermodel, fashion-model face, " +
  "cartoon, anime, illustration, drawing, painting, 3d render, cgi, doll, plastic skin, waxy skin, " +
  // The "it looks so AI" cluster, named explicitly. Everything here is something
  // a generator adds when it is trying to make a picture PRETTY rather than real.
  "airbrushed, retouched, beauty filter, instagram filter, smooth flawless skin, poreless, " +
  "studio lighting, ring light, softbox, professional headshot, glamour shot, magazine cover, " +
  "hdr, oversaturated, heavy color grade, perfect symmetry, symmetrical face, " +
  "text, watermark, logo, deformed, disfigured, distorted face, melted features, " +
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
