// Shared persona utilities — identity portraits, name hashing, gender hints.
//
// Portraits are generated, not fetched: every character gets a deterministic
// premium "identity card" — a deep duotone aura + elegant monogram — rendered
// as an inline SVG data URI. Works in any <img src>, no network, no stock
// photos, perfectly consistent art direction across the whole app.

export const FEMALE_PERSONAS = new Set<string>([
  "Mistress Vale", "Mia (Submissive)", "Aria (Girlfriend)", "Camila (Stepmom)",
  "Yuki (Tsundere)", "Selene (Sadist)", "Vera (Femme Fatale)", "Adira (Hot Wife)",
  "Luna (Life Coach)", "Nova", "Emma (Sister)", "Victoria (Secretary)",
  "Nova (Coach)", "Professor Hale", "Sage (Switch)", "Sage (Mentor)",
  "Pip (Little)", "Stepsister", "Friend's Mom", "Best Friend's Wife",
  "The Babysitter", "Fantasy Maker", "Mommy June", "Obsession",
  "Stranger at the Bar",
])

export function nameHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

// Curated duotone auras — dark-luxe pairs that sit well on the app's near-black.
const AURAS: Array<[string, string]> = [
  ["#f59e0b", "#fb7185"], // amber → rose (brand)
  ["#8b5cf6", "#6366f1"], // violet → indigo
  ["#10b981", "#2dd4bf"], // emerald → teal
  ["#38bdf8", "#3b82f6"], // sky → blue
  ["#e879f9", "#ec4899"], // fuchsia → pink
  ["#f43f5e", "#f97316"], // rose → orange
  ["#facc15", "#f59e0b"], // gold
  ["#a78bfa", "#f0abfc"], // lavender → orchid
]

import { PORTRAIT_SLUGS } from "@/lib/cast-portraits"

// Bump when curated /cast/*.jpg files are re-shot, so the same URL doesn't serve a
// browser-cached stale (robotic) face. v5 = the FAL flux/dev candid re-shoot.
const CAST_VERSION = "5"

/** Same slug rule as the portrait generation pipeline — keep in sync. */
export function portraitSlug(name: string): string {
  return name.toLowerCase().replace(/\(.*?\)/g, "").trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

/**
 * Character portrait. Real generated portrait when one exists
 * (/public/cast/<slug>.jpg); otherwise the deterministic identity card —
 * deep radial aura in a curated duotone, soft ring, serif monogram —
 * as an SVG data URI. Both work directly as <img src>.
 */
export function imageFor(persona: { name: string; photoUrl?: string }): string {
  // An explicit generated photo (Supabase Storage url) always wins.
  if (persona.photoUrl) return persona.photoUrl
  const name = persona.name || "?"
  const slug = portraitSlug(name)
  if (PORTRAIT_SLUGS.has(slug)) return `/cast/${slug}.jpg?v=${CAST_VERSION}`
  const h = nameHash(name)
  const [c1, c2] = AURAS[h % AURAS.length]
  // Aura position drifts per identity so cards don't look stamped.
  const cx = 30 + (h % 41)            // 30–70
  const cy = 26 + ((h >> 3) % 38)     // 26–63
  const initial = (name.replace(/^The\s+/i, "").trim()[0] || "?").toUpperCase()

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<defs>
<radialGradient id="a" cx="${cx}%" cy="${cy}%" r="85%">
<stop offset="0%" stop-color="${c1}" stop-opacity="0.55"/>
<stop offset="45%" stop-color="${c2}" stop-opacity="0.22"/>
<stop offset="100%" stop-color="#121017" stop-opacity="1"/>
</radialGradient>
<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${c1}"/>
<stop offset="100%" stop-color="${c2}"/>
</linearGradient>
</defs>
<rect width="200" height="200" fill="#121017"/>
<rect width="200" height="200" fill="url(#a)"/>
<circle cx="100" cy="100" r="64" fill="none" stroke="url(#b)" stroke-opacity="0.45" stroke-width="1.5"/>
<circle cx="100" cy="100" r="74" fill="none" stroke="url(#b)" stroke-opacity="0.15" stroke-width="1"/>
<text x="100" y="124" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="68" font-weight="700" fill="#f5f3f0" fill-opacity="0.92">${initial}</text>
</svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * Avatar for any room seat by name. Same identity-card system everywhere —
 * model-backed seats (Claude/Gemini) get the same treatment so the room
 * looks coherent. `bot`/`seed` kept for call-site compatibility.
 */
export function avatarForName(name: string, opts?: { bot?: boolean; seed?: string }): string {
  return imageFor({ name: opts?.seed ?? name })
}
