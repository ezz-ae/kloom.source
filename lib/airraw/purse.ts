// The purse — who a wallet belongs to, with no account.
//
// AIRRAW has never asked anyone to sign up and this does not change that. But
// chips are bought with real money, and the free-minute meter's identity model
// (a UUID the browser mints for itself) is not good enough for money: anything
// the client can invent, the client can invent twice. So a purse is a token the
// SERVER mints and HMAC-signs, exactly like the pass token — the browser holds
// it, cannot forge one, and can carry it to another device by copying it.
//
// The wallet key is the token's HASH, never the token. A leaked database gives
// you balances, not the bearer credentials to spend them.
//
// A PASS IS A PURSE. If someone already holds a signed pass, that is a stronger
// identity than anything we would mint here, so their wallet keys off it and
// their chips follow the pass they can already restore on another device. Only a
// visitor with no pass gets a purse of their own.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto"
import { proTokenValid } from "@/lib/airraw-pro-token"

const SECRET = process.env.AIRRAW_PRO_SECRET
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || (process.env.NODE_ENV === "production" ? "" : "airraw-dev-secret")

/** Are purses mintable at all? Without a secret we refuse rather than sign with "". */
export function purseConfigured(): boolean {
  return !!SECRET
}

/**
 * Mint a fresh purse token: `<id>.<sig>`. The id carries no meaning — it is 16
 * random bytes — because a purse should say nothing about who holds it.
 */
export function mintPurse(): string {
  if (!SECRET) throw new Error("no signing secret — refusing to mint a purse")
  const id = randomBytes(16).toString("hex")
  return `${id}.${createHmac("sha256", SECRET).update(id).digest("hex").slice(0, 32)}`
}

/** True only for a token this server signed. */
export function purseValid(token?: string | null): boolean {
  if (!token || !SECRET) return false
  const [id, sig] = token.split(".")
  if (!id || !sig) return false
  try {
    const expected = createHmac("sha256", SECRET).update(id).digest("hex").slice(0, 32)
    const a = Buffer.from(sig), b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch { return false }
}

/** The wallet key for a token. Non-reversible, so the DB never holds a spender. */
export function purseKey(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 32)
}

/**
 * Resolve the wallet a request is acting on.
 *
 * A valid pass wins: it is the identity the buyer can already restore elsewhere,
 * so their chips travel with it and a pass holder who clears their browser does
 * not lose a balance they paid for. Otherwise a valid purse of their own. A token
 * that fails verification is treated as absent, never as a new wallet — silently
 * minting a fresh purse for an invalid one would let a client rotate itself a
 * clean slate, and any per-wallet grant with it.
 */
export function walletFor(passToken?: string | null, purseToken?: string | null): string | null {
  if (passToken && proTokenValid(passToken)) return `pass:${purseKey(passToken)}`
  if (purseToken && purseValid(purseToken)) return `purse:${purseKey(purseToken)}`
  return null
}
