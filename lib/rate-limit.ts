/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * This is per-process (per serverless instance), not global — a production deploy
 * should back this with Vercel KV / Upstash for a shared counter. But even on its
 * own it stops a single client from hammering one warm instance and draining the
 * Fish / LLM spend, which is the immediate exposure on the open AIRRAW endpoints.
 */
const buckets = new Map<string, number[]>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const since = now - windowMs
  const arr = (buckets.get(key) || []).filter((t) => t > since)
  if (arr.length >= limit) {
    buckets.set(key, arr)
    return { ok: false, retryAfter: Math.max(1, Math.ceil((arr[0] + windowMs - now) / 1000)) }
  }
  arr.push(now)
  buckets.set(key, arr)
  // Opportunistic GC so a flood of unique keys can't grow the map without bound.
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.some((t) => t > since)) buckets.delete(k)
  return { ok: true, retryAfter: 0 }
}

export function clientIp(req: Request): string {
  // Prefer x-real-ip: on Vercel it's set to the true client IP and is harder to
  // spoof than the leftmost X-Forwarded-For (which a caller can inject). Fall back
  // to the LAST XFF hop (closest proxy's view) rather than the spoofable first.
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  const xff = req.headers.get("x-forwarded-for")
  if (xff) { const parts = xff.split(","); return parts[parts.length - 1].trim() }
  return "anon"
}

// ── Global spend guard ──────────────────────────────────────────────────────
// Paid traffic brings many unique IPs, so a per-IP limit alone can't bound total
// cost. This is a hard daily ceiling on billable AI calls (chat + TTS) plus an
// instant kill-switch, so a launch can't quietly drain the Fish/LLM budget.
//
// In-memory => per serverless instance. Set AIRRAW_DAILY_CALL_CAP conservatively
// (a few low-traffic instances each get their own bucket) and treat AIRRAW_KILL
// as the real emergency stop. A KV-backed global counter is the production upgrade.
let _dayKey = ""
let _dayCount = 0

export function globalGate(): { ok: boolean; reason?: string } {
  if (process.env.AIRRAW_KILL === "1") return { ok: false, reason: "paused" }
  // Fail-SAFE: an unset cap defaults to a real ceiling, not infinity, so a fresh
  // deploy can never launch with zero spend protection. Raise it deliberately via
  // env once you've sized your budget (see LAUNCH.md). Note: this counter is
  // per-instance, so the true ceiling is ~(instances × cap) — keep a hard
  // provider-side spend limit (Fish/RunPod/Vercel) as the real backstop.
  // 5000/instance was sized when a generation was a few tenths of a cent on a
  // rented GPU. Faces come from a paid API now, so the same number is a bill
  // rather than a ceiling. 800 is roughly a day of real browsing and still an
  // amount a project with no money can absorb if something runs away.
  // Raise it deliberately once revenue covers it.
  const cap = Number(process.env.AIRRAW_DAILY_CALL_CAP || "800")
  if (cap > 0) {
    const today = new Date().toISOString().slice(0, 10) // UTC day
    if (today !== _dayKey) { _dayKey = today; _dayCount = 0 }
    if (_dayCount >= cap) return { ok: false, reason: "capacity" }
    _dayCount++
  }
  return { ok: true }
}
