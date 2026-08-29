// Which accent a voice belongs to — the matcher, against the voices that were
// actually mis-cast on the live account.
//
// This test has now caught the same class of bug twice, and both times the
// fixtures were the reason it hadn't. Round one: substring matching put
// "R-omani-an" in the Khaleeji pool. Round two: the fixtures described voices
// more simply than ElevenLabs really does — no native-language label, and no
// verification rows carrying a locale — so the matcher looked correct here while
// production filed EN-Christina, EN-Archer, EN-David, a British male and two
// Hindi voices as Gulf Arabs. The cases below use the REAL shapes.
const SPECS = JSON.parse((await import("node:fs")).readFileSync("lib/airraw/accent-specs.json", "utf8"))
  .map((s) => [s.key, { lang: s.lang, locales: s.locales, terms: s.terms }])
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const hasWord = (h, t) => new RegExp(`\\b${esc(t)}\\b`).test(h)

// Mirrors lib/airraw/voice-discovery.ts. Two rules do the work: a voice's own
// language decides which accents it can carry, and an accent claim only counts
// as evidence about the language it was made in.
const hay = (v, lang) => [
  v.name || "", v.accent || "",
  ...(v.vl || []).filter((x) => x.language === lang).flatMap((x) => [x.accent || "", x.locale || ""]),
].join(" ").toLowerCase()
const langs = (v) => new Set([...(v.langs || []), ...(v.vl || []).map((x) => x.language)].filter(Boolean))
function accentOf(v) {
  const L = langs(v)
  const native = (v.native || "").toLowerCase()
  for (const [k, s] of SPECS) {
    if (!L.has(s.lang)) continue
    if (native && native !== s.lang) continue
    const h = hay(v, s.lang)
    if (s.locales.some((l) => h.includes(l))) return k
    if (s.terms.some((t) => hasWord(h, t))) return k
  }
  return null
}

let fail = 0
const check = (got, want, label) => {
  const ok = got === want
  if (!ok) fail++
  console.log(`${ok ? "ok  " : "FAIL"} ${String(got).padEnd(8)} (want ${String(want).padEnd(8)}) ${label}`)
}

// ── the live mis-casts ──────────────────────────────────────────────────────
// Every one of these is an ENGLISH (or Hindi) voice that ElevenLabs verified for
// Arabic and stamped with a representative Arabic locale. The locale says which
// language the verification was for, not where the speaker is from. Nine of them
// were being cast as Gulf Arabs on the live floor.
console.log("English voices verified for Arabic — must NOT become Arabs:")
for (const name of ["EN-Christina", "EN-Archer", "EN-David", "James - Professional British Male",
                    "Olivia - Bright, Youthful and Engaging", "Sara - Soft, Calm and Gentle"]) {
  check(accentOf({ name, native: "en", langs: ["en", "ar"],
                   vl: [{ language: "en", accent: "american" }, { language: "ar", accent: "standard", locale: "ar-SA" }] }),
        null, name)
}
console.log("\nHindi voices verified for Arabic — same:")
for (const name of ["Krishna - Energetic and Expressive", "Raju - Warm and Professional"]) {
  check(accentOf({ name, native: "hi", langs: ["hi", "ar"],
                   vl: [{ language: "ar", accent: "standard", locale: "ar-SA" }] }), null, name)
}

// An accent claim made about SPANISH is not evidence about English. This is how
// "EN-Siren" was filed as a Latin-accented English voice.
console.log("\naccent claims don't cross languages:")
check(accentOf({ name: "EN-Siren", native: "en", langs: ["en", "es"],
                 vl: [{ language: "en", accent: "american" }, { language: "es", accent: "latin american" }] }),
      null, "EN-Siren (latin american is its SPANISH accent)")

// ── must still be found ─────────────────────────────────────────────────────
console.log("\nreal regional voices — must still be found:")
check(accentOf({ name: "Fatima - Expressive Egyptian", native: "ar", langs: ["ar"], vl: [{ language: "ar" }] }), "AR_EG", "Fatima - Expressive Egyptian")
check(accentOf({ name: "Maryam E - Saudi Calm & Warm", native: "ar", langs: ["ar"], vl: [{ language: "ar" }] }), "AR_GULF", "Maryam E - Saudi Calm & Warm")
check(accentOf({ name: "Faisal Alotaibi - Warm Saudi", native: "ar", langs: ["ar"], vl: [{ language: "ar" }] }), "AR_GULF", "Faisal Alotaibi - Warm Saudi")
check(accentOf({ name: "Priya - Indian Storyteller", native: "en", langs: ["en"], vl: [{ language: "en" }] }), "EN_IN", "Priya - Indian Storyteller")
// A NATIVE Arabic voice whose locale names its region is the strongest signal
// there is, and it must survive the native-language gate.
for (const [loc, want] of [["ar-EG", "AR_EG"], ["ar-SA", "AR_GULF"], ["ar-MA", "AR_MA"], ["ar-LB", "AR_LB"], ["ar-TN", "AR_TN"]]) {
  check(accentOf({ name: "Generic Voice", native: "ar", langs: ["ar"], vl: [{ language: "ar", locale: loc }] }), want, `native Arabic voice, locale ${loc}`)
}

// ── must still match nothing ────────────────────────────────────────────────
console.log("\nnames that merely LOOK accent-shaped:")
check(accentOf({ name: "Romanian narrator", native: "en", langs: ["en"], vl: [{ language: "en" }] }), null, "Romanian narrator (contains 'omani')")
for (const name of ["Ghozlan - Professional Support Agent", "Mohammad - Warm Arabic Commercial",
                    "Layla - Modern Arabic", "Houssam - Warm, Friendly & Multilingual"]) {
  check(accentOf({ name, native: "ar", langs: ["ar"], vl: [{ language: "ar" }] }), null, `${name} (Arabic, but names no region)`)
}
// Not a false positive: this voice names its own language and is verified for
// English, which is what EN_JP is for — a Japanese speaker's English.
check(accentOf({ name: "Aya - Friendly Casual Japanese Voice", langs: ["en", "ja"], vl: [{ language: "en" }, { language: "ja" }] }),
      "EN_JP", "Aya - Friendly Casual Japanese Voice (no declared native language)")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
