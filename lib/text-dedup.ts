// Catch repeated sentences the model emits — including NEAR-duplicates it restates
// with slight rewording, which exact-match dedup misses entirely (e.g. "but i'm here
// now, right?" then "i'm right here."). This is the dominant cause of the "AI keeps
// repeating the same sentence" complaint, since it repeats the IDEA, not the bytes.

export function normSentence(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim()
}

// Token-set (Jaccard) overlap between two normalized sentences. 1 = identical word set.
export function sentSim(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter(Boolean))
  const tb = new Set(b.split(" ").filter(Boolean))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / (ta.size + tb.size - inter)
}

// Is `norm` a repeat of any prior sentence — exact, substring, or near-duplicate?
// Short fragments (<=8 chars: "ok", "haha", "mmm") are never treated as repeats so
// natural vocal beats aren't stripped.
export function isRepeatSentence(norm: string, priors: string[]): boolean {
  if (norm.length <= 8) return false
  return priors.some(
    (p) => p.length > 8 && (p === norm || p.includes(norm) || norm.includes(p) || sentSim(p, norm) >= 0.6),
  )
}

// Re-join kept sentence fragments with a single space, guaranteeing a space after
// sentence punctuation (the boundary regex can consume the trailing space, gluing
// "is that right?good answer" — which TTS then reads as one run-on word).
export function joinSentences(parts: string[]): string {
  return parts.join(" ").replace(/\s+/g, " ").replace(/([.!?…])([A-Za-z0-9])/g, "$1 $2").trim()
}
