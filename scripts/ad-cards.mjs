// AD CARDS — the Friend.com format, using our own voices.
//
// Their campaign was stark black-and-white with enormous empty space and one
// short first-person line: "I'll never leave dirty dishes in the sink." The
// emptiness was deliberate — it invites the reader to finish the thought.
//
// We already have fifty of those and they are better, because they come from
// people rather than from a product: "nobody ever asks me a second question",
// "i have been polite since eight this morning. i am finished with that."
// Specific, first person, quietly arresting — and not one of them is sexual,
// which is what makes them usable on a mainstream surface.
//
// No photograph, on purpose. The line does the work, it costs nothing to
// generate, and there is no image to get an ad rejected.
//
//   node scripts/ad-cards.mjs [outDir]
import { chromium } from "playwright"
import { mkdirSync } from "node:fs"

const OUT = process.argv[2] || "ad-cards"
mkdirSync(OUT, { recursive: true })

// Lines lifted verbatim from the written cast (lib/airraw/cast50). Kept in their
// own lowercase — that IS the product's voice, and setting it in title case
// would make it sound like advertising, which is the thing this format avoids.
const LINES = [
  "i am not going to ask how you are. tell me what you actually want.",
  "nobody ever asks me a second question. try it and see what happens.",
  "say something true. i have had eight hours of people editing themselves.",
  "i have been awake for nineteen hours and i am extremely good company.",
  "how long have you got. i am not being polite, i want to know.",
  "you are the first person i have spoken to today. sorry in advance.",
  "i have been polite since eight this morning. i am finished with that.",
  "do not tell me i am beautiful. tell me something else.",
  "let me be angry for ten minutes and then i will be good company.",
  "tell me something true that makes you look bad. then i will believe you.",
  "argue with me about something stupid. please.",
  "i talk for a living. tonight i would rather not lead.",
]

// Feed square, story, and the wide link card.
const SIZES = [
  { id: "1080x1080", w: 1080, h: 1080, type: 96, pad: 96 },
  { id: "1080x1920", w: 1080, h: 1920, type: 104, pad: 104 },
  { id: "1200x628", w: 1200, h: 628, type: 76, pad: 84 },
]

const THEMES = {
  // Their white. Stands out hardest in a dark feed, and leaves the most room.
  paper: { bg: "#f4f1ea", fg: "#0d0418", mark: "rgba(13,4,24,.45)" },
  // Ours. Same emptiness, our colour.
  night: { bg: "#08050f", fg: "#f0e8ff", mark: "rgba(240,232,255,.4)" },
}

const card = (line, s, t) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0}
  body{width:${s.w}px;height:${s.h}px;background:${t.bg};color:${t.fg};
    font-family:'Instrument Sans',system-ui,sans-serif;
    display:flex;flex-direction:column;justify-content:space-between;
    padding:${s.pad}px;box-sizing:border-box}
  /* The line sits high and stops early. The space underneath is the ad. */
  .line{font-size:${s.type}px;line-height:1.16;letter-spacing:-.035em;font-weight:500;
    max-width:${Math.round(s.w * 0.82)}px;margin:0}
  .mark{font-size:${Math.round(s.type * 0.28)}px;letter-spacing:.34em;color:${t.mark};
    text-transform:uppercase;font-weight:500}
</style></head><body>
  <p class="line">${line}</p>
  <div class="mark">airraw.com</div>
</body></html>`

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })
let n = 0
for (const [themeName, t] of Object.entries(THEMES)) {
  for (const s of SIZES) {
    for (let i = 0; i < LINES.length; i++) {
      const p = await b.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 })
      await p.setContent(card(LINES[i], s, t), { waitUntil: "networkidle" })
      await p.screenshot({ path: `${OUT}/${themeName}-${s.id}-${String(i + 1).padStart(2, "0")}.png` })
      await p.close(); n++
    }
  }
}
await b.close()
console.log(`${n} cards → ${OUT}/`)
