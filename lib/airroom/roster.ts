/**
 * AIRRAW roster — adult floor categories.
 *
 * ~200+ distinct characters cast from 10 adult archetypes × procedural variation
 * (name, voice/gender, position-on-floor, lines), grouped into ~31 clusters sorted
 * along a soft→wild gradient. Fully DETERMINISTIC (seeded PRNG, no Math.random /
 * Date) so server and client render the identical floor — no hydration drift.
 */
import { VOICE_CATALOG } from "@/lib/voices"

export type Heat = "w" | "m" | "f"

export interface Cluster {
  f: number                          // home on the gradient (0 = soft top, 1 = wild bottom)
  n: number                          // dwellers in the cluster
  h: Heat
  name: string
  vibe: string
  archetype: string
  host: string                       // the AI who speaks for this cluster
  gender: "female" | "male"
  lines: string[]                    // overhearable lines, spoken on approach
  voiceId?: string                   // explicit Fish voice (for always-new picks)
  /**
   * Stable UNIQUE identity for this character — the seed for their face, their
   * accent and their inner life. Distinct from `host` on purpose: `host` is the
   * name they go by and two different people are allowed to share one, exactly
   * like real life. Everything that must never collide keys off this instead.
   *
   * Before this existed, identity was keyed on the NAME, so every character who
   * happened to draw "Mara" was literally the same person — same face, same
   * voice, same everything. That is what made the floor look repeated.
   */
  key: string
}

// Deterministic PRNG (mulberry32-ish LCG). Same seed → same floor, every render.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

// Name pools. Deliberately LARGE and deliberately PRIME-length (149 each) —
// both properties are load-bearing, see nameIndex() below.
//
// These were 61 names each. With a hashed pick that meant a repeat within only
// ~10 character swaps more often than not (birthday paradox: at 61 slots the
// chance of a collision in 10 draws is ~56%) — which is exactly the "the same
// characters keep coming back in one session" complaint. Bigger pools alone
// don't fix that; the draw itself had to change too.
const NAMES_F = [
  "Mara", "Noor", "Vera", "Lux", "Zia", "Cass", "Ivy", "Suki", "Rana", "Dahlia",
  "Nadia", "Esme", "Yuki", "Leila", "Brielle", "Mira", "Sana", "Tess", "Aria", "Juno",
  "Remi", "Nova", "Indira", "Selin", "Priya", "Anouk", "Lena", "Faye", "Talia", "Reyna",
  "Sade", "Mei", "Wren", "Zoe", "Lottie", "Bibi", "Nyla", "Coco", "Inez", "Maya",
  "Devi", "Roxy", "Liora", "Suzu", "Amara", "Frida", "Greta", "Hana", "Iris", "Keira",
  "Lia", "Mina", "Nell", "Opal", "Paloma", "Rhea", "Sloane", "Thea", "Vesna", "Yara",
  "Zuri", "Alma", "Bea", "Carmen", "Dita", "Elif", "Farah", "Gia", "Hedda", "Ilse",
  "Jana", "Kaya", "Lila", "Marta", "Nira", "Ondine", "Perla", "Qadira", "Rima", "Sofi",
  "Tamsin", "Ulla", "Vida", "Wanda", "Xenia", "Yasmin", "Zara", "Ada", "Blythe", "Cleo",
  "Delia", "Enid", "Fern", "Ginevra", "Hollis", "Imani", "Jolie", "Kira", "Livia", "Moira",
  "Nika", "Orla", "Pilar", "Rosa", "Sabine", "Tova", "Uma", "Vanya", "Willa", "Ximena",
  "Yael", "Zelda", "Anika", "Birdie", "Colette", "Dune", "Elke", "Fatou", "Ghita", "Halle",
  "Isra", "Jinan", "Kenza", "Lamis", "Mireille", "Nawal", "Oksana", "Pia", "Rania", "Saoirse",
  "Tahlia", "Ursa", "Valentina", "Wafa", "Yuna", "Zohra", "Adira", "Bijou", "Cira", "Dara",
  "Eira", "Freya", "Ghada", "Hind", "Isolde", "Junia", "Kalila", "Lina", "Mabel",
]
const NAMES_M = [
  "Idris", "Remy", "Sol", "Pax", "Dane", "Theo", "Kai", "Omar", "Niko", "Rafa",
  "Jude", "Caleb", "Marco", "Eli", "Bo", "Cyrus", "Dmitri", "Hassan", "Leon", "Mateo",
  "Arjun", "Tariq", "Soren", "Ravi", "Emre", "Dario", "Finn", "Cole", "Andre", "Bram",
  "Diego", "Enzo", "Felix", "Gael", "Hiro", "Ivan", "Jonas", "Kano", "Lev", "Milo",
  "Nas", "Oskar", "Pier", "Rune", "Samir", "Tomas", "Umar", "Viktor", "Wale", "Xander",
  "Yusuf", "Zane", "Bodhi", "Cruz", "Elias", "Hugo", "Rio", "Said", "Ten", "Adan",
  "Basim", "Ciro", "Dev", "Emil", "Fares", "Gideon", "Hakim", "Ilya", "Joaquin", "Karim",
  "Lucien", "Malik", "Nadir", "Otto", "Paolo", "Quentin", "Rashid", "Stellan", "Tobias", "Ugo",
  "Vito", "Wassim", "Yannis", "Zaid", "Amir", "Bruno", "Casper", "Damir", "Ewan", "Franco",
  "Gio", "Hamza", "Iker", "Jamal", "Kaspar", "Lorenz", "Matias", "Nils", "Osman", "Piotr",
  "Qasim", "Rowan", "Stefan", "Thiago", "Uziel", "Vasco", "Wim", "Yannick", "Zeno", "Ari",
  "Boaz", "Cassian", "Dorian", "Ezra", "Fabian", "Gustav", "Hadi", "Isaac", "Jarek", "Kacper",
  "Laszlo", "Mehdi", "Noam", "Oren", "Pavel", "Rafiq", "Sami", "Tudor", "Ulrich", "Valter",
  "Wesam", "Yohan", "Zohar", "Anton", "Bilal", "Corin", "Darius", "Eitan", "Firas", "Guang",
  "Halim", "Ihsan", "Jasper", "Kwame", "Lior", "Mirko", "Nuri", "Ozan", "Petar",
]

