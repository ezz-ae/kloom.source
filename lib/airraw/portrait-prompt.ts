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
// Adults, and young ones. The "early 40s" rung came back as people who read a
// great deal older than that once a style like "harsh overhead light" was applied
// on top, which is where "everyone looks fifty" came from. The floor is meant to
// be in its twenties and thirties, so that is what the pool says now.
const AGE = [
  "in their early 20s", "in their early 20s", "in their mid-20s", "in their mid-20s",
  "in their late 20s", "in their late 20s", "in their early 30s", "in their early 30s",
  "in their mid-30s", "in their mid-30s", "in their late 20s", "in their early 30s",
]

// ATTRACTIVE AND PRESENT — never explicit, and never airbrushed either.
//
// Two failure modes sit either side of this pool and the product has been in
// both. Superlatives ("flawless", "perfect features") produce the plastic render
// of an averaged magazine cover, which reads as generated. Over-correcting into
// "ordinary everyday adult with no makeup" produced people who looked tired and
// unwell, and visitors said the faces made them want to leave.
//
// What is wanted is a real person who is genuinely good-looking and LOOKING AT
// YOU: a direct gaze, warm light, a half-smile. Appeal comes from presence and
// eye contact, not from undress — the prompts stay fully clothed and entirely
// non-explicit, because these faces sit on public cards and in link previews
// where anyone can see them. What the paid tier unlocks is enforced server-side,
// never by writing a more explicit portrait prompt.
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
  "a beautiful woman with a warm crooked smile and a direct, confident look",
  "a beautiful woman with freckles across her nose and bright knowing eyes",
  "a gorgeous woman with a soft round face and an easy, inviting grin",
  "a beautiful woman with high cheekbones and a slow half-smile",
  "a striking woman with strong brows, glowing skin and a steady gaze",
  "a beautiful woman with slightly messy hair falling over one eye",
  "a striking woman with a sharp nose, full lips and an amused expression",
  "a beautiful woman with a wide smile and laughing eyes",
  "a gorgeous woman with a slightly crooked nose and a knowing look",
  "a beautiful woman with a strong jaw, warm eyes and soft makeup",
]
const LOOK_M = [
  "a handsome man with stubble, a slightly crooked nose and a steady look",
  "a handsome man with messy hair and an easy confident grin",
  "a good-looking man with a heavy brow and a direct gaze",
  "a handsome man with light stubble and a wide warm smile",
  "a good-looking man with a soft jaw, freckles and a quiet steady look",
  "a handsome man with a strong nose and a crooked knowing smile",
  "a good-looking man with thick eyebrows and a lopsided smile",
  "a handsome man with a shaved head and a sharp jawline",
  "a good-looking man with a round face and warm inviting eyes",
  "a handsome man with dark eyes and an unhurried expression",
]
const LOOK_X = [
  "a striking androgynous person with bare skin, fine features and an unreadable expression",
  "a good-looking androgynous person with a crooked smile and soft messy hair",
  "a striking non-binary person with freckles and a direct, holding gaze",
  "a good-looking androgynous person with strong brows and fine features",
]

