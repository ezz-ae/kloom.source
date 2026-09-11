// WALK THE PRODUCT ON A PHONE, BEFORE HE DOES.
//
// This file exists because of one sentence: "I tell you to fix one, you fix one
// and break two." That was not an exaggeration. In a single evening: changing
// the call's button row broke the photo test; changing the paywall branch broke
// two pass tests and went out anyway; the in-app notice was first rendered by a
// component no page mounts, then pinned to the top where it covered a call's
// back button. Every one of those reached him because the only person opening
// the app on a phone was him.
//
// `pnpm test` checks the source. It cannot see a button that is 20px wide, a
// control that renders off the bottom of a 390px screen, a page that stays
// left-to-right in Arabic, or a first line that never plays. This drives the
// REAL app in a real browser at phone size and reports those.
//
// Run it against a local build before pushing anything that touches a screen:
//
//   AIRRAW_HOME=1 pnpm exec next build
//   AIRRAW_HOME=1 AIRRAW_PRO_SECRET=probe-secret pnpm exec next start -p 3131 &
//   node --import ./tests/alias.mjs db/phone-walk.mjs free en-US
//   node --import ./tests/alias.mjs db/phone-walk.mjs free ar-SA
//   node --import ./tests/alias.mjs db/phone-walk.mjs inapp en-US
//   node --import ./tests/alias.mjs db/phone-walk.mjs pro en-US
//
// Every network call the product makes is stubbed, so it costs nothing and
// never touches a live provider. Screenshots land in /tmp/phone-walk.
import { chromium } from "playwright"
import { createHmac } from "crypto"
import { mkdirSync } from "node:fs"

const SHOTS = process.env.PHONE_WALK_SHOTS || "/tmp/phone-walk"
const BASE = process.env.PHONE_WALK_BASE || "http://localhost:3131"
const SECRET = process.env.AIRRAW_PRO_SECRET || "probe-secret"
mkdirSync(SHOTS, { recursive: true })

const p0 = Buffer.from(JSON.stringify({ until: Date.now() + 86400000, v: 1, adult18: true, minutes: 6000 })).toString("base64")
const PASS = `${p0}.${createHmac("sha256", SECRET).update(p0).digest("hex")}`
const SILENT_WAV = Buffer.from("UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=", "base64")
const IG_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0 (iPhone15,3; iOS 17_5; en_US; scale=3.00)"

const [MODE = "free", LOCALE = "en-US"] = process.argv.slice(2)
const AR = LOCALE.startsWith("ar") ? (await import("../lib/airraw/ar.ts")).AR : {}
const tr = (k) => (LOCALE.startsWith("ar") ? (AR[k] ?? k) : k)
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const rx = (k) => new RegExp("^" + esc(tr(k)) + "$", "i")

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" })
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  locale: LOCALE, ...(MODE === "inapp" ? { userAgent: IG_UA } : {}),
})
if (MODE === "pro") await ctx.addInitScript((t) => { try { localStorage.setItem("airraw_pro_token", t) } catch {} }, PASS)
const p = await ctx.newPage()

const errs = [], cons = [], net = []
p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)))
p.on("console", (m) => { if (m.type() === "error" && !/vercel\/insights/.test(m.text())) cons.push(m.text().slice(0, 160)) })
p.on("response", (r) => { const u = r.url(); if (r.status() >= 400 && u.startsWith(BASE) && !/insights|character-photo/.test(u)) net.push(`${r.status()} ${u.replace(BASE, "")}`) })

