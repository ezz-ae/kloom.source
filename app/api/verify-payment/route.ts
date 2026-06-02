import { NextRequest, NextResponse } from "next/server"
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { getAdminClient } from "@/lib/supabase-admin"

const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET!
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com"

export async function POST(req: NextRequest) {
  const { txSignature, walletAddress, creditsExpected, solExpected } = await req.json()

  if (!txSignature || !walletAddress || !creditsExpected) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 })
  }

  const connection = new Connection(RPC, "confirmed")

  let tx
  try {
    tx = await connection.getTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    })
  } catch {
    return NextResponse.json({ error: "rpc_error" }, { status: 502 })
  }

  if (!tx) {
    return NextResponse.json({ error: "tx_not_found" }, { status: 404 })
  }
  if (tx.meta?.err) {
    return NextResponse.json({ error: "tx_failed" }, { status: 400 })
  }

  // Verify payment went to treasury
  const accountKeys = tx.transaction.message.staticAccountKeys ?? (tx.transaction.message as any).accountKeys
  const treasuryIndex = accountKeys?.findIndex(
    (k: PublicKey) => k.toBase58() === TREASURY
  )
  if (treasuryIndex === -1 || treasuryIndex === undefined) {
    return NextResponse.json({ error: "wrong_recipient" }, { status: 400 })
  }

  const pre = tx.meta!.preBalances[treasuryIndex] ?? 0
  const post = tx.meta!.postBalances[treasuryIndex] ?? 0
  const receivedLamports = post - pre
  const receivedSol = receivedLamports / LAMPORTS_PER_SOL

  // Allow 5% slippage on the SOL amount
  if (solExpected && receivedSol < solExpected * 0.95) {
    return NextResponse.json(
      { error: "underpaid", received: receivedSol, expected: solExpected },
      { status: 400 }
    )
  }

  // Credit the user via the SECURITY DEFINER postgres function — SERVICE ROLE only.
  const sb = getAdminClient()
  const { data, error } = await sb.rpc("credit_wallet", {
    p_wallet: walletAddress,
    p_credits: creditsExpected,
    p_tx_sig: txSignature,
    p_amount_sol: receivedSol,
    p_kind: "purchase",
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (data?.error === "duplicate_tx") {
    return NextResponse.json({ error: "already_credited" }, { status: 409 })
  }

  // Fire-and-forget: distribute $BLOOM tokens to the user
  const baseUrl = req.nextUrl.origin
  fetch(`${baseUrl}/api/distribute-bloom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, amount: creditsExpected }),
  }).catch(() => {})

  return NextResponse.json({ ok: true, credits: creditsExpected, sol: receivedSol, bloom: creditsExpected })
}
