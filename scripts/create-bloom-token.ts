/**
 * One-time script: creates the $BLOOM SPL token on Solana mainnet.
 *
 * Run:  npx tsx scripts/create-bloom-token.ts
 *
 * Required env vars (in .env.local):
 *   TREASURY_PRIVATE_KEY_HEX  — hex of the treasury keypair secret
 *   NEXT_PUBLIC_SOLANA_RPC    — RPC endpoint (mainnet)
 *
 * After running, copy BLOOM_MINT_ADDRESS into .env.local.
 */

import "dotenv/config"
import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js"
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getMint,
} from "@solana/spl-token"

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("mainnet-beta")
const PRIV_HEX = process.env.TREASURY_PRIVATE_KEY_HEX

if (!PRIV_HEX) {
  console.error("❌  TREASURY_PRIVATE_KEY_HEX not set in .env.local")
  process.exit(1)
}

const TOTAL_SUPPLY   = 1_000_000_000n   // 1 billion $BLOOM
const DECIMALS       = 6                 // like USDC — 1 $BLOOM = 1_000_000 raw
const REWARDS_SHARE  = 300_000_000n      // 30% → rewards pool (same wallet for now)

async function main() {
  const connection = new Connection(RPC, "confirmed")
  const secretKey  = Buffer.from(PRIV_HEX!, "hex")
  const treasury   = Keypair.fromSecretKey(secretKey)

  console.log("Treasury:", treasury.publicKey.toBase58())

  const bal = await connection.getBalance(treasury.publicKey)
  console.log(`Balance: ${bal / 1e9} SOL`)
  if (bal < 0.05 * 1e9) {
    console.error("❌  Treasury needs at least 0.05 SOL for rent. Fund it first.")
    process.exit(1)
  }

  console.log("\n1/4  Creating mint…")
  const mint = await createMint(
    connection,
    treasury,          // payer
    treasury.publicKey, // mint authority
    treasury.publicKey, // freeze authority
    DECIMALS
  )
  console.log("✅  Mint:", mint.toBase58())

  console.log("\n2/4  Creating treasury token account…")
  const treasuryATA = await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    mint,
    treasury.publicKey
  )
  console.log("     ATA:", treasuryATA.address.toBase58())

  console.log("\n3/4  Minting total supply to treasury…")
  const rawSupply = TOTAL_SUPPLY * BigInt(10 ** DECIMALS)
  await mintTo(
    connection,
    treasury,
    mint,
    treasuryATA.address,
    treasury,
    rawSupply
  )

  const mintInfo = await getMint(connection, mint)
  console.log(`✅  Supply: ${Number(mintInfo.supply) / 10 ** DECIMALS} $BLOOM`)

  console.log("\n4/4  Done.\n")
  console.log("─────────────────────────────────────────────────────")
  console.log("Add these to .env.local:")
  console.log(`NEXT_PUBLIC_BLOOM_MINT=${mint.toBase58()}`)
  console.log(`BLOOM_REWARDS_POOL=${treasuryATA.address.toBase58()}`)
  console.log("─────────────────────────────────────────────────────")
  console.log(`\nTotal supply  : ${TOTAL_SUPPLY.toLocaleString()} $BLOOM`)
  console.log(`Rewards pool  : ${REWARDS_SHARE.toLocaleString()} $BLOOM (distribute via airdrop)`)
  console.log(`\nView on explorer: https://explorer.solana.com/address/${mint.toBase58()}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