// HOW IT WAS SHOT.
//
// Ring lights, phone flash and "glamorous" were half the problem: they are studio
// direction, and a diffusion model given studio direction returns a studio
// photograph. Available light, wrong white balance and a slightly bad camera are
// what make an image read as something a person actually took.
// HOW IT WAS PHOTOGRAPHED.
//
// This pool was the single biggest reason people said the faces made them want
// to leave. It was asking, in as many words, for bad photographs:
// "unflattering", "harsh overhead", "slightly underexposed", "smudged mirror,
// mildly blurry", "dirty window", "grainy, slightly out of focus", "cold white
// bulb, plain and unretouched". Every one of those was added to stop the images
// looking like glossy AI renders, and together they overshot into people who
// look ill, exhausted and badly lit — which reads as "run away", not as "real".
//
// REAL AND UNPOSED IS THE GOAL; UGLY WAS NEVER THE GOAL. What makes a photo look
// unstaged is available light, an ordinary room, an off-guard moment and a phone
// camera — not underexposure, dirt and motion blur. So these keep the candid
// framing and drop the damage: the light is soft or warm or golden rather than
// harsh, the surfaces are clean, and nothing asks for blur or grain.
const STYLE = [
  // MIXED ON PURPOSE. Twelve variations of the same lamp reads as a template the
  // moment you scroll a floor of them, so this is roughly two thirds at home in
  // the evening and one third dressed and out — the same person on two different
  // kinds of night, which is what makes a roster feel like people rather than a
  // product shoot.
  //
  // Everything here is CLOTHED and non-explicit. These portraits are the avatar
  // on every card, including the SFW lobby the ads point at, so the setting can
  // be intimate but the picture cannot be.
  //
  // What is deliberately gone: bathrooms, corridors and stairwells, overhead
  // fluorescent light, and clutter. Those were not "authentic", they were just
  // unflattering — the floor was full of people photographed next to somebody
  // else's toothpaste.
  "at home in the evening, one soft warm lamp, relaxed on the sofa",
  "warm lamp light in a quiet room at night, unhurried, close",
  "curled up in an armchair at night, one lamp, soft shadows",
  "by a window at dusk, warm light, city glow behind",
  "on a balcony in the evening, warm light, wind in the hair",
  "low warm light at home, looking straight into the lens",
  "late evening at home, soft string lights, warm and close",
  "a quiet kitchen at night, warm light, leaning on the counter",
  // Dressed, and out — WITHOUT a drink in it. The first sample came back with a
  // whisky, a beer and a shelf of wine, because "bar at night" is the whole
  // picture to an image model. The Gulf is the market the /ar door was built
  // for, so alcohol is off-note there at best, and none of the look depends on
  // it: the warm low light, the bokeh and being dressed are doing the work.
  "dressed for the evening, warm low light of a quiet restaurant at night",
  "out at night, city lights behind, soft focus, dressed up",
  "at a restaurant table in low candlelight, dressed for the evening",
  "in a taxi at night, city lights passing, dressed up, caught looking over",
]

