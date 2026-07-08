// The first-visit welcome — a warm, personal beat before the deck opens. Once
// ever per browser; a return visitor never sees it again. Everything here is
// CLIENT-ONLY (localStorage) — nothing is sent to the server, no account, no
// signup. A chosen name is just a nickname for the session, not an identity.
const NAME_KEY = "airraw_name"
const SEEN_KEY = "airraw_onboarded"

export function getOnboardName(): string {
  try { return (localStorage.getItem(NAME_KEY) || "").trim() } catch { return "" }
}
export function setOnboardName(name: string) {
  try {
    const clean = name.trim().slice(0, 24)
    if (clean) localStorage.setItem(NAME_KEY, clean)
  } catch { /* */ }
}
export function hasOnboarded(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === "1" } catch { return false }
}
export function markOnboarded() {
  try { localStorage.setItem(SEEN_KEY, "1") } catch { /* */ }
}

/** Group-room presence handle: the chosen name if you gave one, else the
 *  existing random Guest-XXXX from lib/room-session — airraw-only wrapper so
 *  Kloom's shared resolveHandle() stays untouched. */
export function resolveAirrawHandle(fallback: () => string): string {
  const name = getOnboardName()
  return name || fallback()
}
