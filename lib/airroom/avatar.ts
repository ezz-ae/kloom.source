/**
 * AIRROOM avatars — a face for every soul, with no image pipeline and no network.
 * A deterministic, temperature-tinted gradient orb per character (seed → the same
 * face every time). Cool/water souls glow cyan, warm ones amber, fire ones red —
 * each unique via the seed. Cheap enough to paint thousands at once.
 *
 * Colors are emitted as rgb() (not hsl) on purpose: when these gradients are
 * server-rendered, the browser normalizes inline hsl() to rgb() in the DOM, which
 * trips React's hydration check (hsl in the vDOM vs rgb in the server HTML). We do
 * the hsl→rgb conversion here so server and client strings match byte-for-byte.
 */
const h = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }

// Standard hsl→rgb (h in degrees, s/l in percent), rounded the same way browsers
// round, so the string we emit equals the one the browser would compute.
function rgbFromHsl(hDeg: number, sPct: number, lPct: number): string {
  const s = sPct / 100, l = lPct / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = ((((hDeg % 360) + 360) % 360)) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0, g = 0, b = 0
  if (hp < 1) { r = c; g = x } else if (hp < 2) { r = x; g = c }
  else if (hp < 3) { g = c; b = x } else if (hp < 4) { g = x; b = c }
  else if (hp < 5) { r = x; b = c } else { r = c; b = x }
  const m = l - c / 2
  return `rgb(${Math.round((r + m) * 255)}, ${Math.round((g + m) * 255)}, ${Math.round((b + m) * 255)})`
}

export function avatarBg(seed: number, f: number): string {
  const base = f < 0.4 ? 192 : f < 0.72 ? 42 : 10        // water · amber · fire
  const hue = (base + (h(seed) * 46 - 23) + 360) % 360
  const hue2 = (hue + 14 + h(seed * 3.1) * 36) % 360
  const px = 16 + Math.floor(h(seed * 1.7) * 52)
  const py = 16 + Math.floor(h(seed * 2.3) * 52)
  return `radial-gradient(circle at ${px}% ${py}%, ${rgbFromHsl(hue, 90, 72)}, ${rgbFromHsl(hue2, 74, 46)} 60%, ${rgbFromHsl(hue2, 66, 22)})`
}

export function avatarGlow(f: number): string {
  return f < 0.4 ? "#6fd6e6" : f < 0.72 ? "#ffce7a" : "#ff7a4d"
}
