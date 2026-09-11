// EVERYTHING, REGISTERED AND NOT, AGAINST A RUNNING SERVER.
//
// Asked for after a night of "it's broken" that turned out to be four different
// things in four different places. This asks the server itself, in both states
// and both languages, and prints what it answered — so "the voice is broken" or
// "the accounts are broken" becomes a line with a provider name next to it.
//
//   node db/verify-live.mjs                     # production, visitor only
//   node db/verify-live.mjs --base http://localhost:3131 --secret probe-secret
//
// The pass side needs a secret to mint a token with, so against production —
// where the secret lives in Vercel and not here — it reports the visitor side
// in full and says plainly that the pass side was not exercised.
import { createHmac } from "node:crypto"

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const BASE = (arg("--base", "https://airraw.com")).replace(/\/$/, "")
const SECRET = arg("--secret", process.env.AIRRAW_PRO_SECRET || "")
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"

const mint = (sec, ms = 86_400_000) => {
  const p = Buffer.from(JSON.stringify({ until: Date.now() + ms, v: 1, adult18: true, minutes: 6000 })).toString("base64")
  return `${p}.${createHmac("sha256", sec).update(p).digest("hex")}`
}
const PASS = SECRET ? mint(SECRET) : ""
const FORGED = mint("definitely-not-the-secret")
const rid = () => `v-${Math.random().toString(36).slice(2)}${Date.now()}`

