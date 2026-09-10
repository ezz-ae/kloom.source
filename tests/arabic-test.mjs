// THE ARABIC BUILD — interface, floor, and the promise the ad makes.
//
// /ar sells one thing: tap this, and everyone you meet is Arab and speaks
// Arabic. Every assertion here is that promise, because the ways it can quietly
// stop being true are not obvious. The floor's filler cast bypassed the language
// filter entirely and seated Faye and Mireille in an Arabic room. The name pool
// is one international list applied to every origin, so the filter can pass a
// Gulf Arab called Frida. Neither showed up as an error.
import { readFileSync, readdirSync } from "node:fs"
import { AR, UNTRANSLATED } from "@/lib/airraw/ar"
import { AR_CONTENT } from "@/lib/airraw/ar-content"
import { translate, isRTL, currentLocale } from "@/lib/airraw/i18n"
import { ALL_ARABIC_NAMES, displayName } from "@/lib/airraw/arabic-names"
import { ethnicityForSeed } from "@/lib/airraw/portrait-prompt"
import { nativeLanguageFor } from "@/lib/airraw/lang-prefs"
import { makeCharacter, faceSeedFor, pickForLanguages } from "@/lib/airroom/roster"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const ARABIC = /[؀-ۿ]/

console.log("— an untranslated string degrades to English, never to a token —")
check(translate("a string nobody translated", "ar") === "a string nobody translated",
  "a missing key renders its English rather than breaking the screen")
check(translate("Room", "en") === "Room", "and English is the identity function, so Kloom is untouched")
check(translate("Room", "ar") === AR["Room"], "while Arabic looks up the table")
check(isRTL("ar") && !isRTL("en"), "only Arabic mirrors")
check(currentLocale() === "en", "no preference means English, not a guess")

console.log("\n— every translation is actually in Arabic —")
{
  // An English value is a bug unless it is DECLARED — see UNTRANSLATED in ar.ts.
  const notArabic = Object.entries(AR).filter(([k, v]) => !ARABIC.test(v) && !UNTRANSLATED.has(k))
  if (notArabic.length) console.log("   e.g. " + JSON.stringify(notArabic[0]))
  check(notArabic.length === 0, `no entry was left in English by mistake (${Object.keys(AR).length} strings)`)
  check([...UNTRANSLATED].every((k) => k in AR),
    "and every declared exception is a real key, so the list cannot rot")
  // Interpolation has to survive translation or the name vanishes from the line.
  const withVars = Object.entries(AR).filter(([k]) => k.includes("{name}"))
  check(withVars.length > 0 && withVars.every(([, v]) => v.includes("{name}")),
    "and every placeholder survives into the Arabic")
  check(translate("open {name}'s profile", "ar", { name: "رنا" }).includes("رنا"),
    "interpolation puts the name in")
}

console.log("\n— everyone on an Arabic floor is Arab, named, and speaks it —")
{
  const ARAB = new Set(["North African", "Egyptian", "Moroccan", "Middle Eastern", "Gulf Arab", "Lebanese"])
  // The same three conditions matchesPrefs applies for an Arabic entry.
  const ok = (k) => nativeLanguageFor(k) === "Arabic" && ARAB.has(ethnicityForSeed(k))

  let hits = 0, N = 4000
  for (let i = 0; i < N; i++) {
    const c = pickForLanguages((i * 2654435761) >>> 0, (i % 97) / 97, ok)
    if (ok(faceSeedFor(c) || c.host)) hits++
  }
  console.log(`   ${hits}/${N} draws satisfied all three`)
  check(hits === N, "the roster's scan window never falls through to a stranger")

  // Rarity is WHY the window has to be wide — if this drifts up the window can
  // shrink, and if it drifts down the window is already too small.
  let both = 0
  for (let i = 0; i < 20000; i++) {
    const c = makeCharacter(i, (i % 97) / 97)
    if (ok(faceSeedFor(c) || c.host)) both++
  }
  const rate = both / 20000
  console.log(`   an eligible character is 1 in ${(1 / rate).toFixed(0)}`)
  const scan = Number((strip("lib/airroom/roster.ts").match(/scan = (\d+)/) || [])[1])
  const missChance = Math.pow(1 - rate, scan)
  check(missChance < 1e-6, `scan=${scan} misses about 1 in ${Math.round(1 / missChance).toLocaleString()} — wide enough`)
}

