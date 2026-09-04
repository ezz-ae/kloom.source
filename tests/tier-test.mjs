// The premium voice is what the pass buys — and nothing the browser can reset.
//
// Free callers get the cheap engine; a verified, server-metered pass gets the
// premium one; an exhausted pass drops to cheap, never to silence; and Kloom's
// engine order is untouched because the whole gate sits behind the variant.
import { readFileSync } from "node:fs"

let fails = 0
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) fails++ }
const read = (p) => readFileSync(p, "utf8")

const tts = read("app/api/tts/route.ts")
check(/const airraw = adultEnabled\(\)/.test(tts) && /const claims = airraw \? proTokenClaims\(proToken\) : null/.test(tts),
  "the tier gate sits behind the variant — on Kloom nothing changes")
check(/let useEleven = premium/.test(tts) && /if \(elKey && useEleven\) \{/.test(tts), "the premium engine runs only for a paying tier")
check(/if \(!premium\) \{\s*\n\s*fishFirst = await fishSpeak\(/.test(tts), "a free caller speaks with the cheap engine FIRST")
check(/tierHeaders\["X-Tier-Note"\] = `cheap-engine-down/.test(tts) && /useEleven = true/.test(tts),
  "a free caller is never left silent: a dead cheap engine falls through to premium, and says so")
check(/fishDeadUntil = Date\.now\(\) \+ FISH_OFF_MS/.test(tts) && /lastStatus === 401 \|\| lastStatus === 402 \|\| lastStatus === 403/.test(tts),
  "an expired Fish key is latched off, not retried on every chunk")
check(/fishTried \? fishFirst : await fishSpeak\(/.test(tts), "Fish is never asked twice for one chunk")
check(/tier = "free"; passNote = v\.reason/.test(tts), "an exhausted pass drops to the cheap engine, never to silence")
check(/"X-TTS-Tier": tier/.test(tts) && (tts.match(/\.\.\.tierHeaders/g) || []).length >= 2,
  "every voice response says which tier paid for it")
check(/spendPassChars\(proToken!, claims\.minutes, ttsText\.length\)/.test(tts),
  "what is metered is what the engine bills: characters of the shaped text")

for (const f of ["components/airroom/AirBubble.tsx", "components/airroom/GroupRoom.tsx", "components/airroom/Planet.tsx", "components/airroom/RoomCard.tsx"]) {
  const s = read(f)
  check(/proToken: getProToken\(\)/.test(s), `${f.replace("components/airroom/", "")}: presents the pass with every voice request`)
}

const meter = read("lib/airraw/pass-meter.ts")
check(/createHash\("sha256"\)\.update\(token\)/.test(meter) && /rpc\("pass_spend"/.test(meter),
  "usage is keyed on a hash of the signed token — a cleared browser draws on the same pass")
check(/offUntil = Date\.now\(\) \+ OFF_MS/.test(meter) && /return \{ ok: true, unmetered: true \}/.test(meter),
  "a missing table fails OPEN for pass holders, and says so")
check(/PASS_DAILY_CAP_MIN \* CHARS_PER_MINUTE/.test(meter), "the daily fair-use cap is enforced on the server too")

const sql = read("db/pass_usage.sql")
check(/create table if not exists public\.pass_usage/.test(sql) && /create or replace function public\.pass_spend/.test(sql) && /for update/.test(sql),
  "the meter is one atomic row lock per chunk")
check(/enable row level security/.test(sql) && /revoke all on function public\.pass_spend/.test(sql) && /grant execute on function public\.pass_spend[^;]*to service_role/.test(sql),
  "only the server may spend; the browser can neither read nor write usage")

console.log(fails ? `\n${fails} FAILED` : "\nall tier checks pass")
process.exit(fails ? 1 : 0)
