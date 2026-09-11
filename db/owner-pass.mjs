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

if (!SECRET) { console.error("AIRRAW_PRO_SECRET is not set. Refusing to mint with an empty secret."); process.exit(2) }
if (!(DAYS > 0 && DAYS <= 90)) { console.error("--days must be 1..90"); process.exit(2) }

// Byte-for-byte the shape lib/airraw-pro-token.ts mints: the same fields, in the
// same order, or the signature is over a different string and the server says no.
const until = Date.now() + DAYS * 86_400_000
const payload = Buffer.from(JSON.stringify({ until, v: 1, adult18: true, minutes: MINUTES })).toString("base64")
const sig = createHmac("sha256", SECRET).update(payload).digest("hex")
console.error(`owner pass · ${DAYS} day${DAYS === 1 ? "" : "s"} · until ${new Date(until).toISOString()}\n`)
console.log(`${payload}.${sig}`)