console.log("\n— the room's filler goes through the same filter as the deck —")
{
  const room = strip("components/airroom/TheRoom.tsx")
  check(/matchesPrefs\(fk\)/.test(room),
    "the generated floor is filtered — it was not, and seated Faye in an Arabic room")
  const m = room.match(/groupCast\(seed, 0\.5, (.+?)\)\.filter/)
  check(!!m && /\*\s*\d\d/.test(m[1]),
    "and draws a wide pool first, because only one character in seven qualifies")
}

console.log("\n— every generated character has an Arabic name to be printed under —")
{
  check(displayName("Rana", "female", "ar") === "رنا", "a name that is already Arabic maps to itself")
  check(displayName("Rana", "female", "en") === "Rana", "and stays Latin in English")
  // The bug this replaced a filter to fix: Frida is a legitimate Gulf Arab seed.
  check(ARABIC.test(displayName("Frida", "female", "ar")), "a Latin name is GIVEN an Arabic one rather than printed as-is")
  check(ARABIC.test(displayName("Pavel", "male", "ar")), "for men too")
  check(displayName("Frida", "female", "ar") === displayName("Frida", "female", "ar"),
    "and it is stable — the same person every time, on every surface")
  check(ALL_ARABIC_NAMES.every((n) => ARABIC.test(n)), "no display name is left in Latin")
  // Gender has to reach it or half the floor is misnamed.
  const f = new Set(), m = new Set()
  for (const h of ["Frida", "Pavel", "Diego", "Otto", "Xenia", "Greta", "Lila", "Mireille"]) {
    f.add(displayName(h, "female", "ar")); m.add(displayName(h, "male", "ar"))
  }
  check([...f].every((x) => !m.has(x)), "women and men draw from different pools")

  // The identity must never become the translated string: host is half the face
  // seed, so writing Arabic into it would regenerate every portrait.
  const names = strip("lib/airraw/arabic-names.ts")
  check(!/host\s*=\s*(SCRIPT|pool)/.test(names), "displayName never assigns back to host")
  const room = strip("components/airroom/TheRoom.tsx")
  check(/faceSeedFor\(/.test(room) && !/faceSeedFor\(displayName/.test(room),
    "and the face seed is still built from the Latin name")
  check(/content: `\$\{l\.who \? l\.who\.host/.test(room),
    "the model is still told the Latin name, so @mentions keep resolving")
}

console.log("\n— Kloom cannot reach any of this —")
{
  const ar = strip("app/ar/page.tsx")
  check(/AIRRAW_HOME === "1"/.test(ar) && /notFound\(\)/.test(ar), "/ar 404s on a Kloom deployment")
  check(/index: false/.test(ar), "and is noindex, so a paid entrance never competes with the real home page")
}

console.log("\n— every pool the floor draws from has an Arabic version —")
{
  // Coverage, not spot checks. A line added to the roster without its Arabic
  // renders in English on an Arabic floor and nothing errors — which is the
  // failure mode this whole layer is built to make loud instead of silent.
  const have = (k) => k in AR_CONTENT || k in AR
  const roster = readFileSync("lib/airroom/roster.ts", "utf8")
  const i = roster.indexOf("const ARCH: Arch[] = [")
  const arch = roster.slice(i, roster.indexOf("\nconst NAMES_F", i))
  const dossier = readFileSync("lib/airraw/dossier.ts", "utf8")
  const talks = readFileSync("lib/airraw/talks.ts", "utf8")

  const pools = {
    "opening lines": [...arch.matchAll(/lines: \[([\s\S]*?)\n    \]/g)]
      .flatMap((m) => [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1])),
    "vibes": [...arch.matchAll(/vibe: "([^"]+)"/g)].map((m) => m[1]),
    "room names": [...arch.matchAll(/names: \[([^\]]*)\]/g)]
      .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])),
    // The SECOND half of each pair — the card half. The first is prompt text the
    // model reads and is deliberately left in English.
    "card halves": [...dossier.matchAll(/\[\s*"(?:[^"\\]|\\.)*",\s*"((?:[^"\\]|\\.)*)"\s*\]/g)].map((m) => m[1]),
    "talk titles": [...talks.matchAll(/\["((?:[^"\\]|\\.)*)",\s*"[wmf]"\]/g)].map((m) => m[1]),
  }
  // The scene builder: its library is the largest single block of writing in the
  // product, and it is the paid tab — a visitor who reaches it has already
  // decided they might pay, which is the worst possible moment to switch back
  // into English.
  const fantasy = readFileSync("lib/airraw/fantasy.ts", "utf8")
  const fblk = (n) => {
    const i = fantasy.indexOf(`export const ${n}`)
    return fantasy.slice(i, fantasy.indexOf("\n]", i))
  }
  Object.assign(pools, {
    "fantasy labels": [...fblk("FANTASIES").matchAll(/label: "((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]),
    "fantasy scenes": [...fblk("FANTASIES").matchAll(/scene: "((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]),
    "role labels": [...fblk("ROLES").matchAll(/label:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]),
    "role lines": [...fblk("ROLES").matchAll(/line:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]),
    "scene kinds": [...fblk("FANTASY_KINDS").matchAll(/label: "([^"]+)"/g)].map((m) => m[1]),
    "cast vibes": [...fblk("VIBES").matchAll(/"([^"]+)"/g)].map((m) => m[1]),
    "turn modes": [...fblk("TURN_MODES").matchAll(/(?:label|hint): "([^"]+)"/g)].map((m) => m[1]),
    "attributions": [...fblk("ATTRIBUTIONS").matchAll(/(?:label|hint): "([^"]+)"/g)].map((m) => m[1]),
  })

  // The written fifty. Only two of their soul's fields ever reach a screen —
  // `clusterFor` maps soul.wants onto the cluster's vibe (the line under their
  // name) and openers onto its lines (the quote on the card). The rest of the
  // soul is prompt text the model reads, and stays English on purpose, exactly
  // like the generated dossier's first halves.
  const cast50 = readFileSync("lib/airraw/cast50.ts", "utf8")
  Object.assign(pools, {
    "written wants": [...cast50.matchAll(/wants: "((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]),
    "written openers": [...cast50.matchAll(/openers: \[([\s\S]*?)\n    \]/g)]
      .flatMap((m) => [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1])),
  })

  for (const [label, arr] of Object.entries(pools)) {
    const miss = arr.filter((x) => !have(x))
    if (miss.length) console.log(`   missing: ${miss.slice(0, 3).join(" | ")}`)
    check(arr.length > 0 && miss.length === 0, `${label}: ${arr.length - miss.length}/${arr.length} written in Arabic`)
  }
  const bad = Object.entries(AR_CONTENT).filter(([, v]) => !ARABIC.test(v))
  check(bad.length === 0, `and no content string was left in English (${Object.keys(AR_CONTENT).length} written)`)
  // Two files, two jobs — a key in both is a merge conflict waiting to happen.
  const dupes = Object.keys(AR_CONTENT).filter((k) => k in AR)
  check(dupes.length === 0, `no key is in both the interface and the content table${dupes.length ? ": " + dupes[0] : ""}`)
}

// ── the key is the English string, so it must BE the English string ─────────
//
// JSX decodes HTML entities in a text node; a JS string argument does not. So
// the moment a line like `you&apos;re in.` is wrapped as t("you&apos;re in."),
// two things break at once: English starts printing the entity literally, and
// the Arabic lookup misses, because the table is keyed on the apostrophe. It
// happened to eleven strings on the first bulk pass and was invisible in
// review — both languages were wrong, and only one of them was being read.
{
  console.log("\n— no translator key carries an HTML entity —")
  const ENT = /&(?:[a-zA-Z]+|#\d+);/
  // The page files too. The first bulk pass swept components/airroom only, and
  // the discovery floor sat in app/ rendering translated room names in English
  // because the page itself never called the translator.
  const dirs = ["components/airroom", "components/widgets",
                "app/ar", "app/floor", "app/universe", "app/airraw", "app/airraw/chess"]
  let entities = 0, scanned = 0
  for (const d of dirs) {
    let files = []
    try { files = readdirSync(d).filter((f) => f.endsWith(".tsx")) } catch { continue }
    for (const f of files) {
      const src = readFileSync(`${d}/${f}`, "utf8")
      scanned++
      for (const m of src.matchAll(/\b(?:t|tr)\("((?:[^"\\]|\\.)*)"/g)) {
        if (ENT.test(m[1])) { entities++; console.log(`   ${f}: ${m[1].slice(0, 60)}`) }
      }
    }
  }
  check(scanned > 20, `${scanned} surfaces scanned`)
  check(entities === 0, "every key is the literal text, not its escaped form")

  // And the other half of the same rule: a key that no Arabic table answers is
  // a string that silently ships in English on an Arabic-only build.
  let untranslated = 0, keys = 0
  const skip = UNTRANSLATED
  for (const d of dirs) {
    let files = []
    try { files = readdirSync(d).filter((f) => f.endsWith(".tsx")) } catch { continue }
    for (const f of files) {
      const src = readFileSync(`${d}/${f}`, "utf8")
      for (const m of src.matchAll(/\b(?:t|tr)\("((?:[^"\\]|\\.)*)"/g)) {
        const k = m[1].replace(/\\"/g, '"')
        keys++
        if (k in AR || k in AR_CONTENT || skip.has(k)) continue
        untranslated++
        if (untranslated <= 40) console.log(`   ${f}: ${k.slice(0, 70)}`)
      }
    }
  }
  check(keys > 200, `${keys} translator calls on the surfaces`)
  check(untranslated === 0, `every one of them resolves to Arabic (${untranslated} left in English)`)
}

// ── the tables the surfaces render out of ───────────────────────────────────
//
// A table of {label, sub} rendered through t(m.label) is a dynamic call, so the
// literal scan cannot see the strings inside it. The mood step is the first
// screen anyone sees after the door, and it sat in English through two passes
// because of exactly that.
{
  console.log("\n— and the tables they render out of —")
  const TABLES = [
    ["components/airroom/Planet.tsx", "MOODS", /const MOODS[^=]*= \[([\s\S]*?)\n\]/],
  ]
  for (const [file, name, re] of TABLES) {
    const m = readFileSync(file, "utf8").match(re)
    check(!!m, `${name} found in ${file.split("/").pop()}`)
    if (!m) continue
    const strings = [...m[1].matchAll(/(?:label|sub|hint|title):\s*"((?:[^"\\]|\\.)+)"/g)].map((x) => x[1])
    const miss = strings.filter((x) => !(x in AR) && !(x in AR_CONTENT) && !UNTRANSLATED.has(x))
    if (miss.length) console.log(`   missing: ${miss.join(" | ")}`)
    check(strings.length > 4 && miss.length === 0, `   ${strings.length - miss.length}/${strings.length} of ${name} written in Arabic`)
  }
}

// ── the language picker prints names, and those are strings too ─────────────
//
// The picker renders l.name and stores l.name, which is why the name itself
// cannot be translated in the table that feeds it: prefs, the roster and the
// voice all match on the English key. So the VALUE stays English and only the
// printed name is translated — and a language added later must bring its own.
{
  console.log("\n— every language the picker offers has an Arabic name —")
  const { LANGUAGES } = await import("@/lib/languages")
  const names = LANGUAGES.map((l) => l.name)
  const miss = names.filter((n) => !(n in AR) && !(n in AR_CONTENT))
  if (miss.length) console.log(`   missing: ${miss.join(", ")}`)
  check(names.length > 10 && miss.length === 0, `${names.length - miss.length}/${names.length} languages named in Arabic`)

  // And the stored value is still the English key, or a returning Arabic
  // visitor would be filtered against a language nothing in the roster speaks.
  for (const f of ["Planet", "ProSheet", "YouPage"]) {
    const src = readFileSync(`components/airroom/${f}.tsx`, "utf8")
    check(/value=\{l\.name\}/.test(src), `${f} still stores the English key, and translates only what is shown`)
  }
}

// ── status text is set in one place and read in another ─────────────────────
//
// The mic hint and the chess board's status are written into state as English
// literals and rendered somewhere else entirely. Wrapping them where they are
// SET would freeze the language at that moment and miss every other branch, so
// they are translated where they are READ — which means the literal scan above
// cannot see them. This is the guard for that class: both halves, together.
{
  console.log("\n— text set in one place and read in another —")
  const INDIRECT = [
    ["components/airroom/AirBubble.tsx", "setMicHint", "{micHint ? t(micHint) :"],
    ["components/airroom/ChessRoom.tsx", "setStatus", ": t(status)}"],
  ]
  for (const [file, setter, reader] of INDIRECT) {
    const src = readFileSync(file, "utf8")
    const name = file.split("/").pop().replace(/\.tsx$/, "")
    check(src.includes(reader), `${name} translates ${setter.replace("set", "").toLowerCase()} where it is read`)
    // Every literal in the call, not just the first — a setter is as often
    // handed a ternary as a bare string.
    const written = [...src.matchAll(new RegExp(`${setter}\\(([^\\n]*?)\\)\\s*[;,}]`, "g"))]
      .flatMap((m) => [...m[1].matchAll(/"((?:[^"\\]|\\.)+)"/g)].map((x) => x[1]))
      .filter((x) => /[a-z]{2}/.test(x))
    check(written.length > 2, `   ${written.length} literals reach ${setter}`)
    const miss = written.filter((x) => !(x in AR) && !(x in AR_CONTENT) && !UNTRANSLATED.has(x))
    if (miss.length) miss.slice(0, 6).forEach((x) => console.log(`   ${x}`))
    check(miss.length === 0, `   and every one of them has Arabic`)
  }
}

console.log(fail === 0 ? "\nPASS — Arabic all the way down" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
