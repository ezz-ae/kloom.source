/**
 * POST /api/ziina-checkout — RETIRED (410).
 *
 * No UI calls this route anymore; the live money path is /api/airraw-pro,
 * which prices SERVER-SIDE and amount-validates on claim. This route took a
 * client-supplied `price` verbatim while ziina-verify granted by `kind`
 * without checking the amount actually paid — i.e. a $1 charge could mint
 * the full unrestricted pass and fire a fake $9 Purchase into Meta ROAS.
 * If a credit-pack checkout is ever needed again, rebuild it with a
 * server-side kind→price table (never a client price).
 */
import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ error: "retired — use /api/airraw-pro" }, { status: 410 })
}
