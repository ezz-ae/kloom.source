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
  // Separate build dir lets the .fun variant dev server run in parallel with the
  // .io one (different port + NEXT_DIST_DIR) without clobbering .next.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  turbopack: {
    root: projectRoot,
  },
  // The face-quality validator loads its tinyFaceDetector model + tfjs WASM by
  // runtime path, so the file tracer can't see them — force them into the
  // character-photo serverless function bundle.
  outputFileTracingIncludes: {
    "/api/character-photo": ["./face-assets/**/*"],
  },
  // Native (@napi-rs/canvas) + large/wasm (tfjs, face-api) packages must be required
  // at runtime from node_modules, not bundled by Turbopack/webpack.
  serverExternalPackages: ["@vladmandic/face-api", "@tensorflow/tfjs", "@tensorflow/tfjs-backend-wasm", "@napi-rs/canvas"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // On the AIRRAW deployment (AIRRAW_HOME=1) the root opens the situations home —
  // one person, mini situations. Other builds (kloom) keep their own homepage.
  // The old /airroom path redirects on all.
  async rewrites() {
    return { beforeFiles: process.env.AIRRAW_HOME === "1" ? [{ source: "/", destination: "/situations" }] : [] }
  },
  async redirects() {
    return [{ source: "/airroom", destination: "/airraw", permanent: false }]
  },
}

export default nextConfig