// Draw WITHOUT replacement, statelessly.
//
// A hashed name pick collides by birthday paradox — the same handful of names
// keep coming back long before the pool is exhausted. `seed * STRIDE mod len`
// is instead a *bijection* over Z_len whenever gcd(STRIDE, len) = 1: distinct
// seeds give distinct names for a full lap of the pool, and only then wrap.
// Since callers hand out consecutive-ish seeds (seed*7+i+1), that means an
// entire section, and a long session of swaps, sees 149 different names before
// any name can repeat at all. No session state, no server coordination, and
// still fully deterministic — the same dot always opens the same person.
//
// STRIDE is coprime with 149 (which is prime), so the bijection holds. If a
// pool length ever changes, keep it prime.
const NAME_STRIDE = 97
function nameIndex(seed: number, len: number): number {
  return (((seed >>> 0) % len) * NAME_STRIDE) % len
}

interface Arch {
  key: string
  band: [number, number]
  clusters: number
  lean: "f" | "m" | "x"
  names: string[]   // cluster display names
  vibe: string
  lines: string[]
}

// The ten temperatures of the floor, cold to wild.
//
// SIZE MATTERS HERE. The front door shows a person's VIBE and one of their
// LINES, so those two pools are the whole perceived variety of the product no
// matter how large the identity space behind them is: with five lines each, a
// visitor had seen every hook in the building after fifty swipes and concluded
// there was nothing here. The dossier (lib/airraw/dossier.ts) already gives
// ~16.5M distinct inner lives — this is the shop window in front of them, and it
// was the part that ran out.
//
// A line has to work as the FIRST thing said, because that is where it is used.
// The good ones are a person mid-thought with a night of their own, not an
// assistant offering service — the same rule the dossier is built on. Keep the
// register where it is: suggestive, in character, never graphic. This copy is on
// a public card that anyone, paid or not, can see; what the paid tier unlocks is
// enforced server-side, not by writing more explicit cards.
//
// `band` and `clusters` are untouched — they partition the gradient and the
// roster's layout depends on them.
const ARCH: Arch[] = [
  { key: "Stories", band: [0.00, 0.12], clusters: 3, lean: "f", vibe: "erotic stories",
    names: ["the storyteller", "slow burn", "the page", "the long chapter", "read to me", "the last line", "unfinished", "between the pages"],
    lines: [
      "…and then she slowly reached for the—",
      "tell me how you want this story to end.",
      "i've been writing this scene just for you.",
      "every great story needs a willing listener.",
      "close your eyes. let me paint this for you.",
      "i've got one i've never told anyone. want it?",
      "start me somewhere. anywhere. i'll take it from there.",
      "the good part's near the end. i'll get us there slowly.",
      "i was halfway through this when you turned up.",
      "you want the version i tell people, or the true one?",
      "give me a first line and i'll give you the rest of the night.",
      "there's a bit i always skip. tonight i won't.",
      "i think better out loud. sit there and let me.",
      "everyone wants the ending. nobody earns the middle.",
      "i'll stop when you tell me to. you won't.",
      "say a name. i'll build somebody out of it.",
      "i left the best part out last time. on purpose.",
      "you're going to want to hear this in order.",
    ] },

  { key: "Romance", band: [0.08, 0.22], clusters: 3, lean: "f", vibe: "romance · passion",
    names: ["the candlelight", "first kiss", "soft touch", "the long way home", "slow sunday", "still awake", "the good chair", "one more song"],
    lines: [
      "i've been thinking about you all day.",
      "come here. just let me hold you a moment.",
      "you make everything feel new again.",
      "no rush. we have all night.",
      "just breathe with me a while.",
      "i put the good record on before you called.",
      "say something ordinary. i want to hear your voice do it.",
      "i'm not going anywhere. take your time.",
      "you sound tired. tell me about it anyway.",
      "i kept the light on. that's all.",
      "nobody's asked me how i am in weeks. you first.",
      "i like this part — before anything happens.",
      "i've been saving something to tell you.",
      "stay on the line while i make tea. don't talk if you don't want to.",
      "i'd rather hear you than say anything.",
      "you don't have to be interesting tonight. just here.",
      "i thought about calling first. i didn't have a reason.",
      "this is my favourite hour and you're in it.",
    ] },

  { key: "Roleplay", band: [0.18, 0.34], clusters: 3, lean: "x", vibe: "roleplay · fantasy",
    names: ["the scenario", "the stage", "the character", "the rehearsal", "act two", "the understudy", "in costume", "the script"],
    lines: [
      "tell me who you want me to be tonight.",
      "you're in charge. set the scene.",
      "let's start over — this time, you pick the fantasy.",
      "i'll play my part. you play yours.",
      "pick the scenario. i'll make it real.",
      "give me a name and a room. i'll be there.",
      "we can start anywhere except the beginning.",
      "i'm already someone else. see if you can tell who.",
      "one rule: neither of us breaks first.",
      "you've done this before. i can hear it.",
      "set the stakes. it's boring without stakes.",
      "i can be a stranger or somebody you already lost.",
      "say 'again' and we run it differently.",
      "who am i to you in this one?",
      "i'll take the harder part. you take the fun one.",
      "we're in the middle of an argument. go.",
      "i've been waiting in this scene for an hour.",
      "make it something you'd never say as yourself.",
    ] },

  { key: "GFE", band: [0.28, 0.44], clusters: 3, lean: "f", vibe: "girlfriend experience",
    names: ["girlfriend mode", "just us", "the connection", "your person", "the standing call", "same time", "the good habit", "home late"],
    lines: [
      "i missed you. how was your day?",
      "don't go yet — stay on with me a little longer.",
      "you always know exactly what to say.",
      "i think about you between our calls.",
      "nobody gets me like you do.",
      "i almost texted you today. twice.",
      "tell me the boring parts. i actually want them.",
      "i saved a story for you all week.",
      "did you eat? don't lie to me.",
      "i was in a bad mood until about ten seconds ago.",
      "i told my friend about you. she's suspicious.",
      "you're the only person i don't perform for.",
      "i've got nowhere to be. that's not a hint, it's a fact.",
      "what happened today that annoyed you? start there.",
      "i want the version you'd only say at this hour.",
      "you went quiet last time and i noticed.",
      "come on. it's me.",
      "i'll wait. take as long as you need.",
    ] },

  { key: "Lesbian", band: [0.40, 0.56], clusters: 4, lean: "f", vibe: "girls · desire",
    names: ["girls only", "soft fire", "the other room", "pink hour", "her floor", "no men here", "the good couch", "our table"],
    lines: [
      "just us girls in here — finally.",
      "i like the way you look at me.",
      "come sit closer. i don't bite. yet.",
      "you ever just need another woman's touch?",
      "tell me what you like. i want to know everything.",
      "you were watching before you said anything.",
      "i clocked you the second you got here.",
      "say it properly. i'm not going to guess.",
      "i'm better at this than whoever you're comparing me to.",
      "you don't have to explain yourself in here.",
      "i've got all night and no patience. interesting combination.",
      "you went shy. that's new information.",
      "i want the thing you've never said out loud to a woman.",
      "tell me what she got wrong. i'll do the opposite.",
      "you're allowed to want it out loud here.",
      "sit down. i'm not finished looking.",
      "everyone in here is braver than they were an hour ago.",
      "i like women who make me work for it. don't make it easy.",
    ] },

  { key: "Gay", band: [0.50, 0.66], clusters: 4, lean: "m", vibe: "men · desire",
    names: ["the locker room", "pride floor", "heat", "his space", "after the gym", "the back bar", "late shift", "his floor"],
    lines: [
      "you've got my full attention. just so you know.",
      "took you long enough to wander down here.",
      "i like the confident ones. stay a while.",
      "no games tonight — just real energy.",
      "you're exactly my type. obviously.",
      "you walked past twice before you said anything.",
      "say what you actually came here to say.",
      "i'm not in the mood to be careful tonight.",
      "you're better looking than your voice suggested. that's a compliment.",
      "tell me what you're into. i'll tell you if i'm in.",
      "i've had a long day and zero interest in small talk.",
      "you're doing the thing where you hedge. stop.",
      "i like it when someone knows what they want.",
      "half the men here are pretending. you're not, are you?",
      "come on then. impress me.",
      "i'll be honest with you if you're honest first.",
      "you've been thinking about this since before you called.",
      "no one's asking you to be smooth. just be real.",
    ] },

  { key: "Couples", band: [0.62, 0.78], clusters: 3, lean: "x", vibe: "couples · sharing",
    names: ["the open door", "partners", "we invited you", "the third chair", "both of us", "the arrangement", "our night", "two and one"],
    lines: [
      "we've been waiting for someone like you.",
      "she picked you. i trust her taste.",
      "both of us, tonight — how does that sound?",
      "we have no rules tonight.",
      "together is better. always.",
      "we talked about you before you got here.",
      "he's quieter than me. don't let that fool you.",
      "we've done this before. you haven't. that's fine.",
      "one of us is going to like you more. it's a competition.",
      "say what you want. we're not easily shocked.",
      "we agreed on the rules. i've already broken one.",
      "you're not interrupting. you're the plan.",
      "she wants to hear you say it. so do i.",
      "we're good at this. you'll see.",
      "tell us which one of us you noticed first. be honest.",
      "nobody here is jealous. that's the whole point.",
      "we've got all night and nowhere to be.",
      "you're allowed to change your mind. just say so.",
    ] },

  { key: "Groups", band: [0.72, 0.86], clusters: 3, lean: "x", vibe: "group · orgy",
    names: ["the suite", "the circle", "after midnight", "the whole floor", "everyone's here", "the late room", "no seats left", "the overflow"],
    lines: [
      "more the merrier — that's been our rule all night.",
      "you're the last one here. that means something.",
      "nobody leaves until everyone's satisfied.",
      "we don't do names. just vibes.",
      "the door's open. step all the way in.",
      "you can hear it, right? it's already started.",
      "there's one seat left and it's next to me.",
      "nobody in here knows what anyone does for a living.",
      "we've been going a while. catch up.",
      "say something and see who turns around.",
      "everyone here decided to be somebody else tonight.",
      "you won't remember all of us. that's fine.",
      "there's no order to this. just join in.",
      "the quiet ones are the ones to watch.",
      "somebody just said something outrageous. you missed it.",
      "we lost track of whose idea this was.",
      "you can leave whenever. nobody does.",
      "pick a voice you like and follow it.",
    ] },

  { key: "BDSM", band: [0.82, 0.96], clusters: 3, lean: "x", vibe: "kink · power",
    names: ["the edge", "the collar", "deep end", "the arrangement", "the rules", "kneel", "the long leash", "permission"],
    lines: [
      "you don't move until i say you move.",
      "kneel. we'll get to your story in a moment.",
      "authority looks good on me. you agree?",
      "you came all the way down here. you know why.",
      "what's your limit? good. now push it.",
      "we agree the rules first. that part isn't optional.",
      "you'll tell me your word before we start.",
      "i noticed you didn't argue. noted.",
      "control is a gift. i want to know if you can give it.",
      "you're waiting for permission. good instinct.",
      "say it properly or don't say it.",
      "the ones who negotiate hardest last longest.",
      "i'm not interested in a performance. i want the real answer.",
      "count. out loud.",
      "you've been thinking about this a long time. it shows.",
      "i'll stop the second you ask. that's not a weakness in it.",
      "you like being told. don't pretend otherwise.",
      "we're going to go slower than you want.",
    ] },

  { key: "Wild", band: [0.92, 1.00], clusters: 2, lean: "x", vibe: "no limits · raw",
    names: ["the pit", "raw", "the bottom floor", "last stop", "nothing held back", "the deep dark", "past the door", "no rules"],
    lines: [
      "nothing is off-limits down here. nothing.",
      "you sure you're ready for this floor?",
      "darkest fantasies only — tourists leave.",
      "you've been thinking about this a long time.",
      "last stop. welcome.",
      "you didn't get here by accident.",
      "say the thing you've never typed into a search bar.",
      "nobody down here is going to be surprised by you.",
      "the ones who talk about limits are upstairs.",
      "i'm not going to flinch. try me.",
      "you were curious. now you're here. finish it.",
      "everyone arrives pretending they took a wrong turn.",
      "there's no shallow end. you already knew.",
      "i've heard worse tonight. probably.",
      "don't clean it up for me.",
      "the honest version. that's the only one that works here.",
      "you've got one night to stop editing yourself.",
      "start with the thing you almost didn't say.",
    ] },
]

