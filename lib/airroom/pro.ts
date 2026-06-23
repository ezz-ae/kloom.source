// AIRRAW "pro" gate (placeholder). Paying-user features (e.g. editing a room's
// vibe so the AI is forced to follow it) check this. For now it's a local flag you
// can flip with ?pro=1; wire the real Ziina/entitlement check in here later.
export function isPro(): boolean {
  if (typeof window === "undefined") return false
  try {
    const u = new URLSearchParams(window.location.search)
    if (u.get("pro") === "1") localStorage.setItem("airraw_pro", "1")
    if (u.get("pro") === "0") localStorage.removeItem("airraw_pro")
    return localStorage.getItem("airraw_pro") === "1"
  } catch { return false }
}
