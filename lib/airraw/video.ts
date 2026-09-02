// TEXT-TO-VIDEO, on a GPU we rent rather than an API we ask permission from.
//
// WHY RUNPOD AND NOT A HOSTED API. Every mainstream text-to-video service —
// Runway, Pika, Luma, Kling, and the aggregators in front of them — prohibits
// this content in its terms. Building on one would mean the feature works until
// somebody looks, then the account goes and every video with it. A serverless GPU
// endpoint runs a model WE choose on hardware WE rent: the provider sells compute,
// not a content licence, so there is nothing to be thrown off.
//
// That makes the endpoint id the only integration point. Deploy a video worker on
// RunPod (Wan 2.x, LTX-Video and HunyuanVideo are the current open weights worth
// pointing at) and set RUNPOD_VIDEO_ENDPOINT_ID. Nothing here is model-specific
// beyond the input field names, which are the ComfyUI/diffusers convention every
// one of those workers already speaks.
//
// ── WHY THIS IS ASYNC AND THE IMAGE PATH ISN'T ───────────────────────────────
//
// A portrait is seconds; a few seconds of video is minutes, and a cold worker
// adds more. That is longer than a serverless function may live, so a request
// that waits for the whole thing is a request that sometimes dies holding a
// finished video nobody ever receives.
//
// So the job id is the product of starting a job. The caller waits a while — most
// short clips land inside it — and if the budget runs out it hands the id back
// instead of an error. The GPU keeps working either way, and polling later
// collects the result. Nothing is lost by being slow, which is the property that
// matters when each job costs real money.

const RP_KEY = process.env.RUNPOD_API_KEY || ""
const RP_VIDEO = process.env.RUNPOD_VIDEO_ENDPOINT_ID || ""

export function videoConfigured(): boolean {
  return !!RP_KEY && !!RP_VIDEO
}

const base = () => `https://api.runpod.ai/v2/${RP_VIDEO}`
const headers = () => ({ Authorization: `Bearer ${RP_KEY}`, "Content-Type": "application/json" })

export interface VideoJob {
  /** RunPod's job id — the handle for everything after this. */
  id: string
}

export interface VideoResult {
  status: "running" | "done" | "failed"
  bytes?: Buffer
  /** Some workers return a URL rather than the payload. */
  url?: string
  error?: string
}

/**
 * Kick off a generation. Returns as soon as the job is QUEUED — it does not wait.
 *
 * The defaults are deliberately modest: ~3 seconds at 480p. Video cost scales with
 * frames times pixels, so a generous default is the difference between a feature
 * and a bill. Callers that want more should say so explicitly.
 */
export async function startVideo(opts: {
  prompt: string
  negative?: string
  seed?: number
  frames?: number
  fps?: number
  width?: number
  height?: number
}): Promise<VideoJob> {
  if (!videoConfigured()) throw new Error("video endpoint not configured")
  const res = await fetch(`${base()}/run`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      input: {
        prompt: opts.prompt,
        negative_prompt: opts.negative || "",
        width: opts.width ?? 480,
        height: opts.height ?? 640,
        num_frames: opts.frames ?? 49,
        fps: opts.fps ?? 16,
        seed: opts.seed ?? 0,
      },
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    throw new Error(`runpod ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`)
  }
  const data = await res.json()
  const id = data?.id
  if (!id) throw new Error("runpod returned no job id")
  return { id }
}

/** Ask once. Never throws for "still going" — that is a status, not a failure. */
export async function pollVideo(jobId: string): Promise<VideoResult> {
  if (!videoConfigured()) return { status: "failed", error: "video endpoint not configured" }
  try {
    const res = await fetch(`${base()}/status/${encodeURIComponent(jobId)}`, {
      headers: headers(),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return { status: "failed", error: `poll http ${res.status}` }
    const data = await res.json()
    const st = String(data?.status || "")
    if (st === "IN_QUEUE" || st === "IN_PROGRESS") return { status: "running" }
    if (st !== "COMPLETED") {
      return { status: "failed", error: `${st}: ${JSON.stringify(data?.error || "").slice(0, 200)}` }
    }
    const out = bytesFromOutput(data?.output)
    if (out.url) return { status: "done", url: out.url }
    if (out.bytes) return { status: "done", bytes: out.bytes }
    return { status: "failed", error: "worker completed with no video in its output" }
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Wait for a job, up to a budget, then give up WITHOUT killing it.
 *
 * "running" here means the caller should hand the job id back to the client, not
 * that anything went wrong — see the header. The budget is the caller's, because
 * only the caller knows how long its own request is allowed to live.
 */
export async function waitVideo(jobId: string, budgetMs: number): Promise<VideoResult> {
  const deadline = Date.now() + budgetMs
  // 4s is a compromise: fast enough that a quick clip isn't left sitting finished,
  // slow enough that a three-minute job is a few dozen requests and not a thousand.
  while (Date.now() < deadline) {
    const r = await pollVideo(jobId)
    if (r.status !== "running") return r
    const left = deadline - Date.now()
    if (left <= 0) break
    await new Promise((res) => setTimeout(res, Math.min(4000, left)))
  }
  return { status: "running" }
}

/**
 * Dig the video out of whatever shape the worker used.
 *
 * Workers disagree about this and always will — some return base64, some a link
 * to their own storage, some wrap either in a list. Accepting the common shapes
 * here is what lets the endpoint be swapped for a better model without touching
 * anything else.
 */
function bytesFromOutput(out: unknown): { bytes?: Buffer; url?: string } {
  const seen = new Set<unknown>()
  const walk = (v: unknown, depth = 0): { bytes?: Buffer; url?: string } => {
    if (v == null || depth > 4) return {}
    if (typeof v === "string") {
      if (/^https?:\/\//i.test(v)) return { url: v }
      // data: URI, or bare base64 long enough not to be a label.
      const m = v.match(/^data:video\/[a-z0-9.+-]+;base64,(.+)$/i)
      if (m) return { bytes: Buffer.from(m[1], "base64") }
      if (v.length > 512 && /^[A-Za-z0-9+/=\s]+$/.test(v)) {
        return { bytes: Buffer.from(v.replace(/\s/g, ""), "base64") }
      }
      return {}
    }
    if (Array.isArray(v)) {
      for (const item of v) { const r = walk(item, depth + 1); if (r.bytes || r.url) return r }
      return {}
    }
    if (typeof v === "object") {
      if (seen.has(v)) return {}
      seen.add(v)
      const o = v as Record<string, unknown>
      // Look at the likely keys first so a worker that returns both a thumbnail
      // and a video doesn't hand back the thumbnail.
      for (const k of ["video", "video_url", "url", "output", "mp4", "data", "result", "images"]) {
        if (k in o) { const r = walk(o[k], depth + 1); if (r.bytes || r.url) return r }
      }
      for (const val of Object.values(o)) { const r = walk(val, depth + 1); if (r.bytes || r.url) return r }
    }
    return {}
  }
  return walk(out)
}