// Every provider stubbed: this must cost nothing and prove nothing about them.
await p.route("**/api/chat", (r) => r.fulfill({ status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "hey. i was hoping you'd call. tell me about your day. " }))
await p.route("**/api/tts", (r) => r.fulfill({ status: 200, headers: { "Content-Type": "audio/wav" }, body: SILENT_WAV }))
await p.route("**/api/stt", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "hello there" }) }))
await p.route("**/api/character-photo**", (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }))
await p.route("**/api/lead", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }))
await p.route("**/api/airraw-pro", (r) => {
  if (r.request().method() === "GET") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ price: 9, days: 90, minutes: 6000, methods: ["card", "crypto"] }) })
  let body = {}; try { body = JSON.parse(r.request().postData() || "{}") } catch {}
  if (body.action === "checkout") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: BASE + "/__pay", intentId: "pi_test", price: 9, days: 90, t: Date.now(), s: "sig", test: false }) })
  return r.continue()
})
await p.route("**/__pay", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>pay stub</title><h1>PAY STUB</h1>" }))

let step = 0, problems = 0
async function audit(label, expect) {
  await p.waitForTimeout(900)
  step++
  const info = await p.evaluate(() => {
    const txt = document.body.innerText
    const vis = [...document.querySelectorAll("button, a[href], input, textarea, select")].filter((e) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e)
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.opacity !== "0"
    })
    // Off-screen inside a horizontal scroller is how a strip of faces works.
    const scrollable = (e) => { for (let n = e.parentElement; n; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if (o === "auto" || o === "scroll") return true } return false }
    const dup = (() => { const m = {}; for (const e of vis) { const a = e.getAttribute("aria-label"); if (a) m[a] = (m[a] || 0) + 1 } return Object.entries(m).filter(([, n]) => n > 2).map(([a, n]) => `${a}×${n}`) })()
    const name = (e) => (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30)
    return {
      dir: document.documentElement.dir || "unset",
      txt: txt.replace(/\s+/g, " "),
      over: document.documentElement.scrollWidth > window.innerWidth + 1,
      art: [...new Set(txt.match(/\{t\(|\bundefined\b|\bNaN\b|\[object |&apos;|\{name\}|\{n\}|\{lang\}/g) || [])],
      tiny: vis.filter((e) => e.tagName === "BUTTON" && (() => { const r = e.getBoundingClientRect(); return r.width < 24 || r.height < 24 })()).map(name),
      off: vis.filter((e) => { const r = e.getBoundingClientRect(); return (r.right > window.innerWidth + 2 || r.left < -2) && !scrollable(e) }).map(name),
      n: vis.length,
    }
  })
  const flags = []
  if (info.over) flags.push("HORIZONTAL-OVERFLOW")
  if (info.art.length) flags.push("ARTEFACTS:" + info.art.join(","))
  if (info.tiny.length) flags.push("TINY-TAP:" + info.tiny.slice(0, 4).join("|"))
  if (info.off.length) flags.push("OFFSCREEN:" + info.off.slice(0, 4).join("|"))
  if (errs.length) flags.push("PAGEERROR:" + errs.splice(0).join(" ; "))
  if (cons.length) flags.push("CONSOLE:" + [...new Set(cons.splice(0))].slice(0, 3).join(" ; "))
  if (net.length) flags.push("HTTP:" + [...new Set(net.splice(0))].slice(0, 4).join(" ; "))
  if (LOCALE.startsWith("ar") && info.dir !== "rtl") flags.push(`PAGE-DIR=${info.dir} on an Arabic visit`)
  if (expect && !new RegExp(esc(expect), "i").test(info.txt)) flags.push(`MISSING:"${expect}"`)
  if (flags.length) problems++
  await p.screenshot({ path: `${SHOTS}/${MODE}-${LOCALE}-${String(step).padStart(2, "0")}-${label.replace(/[^a-z0-9]+/gi, "-")}.png` })
  console.log(`${flags.length ? "!!" : "ok"} ${String(step).padStart(2, "0")} ${label} [dir=${info.dir}, ${info.n} controls]${flags.length ? "\n     " + flags.join("\n     ") : ""}`)
}
const tap = async (re) => { for (const e of await p.$$("button")) { if (!(await e.isVisible())) continue; const t = ((await e.getAttribute("aria-label")) || (await e.textContent()) || "").trim(); if (re.test(t)) { await e.click({ force: true }); return t } } return null }

await p.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 })
await audit("front door")
await tap(rx("skip, just take me in →"))
await audit("the mood", tr("electric"))
await tap(new RegExp("^" + esc(tr("electric"))))
await p.waitForTimeout(8000)
await audit("the room, once someone has spoken", "hoping you'd call")
for (const tab of ["People", "Scenes", "Talks", "You", "Room"]) { await tap(rx(tab)); await audit(`tab ${tab}`) }
await tap(rx("People")); await p.waitForTimeout(800)
await tap(new RegExp("^(" + [esc(tr("open {name}'s profile").split("{name}")[0].trim()), "call ", "talk to "].join("|") + ")", "i"))
await audit("her card")
await tap(rx("type")); await audit("the call, keypad open")
const box = await p.$("input[placeholder^='type to'], textarea[placeholder^='type to']")
if (box) { await box.fill("hey, are you there?"); await p.keyboard.press("Enter"); await audit("after a line is sent", "hoping you'd call") }
await tap(rx("sound")); await audit("call settings", tr("while you talk"))
await tap(rx("close settings"))
await tap(rx("leave")); await p.waitForTimeout(4000); await audit("after leaving")
await tap(rx("You")); await p.waitForTimeout(500)
await tap(rx("Get a pass")); await audit("the pass sheet", "$9")
await tap(rx("already paid? restore it")); await audit("the restore box")
const code = await p.$(`input[placeholder="${tr("paste your restore code")}"]`)
if (code) {
  await code.fill("garbage.code"); await tap(rx("restore my pass"))
  await audit("a wrong code is refused", tr("that code looks invalid or expired — copy the whole thing"))
  await code.fill(PASS); await tap(rx("restore my pass")); await p.waitForTimeout(3000)
  await tap(rx("You")); await audit("the pass, restored", tr("✦ pass active"))
}
await b.close()
console.log(problems ? `\n${problems} screens flagged — ${SHOTS}` : `\nclean — ${SHOTS}`)
process.exit(problems ? 1 : 0)
