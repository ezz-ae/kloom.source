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
// Asserted as a PROPERTY, not as a literal string. The guarantee is "immersive
// exactly on the front door" — every OTHER surface must be negated in that
// expression. Pinning the exact text meant adding a fourth tab broke this test
// while the guarantee it protects was still perfectly intact.
const immersive = (planet.match(/immersive=\{([^}]*)\}/) || [, ""])[1]
const tabExpr = (planet.match(/tab=\{([^}]*)\}/) || [, ""])[1]
// Every state flag the tab expression branches on is a surface that is NOT the
// front door, so each one has to appear negated in `immersive`.
const surfaces = [...new Set([...tabExpr.matchAll(/\b([a-z][A-Za-z]*(?:Open|Profile))\b/g)].map((m) => m[1]))]
const unguarded = surfaces.filter((v) => !new RegExp(`!${v}\\b`).test(immersive))
check(surfaces.length > 0 && unguarded.length === 0,
  `the front door alone runs immersive (${surfaces.length} surfaces guarded${unguarded.length ? `, MISSING ${unguarded.join(", ")}` : ""})`)
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
const scrim = (front.match(/linear-gradient\(180deg[^`]*/) || [""])[0]
check(/\$\{accent\}/.test(scrim), "the scrim is tinted by the character's heat, not a flat black")
check(/feTurbulence/.test(front), "and carries grain, so a card without a photo still reads as a portrait")
check(/person\.f \* 48/.test(front), "the heat rail marks where this person sits on the soft-to-wild gradient")

// Nothing is pinned to the top of the front door at all.
check(!/position: "absolute", top: "calc\(env\(safe-area-inset-top\)/.test(front),
  "no control is anchored to the top edge")

// ── news lives in its own tab, never on the front door ──────────────────────
// The front door is ONE person. A toast that slides in over her is both a
// distraction from the only thing on screen and — twice now — something that
// physically covered the call button. So anything with news to give says so
// with a dot on the tab that owns it, and you go there when you want to.
check(!/toast|Toast/.test(front), "the front door raises no notifications of its own")
check(/dots\?:\s*Partial<Record<AirTab, boolean>>/.test(shell), "the shell takes a per-tab dot")
check((shell.match(/dots\?\.\[t\.id\]/g) || []).length === 2, "the dot shows on both the dock and the desktop rail")
check(/dots\?\.\[t\.id\] && !active/.test(shell), "and never on the tab you are already looking at")
check(/dots=\{\{\s*talks:/.test(planet), "the talks board is what actually raises it")

// ── the dock is furniture, not the interface ───────────────────────────────
// "MORE IMAGE, LESS TRAFFIC OF HUGE BUTTONS": the person is the product and the
// dock is how you leave her, so it stays small enough to ignore.
// Stated as PROPERTIES, not as the exact classes of one design. These broke on a
// legitimate redesign that made the dock smaller overall, which is a test failing
// for being a screenshot rather than a claim.
const iconSize = Number((shell.match(/<t\.icon size=\{(\d+)\}/) || [])[1] || 99)
check(iconSize <= 20, `the dock's icons are small (${iconSize}px)`)
check(/w-fit/.test(shell) || /max-w-\[\d+rem\]/.test(shell), "the dock is only as wide as it needs to be, never the full screen")
const labelPx = Number((shell.match(/text-\[(\d+(?:\.\d+)?)px\] font-semibold tracking-tight/) || [])[1] || 99)
check(labelPx <= 12, `its labels are a caption, not a heading (${labelPx}px)`)

// ── the dock names where you ARE, not everywhere you could go ──────────────
// Five icons each with a label under it is the default phone tab bar. Only the
// active tab says its name now; the rest are icons, and the label stays in the
// DOM (collapsed) so every control keeps an accessible name.
check(/active \? "ml-1\.5 max-w-\[6rem\] opacity-100" : "ml-0 max-w-0 opacity-0"/.test(shell),
  "only the active tab shows its label, and the others collapse rather than unmount")
check(/aria-label=\{t\.label\}/.test(shell), "an icon-only tab still has a name")

// ── it gets out of the way of the keyboard ─────────────────────────────────
// In the room the chat input sits directly above the dock, so opening the
// keyboard stacked two bars and put "send" a few pixels from a tab.
check(/typing \? "pointer-events-none translate-y-\[130%\] opacity-0"/.test(shell),
  "the dock drops away while a text field has focus")
check(/document\.addEventListener\("focusin"/.test(shell) && /"focusout"/.test(shell),
  "and it tracks focus rather than viewport size, so the URL bar collapsing doesn't flicker it")
check(/aria-hidden=\{typing\}/.test(shell), "while hidden it is hidden from assistive tech too")

// The dock is fixed and the call button is the one control under it. Padding
// belongs in the class, not in a style prop — an inline value beat the Tailwind
// class once and dropped the dock 64px onto the call button.
const dock = shell.slice(shell.indexOf("mobile dock"))
check(!/style=\{\{[^}]*padding/.test(dock), "the dock's spacing is all in classes, so nothing can silently outrank it")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
