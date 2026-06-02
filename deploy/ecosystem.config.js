// PM2 process manager — bare-VPS alternative to Docker.
//   pnpm build && pnpm mcp:build
//   pm2 start deploy/ecosystem.config.js && pm2 save && pm2 startup
//
// Assumes Ollama runs separately (systemd: `systemctl enable --now ollama`)
// and env lives in .env.local at the repo root (loaded by Next automatically;
// the MCP process gets envs from this file's `env` block).

module.exports = {
  apps: [
    {
      // Standalone Next server via wrapper (loads .env.local, sets PORT/HOSTNAME,
      // then runs .next/standalone/server.js). `next start` does NOT work with
      // output:"standalone". `pnpm build` copies static assets into standalone.
      name: "ora-web",
      cwd: __dirname + "/..",
      script: "deploy/start-web.js",
      env: { NODE_ENV: "production", PORT: "3000", HOSTNAME: "0.0.0.0" },
      instances: 1,
      autorestart: true,
      max_memory_restart: "800M",
    },
    {
      name: "ora-mcp",
      cwd: __dirname + "/../mcp-server",
      script: "dist/index.js",
      env: { NODE_ENV: "production", MCP_PORT: "3001" },
      autorestart: true,
      max_memory_restart: "300M",
    },
  ],
}
