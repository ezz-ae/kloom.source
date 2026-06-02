#!/usr/bin/env node
/**
 * Production launcher for the Next.js standalone server.
 *
 * `output: "standalone"` means `next start` does NOT work — you must run
 * .next/standalone/server.js. That server also does NOT auto-load .env.local
 * (only the dev/`next start` runtimes do), and PM2 doesn't read .env files.
 *
 * This wrapper makes every bare-VPS path identical and correct:
 *   - pnpm start          (local prod test)
 *   - pm2  (ecosystem.config.js)
 *   - systemd (ora-web.service)  — systemd's EnvironmentFile still works; this
 *     loader never overrides an env var that is already set.
 *
 * It loads .env.local from the repo root if present, sets PORT/HOSTNAME
 * defaults, then hands off to the standalone server. Zero dependencies.
 */
const fs = require("fs")
const path = require("path")

const root = path.join(__dirname, "..")
const envPath = path.join(root, ".env.local")

if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, "utf8").split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (!key || process.env[key] !== undefined) continue // never override real env
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}

process.env.PORT = process.env.PORT || "3000"
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0"
process.env.NODE_ENV = process.env.NODE_ENV || "production"

const server = path.join(root, ".next", "standalone", "server.js")
if (!fs.existsSync(server)) {
  console.error(`[ora] standalone server not found at ${server}\n` +
                `Run \`pnpm build\` first (it also copies static assets via assets:standalone).`)
  process.exit(1)
}
require(server)