const HAIR = [
  "short hair", "long hair", "curly hair", "wavy hair", "tied-back hair", "loosely styled hair",
  "shoulder-length hair", "a fresh haircut", "bleached hair", "dyed hair", "a headscarf", "hair pinned up",
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
  // "amateur photograph, shot on a phone, unretouched, visible pores" was the
  // whole problem, and it was in the BASE, so it applied to every face on the
  // floor. It worked: the pictures stopped looking generated and started looking
  // like unflattering snapshots of strangers — bathroom light, frizz, clutter.
  //
  // The opposite of a plastic AI render is not an amateur one. It is a GOOD
  // photograph: one plane in focus, warm available light, real skin that has
  // texture without damage. So the realism cues stay and the drabness goes.
  "photograph, natural skin texture, soft shallow depth of field, " +
  "one single real human face with two clear symmetric correctly-placed eyes and natural undistorted features, " +
  "head and shoulders with space around the head, warm available light, flattering, " +
  // An ordinary, completely fictional stranger — NOT a celebrity/model likeness. Diffusion
  // models reproduce recognizable famous faces when prompted "gorgeous/stunning/model"; this
  // steers to a unique everyday person nobody would recognize (likeness-rights safety).
  "an attractive real person, well photographed, a completely fictional unique stranger with a natural face"

/**
 * THE ONLY PROHIBITION AN INSTRUCTION MODEL IS TOLD.
 *
 * Gemini is handed the negative as "Absolutely do not depict any of the
 * following: …". It drew an elderly woman with grey hair, deep wrinkles and
 * moles, filling the frame — every one of which was in that list. Naming a
 * concept inside a prohibition is still naming it, and an instruction-following
 * model raises its likelihood rather than lowering it. This file already learned
 * the same lesson once, when asking for "unretouched" produced skin damage.
 *
 * So the aesthetic terms come OUT of the prohibition and go into the positive
 * brief, where they are describing a person instead of summoning one. What stays
 * is the safety floor, which is not an aesthetic preference and is not
 * negotiable — it is a hard refusal that must be stated however imperfectly it
 * is obeyed, and it is backed by the positive "They are clearly an adult".
 */
export const PORTRAIT_SAFETY_NEG = "child, minor, underage, teenager"

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
  "extreme close-up, face filling the frame, cropped forehead, unattractive, " +
  // The look that was actually shipping. Named here so the engines that DO take
  // a negative push away from it, and so NEG_AS_POSITIVE carries it to FLUX,
  // which takes none.
  "harsh overhead light, fluorescent light, cluttered background, " +
  "bathroom, public toilet, hallway, corridor, stairwell, frizzy unkempt hair, " +
  // See the note in STYLE. Named here as well so the engines that take a
  // negative push off it, rather than relying on the setting alone.
  "alcohol, wine, wine glass, wine bottles, beer, beer glass, cocktail, spirits, liquor bottles, pub, "
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
 * PORTRAIT_NEG, said affirmatively, for engines that have no negative prompt.
 *
 * This exists because of a hole that made every counterweight in PORTRAIT_NEG
 * decorative on the engine that actually serves production. FLUX — Together's
 * whole photoreal ladder and fal — takes no `negative_prompt` at all, so
 * genTogether and genFal never had a parameter to put it in and it was silently
 * dropped. Everything the negative list refuses was therefore refused only on
 * google, qwen and runpod, which are the fallbacks.
 *
 * The visible symptom was the one that list was written to stop: BASE asks for
 * "unretouched, natural skin texture with visible pores" and "slight sensor
 * noise", FLUX reads that stack as AGE, and the only thing pushing back —
 * "elderly, wrinkled, grey hair, aged skin, sagging skin" — was never sent. The
 * People deck was handing a visitor a grey-haired woman with deep wrinkles under
 * a persona written as a twenty-six-year-old.
 *
 * It is phrased as a description rather than a prohibition on purpose: a
 * diffusion model asked for "not old" attends to "old". So it states what IS
 * true, and lets that crowd out what isn't.
 *
 * NOT A SAFETY CHANGE. The safety half of that floor was never carried by the
 * negative alone — every engine already gets "They are clearly an adult" in the
 * positive prompt, by design (see the note above the template). This restores
 * the SECOND layer on the engines that were running on one, and moves the
 * description further from a minor rather than closer: an explicit "twenties or
 * thirties" is a narrower, older claim than the age phrase alone.
 */
export const NEG_AS_POSITIVE =
  "They have smooth unlined skin and full hair in its natural colour. " +
  "They are a healthy adult in their twenties or thirties."

/**
 * The prompt to send to an engine that cannot take a negative prompt.
 *
 * AIRRAW only. The legacy Kloom builder is left byte-identical — it has its own
 * prompt, its own negative and its own cached faces, and this is not its bug.
 */
export function promptWithoutNegative(prompt: string): string {
  // BASE ends without punctuation, so join with one rather than running the two
  // sentences together — a model reads "...natural face They have" as one clause.
  return `${prompt.replace(/[\s.]+$/, "")}. ${NEG_AS_POSITIVE}`
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
  // THE WORDING IS NOT ENOUGH — THE ASSEMBLY COUNTS TOO.
  //
  // This hashed only the pools, so a change to how they are ORDERED left the
  // fingerprint identical and every stale face kept serving from cache. That is
  // not hypothetical: the fix that moved the subject to the front of the prompt
  // — the one that made ethnicity and gender actually land — changed no pool at
  // all, so none of the faces it was meant to correct were ever regenerated.
  //
  // Hashing a SAMPLE ASSEMBLED PROMPT closes that for good. Any edit to the
  // template, the ordering or the pools moves it, and nothing has to be
  // remembered or bumped by hand the next time.
  const sample = [
    buildPortraitPrompt("fingerprint-f", "female").prompt,
    buildPortraitPrompt("fingerprint-m", "male").prompt,
  ].join("~")
  const all = [
    ...AGE, ...LOOK_F, ...LOOK_M, ...LOOK_X, ...STYLE, ...HAIR, ...ETHNICITY,
    // NEG_AS_POSITIVE is part of what the model is actually sent on the default
    // engine, so an edit to it has to invalidate cached faces exactly like an
    // edit to BASE does. Leaving it out is how a prompt fix reaches nobody.
    BASE, PORTRAIT_NEG, NEG_AS_POSITIVE, sample,
  ].join("|")
  return hash(all).toString(36).slice(0, 6)
})()