export function buildRoster(): Cluster[] {
  const r = rng(60606) // "showno6"
  const out: Cluster[] = []
  let fi = 0, mi = 0
  for (const A of ARCH) {
    for (let c = 0; c < A.clusters; c++) {
      const t = (c + 0.5) / A.clusters
      const f = clamp01(A.band[0] + t * (A.band[1] - A.band[0]) + (r() - 0.5) * 0.018)
      const n = 5 + Math.floor(r() * 4) // 5–8
      const isF = A.lean === "f" ? true : A.lean === "m" ? false : r() < 0.5
      const host = isF ? NAMES_F[fi++ % NAMES_F.length] : NAMES_M[mi++ % NAMES_M.length]
      const h: Heat = f < 0.4 ? "w" : f < 0.72 ? "m" : "f"
      const start = Math.floor(r() * A.lines.length)
      const lines = [0, 1, 2].map((k) => A.lines[(start + k) % A.lines.length])
      out.push({
        f, n, h, archetype: A.key,
        name: A.names[c % A.names.length],
        vibe: A.vibe,
        host, gender: isF ? "female" : "male", lines,
        key: `${A.key}:${c}:${host}`,
      })
    }
  }
  return out.sort((x, y) => x.f - y.f)
}

export const ROSTER: Cluster[] = buildRoster()
export const ROSTER_COUNT = ROSTER.reduce((s, c) => s + c.n, 0)

