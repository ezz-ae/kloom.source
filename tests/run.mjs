#!/usr/bin/env node
/**
 * Every behavioural guarantee this project relies on, in one command:
 *
 *   node tests/run.mjs
 *
 * These are plain Node scripts on purpose — no test framework, no build step, no
 * dependencies. Each mirrors a piece of real logic and asserts the property that
 * matters, so a regression shows up as a failed claim rather than a red diff.
 *
 * Several exist because the bug they cover actually shipped once.
 */
import { readdirSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))

const WHAT = {
  "kloom-unaffected": "every AIRRAW behaviour is behind a variant gate",
  "ar-test":          "Arabic subscribe-outro filter blocks it, keeps real speech",
  "chunk-test":       "sentences chunk (incl. Arabic ؟) and play in order",
  "privacy-test":     "mic cuts off-screen; a user mute is never overridden",
  "memory-test":      "free sessions store nothing; memory is erasable",
  "inflight-test":    "barge-in can't corrupt the in-flight chunk counter",
  "pool-test":        "149 prime name pools, no repeat until exhausted",
  "lang-test":        "language steers the floor without ever emptying it",
  "ortho-test":       "accent never predicts personality",
  "match-test":       "voice accents match on words, not substrings",
  "platform-facts":   "platform answers fire when asked, stay silent otherwise",
  "fai-test":         "FAI is earn-only, capped, and cannot be bought",
  "talks-test":       "the talks board moves, fills, and is never a dead end",
  "voices-test":      "one accent table; every tier reachable, with enough to say",
  "faces-test":       "a talk's cast can't churn, and a dead key isn't retried",
  "stt-test":         "every recogniser names itself, and Arabic is seeded",
  "shell-test":       "the app shell wraps what you browse, never the front door",
  "llm-seat-test":    "a rejected model key is asked once, not every turn",
  "media-test":       "text/voice to media is always the SAME her",
  "taste-test":       "the floor is filterable, and a filter is never a dead end",
  "pass-rotation-test": "a pass outlives a rotated secret, and a paid caller is never sold it twice",
  "reissue-test":     "reissuing a pass restores one, and can never grant one",
  "face-cache-test":  "a dead image provider costs new faces, never the ones already drawn",
  "pay-test":         "a crypto pass needs a signed callback, never a claim",
  "video-test":       "a clip outlives its request, is paid for once, and persists",
  "cast-test":        "the floor has 2,980 people in it, not 298",
  "age-test":         "the floor is in its 20s and 30s, and the safety floor holds",
  "pin-test":         "one person, one voice — greeting, call, and every chunk",
  "tier-test":        "one free minute, same voice as the pass, metered on the server",
  "upsell-test":      "a free user finds out the wall exists, once, where it matters",
  "refused-pass-test": "a refused pass never ends the call, and never still reads as active",
  "room-test":        "the site lands in a room of distinct people, and it never spends unwatched",
  "norepeat-test":    "profile = character; nobody repeats in a room or across hours",
  "photo-test":       "a photo of her is pass-only, counted first, and the meter fails closed",
  "warm-test":        "the face warmer covers what the screen actually asks for",
  "who-test":         "every person has a page, in their own words, that can never spend money",
  "fantasy-test":     "the scene menu is closed, clean, and cannot smuggle a prompt",
  "image-test":       "the best face engine runs first, and a refusal falls through instead of failing",
  "browser-language-test": "the visitor browser picks the language, nobody else does",
  "cast50-test":      "fifty written people, no two alike, and one person in every language",
  "chips-test":       "every pack clears its own cost, and nothing is taken back to make you move",
  "pickup-test":      "she opens with something real from last time, or says nothing at all",
  "onetab-test":      "no surface spawns a tab, and the call carries its own settings",
  "golden-test":      "the room you rent keeps the person you brought, and is priced for it",
  "money-test":       "a price shown in riyals is that price, and the statement currency is said out loud",
  "price-truth-test":  "the price on the page is the price at the till",
  "profile-test":     "one person computed once — the card, the call and the photo can't disagree",
  "persona-test":     "one definition rendered per surface — no character left without a voice",
  "arabic-test":      "the Arabic build: everyone Arab, everything Arabic, Kloom out of reach",
}

// Two suites drive a real browser and need a server, so they are excluded from
// the default run. Start one and call them directly:
//   AIRRAW_HOME=1 AIRRAW_PRO_SECRET=probe-secret npx next start -p 3131 &
//   PORT=3131 node tests/ui-check.mjs
//   node tests/live-check.mjs
//
// live-check is the one to run before any deploy touching audio, metering or the
// room loop. The suites below read source and assert properties, which is fast
// and catches most regressions — but it cannot catch code that is written
// correctly and does not happen. That is not theoretical: loadVolume looked
// perfect and returned 0 for every new visitor, so every first private call was
// silent while the voice engine billed for it. Reading it would never have found
// that; running it found it immediately.
const SERVER_ONLY = new Set(["run.mjs", "ui-check.mjs", "live-check.mjs"])
// Not suites: the "@/" alias resolver this runner loads into every suite. They
// contain no assertions, so running them reported two extra PASSes and inflated
// the count — which is worse than useless, because a real suite disappearing
// would have been hidden by the same number staying put.
const HELPERS = new Set(["alias.mjs", "alias-hooks.mjs"])
const all = readdirSync(here).filter((f) => f.endsWith(".mjs") && !SERVER_ONLY.has(f) && !HELPERS.has(f)).sort()
// A suite with no description is almost always a new file nobody wired up. Say
// so rather than running it namelessly under a blank column.
const undescribed = all.filter((f) => !WHAT[f.replace(/\.mjs$/, "")])
if (undescribed.length) console.log(`note: no description for ${undescribed.join(", ")} — add one to WHAT\n`)
const files = all
let failed = 0
for (const f of files) {
  const name = f.replace(/\.mjs$/, "")
  // --import registers the "@/" alias resolver (tests/alias.mjs) so a suite can
  // import and RUN a module that uses the project alias, instead of grepping its
  // source and hoping the text implies the behaviour.
  const r = spawnSync(process.execPath, ["--import", join(here, "alias.mjs"), join(here, f)], { encoding: "utf8" })
  const ok = r.status === 0
  if (!ok) failed++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(18)} ${WHAT[name] || ""}`)
  if (!ok) console.log((r.stdout + r.stderr).split("\n").filter((l) => /FAIL|Error/.test(l)).slice(0, 6).map((l) => `        ${l}`).join("\n"))
}
console.log(`\n${files.length - failed}/${files.length} suites passing`)
process.exit(failed ? 1 : 0)
