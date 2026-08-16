// Catch repeated sentences the model emits — including NEAR-duplicates it restates
// with slight rewording, which exact-match dedup misses entirely (e.g. "but i'm here
// now, right?" then "i'm right here."). This is the dominant cause of the "AI keeps
// repeating the same sentence" complaint, since it repeats the IDEA, not the bytes.

export function normSentence(s: string): string {
  // Keep Latin, Arabic (U+0600–U+06FF), and digits; strip punctuation/emoji.
  return s.toLowerCase().replace(/[^a-z0-9؀-ۿ ]/g, "").replace(/\s+/g, " ").trim()
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

// The LLM itself occasionally hallucinates video-outro boilerplate — trained on scraped
// video transcripts/subtitles, it slips into "subscribe to the channel" / "like and
// subscribe" mid-character-voice, most often in Arabic ("اشتركوا في القناة" and its many
// singular/plural/dialect spellings) but sometimes in English too. This is CONTENT the
// model produced, not noise from a mic — so it needs a substring check (the phrase can
// sit inside an otherwise-real sentence), unlike the STT hallucination list which only
// ever sees a clean, isolated utterance. Checked per-sentence in the chat stream so a
// hit drops just that sentence, never the character's real line around it.
// Arabic is written inconsistently — the SAME phrase appears as القناة or القناه
// (ta-marbuta vs ha), اشتركوا or اشتركو (with/without the final alef), أ/إ/آ or ا,
// ى or ي. The previous regex demanded one exact spelling, so real output like
// "اشتركو في القناه" walked straight past it. Normalise the text first, then match
// against normalised patterns — one rule now covers every spelling variant.
function normArabic(s: string): string {
  return s
    .replace(/[ً-ٰٟـ]/g, "")  // strip diacritics + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")                            // ta-marbuta → ha
    .replace(/[ىی]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
}

// Matched against NORMALISED text (so القناه covers القناة, اشتركو covers اشتركوا).
const BOILERPLATE_AR =
  /اشترك\S*\s*(؟?)(في|ب)?\s*(ال)?قنا|الاشتراك\s*(في|ب)?\s*(ال)?قنا|لا\s*تنسو?ا?\s*الاشتراك|لايك\s*و?\s*اشتراك|فعل\S*\s*الجرس|تابعو?نا\s+(علي|في)|اشترك\S*\s*(في|ب)?\s*قناتنا/

const BOILERPLATE_EN =
  /subscribe\s+to\s+(?:my|the|our)\s+channel|like\s+and\s+subscribe|hit\s+the\s+bell|smash\s+that\s+(?:like|subscribe)|don'?t\s+forget\s+to\s+subscribe|thanks?\s+for\s+watching/i

export function isHallucinatedBoilerplate(text: string): boolean {
  return BOILERPLATE_EN.test(text) || BOILERPLATE_AR.test(normArabic(text))
}

// For callers that get one accumulated reply string instead of a live sentence
// stream (e.g. GroupRoom's per-member turn) — split on sentence boundaries, drop
// any hallucinated ones, rejoin. Returns "" if nothing real was left (caller's
// existing empty-reply fallback then takes over, same as an LLM-down turn).
export function stripHallucinatedSentences(text: string): string {
  const parts = text.match(/[^.!?…؟\n]*[.!?…؟\n]+|\S[^.!?…؟\n]*$/g)
  if (!parts) return isHallucinatedBoilerplate(text) ? "" : text
  const kept = parts.filter((p) => !isHallucinatedBoilerplate(p)).map((p) => p.trim())
  return kept.length ? joinSentences(kept) : ""
}
