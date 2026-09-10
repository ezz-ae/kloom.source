// Apply the AIRRAW database setup, from a terminal, without the Supabase dashboard.
//
// The dashboard has been the blocker: the project (sekntmutponnopywhnsd) is owned
// by an account whose login nobody can find, so `db/chips.sql` and
// `db/pass_usage.sql` have sat unapplied while chips and the golden room answered
// `ready: false` in production and could not take a single payment.
//
// This needs no account and no password — only the database connection string,
// which is already sitting in the Vercel project's environment and comes down
// with `vercel env pull`. See the instructions printed when it can't find one.
//
// Safe to run repeatedly. Every statement in both files is `create table if not
// exists` or `create or replace function`; nothing is dropped, no existing table
// is touched, and no row is deleted. Running it twice is a no-op.
//
//   pnpm add -D pg
//   node db/apply.mjs                        # reads .env.production.local
//   node db/apply.mjs "postgresql://…"       # or pass the string directly
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, "..")
const FILES = ["chips.sql", "pass_usage.sql"]

// The names Vercel and Supabase use, in the order they are worth trying. A
// Marketplace-provisioned database injects POSTGRES_URL; a hand-configured one
// is usually DATABASE_URL.
const KEYS = ["POSTGRES_URL_NON_POOLING", "POSTGRES_URL", "DATABASE_URL", "SUPABASE_DB_URL"]

/** Read a .env file well enough for this: KEY=value, quotes stripped, # ignored. */
function loadEnvFile(path) {
  const out = {}
  if (!existsSync(path)) return out
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq < 1) continue
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
  }
  return out
}

function findConnectionString() {
  if (process.argv[2]?.startsWith("postgres")) return { url: process.argv[2], from: "the command line" }
  for (const k of KEYS) if (process.env[k]) return { url: process.env[k], from: `the ${k} environment variable` }
  for (const f of [".env.production.local", ".env.local", ".env"]) {
    const env = loadEnvFile(join(ROOT, f))
    for (const k of KEYS) if (env[k]) return { url: env[k], from: `${f} (${k})` }
  }
  return null
}

function howToGetOne() {
  console.error(`
Couldn't find a database connection string. Two ways to get one, neither of
which needs you to remember which Supabase account owns the project.

  A. Pull it from Vercel, where the app already keeps its credentials:

       npx vercel login
       npx vercel link            # team: ezz-dxb   project: airroom
       npx vercel env pull .env.production.local --environment=production
       node db/apply.mjs

     If that file ends up with no ${KEYS.join(" / ")},
     the database was not attached through Vercel and you want B.

  B. Open Supabase THROUGH Vercel, which signs you in as whoever owns it:

       Vercel dashboard → the airroom project → Storage (or Integrations)
       → the Supabase resource → Open in Supabase

     Then: Project Settings → Database → Connection string → URI, copy it,
     and run:

       node db/apply.mjs "postgresql://…"
`)
}

const found = findConnectionString()
if (!found) { howToGetOne(); process.exit(1) }

let pg
try {
  pg = await import("pg")
} catch {
  console.error("\nThe postgres driver isn't installed yet. One command:\n\n    pnpm add -D pg\n\nthen run this again.\n")
  process.exit(1)
}

// Supabase requires TLS and presents a certificate this client has no root for,
// which is the normal situation for a hosted database reached from a laptop.
const client = new pg.default.Client({ connectionString: found.url, ssl: { rejectUnauthorized: false } })

console.log(`\nconnecting — connection string from ${found.from}`)
try {
  await client.connect()
} catch (e) {
  console.error(`\ncouldn't connect: ${e.message}`)
  console.error(`\nIf this says "password authentication failed", the string is stale — pull it again.`)
  console.error(`If it says "ENOTFOUND", check you copied the whole line including the host.\n`)
  process.exit(1)
}

const who = await client.query("select current_database() db, current_user usr")
console.log(`connected to ${who.rows[0].db} as ${who.rows[0].usr}\n`)

for (const f of FILES) {
  const sql = readFileSync(join(HERE, f), "utf8")
  process.stdout.write(`applying ${f} … `)
  try {
    await client.query(sql)
    console.log("ok")
  } catch (e) {
    console.log("FAILED")
    console.error(`\n  ${e.message}\n`)
    // Keep going: the two files are independent, and getting one of them in is
    // strictly better than getting neither.
    continue
  }
}

// Prove it rather than assume it. This is the exact thing the app checks before
// it will sell anything, so if these four rows are present, production works.
console.log("\nverifying —")
const checks = [
  ["table    chip_wallet", "select 1 from information_schema.tables where table_schema='public' and table_name='chip_wallet'"],
  ["table    chip_ledger", "select 1 from information_schema.tables where table_schema='public' and table_name='chip_ledger'"],
  ["table    pass_usage",  "select 1 from information_schema.tables where table_schema='public' and table_name='pass_usage'"],
  ["function chips_move",  "select 1 from pg_proc where proname='chips_move'"],
  ["function chips_state", "select 1 from pg_proc where proname='chips_state'"],
  ["function pass_spend",  "select 1 from pg_proc where proname='pass_spend'"],
]
let missing = 0
for (const [label, q] of checks) {
  const r = await client.query(q)
  const ok = r.rowCount > 0
  if (!ok) missing++
  console.log(`  ${ok ? "✓" : "✗"} ${label}`)
}
await client.end()

console.log(missing === 0
  ? `\nDone. Check it went live:  https://airraw.com/api/chips  → should now say "ready":true\n`
  : `\n${missing} missing — paste the error above and it can be fixed.\n`)
process.exit(missing === 0 ? 0 : 1)
