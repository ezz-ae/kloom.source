// TEXT-TO-VIDEO — the expensive path, so the guards are about money and time.
//
// A clip is minutes of rented GPU. Three things follow from that, and each has a
// failure mode worse than "it didn't work":
//
//   1. A request that waits for the whole job sometimes dies holding a finished
//      video nobody receives — paid for, never delivered.
//   2. The same scene asked for twice should cost once.
//   3. A worker's own storage is temporary, so a clip that isn't copied into our
//      bucket is a saved character whose media quietly disappears.
import { readFileSync } from "node:fs"
import { strict as assert } from "node:assert"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const vid = readFileSync("lib/airraw/video.ts", "utf8")
const vidCode = strip("lib/airraw/video.ts")
const media = readFileSync("app/api/media/route.ts", "utf8")
const mediaCode = strip("app/api/media/route.ts")

// ── nobody else's content policy in the loop ────────────────────────────────
// Every hosted text-to-video API prohibits this content. Building on one means
// the feature works until somebody looks. A rented GPU sells compute, not a
// content licence.
check(/api\.runpod\.ai/.test(vidCode), "video runs on a GPU we rent")
check(!/runwayml|pika\.art|lumalabs|api\.klingai|replicate\.com|fal\.run/i.test(vidCode),
  "and not through a hosted API that forbids the content")
check(/RUNPOD_VIDEO_ENDPOINT_ID/.test(vidCode), "the endpoint is configuration, so the model can be swapped")

// ── a long job must outlive its request ────────────────────────────────────
check(/\/run\b/.test(vidCode) && /\/status\//.test(vidCode),
  "generation is start-then-poll, not one blocking call")
check(!/\/runsync/.test(vidCode), "it never uses the synchronous endpoint — a clip outlives the request")
check(/status: "running"/.test(vidCode), "giving up waiting is a STATUS, not an error")
// waitVideo must not cancel the job it stopped waiting for: the GPU keeps going
// and the id is how we collect it later. A cancel here would burn the money.
check(!/\/cancel/.test(vidCode), "and it never cancels the job it stopped waiting for")
check(/202/.test(mediaCode) && /jobId/.test(mediaCode), "the route hands back the job id instead of failing")
check(/export async function GET/.test(mediaCode), "and there is a way to collect it afterwards")

// The wait budget has to leave room for the upload that follows it, inside the
// route's own declared maxDuration.
const maxDur = Number((media.match(/maxDuration\s*=\s*(\d+)/) || [])[1] || 0)
const budgetMs = Number((media.match(/waitVideo\(job\.id,\s*([\d_]+)\)/) || [])[1]?.replace(/_/g, "") || 0)
check(maxDur > 0 && budgetMs > 0, `both the limit (${maxDur}s) and the wait budget (${budgetMs}ms) are stated`)
check(budgetMs / 1000 < maxDur - 30,
  `the wait leaves headroom for the upload (${budgetMs / 1000}s wait inside a ${maxDur}s limit)`)

// ── the same clip is not paid for twice ────────────────────────────────────
check(/cachedVideo/.test(mediaCode), "a finished clip is looked up before anything is spent")
const videoBranch = mediaCode.slice(mediaCode.indexOf('if (kind === "video")'), mediaCode.indexOf("export async function GET"))
check(videoBranch.indexOf("cachedVideo") < videoBranch.indexOf("startVideo"),
  "and the cache is checked BEFORE the job starts, which is the only order that saves money")
check(/cachedVideo/.test(mediaCode.slice(mediaCode.indexOf("export async function GET"))),
  "the collect path checks it too, so a second poll doesn't re-upload")

// ── the clip has to still be there tomorrow ────────────────────────────────
check(/storeVideo/.test(mediaCode) && /upload\(/.test(mediaCode), "finished clips are copied into our own bucket")
check(/async function collect/.test(mediaCode) && /await fetch\(r\.url/.test(mediaCode),
  "including when the worker returns a link to its own temporary storage")

// ── a client cannot steer a storage path ───────────────────────────────────
// The scene id is the only part of the path a caller influences. It is validated
// to the shape we mint rather than escaped.
check(/function safeSceneId/.test(mediaCode), "the scene id is validated, not trusted")
const re = (mediaCode.match(/\/\^\[a-z0-9\]\{1,\d+\}\$\//) || [])[0]
check(!!re, "and validated against an explicit allowlist pattern")
if (re) {
  const rx = new RegExp(re.slice(1, -1))
  for (const bad of ["../../etc/passwd", "a/b", "a.mp4", "", "A".repeat(41), "x'y", "%2e%2e"]) {
    assert.equal(rx.test(bad), false, `path-ish scene id must be refused: ${bad}`)
  }
  check(rx.test("k3j9zq"), "a real base36 scene id passes")
  check(true, "no traversal, slash, dot or overlong id gets through")
}
check(/videoPath = \(sceneId/.test(mediaCode) && /`video\//.test(mediaCode),
  "clips live under their own prefix")

// ── same gates as everything else on this surface ──────────────────────────
check(/adultEnabled\(\)/.test(mediaCode), "the route is still AIRRAW-only")
check((mediaCode.match(/adultEnabled\(\)/g) || []).length >= 2, "on the collect path as well as the generate path")
check(/rateLimit\(/.test(mediaCode.slice(mediaCode.indexOf("export async function GET"))),
  "and polling is rate-limited too — it is a public endpoint")

// ── unconfigured says so, rather than hanging ──────────────────────────────
check(/501/.test(mediaCode) && /RUNPOD_VIDEO_ENDPOINT_ID/.test(mediaCode),
  "no endpoint configured is a 501 naming the missing variable")

// ── the worker's output shape is not assumed ───────────────────────────────
// Workers disagree about this and always will; accepting the common shapes is
// what lets the model be swapped without touching anything else.
check(/base64/.test(vidCode) && /https\?:/.test(vidCode), "base64 and URL outputs are both understood")
check(/depth > 4/.test(vidCode), "the search is depth-bounded")
check(/seen\.has\(v\)/.test(vidCode), "and cycle-safe, so a self-referencing payload can't hang it")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