let bad = 0
const say = (ok, label, detail) => { console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `   ${detail}` : ""}`); if (!ok) bad++ }
// A local build has no provider keys. "Not configured here" is not a failure —
// saying it is would train everyone to ignore this output.
const skip = (label, detail) => console.log(`--   ${label}   ${detail}`)
const post = async (path, body, headers = {}) => {
  const r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": UA, ...headers }, body: JSON.stringify(body) })
  const ct = r.headers.get("content-type") || ""
  const buf = Buffer.from(await r.arrayBuffer())
  return { r, buf, json: ct.includes("json") ? JSON.parse(buf.toString() || "{}") : null, text: ct.startsWith("text") ? buf.toString() : "" }
}
const tts = (text, language, who, token) =>
  post("/api/tts", { text, personaName: who, seedKey: who, gender: "female", language, visitorId: rid(), mode: "voice", ...(token ? { proToken: token } : {}) })

console.log(`\n═══ ${BASE} ═══\n`)

console.log("── THE DOOR ──")
{
  // A deploy that half-landed shows as a page that loads and scripts that 404,
  // and nothing else here would catch it.
  const r = await fetch(BASE + "/", { headers: { "User-Agent": UA } })
  const html = await r.text()
  const chunks = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map((m) => m[1])
  say(r.status === 200 && html.length > 4000, "the front page loads", `${r.status} ${(html.length / 1024).toFixed(0)}KB`)
  let broken = 0
  for (const u of chunks) {
    const c = await fetch(BASE + u, { headers: { "User-Agent": UA } })
    if (!c.ok) broken++
  }
  say(chunks.length > 0 && broken === 0, "and every script it needs", `${chunks.length - broken}/${chunks.length} load`)
  // The faces are served from storage, not from us. A dead bucket empties the
  // floor and the app itself would look fine.
  const face = await fetch("https://sekntmutponnopywhnsd.supabase.co/storage/v1/object/public/character-photos/layla-1530719533-r3-gsfz3k.jpg", { method: "HEAD" })
  say(face.ok, "and a warmed face is still in storage", `${face.status}`)
}

console.log("\n── THE VOICE, as a visitor who has not paid ──")
const probe = await tts("hello.", "English", "bea")
const TTS_LIVE = probe.r.status === 200
if (!TTS_LIVE) skip("no voice engine on this server", `${probe.r.status} ${(probe.json?.error || "").slice(0, 60)} — the voice checks are not exercised`)
for (const [lang, line] of TTS_LIVE ? [["English", "hey, it's good to hear you tonight."], ["Arabic", "أهلاً، وحشتني. قوللي عملت إيه النهارده."]] : []) {
  const { r, buf } = await tts(line, lang, "bea")
  const prov = r.headers.get("x-tts-provider"), tier = r.headers.get("x-tts-tier")
  say(r.status === 200 && buf.length > 15000 && prov === "elevenlabs",
    `${lang.padEnd(8)} speaks`, `${r.status} ${prov || "-"} tier=${tier || "-"} ${(buf.length / 1024).toFixed(0)}KB`)
}
if (TTS_LIVE) {
  const names = ["bea", "nadia", "salma", "maya", "oksana", "hugo", "theo", "reza"]
  const voices = []
  for (const n of names) {
    const { r } = await tts("hey there.", "English", n)
    voices.push(r.headers.get("x-el-voice") || "-")
  }
  const distinct = new Set(voices.filter((v) => v !== "-")).size
  say(distinct === names.length, "eight people, eight voices", `${distinct}/${names.length} distinct`)
}
for (const [lang, iso] of TTS_LIVE ? [["English", "en"], ["Arabic", "ar"]] : []) {
  const { buf } = await tts(lang === "Arabic" ? "قوللي حاجة حلوة." : "say something nice.", lang, "bea")
  const form = new FormData()
  form.append("file", new Blob([buf], { type: "audio/mpeg" }), "audio.mp3")
  form.append("language", iso)
  const r = await fetch(BASE + "/api/stt", { method: "POST", body: form, headers: { "User-Agent": UA } })
  const d = await r.json().catch(() => ({}))
  say(r.status === 200 && !!d.text, `${lang.padEnd(8)} is heard`, `${r.status} ${r.headers.get("x-stt-provider") || "-"} "${(d.text || "").slice(0, 40)}"`)
}
for (const lang of ["English", "Arabic"]) {
  const { r, text } = await post("/api/chat", {
    persona: { name: "Bea", personality: "You are Bea, warm, late at night. One short line.", speakingStyle: "close to the mic", backstory: "", language: lang, seedKey: "bea" },
    messages: [{ role: "user", content: lang === "Arabic" ? "لسه صاحي؟" : "still up?" }],
  })
  const seat = r.headers.get("x-llm-seat") || "-"
  // seat=local with nothing in it means no model key on this server at all: the
  // router fell all the way through to an endpoint that is not running.
  if (seat === "local" && !text.trim()) skip(`${lang.padEnd(8)} answers`, "no model key on this server — not exercised")
  else say(r.status === 200 && text.trim().length > 2, `${lang.padEnd(8)} answers`, `${r.status} seat=${seat} "${text.trim().slice(0, 40)}"`)
}

console.log("\n── THE VOICE, with a pass ──")
if (!PASS) skip("the paid voice is not exercised", "no secret here — pass --secret, or run this against a local build")
else if (!TTS_LIVE) skip("the paid voice is not exercised", "no voice engine on this server")
else {
  const { r } = await tts("hey, it's good to hear you.", "English", "bea", PASS)
  say(r.headers.get("x-tts-tier") === "pass", "a real pass is honoured", `tier=${r.headers.get("x-tts-tier")} ${r.headers.get("x-tts-provider")}`)
}
if (TTS_LIVE) {
  const { r } = await tts("hey.", "English", "bea", FORGED)
  const why = r.headers.get("x-pass")
  say(why === "rejected", "a forged pass is refused", `x-pass=${why || "-"} ${r.status}`)
}

console.log("\n── THE ACCOUNTS ──")
{
  const r = await fetch(BASE + "/api/airraw-pro", { headers: { "User-Agent": UA } })
  const d = await r.json()
  const rails = (d.methods || []).join(", ")
  if (r.status === 200 && d.price > 0 && !rails) skip("no payment rail on this server", `$${d.price} / ${d.days}d — no Ziina or crypto key here`)
  else say(r.status === 200 && d.price > 0 && !!rails, "the offer is live", `$${d.price} / ${d.days}d · rails: ${rails || "NONE"}`)
}
{
  const { json } = await post("/api/airraw-pro", { action: "verify", token: "garbage" })
  say(json?.valid === false && json?.reason === "rejected", "a made-up restore code is refused", JSON.stringify(json))
  const f = await post("/api/airraw-pro", { action: "verify", token: FORGED })
  say(f.json?.valid === false, "and so is one signed with the wrong secret", JSON.stringify(f.json))
}
if (PASS) {
  const { json } = await post("/api/airraw-pro", { action: "verify", token: PASS })
  say(json?.valid === true && json?.until > Date.now(), "a real restore code is accepted", `until ${json?.until ? new Date(json.until).toISOString().slice(0, 10) : "-"}`)
}
{
  const a = await post("/api/airraw-pro", { action: "restore_by_email", email: "not-an-email" })
  say(a.json?.reason === "bad-email", "restore by email refuses a non-address", JSON.stringify(a.json))
  const b = await post("/api/airraw-pro", { action: "restore_by_email", email: `nobody-${Date.now()}@example.com`, visitorId: rid() })
  say(["no-pass", "unavailable"].includes(b.json?.reason), "and an address that never bought gets nothing", JSON.stringify(b.json))
}

// A fresh visitor must be able to hear her TWICE — the free minute used to be
// spent for the life of the browser, so a second visit was silent.
if (TTS_LIVE) {
  console.log("\n── AND TOMORROW'S VISITOR ──")
  const v = rid()
  const line = "a sentence of roughly a hundred and twenty characters, spoken out loud, to spend a little of the free allowance."
  let last = 0
  for (let i = 0; i < 3; i++) {
    const r = await fetch(BASE + "/api/tts", {
      method: "POST", headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({ text: line, personaName: "bea", seedKey: "bea", gender: "female", language: "English", visitorId: v, mode: "voice" }),
    })
    last = r.status
    if (r.status !== 200) break
    await r.arrayBuffer()
  }
  say(last === 200, "one visitor can hear three lines in a row", `last call ${last}`)
}

console.log(bad ? `\n${bad} FAILED\n` : "\nall green\n")
process.exit(bad ? 1 : 0)
