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
  "a missing table fails OPEN, and says so")

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
