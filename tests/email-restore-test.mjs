// THE EMAIL IS THE WAY BACK IN.
//
// "I made a new account and got no code, so I can't use it anywhere and it will
// easily be lost." True as written: the pass is anonymous, its only credential
// is a long signed code, and that code is shown once in a toast at the moment
// of purchase. Miss it and the pass lives on exactly one browser until that
// browser is cleared.
//
// So the address given at checkout opens it again, with no password, bounded by
// a device budget. The trade is deliberate and stated: anyone who knows the
// address can claim the pass, and what stops that spreading is three devices,
// counted atomically in the meter the pass already has — no new table, nothing
// for anyone to run.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const route = strip(readFileSync("app/api/airraw-pro/route.ts", "utf8"))
const meter = strip(readFileSync("lib/airraw/pass-meter.ts", "utf8"))
const sheet = strip(readFileSync("components/airroom/ProSheet.tsx", "utf8"))
const ar = readFileSync("lib/airraw/ar.ts", "utf8")

console.log("— the address is taken at the till, on both rails —")
check(/const buyerEmail = \/\^\[\^\\s@\]\+@/.test(route), "a valid address is kept, anything else becomes \"anon\"")
check((route.match(/wallet: buyerEmail/g) || []).length === 2, "and it is written on the purchase row for the card rail AND the crypto rail")
check(/action: "checkout", method, email: email\.trim\(\)\.toLowerCase\(\)/.test(sheet), "the sheet sends it")
check(/disabled=\{busy \|\| !EMAIL_OK\.test\(email\.trim\(\)\)\}/.test(sheet), "and will not open checkout without one — the code alone was how passes got lost")

console.log("— and it opens the pass again on a phone that has nothing —")
{
  const i = route.indexOf('action === "restore_by_email"')
  const block = i < 0 ? "" : route.slice(i, i + 2600)
  check(i > 0, "the route answers restore_by_email")
  check(/\.eq\("wallet", email\)/.test(block) && /\.in\("kind", \["airraw_pass", "airraw_pass_crypto"\]\)/.test(block), "it looks for a purchase on that address, either rail")
  check(/\["completed", "finished", "confirmed", "paid"\]/.test(block), "and only a PAID one — an abandoned checkout is not a pass")
  check(/reason: "no-pass"/.test(block) && !/reason: "unknown-email"/.test(block), "an address with no pass gets the same answer whether or not it exists — never an oracle for who bought")
  check(/Date\.parse\(paidRow\.created_at\)/.test(block) && /\+ DAYS \* 86_400_000/.test(block), "the window is anchored to the PURCHASE, so restoring cannot roll it forward")
  check(/if \(until <= Date\.now\(\)\) return Response\.json\(\{ paid: false, reason: "expired" \}/.test(block), "an expired purchase restores nothing")
  check(block.indexOf("claimDevice(email") > 0 && block.indexOf("claimDevice(email") < block.indexOf("mintPassWithChips"), "the device is claimed BEFORE a token is minted")
  check(/reason: "device-limit", limit: dev\.limit/.test(block), "and the refusal says it is the device budget, not a wrong address")
}

console.log("— the device budget lives in the meter that already exists —")
{
  const i = meter.indexOf("export async function claimDevice")
  const fn = i < 0 ? "" : meter.slice(i, meter.indexOf("export async function spendPassChars"))
  check(i > 0, "claimDevice is part of the pass meter")
  check(/dev:\$\{bucket\(e\)\}:\$\{bucket\(d\)\}/.test(fn), "each phone has its own key, hashed — no address or device id is stored in the clear")
  check(/\(seen\.used \?\? 1\) > 1\) return \{ ok: true/.test(fn), "a phone already on this pass returns free and does not burn a change")
  check(/spendChars\(`devs:\$\{bucket\(e\)\}`, 1, PASS_DEVICES/.test(fn), "only a NEW phone spends from the budget")
  check(/if \(seen\.unmetered\) return \{ ok: true/.test(fn) && /if \(budget\.unmetered\) return \{ ok: true/.test(fn),
    "and it fails OPEN — a database that is down lets a buyer in rather than locking them out of what they paid for")
  check(/PASS_DEVICES = Math\.max\(1, Number\(process\.env\.AIRRAW_PASS_DEVICES \|\| 3\)\)/.test(meter), "three devices, env-overridable")
  check(!/create table/i.test(meter), "and no new table — it reuses pass_usage, so there is nothing for anyone to run")
}

console.log("— the screen offers it —")
check(/action: "restore_by_email", email: e, visitorId: visitorId\(\)/.test(sheet), "the restore box asks by email, carrying this device")
for (const k of ["your email — this is how you get back in", "the email you paid with", "open it with my email", "this pass has already been opened on {n} devices"]) {
  check(ar.includes(`"${k}":`), `Arabic: ${k}`)
}

console.log(fail ? `\n${fail} FAILED` : "\nPASS")
process.exit(fail ? 1 : 0)
