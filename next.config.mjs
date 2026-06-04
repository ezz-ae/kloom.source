import { fileURLToPath } from "node:url"
import { dirname } from "node:path"

const projectRoot = dirname(fileURLToPath(import.meta.url))

// `STANDALONE=1` switches on the self-hosted (Docker/VPS) output. On Vercel we
// must NOT use standalone output — Vercel's own build pipeline serves the app,
// and `output: "standalone"` produces a deployment whose static chunks don't
// resolve correctly, which kills hydration (dead buttons, broken chat). So the
// Vercel/cloud build is the default (no standalone); the VPS build sets STANDALONE=1.
const standalone = process.env.STANDALONE === "1"

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(standalone ? { output: "standalone", outputFileTracingRoot: projectRoot } : {}),
  turbopack: {
    root: projectRoot,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
