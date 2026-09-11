// A PASS SURVIVES A ROTATED SECRET, AND A PAID CALLER IS NEVER SOLD THE PASS.
//
// Every pass is an HMAC over AIRRAW_PRO_SECRET. That secret falls back to
// SUPABASE_SERVICE_ROLE_KEY, so it moved the day AIRRAW_PRO_SECRET was first
// set, and it moves again on any Supabase rotation or project switch. When it
// moves, every pass already sold stops verifying — and the holder is not shown
// an error. They are metered as a free visitor: one minute, then the sheet
// asking them to buy what they already bought.
//
// Reproduced against a live server before this file existed: a pass signed with
// a previous secret served 3 calls and was walled at the 4th with
// X-TTS-Tier: free.
//
// Two rules, and the second matters even when the first holds:
//   1. Verification accepts a previous secret; minting never does.
//   2. A pass that is sent and refused is named on the response, and the call
//      screen never answers it with the free wall's words or the buy sheet.
import { readFileSync } from "node:fs"
import { createHmac } from "node:crypto"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const read = (p) => readFileSync(p, "utf8")
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

// ── 1. a rotated secret does not void a pass someone paid for ───────────────
console.log("— a pass outlives the secret it was signed with —")
{
  const CUR = "current-secret-value", PREV = "previous-secret-value"
  process.env.AIRRAW_PRO_SECRET = CUR
  process.env.AIRRAW_PRO_SECRET_PREV = PREV
  const { proTokenClaims, mintProToken, proTokenRefusal } = await import("@/lib/airraw-pro-token")

  const sign = (secret, until = Date.now() + 86400000) => {
    const p = Buffer.from(JSON.stringify({ until, v: 1, adult18: true, minutes: 6000 })).toString("base64")
    return `${p}.${createHmac("sha256", secret).update(p).digest("hex")}`
  }

  check(!!proTokenClaims(sign(CUR)), "a pass signed with the current secret verifies")
  check(!!proTokenClaims(sign(PREV)),
    "and one signed with the PREVIOUS secret still does — this is the customer who already paid")
  check(!proTokenClaims(sign("some-other-secret")),
    "but any other secret is still refused — rotation is not a hole")
  check(!proTokenClaims(sign(PREV, Date.now() - 1000)),
    "and a rotated pass that has EXPIRED is still refused")

  // Minting must never reach for the old value, or rotating would never finish.
  const minted = mintProToken(Date.now() + 86400000)
  const payload = minted.split(".")[0]
  check(minted.split(".")[1] === createHmac("sha256", CUR).update(payload).digest("hex"),
    "a NEW pass is signed with the current secret, never the previous one")

  check(proTokenRefusal(sign(CUR)) === null, "a good pass has no refusal to report")
  check(proTokenRefusal(undefined) === "none", "no pass at all is reported as none")
  check(proTokenRefusal(sign("some-other-secret")) === "rejected", "a bad signature is reported as rejected")
  check(proTokenRefusal(sign(CUR, Date.now() - 1000)) === "expired", "and a lapsed one as expired, not rejected")
}

// ── 2. the refusal reaches the caller ───────────────────────────────────────
console.log("\n— and the server says so, instead of leaving it to be guessed —")
{
  const tts = strip(read("app/api/tts/route.ts"))
  check(/proTokenRefusal/.test(tts), "the TTS route reports why a pass was not honoured")
  check(/!claims && proToken/.test(tts),
    "specifically when one was SENT and not honoured — which is the case that costs a customer")
}

// ── 3. and a paying customer is never answered with the free wall ───────────
console.log("\n— a paid caller is never sold the pass they already hold —")
{
  const bubble = strip(read("components/airroom/AirBubble.tsx"))
  const at = bubble.indexOf('res.status === 402')
  check(at > 0, "the call screen handles the 402")
  const block = bubble.slice(at, at + 1400)

  check(/why === "rejected" \|\| why === "expired"/.test(block),
    "a refused pass is its own branch, not the free wall's")

  // The rule with teeth: inside that branch, the buy sheet must not open and the
  // free minute must not be named.
  const refused = block.slice(block.indexOf('why === "rejected"'))
  const nextBranch = refused.search(/\}\s*else\b/)
  const arm = nextBranch > 0 ? refused.slice(0, nextBranch) : refused
  check(!/setShowPro\(true\)/.test(arm),
    "it does NOT open the buy sheet — asking twice for one purchase is the worst answer here")
  check(!/free minute/.test(arm), "and it does not tell them their free minute is up")
  check(/restore/.test(arm), "it points at restoring the pass, which is the thing that actually helps")

  // The free arm still has to sell, or the wall stops working.
  const freeArm = nextBranch > 0 ? refused.slice(nextBranch) : ""
  check(/free minute/.test(freeArm) && /setShowPro\(true\)/.test(freeArm),
    "while a genuine free caller still hits the wall and still sees the sheet")
}

// ── and the group room does not simply go quiet ─────────────────────────────
//
// The 1:1 call has said for a while that "a call that just goes quiet reads as
// broken". The group room still answered the same 402 with a bare `return`:
// the room fell silent, with no wall, no reason and nothing to buy.
{
  console.log("\n— the group room answers the wall too —")
  const g = strip(read("components/airroom/GroupRoom.tsx"))
  const at = g.indexOf("res.status === 402")
  check(at > 0, "the group room handles the 402 instead of returning on it")
  const block = g.slice(at, at + 1200)
  check(/why === "rejected" \|\| why === "expired"/.test(block), "a refused pass is its own branch here as well")
  const refused = block.slice(block.indexOf('why === "rejected"'))
  const nextBranch = refused.search(/\}\s*else\b/)
  const arm = nextBranch > 0 ? refused.slice(0, nextBranch) : refused
  check(!/setShowPro\(true\)/.test(arm), "and it does not sell the pass to someone who holds one")
  const freeArm = nextBranch > 0 ? refused.slice(nextBranch) : ""
  check(/setShowPro\(true\)/.test(freeArm), "while a free caller in a group room still sees the sheet")
}

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
