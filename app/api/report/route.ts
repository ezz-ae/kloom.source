// "Something's wrong" — with enough attached to actually find it.
//
// A bug report that says "the voice didn't work" is unactionable, and asking a
// person to describe their browser is asking them to do our job. So the client
// attaches what a developer would have asked for anyway: build, screen, engine
// tiers, the last few failed requests, whether they hold a pass.
//
// WHAT IT NEVER ATTACHES. Not one word of any conversation. This is an adult
// product; a diagnostic bundle that hoovers up transcripts would be the single
// most damaging thing in the codebase, and "we only look at it when there's a
// bug" is not a protection — it is an intention. The client sends technical
// fields only (lib/airraw/report.ts), and this route stores only the fields it
// recognises, so a future client that starts sending more cannot quietly widen
// what is kept.
//
// It lands in the server log with a findable prefix. No table, no migration,
// nothing for anyone to run — reports show up in the runtime logs alongside
// everything else, which is where you are already looking when something breaks.
import type { NextRequest } from "next/server"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"

export const maxDuration = 15

/** The only fields kept. Anything else the client sends is dropped on the floor. */
const KEEP = [
  "note", "kind", "build", "url", "ua", "screen", "lang", "pro", "chips", "golden",
  "voice", "stt", "online", "at", "recent",
] as const

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit(`report:${ip}`, 6, 10 * 60_000)
  if (!rl.ok) return Response.json({ ok: false, error: "you've sent a few already — give it a minute" }, { status: 429 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* */ }

  // Allow-list, not deny-list. A deny-list is a promise; an allow-list is a fact.
  const clean: Record<string, unknown> = {}
  for (const k of KEEP) if (body[k] !== undefined) clean[k] = body[k]

  const note = String(clean.note || "").trim().slice(0, 2000)
  if (!note) return Response.json({ ok: false, error: "tell us what happened" }, { status: 400 })
  clean.note = note
  // Truncate the diagnostic tail rather than trusting its size.
  if (Array.isArray(clean.recent)) clean.recent = (clean.recent as unknown[]).slice(0, 12)

  const id = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  // One line, one prefix, greppable in the runtime logs. This is the whole
  // storage layer, deliberately — nothing to migrate and nowhere for it to rot.
  console.error(`[report ${id}] ${JSON.stringify({ ...clean, ip: ip.slice(0, 20) })}`)

  // If a table happens to exist, keep it there too. Never required, never blocks.
  if (hasAdmin()) {
    try {
      await getAdminClient().from("airraw_reports").insert({ id, payload: clean, ip: ip.slice(0, 40) })
    } catch { /* the log line above is the record that matters */ }
  }

  return Response.json({ ok: true, id })
}