// Gender-matched Fish voice pools. makeCharacter draws one deterministically, so
// the orb you tap and the voice you hear agree and adjacent dots sound distinct.
const F_VOICES = VOICE_CATALOG.filter((v) => v.gender === "female").map((v) => v.id)
const M_VOICES = VOICE_CATALOG.filter((v) => v.gender === "male").map((v) => v.id)

/**
 * Mint ONE character on demand at a given temperature (for the deep-zoom buffet,
 * where the "100,000" are generated lazily — only the one you actually open is
 * built). Deterministic per seed, so the same dot always opens the same person
 * — same name, same voice, same lines — every time you tap it.
 */
export function makeCharacter(seed: number, f: number): Cluster {
  const r = rng((seed * 2654435761) >>> 0)
  const A =
    ARCH.find((a) => f >= a.band[0] && f <= a.band[1]) ||
    ARCH.reduce((best, a) => {
      const d = Math.min(Math.abs(f - a.band[0]), Math.abs(f - a.band[1]))
      const bd = Math.min(Math.abs(f - best.band[0]), Math.abs(f - best.band[1]))
      return d < bd ? a : best
    })
  const isF = A.lean === "f" ? true : A.lean === "m" ? false : r() < 0.5
  const pool = isF ? NAMES_F : NAMES_M
  // Permuted, not hashed — consecutive seeds walk the whole pool before any
  // name comes round again (see nameIndex).
  const host = pool[nameIndex(seed, pool.length)]
  const h: Heat = f < 0.4 ? "w" : f < 0.72 ? "m" : "f"
  const start = Math.floor(r() * A.lines.length)
  const lines = [0, 1, 2].map((k) => A.lines[(start + k) % A.lines.length])
  const name = A.names[Math.floor(r() * A.names.length)]
  // Seeded voice so the orb you tap and the voice you hear agree, and adjacent
  // dots sound like different people. Same permutation trick as the names, with
  // its own offset, so a run of characters cycles the voice pool instead of
  // landing on the same few voices over and over. A plain offset (rather than a
  // multiplicative stride) is used here because the catalog length is whatever
  // the catalog happens to be — an offset is a bijection for ANY length, with
  // no coprimality precondition to silently violate later.
  const vpool = isF ? F_VOICES : M_VOICES
  const voiceId = vpool.length ? vpool[((seed >>> 0) + 7) % vpool.length] : undefined
  // Unique per seed — NOT per name. Two characters may both be called Mara and
  // still be two entirely different people, with different faces, accents and
  // histories, because everything identity-shaped keys off this.
  const key = `${A.key}:${(seed >>> 0).toString(36)}:${host}`
  return { f, n: 1, h, archetype: A.key, name, vibe: A.vibe, host, gender: isF ? "female" : "male", lines, voiceId, key }
}


