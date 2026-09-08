// THE THINGS THAT COST MONEY OR A CUSTOMER IF THEY ARE WRONG.
//
// The suites in run.mjs read source and assert properties, which is fast, runs
// anywhere and catches most regressions. It cannot catch a behaviour that is
// written correctly and does not happen. Tonight it didn't: `loadVolume` looked
// exactly right and returned 0 for every new visitor, so every first private
// call was silent while the voice engine billed for it. Reading the source
// would never have found that. Running it found it in one line.
//
// So this file runs the real thing against a real server and a real browser.
// It is slow and it needs both, which is why it is not in the default run.
//
//   AIRRAW_HOME=1 AIRRAW_PRO_SECRET=probe-secret npx next start -p 3131 &
//   node tests/live-check.mjs
//
// Run it before a deploy that touches audio, metering, or the room loop.
//
// Every check here has been confirmed to FAIL on the broken version of the code
// it guards. A test that cannot fail is decoration.
import { chromium } from "playwright"
import { createHmac } from "crypto"

const BASE = process.env.BASE || "http://localhost:3131"
const SECRET = process.env.AIRRAW_PRO_SECRET || "probe-secret"
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

let skippedWall = false
const p0 = Buffer.from(JSON.stringify({ until: Date.now() + 86400000, v: 1, adult18: true, minutes: 6000 })).toString("base64")
const PASS = `${p0}.${createHmac("sha256", SECRET).update(p0).digest("hex")}`

// ═══ 1. THE FREE WALL ACTUALLY STOPS SOMEONE ═══════════════════════════════
// With no Supabase reachable the durable meter fails open and the in-memory
// fallback is the live path — which is exactly the state production is in until
// db/pass_usage.sql is applied. Before the fallback existed, this loop ran
// forever and every visitor got unlimited premium voice for nothing.
console.log("— the free minute ends, with or without the database —")
{
  const say = (text, visitorId) => fetch(`${BASE}/api/tts`, {
    method: "POST", headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ text, personaName: "Mara", gender: "female", language: "English", mode: "voice", visitorId }),
  })
  const CHARS = Number(process.env.FREE_VOICE_CHARS || 400)
  const IP_CAP = Number(process.env.FREE_IP_DAILY_CHARS || 4000)
  const LINE = "x".repeat(100)

  const vid = `live-${Date.now()}`
  let walled = 0, served = 0
  for (let i = 1; i <= 12; i++) {
    const r = await say(LINE, vid)
    if (r.status === 402) { walled = i; break }
    served++
  }
  // The in-memory buckets are per SERVER PROCESS and keyed partly on IP, so a
  // second run against the same instance starts with the day's IP budget already
  // spent — and every assertion below would then fail for a reason that has
  // nothing to do with the code. That is worse than not testing: a suite that
  // cries wolf teaches people to ignore it. So say what happened and stop.
  if (walled === 1) {
    console.log("\n   SKIPPED — this server's IP budget is already spent (a previous run, or the UI sweep).")
    console.log("   Restart it and run again:  kill the next-server process, npx next start -p 3131\n")
    skippedWall = true
  }
  if (!skippedWall) {
  console.log(`   served ${served} turns of 100 chars, then 402 on turn ${walled} (cap ${CHARS})`)
  check(walled > 0, "a free visitor is refused once the minute is spent")
  const expected = Math.ceil(CHARS / 100) + 1
  check(Math.abs(walled - expected) <= 1, `and it lands where the cap says (expected near turn ${expected})`)

  const again = await say(LINE, vid)
  const body = await again.json().catch(() => ({}))
  check(again.status === 402, "still refused on the next attempt, not a one-off")
  check(body?.paywall === true, "and flagged paywall:true, which is what opens the pass sheet")

  check((await say(LINE, `live2-${Date.now()}`)).status !== 402, "a different visitor still gets their own minute")

  // One call per burner, well under the per-visitor cap, so a refusal here can
  // only be the IP bucket. A test that cannot tell which of two limits fired
  // proves neither.
  let burners = 0
  for (let n = 0; n < 120; n++) {
    const r = await say(LINE, `burner-${Date.now()}-${n}`)
    if (r.status === 402) break
    burners++
  }
  console.log(`   fresh identities before the IP bucket stopped it: ${burners} (~${burners * 100} chars, cap ${IP_CAP})`)
  check(burners < 120, "clearing storage for a new id does not hand out unlimited voice")
  check(burners * 100 <= IP_CAP + 200, "and it stops inside the IP day cap, not well past it")
  check(burners > 0, "while a real first-time visitor on a shared IP is still served")
  }
}

// ═══ browser ═══════════════════════════════════════════════════════════════
const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" })

const mk = async (withPass) => {
  const ctx = await b.newContext({ viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true })
  await ctx.addInitScript((t) => {
    localStorage.setItem("airroom_18", "1")
    if (t) localStorage.setItem("airraw_pro_token", t)
  }, withPass ? PASS : null)
  return ctx
}

const drive = async (p, counter) => {
  await p.route("**/api/chat", (r) => { if (counter) counter(); r.fulfill({ status: 200, contentType: "text/plain", body: "mm." }) })
  await p.route("**/api/tts", (r) => r.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.alloc(900) }))
  const click = async (re) => {
    for (const e of await p.$$("button")) {
      if (!(await e.isVisible())) continue
      const t = (((await e.textContent()) || "") + " ~ " + ((await e.getAttribute("aria-label")) || "")).trim()
      if (re.test(t)) { await e.click({ force: true }); return t }
    }
    return null
  }
  await p.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 })
  await p.waitForTimeout(400)
  await click(/18 or older/i); await p.waitForTimeout(800)
  await click(/skip, just take me in/i); await p.waitForTimeout(800)
  await click(/electric/i); await p.waitForTimeout(1500)
  return click
}

