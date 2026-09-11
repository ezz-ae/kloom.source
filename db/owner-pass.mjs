#!/usr/bin/env node
// A PASS FOR THE OWNER'S OWN PHONE — to test the paid product without paying.
//
//   AIRRAW_PRO_SECRET=… node db/owner-pass.mjs            # 1 day
//   AIRRAW_PRO_SECRET=… node db/owner-pass.mjs --days 7
//
// Prints one line: the restore code. Paste it into "already paid? restore it"
// on the pass sheet. It is signed with the SAME secret the server verifies
// with, so it is honoured everywhere a paid pass is; it is never written
// anywhere, and the secret is never printed.
//
// This mints nothing a buyer gets that the owner could not already grant —
// whoever holds the server secret can sign a pass by definition. What it
// replaces is the dev-mint that lived in a phone for weeks after the secret
// moved, reading "pass active" while every call was metered as free. A pass
// from here is short by default for exactly that reason: it expires before it
// can become that.
//
// Get the secret with `vercel env pull` (Production), or from the Vercel
// dashboard. Not SUPABASE_SERVICE_ROLE_KEY unless AIRRAW_PRO_SECRET is unset
// on the server — the server falls back to it only then.
import { createHmac } from "node:crypto"

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const SECRET = process.env.AIRRAW_PRO_SECRET || ""
const DAYS = Number(arg("--days", 1))
const MINUTES = Number(process.env.AIRRAW_PASS_MINUTES || 6000)
const BASE = (arg("--check", "https://airraw.com")).replace(/\/$/, "")

if (!SECRET) { console.error("AIRRAW_PRO_SECRET is not set. Refusing to mint with an empty secret."); process.exit(2) }
if (!(DAYS > 0 && DAYS <= 90)) { console.error("--days must be 1..90"); process.exit(2) }

// A PLACEHOLDER IS NOT A SECRET, AND IT MINTS A CODE THAT LOOKS PERFECT.
//
// `vercel env pull` writes the literal string [SENSITIVE] for any variable
// marked sensitive, because those cannot be read back. Signed with that, this
// tool produced a code of exactly the right shape, with the right expiry, that
// production rejected — and there was no way to tell that from a wrong secret
// or a bug in the pass. An hour went into that. It stops here.
const PLACEHOLDERS = ["[sensitive]", "[decrypted]", "[redacted]", "undefined", "null", "changeme", "your-secret-here"]
if (PLACEHOLDERS.includes(SECRET.trim().toLowerCase()) || SECRET.trim().length < 16) {
  console.error(`\nThat is not the secret — it is "${SECRET.trim().slice(0, 24)}".\n`)
  console.error("`vercel env pull` writes [SENSITIVE] for variables Vercel will not read back,")
  console.error("and a secret shorter than 16 characters is not one either.\n")
  console.error("Get the real value from the Vercel dashboard:")
  console.error("  Project → Settings → Environment Variables → AIRRAW_PRO_SECRET → Reveal")
  console.error("(If it is marked Sensitive it cannot be revealed. Nobody has bought a pass yet,")
  console.error(" so you can safely set it to a new value of your own and redeploy.)\n")
  process.exit(2)
}

// Byte-for-byte the shape lib/airraw-pro-token.ts mints: the same fields, in the
// same order, or the signature is over a different string and the server says no.
const until = Date.now() + DAYS * 86_400_000
const payload = Buffer.from(JSON.stringify({ until, v: 1, adult18: true, minutes: MINUTES })).toString("base64")
const sig = createHmac("sha256", SECRET).update(payload).digest("hex")
const token = `${payload}.${sig}`

// AND IT CHECKS ITS OWN WORK BEFORE HANDING IT OVER.
//
// The only thing that settles whether a code works is the server that will be
// asked to honour it. Asking takes one request and turns "paste this and see"
// into a yes or a no.
let verdict = "not checked"
try {
  const r = await fetch(`${BASE}/api/airraw-pro`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "verify", token }),
  })
  const d = await r.json()
  verdict = d?.valid ? "accepted" : `REFUSED (${d?.reason || r.status})`
} catch (e) { verdict = `could not reach ${BASE}: ${e instanceof Error ? e.message : String(e)}` }

console.error(`owner pass · ${DAYS} day${DAYS === 1 ? "" : "s"} · until ${new Date(until).toISOString()}`)
console.error(`${BASE} says: ${verdict}\n`)
if (verdict.startsWith("REFUSED")) {
  console.error("So this code will NOT work. The secret you minted with is not the one that")
  console.error("deployment verifies with. Check AIRRAW_PRO_SECRET in the Vercel dashboard for")
  console.error("the environment that is actually serving airraw.com, and note that the server")
  console.error("falls back to SUPABASE_SERVICE_ROLE_KEY when AIRRAW_PRO_SECRET is unset.\n")
  console.log(token)
  process.exit(1)
}
console.log(token)