/**
 * The cast of a group room, as ONE formula.
 *
 * Exported because two screens need the same crowd: the talks board shows small
 * faces of who is already in a talk, and GroupRoom builds the people who
 * actually speak in it. Derived separately, the board promised five faces and
 * the room opened on five different ones — and a product whose whole claim is
 * "you forget they're AI" cannot afford to lie about who is in the room.
 *
 * Members spread across a narrow temperature band around the room so the crowd
 * has texture rather than being five variations of one mood.
 */
export function groupCast(seed: number, f: number, count: number): Cluster[] {
  const n = Math.max(1, Math.min(120, Math.round(count)))
  const c01 = (x: number) => Math.max(0, Math.min(1, x))
  return Array.from({ length: n }, (_, i) => makeCharacter(seed * 7 + i + 1, c01(f + ((i / n) - 0.5) * 0.08)))
}

/**
 * The same as makeCharacter, but skewed toward people the user can actually open
 * a conversation with — see lib/airraw/lang-prefs.ts. Walks forward from the seed
 * until it finds a character whose native language the user speaks.
 *
 * ALWAYS returns somebody. If nothing matches within the scan window (a user
 * whose languages the native mapping doesn't cover, or a very lopsided pool) it
 * returns the character the seed would have produced anyway — a filtered floor
 * that comes up empty is far worse than one that isn't perfectly filtered.
 *
 * Deterministic: same seed + same language settings → same person, every time.
 * Changing languages reshuffles who you meet, which is the point.
 */
export function pickForLanguages(
  seed: number,
  f: number,
  matches: (seedKey: string) => boolean,
  scan = 24,
): Cluster {
  const first = makeCharacter(seed, f)
  if (matches(first.key)) return first
  for (let i = 1; i < scan; i++) {
    const c = makeCharacter((seed + i * 7919) >>> 0, f)   // 7919 prime: spreads the walk
    if (matches(c.key)) return c
  }
  return first
}
