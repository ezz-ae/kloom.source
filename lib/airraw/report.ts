"use client"

// What gets attached to a bug report, and — more importantly — what does not.
//
// THE RULE: technical facts only. Not one word of any conversation, not a
// character's name, not a scene, not a photo. This is an adult product. A
// diagnostic bundle that swept up transcripts would be the most damaging thing
// in the codebase, and "we only read it when there's a bug" is an intention
// rather than a protection. So the transcript is not excluded downstream — it is
// never collected, and the report screen says so in plain words where the person
// can read it before they send.
//
// Everything here answers a question a developer would otherwise have to ask:
// which build, which screen, which engines, what failed just before.

const RECENT_MAX = 12
const recent: Array<{ at: number; what: string; status: number }> = []

/**
 * Remember that a request failed. Called from the fetch paths that matter, so a
 * report carries the last few failures instead of "it didn't work".
 */
export function noteFailure(what: string, status: number) {
  recent.push({ at: Date.now(), what: what.slice(0, 60), status })
  if (recent.length > RECENT_MAX) recent.splice(0, recent.length - RECENT_MAX)
}

export interface ReportContext {
  kind?: string
  pro?: boolean
  chips?: number
  golden?: number
  voice?: string
  stt?: string
}

/** The bundle. Deliberately small, and deliberately dull. */
export function buildReport(note: string, ctx: ReportContext = {}) {
  const nav = typeof navigator === "undefined" ? undefined : navigator
  return {
    note: note.slice(0, 2000),
    kind: ctx.kind || "general",
    // Where in the app, without the query string — a share or a claim link can
    // carry a token, and a bug report is not a place to put one.
    url: typeof location === "undefined" ? "" : `${location.pathname}`,
    build: process.env.NEXT_PUBLIC_BUILD_ID || "dev",
    ua: nav?.userAgent?.slice(0, 180) || "",
    lang: nav?.language || "",
    screen: typeof window === "undefined" ? "" : `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio || 1}`,
    online: nav?.onLine ?? true,
    pro: !!ctx.pro,
    chips: ctx.chips ?? null,
    golden: ctx.golden ?? null,
    voice: ctx.voice || "",
    stt: ctx.stt || "",
    at: new Date().toISOString(),
    recent: recent.slice(-RECENT_MAX),
  }
}

/** Everything the bundle contains, in the words shown to the person sending it. */
export const REPORT_INCLUDES = [
  "which page you were on",
  "your browser, screen size and language",
  "which build you're running",
  "anything that failed in the last few minutes",
]

/** And what it never contains. Shown next to the above, not buried. */
export const REPORT_EXCLUDES = "nothing you said, and nothing anyone said to you"

export async function sendReport(note: string, ctx?: ReportContext): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const r = await fetch("/api/report", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildReport(note, ctx)),
    })
    const d = await r.json()
    return d?.ok ? { ok: true, id: d.id } : { ok: false, error: d?.error || "couldn't send that" }
  } catch {
    return { ok: false, error: "you seem to be offline" }
  }
}
