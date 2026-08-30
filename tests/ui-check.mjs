// The front door, driven in a real browser.
//
// This file exists because the worst regression this screen has had — every
// button inside the card silently stopped being clickable, "call" included —
// was invisible to unit tests, to the type checker and to a screenshot. Only
// clicking the thing found it. Clicking and dragging pull against each other
// here: capture the pointer too early and no button works, too late and a swipe
// that leaves the screen freezes the card. Both are asserted below, alongside
// the rebuilt chrome (two pills and a menu, not four floating controls).
//
// Needs a running server AND playwright (which is not a project dependency —
// nothing else here needs a browser), so it is excluded from `npm test`:
//   npx next start -p 3131 &
//   npm i --no-save playwright && PORT=3131 node tests/ui-check.mjs
// Set SHOTS=<dir> to also write screenshots of the menu, front door and board.
import { chromium } from "playwright"
const P = process.env.PORT || "3131"
const SHOTS = process.env.SHOTS || ""
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })
const p = await b.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 160)))

const click = async (re) => {
  for (const e of await p.$$("button")) {
    const t = (((await e.textContent()) || "") + " " + ((await e.getAttribute("aria-label")) || "")).trim()
    if (re.test(t)) { await e.click({ force: true }); return t }
  }
  return null
}
const waitFor = async (re, label, ms = 15000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const txt = await p.$eval("body", (e) => e.innerText).catch(() => "")
    if (re.test(txt)) return true
    await p.waitForTimeout(250)
  }
  console.log(`  TIMEOUT: ${label}`); return false
}
const selects = () => p.$$eval("select", (els) => els.filter((e) => e.getBoundingClientRect().width > 0).length)
const who = () => p.$$eval("button", (els) => els.map((e) => (e.textContent || "").trim()).find((t) => /^call /.test(t)) || "?")

await p.goto(`http://localhost:${P}/`, { waitUntil: "networkidle", timeout: 60000 })
await p.waitForTimeout(400)
await click(/18 or older/i); await waitFor(/call you|tonight/i, "onboard")
await click(/skip, just take me in/i); await waitFor(/tonight/i, "vibe")
await click(/electric/i); await waitFor(/swipe for someone else/i, "front door")
await p.waitForTimeout(1200)

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

// 1. NOTHING is pinned to the top of this screen any more.
const topNow = () => p.evaluate(() => {
  const top = window.innerHeight * 0.14
  return [...document.querySelectorAll("button, select")]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.top < top && r.width > 0 && r.height > 0 })
    .map((e) => (e.textContent || "").trim().replace(/\s+/g, " ") || e.getAttribute("aria-label") || e.tagName)
})
const coveringNow = () => p.evaluate(() => {
  const call = [...document.querySelectorAll("button")].find((b) => /^call /.test((b.textContent || "").trim()))
  if (!call) return "(no call button)"
  const c = call.getBoundingClientRect()
  // Whatever the browser says is on top at the centre of the button must BE the
  // button — that is what a real tap would hit.
  const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2)
  return hit && (hit === call || call.contains(hit)) ? "" : (hit?.textContent || hit?.tagName || "?").trim().slice(0, 40)
})

// THE TOAST IS UP RIGHT NOW. That is the moment the bug existed, so that is the
// moment to look: a notification floated over the card once landed square on the
// call button and this check, run afterwards, saw nothing.
const seatsUp = /SEATS/.test(await p.$eval("body", (e) => e.innerText))
const coveredDuringToast = await coveringNow()
console.log(`   with the toast ${seatsUp ? "UP" : "already gone"}: ${coveredDuringToast || "call button is clear"}`)
check(coveredDuringToast === "", "nothing covers the call button while the toast is showing")

const chrome = await topNow()
console.log("   top-edge controls:", JSON.stringify(chrome))
check(chrome.length === 0, `the header is empty (${chrome.length} control(s) found)`)

// The seats toast now rises from the bottom, beside the dock — and still leaves.
let gone = false
for (let i = 0; i < 24; i++) {
  await p.waitForTimeout(600)
  if (!/SEATS/.test(await p.$eval("body", (e) => e.innerText))) { gone = true; break }
}
check(gone, "the seats notification leaves on its own")

// 2. No loose language <select> outside the menu.
check(await selects() === 0, "no language selector floating over the portrait")

// 3. FAI and language moved to the You tab — the header held neither.
const before = await who()

// 4b. THE DOCK MUST NOT COVER THE CALL BUTTON. It is a fixed overlay and the
// card is absolutely positioned, so nothing makes room automatically.
const overlap = await p.evaluate(() => {
  const call = [...document.querySelectorAll("button")].find((b) => /^call /.test((b.textContent || "").trim()))
  const dock = document.querySelector("nav .glass-strong")
  if (!call || !dock) return { ok: false, why: `call=${!!call} dock=${!!dock}` }
  const c = call.getBoundingClientRect(), d = dock.getBoundingClientRect()
  return { ok: c.bottom <= d.top, gap: Math.round(d.top - c.bottom) }
})
console.log("   call → dock gap:", JSON.stringify(overlap))
check(overlap.ok, "the dock sits clear of the call button")

// NOTHING may overlap the call button — not the dock, not a toast, not anything
// added later. The toast covered it once by being absolutely positioned against
// hand-tuned geometry, so this checks every floating element, not one by name.
const covered = await coveringNow()
check(covered === "", `nothing covers the call button with the toast gone${covered ? ` (${covered})` : ""}`)

// 5. THE REGRESSION TEST: a button must still click.
await click(/someone else/)
await p.waitForTimeout(700)
check(await who() !== before, "the next-person button still works")

// 6. A drag that leaves the screen still advances.
const c1 = await who()
await p.mouse.move(201, 500); await p.mouse.down()
for (let i = 1; i <= 12; i++) await p.mouse.move(201 - 25 * i, 500)
await p.mouse.up(); await p.waitForTimeout(800)
check(await who() !== c1, "a swipe leaving the screen still advances")
if (SHOTS) await p.screenshot({ path: `${SHOTS}/front.png` })

// 7. The talks board opens from the dock and shows faces of who is in there.
await p.locator("nav button:visible", { hasText: "Talks" }).first().click({ force: true })
check(await waitFor(/happening now/i, "talks board"), "the talks board opens")
await p.waitForTimeout(1500)
const imgs = await p.$$eval("img", (els) => els.filter((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().width < 40).length)
console.log("   avatar-sized images on the board:", imgs)
check(imgs >= 8, "each talk shows small faces of who is already in it")
if (SHOTS) await p.screenshot({ path: `${SHOTS}/talks.png`, fullPage: true })

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
await b.close()
process.exit(fail ? 1 : 0)
