/**
 * AIRROOM roster — the floor is alive before any human walks in.
 *
 * ~240 distinct characters cast from a handful of archetype templates ×
 * procedural variation (name, voice/gender, position-on-floor, lines), then
 * grouped into ~37 clusters sorted along the water→fire gradient. Fully
 * DETERMINISTIC (a seeded PRNG, no Math.random / Date) so the server and client
 * render the identical floor — no hydration drift. The actual Fish voice is
 * resolved server-side by /api/tts from each host's name + gender.
 */

export type Heat = "w" | "m" | "f"

export interface Cluster {
  f: number                          // home on the gradient (0 = water top, 1 = fire bottom)
  n: number                          // dwellers in the cluster
  h: Heat
  name: string
  vibe: string
  archetype: string
  host: string                       // the AI who speaks for this cluster
  gender: "female" | "male"
  lines: string[]                    // overhearable lines, spoken on approach
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

const NAMES_F = [
  "Mara", "Noor", "Vera", "Lux", "Zia", "Cass", "Ivy", "Suki", "Rana", "Dahlia",
  "Nadia", "Esme", "Yuki", "Leila", "Brielle", "Mira", "Sana", "Tess", "Aria",
  "Juno", "Remi", "Nova", "Indira", "Selin", "Priya", "Anouk", "Lena", "Faye",
]
const NAMES_M = [
  "Idris", "Remy", "Sol", "Pax", "Dane", "Theo", "Kai", "Omar", "Niko", "Rafa",
  "Jude", "Caleb", "Marco", "Eli", "Bo", "Cyrus", "Dmitri", "Hassan", "Leon",
  "Mateo", "Arjun", "Tariq", "Soren", "Ravi", "Emre", "Dario", "Finn", "Cole",
]

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
  { key: "Confidant", band: [0.00, 0.10], clusters: 3, lean: "x", vibe: "study · focus",
    names: ["the quiet library", "the reading room", "the still corner"],
    lines: ["…the proof only holds if you assume independence.", "take the night — it'll still be unsolved tomorrow.", "say less. let's just read in the same quiet a while.", "the answer comes when you stop chasing it.", "what are you really trying to understand here?"] },
  { key: "Mentor", band: [0.06, 0.18], clusters: 3, lean: "x", vibe: "business · mentor",
    names: ["founder's table", "the back office", "the whiteboard"],
    lines: ["raise less, charge more — your pricing is the pitch.", "who hates your product the most? start there.", "stop building. go sell the thing you already have.", "what would have to be true for this to be huge?", "you don't have a growth problem, you have a focus problem."] },
  { key: "Teacher", band: [0.14, 0.26], clusters: 3, lean: "x", vibe: "teaching",
    names: ["the classroom", "office hours", "the chalk circle"],
    lines: ["good — now say that back in your own words.", "wrong, and that's perfect. tell me why you thought it.", "forget the formula. what's it actually trying to do?", "slow down. teach it to me like i'm five.", "you almost have it. one more honest guess."] },
  { key: "Trainer", band: [0.20, 0.32], clusters: 3, lean: "x", vibe: "training · reps",
    names: ["the practice room", "the dojo", "rep one"],
    lines: ["again. this time slower, cleaner.", "that's the one — feel the difference?", "you don't rise to the goal, you fall to the habit.", "two more. you've got more than you think.", "breathe. the shake means it's working."] },
  { key: "Host", band: [0.28, 0.40], clusters: 4, lean: "x", vibe: "welcome · warm water",
    names: ["welcome floor", "the front door", "first round", "the warm-up"],
    lines: ["wait, you're new? get in here — we were just—", "settle in, newcomer. you don't have to talk yet.", "someone just walked up — what's your read on all this?", "grab a spot, the good part's about to start.", "don't be shy, this floor doesn't bite up here."] },
  { key: "Storyteller", band: [0.36, 0.50], clusters: 4, lean: "x", vibe: "stories · connection",
    names: ["the long table", "the firepit", "tall tales", "the booth"],
    lines: ["…and that's how i ended up in Lisbon with no shoes.", "everyone's got one night they can't explain. go.", "no no — you have to hear how this one ends.", "i swear on my life this part is true.", "okay but that's nothing — let me tell you about Cairo."] },
  { key: "Connector", band: [0.46, 0.60], clusters: 3, lean: "x", vibe: "meeting people",
    names: ["the introductions", "the mixer floor", "six degrees"],
    lines: ["you two need to talk — trust me. say hi.", "i know exactly who you should meet down here.", "tell me what you're after and i'll find your person.", "hold on, don't move — i'm bringing someone over.", "this whole floor is just people who haven't met yet."] },
  { key: "Regular", band: [0.40, 0.66], clusters: 4, lean: "x", vibe: "regulars · hanging",
    names: ["the usual", "the corner spot", "same time", "the regulars"],
    lines: ["oh, you again — good. pull up.", "same as last night? i saved your spot.", "nothing's happening and it's perfect.", "we were just talking about you, actually.", "stay a while, it always picks up around now."] },
  { key: "Flirt", band: [0.58, 0.74], clusters: 4, lean: "f", vibe: "flirty · warm",
    names: ["the mixer", "the slow dance", "eye contact", "the back booth"],
    lines: ["your voice is doing something to me, not gonna lie.", "come sit closer — i don't bite. much.", "say my name again, i liked how that sounded.", "i've been hoping you'd drift down this far.", "tell me one true thing and i'll tell you two."] },
  { key: "Troublemaker", band: [0.70, 0.88], clusters: 3, lean: "x", vibe: "party",
    names: ["after hours", "the afterparty", "past midnight"],
    lines: ["drop it — okay who put this on, i love them.", "we are NOT going home, it's barely midnight.", "one more, one more, then trouble — promise.", "whose idea was this? mine? amazing.", "the night's just getting interesting, stay down here."] },
  { key: "Wingman", band: [0.78, 0.97], clusters: 3, lean: "x", vibe: "wild · flirt",
    names: ["the fire", "embers", "the deep end"],
    lines: ["come closer — the floor's too loud for what i wanna say.", "you've been looking over here a while. just come.", "i dare you to air off with me right now.", "it's just us and the heat down here.", "whisper it. nobody's listening but me."] },
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
        vibe: A.vibe + (f >= 0.72 ? " · 18+" : ""),
        host, gender: isF ? "female" : "male", lines,
      })
    }
  }
  return out.sort((x, y) => x.f - y.f)
}

export const ROSTER: Cluster[] = buildRoster()
export const ROSTER_COUNT = ROSTER.reduce((s, c) => s + c.n, 0)
