// A PHOTO OF HER — the one thing that costs cash per unit, sold per unit.
//
// Two invariants, and the tests exist to keep them true against every future
// "let's just give free users one":
//   1. No free path. Not a teaser, not a preview. A free user is shown the wall
//      and the server is never asked — a photo is two cents spent on someone who
//      has not paid.
//   2. Counted BEFORE it is generated, and the meter FAILS CLOSED. A refused
//      request must cost nothing, and a broken meter must generate nothing.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const route = strip("app/api/media/route.ts")
const meter = strip("lib/airraw/pass-meter.ts")
const bubble = strip("components/airroom/AirBubble.tsx")
const bubbleRaw = readFileSync("components/airroom/AirBubble.tsx", "utf8")
const sheet = readFileSync("components/airroom/ProSheet.tsx", "utf8")

// ── the route: pass only, counted first ─────────────────────────────────────
check(/proTokenClaims\(proToken\)/.test(route), "the route verifies a pass server-side")
check(/status: 402/.test(route), "no pass → 402, not a photo")
check(/spendPassPhoto\(proToken\)/.test(route), "a photo is charged against the pass")
const spendAt = route.indexOf("spendPassPhoto("), genAt = route.indexOf("/api/character-photo")
check(spendAt > 0 && genAt > 0 && spendAt < genAt, "and charged BEFORE anything is generated — a refused request costs nothing")
check(/status: 429/.test(route) && /daily-cap/.test(route), "a capped pass is told which cap, and generates nothing")
check(!/teaser|free photo|firstPhoto/i.test(route), "there is no free-photo path in the route")

// ── the meter: fails closed ─────────────────────────────────────────────────
const photoFn = meter.slice(meter.indexOf("export async function spendPassPhoto"), meter.indexOf("const bucket ="))
check(/if \(!hasAdmin\(\)\) return \{ ok: false/.test(photoFn), "no store → no photo (closed), unlike voice which fails open")
check(/catch[\s\S]{0,300}return \{ ok: false/.test(photoFn), "a broken meter → no photo (closed)")
check(/p_key: `photo:\$\{passKey\(token\)\}`/.test(photoFn), "its own key namespace, so photos never draw on the voice allowance")
const perDay = Number((readFileSync("lib/airraw/pass-meter.ts", "utf8").match(/PASS_PHOTOS_PER_DAY \|\| (\d+)/) || [])[1])
const perPass = Number((readFileSync("lib/airraw/pass-meter.ts", "utf8").match(/PASS_PHOTOS_PER_PASS \|\| (\d+)/) || [])[1])
check(perDay >= 1 && perDay <= 5, `${perDay} a day`)
check(perPass >= 10 && perPass <= 60, `${perPass} on a pass — worst case well under a dollar against a $9 sale`)
check(/p_cap: PHOTOS_PER_PASS, p_day_cap: PHOTOS_PER_DAY/.test(photoFn), "both caps go to the same atomic RPC voice uses")

// ── the client: free users never cause a request ────────────────────────────
const ask = bubble.slice(bubble.indexOf("const askPhoto = async"), bubble.indexOf("const send = async"))
check(/if \(!pro\) \{[\s\S]{0,300}return\s*\}/.test(ask), "a free user is turned back before any fetch")
check(ask.indexOf("if (!pro)") < ask.indexOf("fetch("), "and that check sits ahead of the request")
check(/setNudge\(/.test(ask) && /setCeiling\(true\)/.test(ask), "they see the wall, with a photo-specific first sentence")
check(/photo_nudge/.test(ask), "and it is counted, so the funnel shows how often photos are asked for by people who haven't paid")
check(/proToken: getProToken\(\)/.test(ask), "a pass holder's request carries the pass")
check(/look: lookFor\(cluster\)/.test(ask), "and her frozen appearance, so it is the same her")
check(/addMedia\(saveCharacter\(cluster\)\.key/.test(ask), "and the photo is kept on her card")

// ── askable like a person would ask ─────────────────────────────────────────
check(/const PHOTO_ASK = /.test(bubbleRaw), "a typed or spoken request is recognised")
const rx = new RegExp((bubbleRaw.match(/const PHOTO_ASK = \/(.+)\/i\n/) || [])[1], "i")
for (const t of ["send me a photo", "show me a pic of you in the kitchen", "can you send me a selfie", "give me another picture"]) {
  check(rx.test(t), `"${t}" asks for a photo`)
}
check(!rx.test("i love photography"), "but talking about photos is not asking for one")
check(bubble.indexOf("photoScene(text)") > bubble.indexOf("const send = async") && bubble.indexOf("photoScene(text)") < bubble.indexOf("await requestReply()"),
  "and it is routed to a photo before it could become a chat reply")

// ── it is findable, and it is sold ──────────────────────────────────────────
check(/aria: "ask her for a photo"/.test(bubble), "there is a photo button on the call screen")
check(/see her photos/.test(bubble), "and the newest photo shows on the call itself, not only behind the keypad")
check(/photos of her, three a day/.test(sheet), "the pass sells it")
check(sheet.indexOf("photos of her") < sheet.indexOf("fully unrestricted"), "first — the one perk a person can picture")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
