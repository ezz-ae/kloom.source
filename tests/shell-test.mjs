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

// ── the front door stays immersive ──────────────────────────────────────────
// The full-screen person was deliberately cut back to two small controls. A nav
// bar under the call button would put the chrome straight back, and the bottom
// of that screen is already its busiest part.
check(/: <FrontDoor/.test(planet), "the front door renders outside the shell")
const shellBlock = planet.slice(planet.indexOf("<AirShell"), planet.indexOf("</AirShell>"))
check(!/FrontDoor/.test(shellBlock), "nothing wraps the front door in shell chrome")
check(/YouPage/.test(shellBlock) && /<Talks/.test(shellBlock), "talks and you are both inside it")

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

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
