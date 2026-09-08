// Everyone hears the same premium voice; what differs is the meter.
//
// A free caller gets one minute, counted on the SERVER by browser id and by IP
// so clearing storage doesn't refill it; a pass draws on its own allowance; past
// either, the answer is a 402 the call screen turns into the pass sheet — never
// a call that just goes quiet. Kloom's engine order is untouched because the
// whole gate sits behind the variant.
import { readFileSync } from "node:fs"

let fails = 0
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) fails++ }
const read = (p) => readFileSync(p, "utf8")

const tts = read("app/api/tts/route.ts")
check(/const airraw = adultEnabled\(\)/.test(tts) && /const claims = airraw \? proTokenClaims\(proToken\) : null/.test(tts),
  "the tier gate sits behind the variant — on Kloom nothing changes")
check(/if \(elKey\) \{/.test(tts) && !/useEleven/.test(tts), "everyone hears the same premium engine — free is not a downgrade")
check(/if \(tier === "free"\) \{\s*\n\s*const v = await spendFreeChars\(visitorId, clientIp\(request\), ttsText\.length\)/.test(tts),
  "a free caller's minute is metered on the server, by browser id and IP")
check(/status: 402/.test(tts) && /paywall: true/.test(tts) && /tierHeaders\["X-Free"\]/.test(tts),
  "past the minute the answer is a 402 that names itself")
check(/if \(!v\.ok\) \{ tier = "free"; tierHeaders\["X-Pass"\] = v\.reason/.test(tts),
  "an exhausted pass falls to the free allowance with the reason in X-Pass")
check(/tierHeaders\["X-TTS-Tier"\] = tier/.test(tts) && (tts.match(/\.\.\.tierHeaders/g) || []).length >= 2,
  "every voice response says which tier paid for it")
check(/const f = await fishSpeak\(/.test(tts) && /fishDeadUntil = Date\.now\(\) \+ FISH_OFF_MS/.test(tts),
  "Fish is the fallback when the premium engine can't, and an expired key is latched, not retried per chunk")

for (const f of ["components/airroom/AirBubble.tsx", "components/airroom/GroupRoom.tsx", "components/airroom/Planet.tsx", "components/airroom/RoomCard.tsx"]) {
  const s = read(f)
  const short = f.replace("components/airroom/", "")
  check(/proToken: getProToken\(\)/.test(s), `${short}: presents the pass with every voice request`)
  check(/visitorId: visitorId\(\)/.test(s), `${short}: presents the browser id, so the free minute is per visitor`)
}
const air = read("components/airroom/AirBubble.tsx")
check(/res\.status === 402/.test(air) && /setShowPro\(true\)/.test(air) && /your free minute is up/.test(air),
  "a used-up minute opens the pass sheet and says why")
check(/why === "daily-cap"/.test(air), "a pass holder at today's cap is told to come back, not sold a pass")

const meter = read("lib/airraw/pass-meter.ts")
check(/export async function spendFreeChars/.test(meter) && /free:v:\$\{bucket\(vid\)\}/.test(meter) && /free:ip:\$\{bucket\(ip/.test(meter),
  "the free minute has two buckets: the browser for life, the IP per day")
check(/FREE_VOICE_CHARS = Math\.max\(0, Number\(process\.env\.FREE_VOICE_CHARS \?\? 400\)\)/.test(meter),
  "the minute is ~400 characters of speech, tunable without a deploy")
check(/createHash\("sha256"\)\.update\(token\)/.test(meter) && /rpc\("pass_spend"/.test(meter),
  "pass usage is keyed on a hash of the signed token")
check(/offUntil = Date\.now\(\) \+ OFF_MS/.test(meter) && /return \{ ok: true, unmetered: true \}/.test(meter),
  "a missing table fails OPEN for a PASS, and says so — losing paid voice to a missing table is the worse failure")

// ── but the free wall still has to stand ────────────────────────────────────
// Failing open is right for someone who paid and wrong for someone who has not:
// for a free visitor it does not shorten the minute, it removes it. This is not
// hypothetical — with the meter's table missing, one day served 1,818 voice
// calls and showed the paywall exactly once. The product was being given away
// in the expensive engine, to everyone, on a budget of zero.
const freeFn = meter.slice(meter.indexOf("export async function spendFreeChars"))
check(/function spendMem\(/.test(meter),
  "there is a per-instance counter for when the durable meter cannot answer")
check(/v\.unmetered && !spendMem\(`v:\$\{bucket\(vid\)\}`, chars, FREE_VOICE_CHARS\)/.test(freeFn),
  "an unmetered free spend is counted in memory instead, per visitor")
check(/ipv\.unmetered && !spendMem\(`ip:\$\{bucket\(ip \|\| "anon"\)\}`, chars, FREE_IP_DAILY_CHARS\)/.test(freeFn),
  "and per IP, so a cleared browser does not mint a fresh minute either")
check(/return \{ ok: false, reason: "exhausted" \}/.test(freeFn),
  "and past it a free visitor is refused — the wall stands without the table")
// It must not double-count when the real meter IS working.
check(/if \(v\.unmetered &&/.test(freeFn) && /if \(ipv\.unmetered &&/.test(freeFn),
  "the memory counter runs ONLY when the durable meter counted nothing, so it never double-charges")
check(/memFree\.size > 5000/.test(meter),
  "and the map is bounded, so a long-lived instance cannot grow it forever")

// ── and they can actually HEAR it ───────────────────────────────────────────
// The meter is pointless if the audio it counts arrives silent. This read was
// `Number(localStorage.getItem(VOL_KEY))`, and getItem returns null when the key
// was never written — Number(null) is 0, which is finite, >= 0 and <= 1, so it
// passed the range check and came back as a real preference. Every first-time
// visitor started a private call at volume zero: she spoke, the engine billed
// for it, and they heard nothing, on the one screen the pass exists to sell.
// Run against the real module, because the bug lived in a range check that
// cannot tell absence from a choice.
{
  const store = new Map()
  const prev = globalThis.localStorage
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  }
  const { loadVolume, saveVolume } = await import("../lib/airraw/audio-output.ts")
  check(loadVolume() === 1, `a visitor who never set a volume starts audible (got ${loadVolume()})`)
  saveVolume(0.4)
  check(loadVolume() === 0.4, "a saved level is honoured")
  saveVolume(0)
  check(loadVolume() === 0, "including a deliberate zero — absence and choice are different things")
  store.set("airraw_volume", "abc")
  check(loadVolume() === 1, "and an unreadable value falls back to audible, never to silent")
  globalThis.localStorage = prev
}

const vis = read("lib/airraw/visitor.ts")
check(/if \(typeof window === "undefined"\) return ""/.test(vis) && /localStorage\.setItem\(KEY, mem\)/.test(vis),
  "the browser id is minted once per browser and never on the server")

const credits = read("lib/voice-credits.ts")
check(/export const FREE_SECONDS = adultEnabled\(\) \? 60 : 300/.test(credits), "AIRRAW shows one free minute; Kloom keeps five")

const sql = read("db/pass_usage.sql")
check(/create table if not exists public\.pass_usage/.test(sql) && /for update/.test(sql), "the meter is one atomic row lock per chunk")
check(/enable row level security/.test(sql) && /grant execute on function public\.pass_spend[^;]*to service_role/.test(sql),
  "only the server may spend; the browser can neither read nor write usage")

console.log(fails ? `\n${fails} FAILED` : "\nall tier checks pass")
process.exit(fails ? 1 : 0)
