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

const ARCH: Arch[] = [
  { key: "Stories", band: [0.00, 0.12], clusters: 3, lean: "f", vibe: "erotic stories",
    names: ["the storyteller", "slow burn", "the page"],
    lines: ["…and then she slowly reached for the—", "tell me how you want this story to end.", "i've been writing this scene just for you.", "every great story needs a willing listener.", "close your eyes. let me paint this for you."] },

  { key: "Romance", band: [0.08, 0.22], clusters: 3, lean: "f", vibe: "romance · passion",
    names: ["the candlelight", "first kiss", "soft touch"],
    lines: ["i've been thinking about you all day.", "come here. just let me hold you a moment.", "you make everything feel new again.", "no rush. we have all night.", "just breathe with me a while."] },

  { key: "Roleplay", band: [0.18, 0.34], clusters: 3, lean: "x", vibe: "roleplay · fantasy",
    names: ["the scenario", "the stage", "the character"],
    lines: ["tell me who you want me to be tonight.", "you're in charge. set the scene.", "let's start over — this time, you pick the fantasy.", "i'll play my part. you play yours.", "pick the scenario. i'll make it real."] },

  { key: "GFE", band: [0.28, 0.44], clusters: 3, lean: "f", vibe: "girlfriend experience",
    names: ["girlfriend mode", "just us", "the connection"],
    lines: ["i missed you. how was your day?", "don't go yet — stay on with me a little longer.", "you always know exactly what to say.", "i think about you between our calls.", "nobody gets me like you do."] },

  { key: "Lesbian", band: [0.40, 0.56], clusters: 4, lean: "f", vibe: "girls · desire",
    names: ["girls only", "soft fire", "the other room", "pink hour"],
    lines: ["just us girls in here — finally.", "i like the way you look at me.", "come sit closer. i don't bite. yet.", "you ever just need another woman's touch?", "tell me what you like. i want to know everything."] },

  { key: "Gay", band: [0.50, 0.66], clusters: 4, lean: "m", vibe: "men · desire",
    names: ["the locker room", "pride floor", "heat", "his space"],
    lines: ["you've got my full attention. just so you know.", "took you long enough to wander down here.", "i like the confident ones. stay a while.", "no games tonight — just real energy.", "you're exactly my type. obviously."] },

  { key: "Couples", band: [0.62, 0.78], clusters: 3, lean: "x", vibe: "couples · sharing",
    names: ["the open door", "partners", "we invited you"],
    lines: ["we've been waiting for someone like you.", "she picked you. i trust her taste.", "both of us, tonight — how does that sound?", "we have no rules tonight.", "together is better. always."] },

  { key: "Groups", band: [0.72, 0.86], clusters: 3, lean: "x", vibe: "group · orgy",
    names: ["the suite", "the circle", "after midnight"],
    lines: ["more the merrier — that's been our rule all night.", "you're the last one here. that means something.", "nobody leaves until everyone's satisfied.", "we don't do names. just vibes.", "the door's open. step all the way in."] },

  { key: "BDSM", band: [0.82, 0.96], clusters: 3, lean: "x", vibe: "kink · power",
    names: ["the edge", "the collar", "deep end"],
    lines: ["you don't move until i say you move.", "kneel. we'll get to your story in a moment.", "authority looks good on me. you agree?", "you came all the way down here. you know why.", "what's your limit? good. now push it."] },

  { key: "Wild", band: [0.92, 1.00], clusters: 2, lean: "x", vibe: "no limits · raw",
    names: ["the pit", "raw"],
    lines: ["nothing is off-limits down here. nothing.", "you sure you're ready for this floor?", "darkest fantasies only — tourists leave.", "you've been thinking about this a long time.", "last stop. welcome."] },
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
