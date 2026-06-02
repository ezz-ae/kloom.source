import { fileURLToPath } from "node:url"
import { dirname } from "node:path"

const projectRoot = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone build for Docker/VPS — self-contained server in .next/standalone
  output: "standalone",
  // Pin the file-tracing root to THIS project. Without it, a stray lockfile in a
  // parent dir makes Next nest the standalone output (server.js ends up buried).
  outputFileTracingRoot: projectRoot,
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
