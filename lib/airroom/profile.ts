// AIRRAW profile — anonymous, no login. A stable id + avatar (hue + glyph) is
// generated once and kept locally; the display name is editable. This is "you"
// on the floor — the same identity the room presence layer shows to others.
// Cosmetic + local, in the same spirit as the Pro token in ./pro.

export interface Profile { id: string; name: string; hue: number; glyph: string }

const KEY = "airraw_profile"
const GLYPHS = ["✦", "☾", "✷", "❂", "⟡", "✺", "◐", "♁", "✸", "❖", "⬡", "✶"]
const ADJ = ["quiet", "late", "neon", "velvet", "golden", "ember", "drift", "echo", "lunar", "hush", "cobalt", "amber"]
const NOUN = ["signal", "comet", "static", "orbit", "ghost", "wave", "spark", "moth", "tide", "haze", " link", "ember"]

function rnd(): number {
  // crypto when available; Math.random fallback. Only used to mint the one-time id.
  try {
    const a = new Uint32Array(1); (crypto as Crypto).getRandomValues(a); return a[0]
  } catch { return Math.floor(Math.random() * 4294967296) }
}

function generate(): Profile {
  const a = ADJ[rnd() % ADJ.length], n = NOUN[rnd() % NOUN.length].trim()
  return { id: rnd().toString(36) + rnd().toString(36).slice(0, 4), name: `${a} ${n}`, hue: rnd() % 360, glyph: GLYPHS[rnd() % GLYPHS.length] }
}

export function getProfile(): Profile {
  if (typeof window === "undefined") return { id: "", name: "you", hue: 168, glyph: "✦" }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { const p = JSON.parse(raw) as Profile; if (p && p.id) return p }
  } catch { /* */ }
  const p = generate()
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* */ }
  return p
}

export function setProfileName(name: string): Profile {
  const p = getProfile()
  p.name = (name || "").trim().slice(0, 24) || p.name
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* */ }
  return p
}

/** Re-roll the avatar glyph + colour (keeps the id and name). */
export function rerollAvatar(): Profile {
  const p = getProfile()
  p.hue = rnd() % 360; p.glyph = GLYPHS[rnd() % GLYPHS.length]
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* */ }
  return p
}
