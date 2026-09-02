// A rejected LLM key must be asked once, not on every turn.
//
// Production logs showed the xAI seat failing on EVERY /api/chat request for
// hours — "Incorrect API key provided", over and over, each one a wasted round
// trip in front of someone waiting for a reply. Same shape as the image key: an
// error that can never succeed, retried as though it might.
import { readFileSync } from "node:fs"
let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const src = readFileSync("lib/llm-backends.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

check(/const seatOffUntil/.test(src) && /seatRejected/.test(src), "a rejected seat is parked")
check(/if \(seatRejected\(backend\)\) \{ yield\* houseFallback/.test(src),
  "the primary skips a parked seat instead of re-paying the 401")
check(/\|\| seatRejected\(name\)\) continue/.test(src),
  "and so does the fallback cascade, or the same dead key costs twice")
check(/AUTH_OFF_MS/.test(src) && /Date\.now\(\) \+ AUTH_OFF_MS/.test(src),
  "the park expires — a new key must not need a redeploy to be tried")

// Only auth failures latch. A rate limit or a network blip is exactly the kind
// of failure worth retrying, and parking those would take the seat down for ten
// minutes over a hiccup.
const note = src.slice(src.indexOf("function noteSeatFailure"))
const body = note.slice(0, note.indexOf("\n}"))
check(/incorrect api key|invalid api key|unauthorized|authentication/i.test(body),
  "it matches the provider's message, since xAI answers 400 for a bad key")
check(!/\b429\b/.test(body) && !/\b5\d\d\b/.test(body), "rate limits and server errors are NOT parked")

// ── the latch has to OUTLIVE the request that set it ────────────────────────
// It shipped declared inside streamLLM, which broke it twice over and silently:
// seatOffUntil was a fresh const on every call, so a parked seat un-parked
// itself before the next turn ever asked; and houseFallback — a separate
// top-level function — couldn't see the names at all, so the fallback cascade
// threw a ReferenceError on exactly the path the latch exists for. Nothing
// errored at build time because the seat path only runs when a key is rejected.
const declIdx = src.indexOf("const seatOffUntil")
const streamIdx = src.indexOf("export async function* streamLLM")
check(declIdx > 0 && streamIdx > 0 && declIdx < streamIdx,
  "the parked-seat state lives at module scope, above every function that reads it")
check(src.indexOf("function noteSeatFailure") < streamIdx,
  "and so does the function that sets it, so the fallback cascade can call it")
// Module scope means column zero. Anything indented is inside something.
check(/^const seatOffUntil/m.test(src) && /^function noteSeatFailure/m.test(src) && /^const seatRejected/m.test(src),
  "all three are declared unindented — a nested copy would be per-request state again")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