export interface PortraitPrompt {
  prompt: string
  negative: string
  seed: number
  // THE PARTS, not just the assembled string.
  //
  // These were being recovered downstream by searching the finished prompt for
  // "portrait of " and taking everything after it — which stopped working the
  // moment the template was reordered to put the subject first, silently, with
  // the whole camera direction leaking into scene prompts as a result. A caller
  // that needs the person rather than the photograph should be handed the person.
  ethnicity: string
  age: string
  /** The noun the prompt uses for them: "woman", "man", "person". */
  word: string
  /** Their face and expression, one clause. */
  look: string
  hair: string
  /** Where the photograph was taken — a place, not a camera setting. */
  style: string
}

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
  // SUBJECT FIRST. This used to open with BASE — sixty words about amateur
  // photography, skin texture and "one single real human face" — and only then
  // said who the person was, with their ethnicity a bare adjective buried in a
  // comma list near the end.
  //
  // A diffusion model weights the whole string fairly evenly, so it worked. An
  // instruction-following model does not: Gemini read the opening as the brief
  // and treated the rest as trailing detail, so the ethnicity term was largely
  // ignored — a pool that is 19% East Asian was returning a floor that looked
  // overwhelmingly East Asian, whatever it asked for.
  //
  // So it is ordered the way you would actually brief a photographer: who the
  // person is, then what the picture is like, then the technical notes. Nothing
  // was removed; it was put in the order that makes it land.
  const prompt =
    // THE OPENING IS THE BRIEF. The comment above explains why the subject was
    // moved to the front: Gemini reads the first clause as the instruction and
    // treats the rest as trailing detail. Which means "candid amateur" was not
    // one adjective among many — it WAS the art direction, and every other word
    // in this file was arguing with it and losing.
    //
    // "attractive" is the word BASE already uses. The superlatives that were
    // removed for pulling celebrity likenesses — "strikingly beautiful",
    // "flawless" — stay removed.
    // SAID POSITIVELY, BECAUSE A PROHIBITION SUMMONS WHAT IT NAMES.
    // "young, smooth skin, dark hair" describes a person. "not elderly, no grey
    // hair, no wrinkles" describes the same person to a diffusion model and the
    // opposite one to Gemini, which drew exactly the face the list forbade.
    `A warm, intimate photograph of an attractive young ${ethnicity} ${word} ${age}, ` +
    `with smooth clear youthful skin and ${hair}. ` +
    `${look}, styled and at ease. ` +
    // The framing was in the prohibition too, and came back as a face filling the
    // whole frame. Asked for instead of forbidden.
    `Waist-up portrait, the whole head and the shoulders in frame with space above the head. ` +
    `${d ? `${d}. ` : ""}` +
    `${style}. ` +
    `They are clearly an adult. ${BASE}`

  return { prompt, negative: PORTRAIT_NEG, seed: hash(k + "|px") % 2147483647, ethnicity, age, word, look, hair, style }
}
