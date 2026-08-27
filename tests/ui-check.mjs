// Clicking and dragging pull against each other on the front door: capturing the
// pointer too early kills every button, capturing too late leaves a swipe that
// exits the screen stuck. This asserts BOTH still work.
import { chromium } from "playwright"
const PORT = process.env.PORT || "3131"
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })
const p = await b.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 140)))

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
const who = () => p.$$eval("button", (els) => els.map((e) => (e.textContent || "").trim()).find((t) => /^call /.test(t)) || "?")

await p.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle", timeout: 60000 })
await p.waitForTimeout(400)
await click(/18 or older/i); await waitFor(/call you|tonight/i, "onboard")
await click(/skip, just take me in/i); await waitFor(/tonight/i, "vibe")
await click(/electric/i); await waitFor(/swipe for someone else/i, "front door")

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

// 1. A BUTTON must click. This broke when capture was taken on pointerdown.
const a = await who()
await click(/someone else/)
await p.waitForTimeout(700)
check(await who() !== a, "the next-person button works (buttons are clickable)")

// 2. A DRAG that ends OFF-SCREEN must still complete.
const c1 = await who()
await p.mouse.move(201, 500); await p.mouse.down()
for (let i = 1; i <= 12; i++) await p.mouse.move(201 - 25 * i, 500)
await p.mouse.up(); await p.waitForTimeout(800)
check(await who() !== c1, "a swipe leaving the screen still advances")

// 3. The card must not be left stuck mid-drag.
const st = await p.evaluate(() => {
  const el = [...document.querySelectorAll("div")].find((d) => d.style.willChange === "transform, opacity")
  return el ? { o: el.style.opacity || "1", t: el.style.transform || "none" } : null
})
check(st && (st.o === "1" || st.o === "") && (st.t === "none" || st.t === ""), `card resets after a swipe (${JSON.stringify(st)})`)

// 4. The talks board must open from the front door.
await click(/talks happening now/i)
check(await waitFor(/happening now/i, "talks board"), "the talks board opens")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
await b.close()
process.exit(fail ? 1 : 0)
