// The IPN signature check, on its own and with no dependencies.
//
// This is the entire security boundary of the crypto rail: it is what stops a
// stranger POSTing {"payment_status":"finished"} at the callback and walking off
// with a free pass. It lives in its own file, importing nothing from the project,
// for one reason — so the tests can exercise the REAL function instead of a copy
// of it. A mirrored implementation in a test proves the test agrees with itself.
//
// NOWPayments signs with HMAC-SHA512 over the JSON with its keys SORTED, not over
// the bytes it sent. Getting that wrong fails in the worst possible direction:
// every callback is rejected, no payment is ever confirmed, and the symptom is
// "nobody is buying" rather than an error anyone would go looking for.

import { createHmac, timingSafeEqual } from "crypto"

/**
 * JSON.stringify with every object's keys sorted, at EVERY depth.
 *
 * The recursion is the part worth stating: JSON.stringify's replacer-array trick
 * sorts only the top level, and NOWPayments payloads nest, so a top-level-only
 * sort produces a signature that matches on flat callbacks and mysteriously stops
 * matching on the ones carrying an object.
 */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`
  }
  return JSON.stringify(v) ?? "null"
}

/** The expected signature for a payload. Exported so tests can build fixtures. */
export function ipnSignature(payload: unknown, secret: string): string {
  return createHmac("sha512", secret).update(stableStringify(payload)).digest("hex")
}

/**
 * Verify a callback. Returns the parsed body only when the signature checks out —
 * so a caller physically cannot read the payload without having verified it, which
 * is a nicer shape than returning a boolean somebody can forget to look at.
 *
 * Fails closed on every missing piece: no secret configured, no signature header,
 * unparseable body. There is deliberately no "allow when unconfigured" path.
 */
export function verifyIpnSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
): { ok: boolean; body: Record<string, unknown> | null } {
  if (!secret || !signature) return { ok: false, body: null }
  let parsed: unknown
  try { parsed = JSON.parse(rawBody) } catch { return { ok: false, body: null } }
  const expected = ipnSignature(parsed, secret)
  let ok = false
  try {
    const a = Buffer.from(signature, "hex"), b = Buffer.from(expected, "hex")
    // Length check first: timingSafeEqual throws on a mismatch rather than
    // returning false, and a thrown comparison is an accepted signature if
    // anything upstream catches it carelessly.
    ok = a.length === b.length && a.length > 0 && timingSafeEqual(a, b)
  } catch { ok = false }
  return { ok, body: ok ? (parsed as Record<string, unknown>) : null }
}
