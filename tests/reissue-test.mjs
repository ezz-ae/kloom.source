// REISSUING A PASS IS RESTORING ONE, NEVER GRANTING ONE.
//
// db/reissue-pass.mjs exists for the customers whose pass was signed with a
// secret that is now gone — it cannot be verified, so it cannot be restored, so
// a replacement has to be minted from the payment itself. That makes it the one
// piece of code that creates a paid pass without anybody paying at that moment,
// which is exactly the thing that must not become a way to hand out passes.
//
// Two things are asserted here, and the second is the one with teeth:
//   1. The replacement is byte-identical to what the server would have minted.
//      The CLI carries its own copy of the mint (no build step, no tsx), and a
//      copy that drifts issues passes the server will refuse — reproducing the
//      bug it exists to fix.
//   2. Every refusal actually refuses. Unpaid, underpaid, unknown, undated and
//      lapsed all come back false, and the window is anchored to the purchase
//      rather than to now — otherwise one $9 sale reissued monthly is a
//      lifetime pass.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

process.env.AIRRAW_PRO_SECRET = "reissue-test-secret"
const { mintProToken } = await import("@/lib/airraw-pro-token")
const { reissuePlan, mintProToken: cliMint } = await import("../db/reissue-pass.mjs")

// ── 1. the CLI mints what the server mints ──────────────────────────────────
console.log("— the replacement is the same pass the server would have sold —")
{
  const cli = readFileSync("db/reissue-pass.mjs", "utf8")

  // The real function out of the CLI, not a re-typed copy of it — a test that
  // reimplements the thing it is checking cannot catch the thing it exists for.
  const until = 1800000000000
  check(cliMint(until, 6000) === mintProToken(until, 6000),
    "byte-identical to lib/airraw-pro-token.ts — a drifted copy would mint passes the server refuses")
  check(cliMint(until, 300) === mintProToken(until, 300), "at any allowance")
  check(cliMint(until + 1, 6000) !== cliMint(until, 6000), "and the expiry is inside the signature")

  check(/JSON\.stringify\(\{ until: untilMs, v: 1, adult18: true, minutes \}\)/.test(cli),
    "and it signs the same claims — until, v, adult18, minutes")
  const server = readFileSync("lib/airraw-pro-token.ts", "utf8")
  check(/JSON\.stringify\(\{ until: untilMs, v: 1, adult18: true, minutes \}\)/.test(server),
    "which is still the payload the server signs")
}

// ── 2. it refuses everything it should ──────────────────────────────────────
console.log("\n— and it refuses everything that is not a completed purchase —")
{
  const NOW = 1_700_000_000_000
  const DAY = 86_400_000
  const paid = { id: "pi_1", status: "completed", amount: 3305 }   // ≈ $9 in AED minor units
  const bought = NOW - 10 * DAY

  const good = reissuePlan({ intent: paid, purchasedAt: bought, now: NOW })
  check(good.ok, "a completed payment inside its window is reissued")
  check(good.until === bought + 90 * DAY,
    "and the window is anchored to the PURCHASE — reissuing monthly must not become a lifetime pass")
  check(good.until < NOW + 90 * DAY, "specifically, it is not 90 days from today")

  check(!reissuePlan({ intent: null, purchasedAt: bought, now: NOW }).ok,
    "an intent Ziina has never heard of is refused")
  for (const status of ["pending", "failed", "cancelled", "requires_payment_instrument"]) {
    check(!reissuePlan({ intent: { ...paid, status }, purchasedAt: bought, now: NOW }).ok,
      `a "${status}" payment is refused — only completed counts`)
  }
  check(!reissuePlan({ intent: { ...paid, amount: 100 }, purchasedAt: bought, now: NOW }).ok,
    "a payment below the pass price is refused, so a cheap intent can't be replayed into a pass")
  check(!reissuePlan({ intent: paid, purchasedAt: null, now: NOW }).ok,
    "no purchase date means no reissue — anchoring on now would silently extend it")
  check(!reissuePlan({ intent: paid, purchasedAt: NOW - 200 * DAY, now: NOW }).ok,
    "and a pass that already ran out is refused — a reissue restores, it does not resurrect")

  // Right at the boundary, both sides.
  check(reissuePlan({ intent: paid, purchasedAt: NOW - 90 * DAY + 1000, now: NOW }).ok,
    "a pass with a second left on it is still reissued")
  check(!reissuePlan({ intent: paid, purchasedAt: NOW - 90 * DAY, now: NOW }).ok,
    "one that expired this instant is not")
}

// ── 3. and there is no override ─────────────────────────────────────────────
console.log("\n— with no way to skip the payment check —")
{
  const cli = readFileSync("db/reissue-pass.mjs", "utf8")
  const body = cli.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  check(!/--force|--grant|--anyway|skipVerify/.test(body),
    "no flag bypasses Ziina — the payment is the only thing that authorises a pass")
  check(/status !== "completed"/.test(body), "the completed check is in the code, not just in the docs")
  check(/reissue:\$\{id\}/.test(body),
    "chips are re-granted under a per-intent event id, which the ledger de-duplicates — running it twice cannot pay twice")
  // Naming the variable in an error is help; interpolating its VALUE is a leak.
  // Only the second is a bug, so only the second is what this looks for.
  const leaks = [...body.matchAll(/console\.(?:log|error|warn)\(([\s\S]*?)\)\n/g)]
    .map((m) => m[1])
    .filter((a) => /\$\{\s*(?:SECRET|SB_KEY|ZIINA)\s*[}.]/.test(a) || /,\s*(?:SECRET|SB_KEY|ZIINA)\s*[,)]/.test(a))
  if (leaks.length) console.log(`   ${leaks[0].slice(0, 70)}`)
  check(leaks.length === 0, "and it never prints a secret's value — only ever its name")

  // The one long string it DOES print is the customer's own restore code, which
  // is the credential they were always meant to hold.
  check(/code: \$\{token\}/.test(body), "the only credential it prints is the pass it just minted")
}

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
