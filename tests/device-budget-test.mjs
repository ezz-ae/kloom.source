// THREE DEVICES, AND COMING BACK IS FREE.
//
// A pass is reopened by typing the address it was bought with — no password —
// so the only thing between a leaked address and a shared pass is the device
// budget. That makes it load-bearing, and it had never been run: it is counted
// through pass_usage, a Postgres RPC, which no unit test can reach.
//
// So this stands a server in front of it honouring the same contract as
// db/pass_usage.sql — one row per key, atomic increment, refuse past the cap,
// report the new total — and drives the real claimDevice against it.
import { createServer } from "node:http"

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:3323"
process.env.SUPABASE_SERVICE_ROLE_KEY = "stub"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

const rows = new Map()
const server = createServer((req, res) => {
  let body = ""
  req.on("data", (c) => (body += c))
  req.on("end", () => {
    res.setHeader("Content-Type", "application/json")
    if (!req.url.includes("/rest/v1/rpc/pass_spend")) { res.statusCode = 404; return res.end("{}") }
    const { p_key, p_chars, p_cap } = JSON.parse(body || "{}")
    const r = rows.get(p_key) || { chars: 0 }
    if (r.chars + p_chars > p_cap) return res.end(JSON.stringify({ ok: false, reason: "exhausted", used: r.chars }))
    r.chars += p_chars; rows.set(p_key, r)
    res.end(JSON.stringify({ ok: true, used: r.chars }))
  })
})
await new Promise((r) => server.listen(3323, r))

const { claimDevice, PASS_DEVICES } = await import("../lib/airraw/pass-meter.ts")
const ME = "buyer@example.com"

console.log("— the budget —")
check(PASS_DEVICES === 3, `three devices by default (${PASS_DEVICES})`)
for (let i = 1; i <= PASS_DEVICES; i++) {
  const r = await claimDevice(ME, `phone-${i}`)
  check(r.ok && r.devices === i, `phone ${i} is let in, and counted (${r.devices})`)
}
check(!(await claimDevice(ME, "phone-4")).ok, "the fourth phone is refused")
check(!(await claimDevice(ME, "phone-5")).ok, "and so is every one after it")

console.log("— but your own phones are not a one-way door —")
for (const d of ["phone-1", "phone-2", "phone-3"]) {
  check((await claimDevice(ME, d)).ok, `${d} comes back free — a phone already on the pass never burns a change`)
}
check(!(await claimDevice(ME, "phone-4")).ok, "while the refused one stays refused — it never got written down, so a retry is not a way in")
for (let i = 0; i < 4; i++) check(!(await claimDevice(ME, "phone-4")).ok, `and still refused on retry ${i + 1}`)

console.log("— one buyer's budget is their own —")
{
  const other = await claimDevice("someone-else@example.com", "phone-1")
  check(other.ok && other.devices === 1, "the same device id on another address starts that address at one")
}

console.log("— and a missing address or device is never let through —")
check(!(await claimDevice("", "d")).ok, "no address, no claim")
check(!(await claimDevice(ME, "")).ok, "no device, no claim")

console.log("— when the meter is down, a buyer is let IN, not locked out —")
await new Promise((r) => server.close(r))
check((await claimDevice("fresh@example.com", "phone-1")).ok, "a database that cannot answer lets them into what they paid for")

console.log(fail ? `\n${fail} FAILED` : "\nPASS")
process.exit(fail ? 1 : 0)
