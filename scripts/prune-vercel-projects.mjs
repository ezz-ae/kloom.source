#!/usr/bin/env node
/**
 * List — and optionally delete — idle Vercel projects on a team.
 *
 *   node scripts/prune-vercel-projects.mjs                 # DRY RUN, deletes nothing
 *   node scripts/prune-vercel-projects.mjs --delete        # actually delete
 *
 * Needs a token (Vercel dashboard → Settings → Tokens), because the CLI's own
 * credentials aren't readable from a script:
 *   export VERCEL_TOKEN=xxxxx
 *
 * Deleting a project is IRREVERSIBLE, so:
 *   - dry run is the default; --delete is required to touch anything
 *   - PROTECTED names can never be deleted, even with --delete
 *   - a project with a PRODUCTION deployment is skipped unless --include-live
 *   - each deletion is reported individually, and one failure doesn't abort
 */

// Never deletable. Substring match, case-insensitive — deliberately broad, because
// the cost of over-protecting is a leftover project and the cost of
// under-protecting is deleting the live product.
const PROTECTED = ["airroom", "airraw", "kloom", "entrestate"]

const TOKEN = process.env.VERCEL_TOKEN
if (!TOKEN) {
  console.error(`No VERCEL_TOKEN.

  1. https://vercel.com/account/tokens  →  Create Token (scope: the team you're pruning)
  2. export VERCEL_TOKEN=xxxxx
  3. node scripts/prune-vercel-projects.mjs

Dry run by default — nothing is deleted until you add --delete.`)
  process.exit(1)
}

const DO_DELETE = process.argv.includes("--delete")
const INCLUDE_LIVE = process.argv.includes("--include-live")
const TEAM = process.argv.find((a) => a.startsWith("--team="))?.slice(7) || "trendinerdxb-2027s-projects"

const api = async (path, init = {}) => {
  const url = `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(TEAM)}`
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) } })
  const body = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${body.slice(0, 200)}`)
  return body ? JSON.parse(body) : {}
}

// ── collect every project, across pages ─────────────────────────────────────
const all = []
let until
for (let page = 0; page < 40; page++) {
  const q = `/v9/projects?limit=100${until ? `&until=${until}` : ""}`
  let data
  try { data = await api(q) } catch (e) { console.error(`list failed: ${e.message}`); break }
  all.push(...(data.projects || []))
  const next = data.pagination?.next
  if (!next) break
  until = next
}
console.log(`team: ${TEAM}`)
console.log(`projects found: ${all.length}\n`)

const isProtected = (n) => PROTECTED.some((p) => n.toLowerCase().includes(p))
const hasProd = (p) => !!(p.targets?.production?.id || p.latestDeployments?.some((d) => d.target === "production"))
const age = (ms) => (ms ? `${Math.floor((Date.now() - ms) / 86400000)}d` : "never")

const keep = [], drop = []
for (const p of all) {
  const why =
    isProtected(p.name) ? "PROTECTED"
    : (hasProd(p) && !INCLUDE_LIVE) ? "has a production deployment"
    : null
  ;(why ? keep : drop).push({ p, why })
}

console.log("── KEEPING ──")
for (const { p, why } of keep) console.log(`  ${p.name.padEnd(34)} ${why}`)
if (!keep.length) console.log("  (none)")

console.log(`\n── ${DO_DELETE ? "DELETING" : "WOULD DELETE"} (${drop.length}) ──`)
for (const { p } of drop) console.log(`  ${p.name.padEnd(34)} updated ${age(p.updatedAt)}`)
if (!drop.length) console.log("  (none)")

if (!DO_DELETE) {
  console.log(`\nDRY RUN — nothing was deleted.`)
  console.log(`Read the list above. If it looks right:\n`)
  console.log(`  node scripts/prune-vercel-projects.mjs --delete\n`)
  process.exit(0)
}

console.log("")
let ok = 0, failed = 0
for (const { p } of drop) {
  try {
    await api(`/v9/projects/${encodeURIComponent(p.id || p.name)}`, { method: "DELETE" })
    console.log(`  deleted  ${p.name}`); ok++
  } catch (e) {
    console.log(`  FAILED   ${p.name} — ${e.message.slice(0, 120)}`); failed++
  }
}
console.log(`\ndone: ${ok} deleted, ${failed} failed, ${keep.length} kept.`)
