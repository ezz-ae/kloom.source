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
  "pay-test":         "a crypto pass needs a signed callback, never a claim",
  "video-test":       "a clip outlives its request, is paid for once, and persists",
  "cast-test":        "the floor has 2,980 people in it, not 298",
  "age-test":         "the floor is in its 20s and 30s, and the safety floor holds",
  "pin-test":         "one person, one voice — greeting, call, and every chunk",
  "tier-test":        "one free minute, same voice as the pass, metered on the server",
  "upsell-test":      "a free user finds out the wall exists, once, where it matters",
  "room-test":        "the site lands in a room of distinct people, and it never spends unwatched",
  "norepeat-test":    "profile = character; nobody repeats in a room or across hours",
  "photo-test":       "a photo of her is pass-only, counted first, and the meter fails closed",
  "who-test":         "every person has a page, in their own words, that can never spend money",
  "fantasy-test":     "the scene menu is closed, clean, and cannot smuggle a prompt",
}

// ui-check.mjs drives a real browser and needs a server, so it is excluded from
// the default run. Start one and call it directly:
//   npx next start -p 3131 &   PORT=3131 node tests/ui-check.mjs
const files = readdirSync(here).filter((f) => f.endsWith(".mjs") && f !== "run.mjs" && f !== "ui-check.mjs").sort()
let failed = 0
for (const f of files) {
  const name = f.replace(/\.mjs$/, "")
  const r = spawnSync(process.execPath, [join(here, f)], { encoding: "utf8" })
  const ok = r.status === 0
  if (!ok) failed++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(18)} ${WHAT[name] || ""}`)
  if (!ok) console.log((r.stdout + r.stderr).split("\n").filter((l) => /FAIL|Error/.test(l)).slice(0, 6).map((l) => `        ${l}`).join("\n"))
}
console.log(`\n${files.length - failed}/${files.length} suites passing`)
process.exit(failed ? 1 : 0)
