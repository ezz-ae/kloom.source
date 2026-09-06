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
  "an attractive young woman with a warm crooked smile and slightly uneven eyebrows",
  "a beautiful young woman with freckles across her nose and bright direct eyes",
  "a pretty young woman with a soft round face and an easy grin",
  "an attractive young woman with high cheekbones and a quiet half-smile",
  "a beautiful young woman with strong brows, bare skin and a direct look",
  "an attractive young woman with slightly messy hair and no makeup",
  "a pretty young woman with a sharp nose, thin lips and an amused expression",
  "an attractive young woman with a wide smile and laughing eyes",
  "a beautiful young woman with a slightly crooked nose and a knowing look",
  "an attractive young woman with a strong jaw and warm eyes",
]
const LOOK_M = [
  "an attractive young man with stubble and a slightly crooked nose",
  "a handsome young man with messy hair and an easy grin",
  "an attractive young man with a heavy brow and a steady look",
  "a handsome young man with light stubble and a wide smile",
  "an attractive young man with a soft jaw, freckles and a quiet expression",
  "a handsome young man with a strong nose and a crooked smile",
  "an attractive young man with thick eyebrows and a lopsided smile",
  "a handsome young man with a shaved head and a sharp jawline",
  "an attractive young man with a round face, warm eyes and no styling",
  "a handsome young man with dark eyes and an unpolished look",
]
const LOOK_X = [
  "an attractive young androgynous person with bare skin and an unreadable expression",
  "a good-looking young androgynous person with a crooked smile and messy hair",
  "an attractive young non-binary person with freckles and a direct gaze",
  "a good-looking young androgynous person with strong brows and fine features",
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
  "short hair", "long hair", "curly hair", "wavy hair", "tied-back hair", "messy hair",
  "shoulder-length hair", "a fresh haircut", "bleached hair", "dyed hair", "a headscarf", "a cap",
]

const BASE =
  // "cinematic color grade" and "sharp focus" were asking for the exact glossy
  // render the floor is trying not to look like. A real photo has one plane in
  // focus, imperfect skin, and whatever colour the room happened to be.
  // "blemishes and stray hairs" is what put acne and moles across every face, and
  // it was in the BASE — applied to EVERY portrait, on top of whatever flaw the
  // look already named. Two imperfections stacked read as character; five read as
  // a dermatology reference. Skin texture is the thing worth asking for; damage
  // is not. "Ordinary everyday adult" did the rest of it: asked for plain, got
  // plain. The people here are meant to be attractive AND real, and dropping
  // "attractive" was not the way to stop them looking generated — the superlatives
  // were ("strikingly beautiful", "flawless"), and those are still gone.
  "amateur photograph, shot on a phone, unretouched, natural skin texture with visible pores, " +
  "one single real human face with two clear symmetric correctly-placed eyes and natural undistorted features, " +
  "head and shoulders with space around the head, available light, slight sensor noise, " +
  // An ordinary, completely fictional stranger — NOT a celebrity/model likeness. Diffusion
  // models reproduce recognizable famous faces when prompted "gorgeous/stunning/model"; this
  // steers to a unique everyday person nobody would recognize (likeness-rights safety).
  "an attractive real person photographed casually, a completely fictional unique stranger with a natural face"

export const PORTRAIT_NEG =
  // THE SAFETY TERMS STAY, EXACTLY AS THEY ARE. child/minor/underage/teenager are
  // a hard floor and nothing below is allowed to weaken them.
  //
  // "young-looking" used to sit in this list and it did not belong: it is not a
  // safety term, it is an aesthetic one, and it negates precisely the people the
  // AGE pool asks for. Every persona is described as "in their early 20s" or
  // "mid-20s" and the negative was simultaneously pushing away from anyone who
  // looks young — so the model resolved the contradiction the only way it could,
  // by ageing everyone up. A 22-year-old is young-looking; that is what 22 is.
  "child, minor, underage, teenager, " +
  // The counterweight, now that nothing is fighting youth by accident. These are
  // what the de-glamming pass drifted toward when its imperfections were read as
  // age rather than as texture.
  // NOT "middle-aged": the AGE pool legitimately says "early 40s", and a negative
  // that contradicts the positive is the exact bug being fixed two lines up.
  // Only terms no persona is ever described as belong here.
  "elderly, old person, wrinkled, deep wrinkles, aged skin, " +
  "grey hair, balding, sagging skin, liver spots, " +
  // The over-correction: asking for "unretouched" and "blemishes" produced skin
  // damage rather than skin texture. These name the damage explicitly. Nothing
  // here contradicts a look — the flaw words the looks DO use (crooked, freckles,
  // uneven, stubble) are deliberately absent, because a negative that fights the
  // positive is the bug that aged everyone up two commits ago.
  "acne, pimples, spots, skin blemishes, moles, warts, skin lesions, rash, scabs, " +
  "bad teeth, damaged teeth, missing teeth, discoloured teeth, " +
  "extreme close-up, face filling the frame, cropped forehead, unattractive, "
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

/**
 * A fingerprint of the PROMPT ITSELF, and the reason it exists is a bug that cost
 * two rounds of "the faces are still wrong".
 *
 * Portraits are cached by path, and the path carried a hand-bumped REALISM_VERSION.
 * That meant every prompt change depended on somebody remembering to bump a string
 * — and worse, on that string not being pinned somewhere else. It was: Vercel had
 * REALISM_VERSION=r3 set, which silently won over the code default, so the
 * de-glamming pass AND the age fix both wrote to a cache key that never moved.
 * Production kept serving the same faces and nothing anywhere said why.
 *
 * So the key now derives from the prompt. Change a look, a style, an age band or
 * the negative, and the fingerprint changes with it — automatically, with nothing
 * to remember and no environment variable able to pin it. A prompt that has not
 * changed still hits cache, so this costs nothing when nothing has changed.
 */
export const PROMPT_FINGERPRINT = (() => {
  const all = [
    ...AGE, ...LOOK_F, ...LOOK_M, ...LOOK_X, ...STYLE, ...HAIR, ...ETHNICITY,
    BASE, PORTRAIT_NEG,
  ].join("|")
  return hash(all).toString(36).slice(0, 6)
})()

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
  // "adult" is stated OUTRIGHT, not left to be inferred from the age phrase.
  //
  // The AGE pool starts at "in their early 20s", which every diffusion engine
  // read as an adult. The Google engine does not always: on a sample of new
  // faces one came back young enough to read as a teenager from the identical
  // prompt. The negative list already refuses child/minor/underage/teenager, and
  // this is the positive half of that same floor — the two work together, and
  // neither is enough on its own with a model that interprets differently.
  //
  // It costs one word and it is not a style choice, so it stays regardless of
  // which engine is in play.
  const prompt =
    `${BASE}. ${style}. portrait of an adult ${look}, ${ethnicity}, ${word} ${age}, clearly of adult age, ${hair}` +
    (d ? `, ${d}` : "")
  return { prompt, negative: PORTRAIT_NEG, seed: hash(k + "|px") % 2147483647, ethnicity, age }
}
