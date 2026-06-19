/**
 * AIRROOM avatars — a face for every soul, with no image pipeline and no network.
 * A deterministic, temperature-tinted gradient orb per character (seed → the same
 * face every time). Cool/water souls glow cyan, warm ones amber, fire ones red —
 * each unique via the seed. Cheap enough to paint thousands at once.
 */
const h = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }

export function avatarBg(seed: number, f: number): string {
  const base = f < 0.4 ? 192 : f < 0.72 ? 42 : 10        // water · amber · fire
  const hue = (base + (h(seed) * 46 - 23) + 360) % 360
  const hue2 = (hue + 14 + h(seed * 3.1) * 36) % 360
  const px = 16 + Math.floor(h(seed * 1.7) * 52)
  const py = 16 + Math.floor(h(seed * 2.3) * 52)
  return `radial-gradient(circle at ${px}% ${py}%, hsl(${hue} 90% 72%), hsl(${hue2} 74% 46%) 60%, hsl(${hue2} 66% 22%))`
}

export function avatarGlow(f: number): string {
  return f < 0.4 ? "#6fd6e6" : f < 0.72 ? "#ffce7a" : "#ff7a4d"
}
