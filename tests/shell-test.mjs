// The AIRRAW shell — Kloom's app furniture, AIRRAW's palette.
import { readFileSync } from "node:fs"
let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const shell = strip("components/airroom/AirShell.tsx")
const planet = strip("components/airroom/Planet.tsx")
const css = readFileSync("app/globals.css", "utf8")

// ── children render ONCE ────────────────────────────────────────────────────
// Kloom's shell carries a comment about this because it shipped broken: a
// desktop block and a mobile block double-mounted every page, which for a live
// room meant two realtime channels and two voice hooks per user.
check((shell.match(/\{children\}/g) || []).length === 1, "children are rendered exactly once")

// ── every browsable surface is a tab, the front door included ───────────────
const shellBlock = planet.slice(planet.indexOf("<AirShell"), planet.indexOf("</AirShell>"))
check(/YouPage/.test(shellBlock) && /<Talks/.test(shellBlock) && /<FrontDoor/.test(shellBlock),
  "people, talks and you are all tabs of one shell")

// The front door is IMMERSIVE inside it: the card is absolutely positioned, so
// it ignores the scroll container's padding and has to clear the fixed dock
// itself. Reserving space in the shell instead would leave a dead strip.
check(/immersive=\{!showProfile && !roomsOpen\}/.test(planet), "the front door runs the shell in immersive mode")
const front = strip("components/airroom/FrontDoor.tsx")
check(/env\(safe-area-inset-bottom\)\+5\.75rem/.test(front.replace(/\s/g, "")),
  "the card lifts itself above the dock on phones")
check(/lg:pb-\[calc\(env\(safe-area-inset-bottom\)\+1\.375rem\)\]/.test(front),
  "and drops back to its original spacing on desktop, where there is no dock")

// A LIVE CALL is not a tab. Its own controls sit where the dock would be, and
// you should never be one mis-tap from leaving a conversation.
check(/!selected && !group/.test(planet.slice(0, planet.indexOf("<AirShell"))),
  "a live call renders outside the shell entirely")

// One route to a place, not two. The dock owns Talks and You now.
check(!/talks happening now/.test(front), "the front door has no talks pill competing with the dock")
check(!/your profile/.test(front), "and no profile row competing with it either")

// ── the skin cannot leak onto Kloom ─────────────────────────────────────────
// Scoped in CSS rather than switched in JS: no variant check to get wrong, and
// no way for the adult palette to reach the SFW ad domain.
const skinRules = (css.match(/^\.airraw-skin /gm) || []).length
check(skinRules >= 6, `the adult palette is scoped to .airraw-skin (${skinRules} rules)`)
check(/\.airraw-skin \.brand-gradient/.test(css) && /#c084fc/.test(css),
  "it re-skins the brand gradient to the floor's purple rather than Kloom's amber")
const kloomGradient = css.match(/^\.brand-gradient \{[^}]*\}/m)?.[0] || ""
check(/#fbbf24/.test(kloomGradient), "Kloom's own amber gradient is untouched")
check(/airraw-skin/.test(shell), "the shell opts into the skin explicitly")

// ── one way out ─────────────────────────────────────────────────────────────
const talks = strip("components/airroom/Talks.tsx")
check(!/back to people/.test(talks), "the board has no second back control competing with the dock")


// ── the card is lit by who the person is ────────────────────────────────────
// A neutral black scrim makes every card identical, and with no portrait loaded
// it makes them all the same grey blur. The wash carries the character's own
// heat colour, which is the gradient the whole product is built on.
check(/\$\{accent\}1f/.test(front), "the scrim is tinted by the character's heat, not a flat black")
check(/feTurbulence/.test(front), "and carries grain, so a card without a photo still reads as a portrait")
check(/person\.f \* 48/.test(front), "the heat rail marks where this person sits on the soft-to-wild gradient")

// Nothing is pinned to the top of the front door at all.
check(!/position: "absolute", top: "calc\(env\(safe-area-inset-top\)/.test(front),
  "no control is anchored to the top edge")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
