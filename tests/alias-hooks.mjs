// Resolve the project's "@/" import alias for tests.
//
// tsconfig maps "@/*" to the repo root, which Next understands and bare Node does
// not. Without this, any module that imports "@/lib/…" can only be tested by
// reading its source and asserting on the text — which is how a broken function
// like lookFor sat there passing a source-grep while returning the entire
// portrait prompt at runtime. Resolving the alias lets a test call the real
// thing and look at what it actually returns.
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

const ROOT = new URL("../", import.meta.url)

export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/")) {
    const base = new URL(spec.slice(2), ROOT)
    // Same candidate order a bundler uses: exact file, then .ts/.tsx, then index.
    for (const ext of ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"]) {
      const cand = new URL(base.href + ext)
      if (existsSync(fileURLToPath(cand))) return next(cand.href, ctx)
    }
  }
  return next(spec, ctx)
}