// ═══ 2. A FIRST-TIME VISITOR CAN HEAR HER ══════════════════════════════════
// loadVolume read Number(localStorage.getItem(KEY)); getItem returns null when
// unset and Number(null) is 0, which passed the 0..1 range check and came back
// as a preference. Every first private call was silent. Confirmed to fail here
// with "got 0" on that version.
console.log("\n— a first-time visitor can hear her —")
{
  const ctx = await mk(true)
  const p = await ctx.newPage()
  const click = await drive(p)
  await click(/open .*'s profile/i); await p.waitForTimeout(1200)
  await click(/message .* privately/i); await p.waitForTimeout(2500)
  const vol = await p.evaluate(() => { const a = document.querySelector("audio"); return a ? a.volume : null })
  const stored = await p.evaluate(() => localStorage.getItem("airraw_volume"))
  console.log(`   stored volume = ${stored}, live audio.volume = ${vol}`)
  check(vol !== null, "the call has an audio element")
  check(vol === 1, "and it is AUDIBLE on a profile that never set a volume")
  check(stored === null, "with nothing stored, so this is genuinely the untouched-visitor path")
  await ctx.close()
}

// ═══ 3. THE ROOM ONLY SPENDS WHILE SOMEONE IS THERE ════════════════════════
console.log("\n— an unfocused window stops spending —")
{
  let calls = 0
  const ctx = await mk(true)
  const p = await ctx.newPage()
  await drive(p, () => calls++)
  await p.waitForTimeout(9000)
  check(calls > 0, `the room generates while you watch (${calls} calls)`)
  await p.evaluate(() => window.dispatchEvent(new Event("blur")))
  await p.waitForTimeout(7000)
  calls = 0
  await p.waitForTimeout(14000)
  console.log(`   after blur + the 5s fuse, calls in the next 14s: ${calls}`)
  check(calls === 0, "and stops once the window is no longer in front")
  await p.evaluate(() => window.dispatchEvent(new Event("focus")))
  await p.waitForTimeout(9000)
  check(calls > 0, "coming back starts it again")
  await ctx.close()
}

console.log("\n— and an empty room goes quiet —")
{
  let calls = 0
  const ctx = await mk(true)
  const p = await ctx.newPage()
  // Five minutes is too long to sit through; the code reads Date.now(), so fake
  // that rather than the wall clock.
  await p.clock.install()
  await drive(p, () => calls++)
  await p.clock.runFor(20_000)
  check(calls > 0, `it runs while someone is there (${calls} calls)`)
  await p.clock.runFor(6 * 60_000)
  calls = 0
  await p.clock.runFor(60_000)
  console.log(`   ${calls} calls in the minute after crossing the 5-minute line`)
  check(calls === 0, "after five minutes untouched it stops on its own")
  check(/tap to carry on/i.test(await p.$eval("body", (e) => e.innerText).catch(() => "")),
    "and says it is waiting rather than just dying")
  await ctx.close()
}

// ═══ 4. ONE TAB SPENDS ═════════════════════════════════════════════════════
// Two tabs is two rooms generating in parallel for one person.
console.log("\n— one tab spends, the rest watch —")
{
  const ctx = await mk(false)
  let a = 0, bb = 0
  const A = await ctx.newPage(); await drive(A, () => a++)
  await A.waitForTimeout(8000)
  check(a > 0, `the first tab runs (${a} calls)`)
  const B = await ctx.newPage(); await drive(B, () => bb++)
  await B.waitForTimeout(2000)
  a = 0; bb = 0
  await B.waitForTimeout(15000)
  console.log(`   after a second tab opened: old=${a} new=${bb}`)
  check(a === 0, "the older tab stops entirely")
  check(bb > 0, "and the newest one is the live one")
  check(/running in another tab/i.test(await A.$eval("body", (e) => e.innerText).catch(() => "")),
    "the quiet tab says why instead of looking broken")
  await ctx.close()
}

// ═══ 5. THE CALL CARRIES ITS OWN SETTINGS ══════════════════════════════════
console.log("\n— the call carries its own settings —")
{
  const ctx = await mk(true)
  const p = await ctx.newPage()
  const click = await drive(p)
  await click(/open .*'s profile/i); await p.waitForTimeout(1200)
  await click(/message .* privately/i); await p.waitForTimeout(2000)
  const body = () => p.$eval("body", (e) => e.innerText).catch(() => "")
  check(!/while you talk/i.test(await body()), "the drawer is closed when the call opens")
  await click(/~ sound$/); await p.waitForTimeout(900)
  const t = await body()
  check(/while you talk/i.test(t), "one tap opens it")
  check(/test your mic/i.test(t), "the mic test is in it")
  check(/show the words|hide the words/i.test(t), "so is turning the words on")
  check(/hear (?:her|him)|on mute/i.test(t),
    "and hearing them while you read — either pronoun, because the copy follows the character")
  const dlg = await p.$("[role='dialog'][aria-label='call settings']")
  const box = dlg && await dlg.boundingBox()
  check(!!box && box.x > 60 && box.x + box.width <= 403,
    "and it comes in from the side, inside the screen, without moving the call")
  await click(/close settings/i); await p.waitForTimeout(700)
  check(!/while you talk/i.test(await body()), "and it closes again")
  await ctx.close()
}

console.log(fail === 0
  ? `\nPASS — the money paths hold${skippedWall ? " (wall checks skipped — restart the server to include them)" : ""}`
  : `\nFAIL — ${fail}`)
await b.close()
process.exit(fail ? 1 : 0)
