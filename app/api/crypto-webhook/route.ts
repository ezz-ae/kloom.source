// POST /api/crypto-webhook — NOWPayments IPN.
//
// This endpoint is the ONLY thing that can mark a crypto sale paid, which makes
// it the whole security boundary for that rail. The card webhook next door can
// afford to be relaxed about its body because it re-fetches the intent from
// Ziina and believes only that; there is no equivalent here — an invoice has no
// pollable status — so the signature IS the proof and an unverified body is
// worth exactly nothing.
//
// Hence: no secret, no signature, or a signature that doesn't match → 401, and
// nothing is written. There is deliberately no "accept it anyway and log a
// warning" path, because that path is a free pass for anyone who can guess this
// URL.
//
// Set the IPN secret in the NOWPayments dashboard (Store Settings → IPN) and
// point the callback at this route; ipn_callback_url is also sent per invoice.

import type { NextRequest } from "next/server"
import { verifyIpn, recordIpn } from "@/lib/pay/crypto"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  // The RAW body, before any parsing — the HMAC is over the exact bytes we were
  // sent (re-serialised in sorted-key form), so anything that reparses and
  // re-encodes first can change them.
  const raw = await req.text()
  const { ok, body } = verifyIpn(raw, req.headers.get("x-nowpayments-sig"))
  if (!ok || !body) return Response.json({ error: "invalid_signature" }, { status: 401 })

  // order_id is ours, minted at checkout. A callback for anything else is not a
  // sale of ours and is dropped — acknowledged, so the provider stops retrying,
  // but not recorded.
  const orderId = String(body.order_id || "")
  const status = String(body.payment_status || "")
  if (!orderId.startsWith("air_") || !status) return Response.json({ ok: true, ignored: true })

  // WHICH NUMBER IS THE AMOUNT CHECK?
  //
  // Not the obvious ones. `actually_paid` and `outcome_amount` are denominated in
  // the COIN (satoshis, USDT, whatever they chose), so comparing either against a
  // dollar price compares two different units and passes or fails for reasons
  // that have nothing to do with underpayment.
  //
  // Underpayment in crypto is carried by the STATUS: NOWPayments compares
  // actually_paid against pay_amount itself, in the pay currency where the
  // comparison is meaningful, and reports `partially_paid` when it falls short.
  // That status is not in the paid set, so short payments already cannot buy a
  // pass — the check exists, it just lives where the units line up.
  //
  // What we keep here is `price_amount`: the USD figure the sale was OPENED at.
  // That is what the claim compares against the current price, which is the same
  // guard the card path makes ("a cheaper intent can't be replayed into a pass"),
  // and it is echoed back to us unchanged so a callback cannot inflate it.
  const quotedUsd = String(body.price_currency || "").toLowerCase() === "usd"
    ? num(body.price_amount)
    : null

  // A 5xx here is the CORRECT answer to "we couldn't write this down": the
  // provider retries a failed callback, and this row is the only proof the sale
  // happened. Answering 200 on a failed write throws that proof away and leaves
  // someone who paid unable to claim, with nothing anywhere to show they did.
  try {
    await recordIpn(orderId, status, quotedUsd)
  } catch (e) {
    console.error(`[crypto-webhook] could not record ${orderId} (${status}):`, e)
    return Response.json({ error: "could not record payment" }, { status: 503 })
  }
  return Response.json({ ok: true })
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN
  return Number.isFinite(n) ? n : null
}
