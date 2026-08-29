// Plain-JS mirror of the rewritten matcher, run against the exact voices that
// were mis-cast in the real output.
// The REAL table, not a copy of it. This test guards the matcher against the
// voices it actually mis-cast, so it has to run against the specs the server
// ships — a private copy would keep passing while the shipped table rotted.
const SPECS = JSON.parse((await import("node:fs")).readFileSync("lib/airraw/accent-specs.json", "utf8"))
  .map((s) => [s.key, { lang: s.lang, locales: s.locales, terms: s.terms }])
const esc=t=>t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")
const hasWord=(h,t)=>new RegExp(`\\b${esc(t)}\\b`).test(h)
const hay=v=>[v.name||"",v.accent||"",...(v.vl||[]).flatMap(x=>[x.accent||"",x.locale||""])].join(" ").toLowerCase()
const langs=v=>new Set([...(v.langs||[]),...(v.vl||[]).map(x=>x.language)].filter(Boolean))
function accentOf(v){const h=hay(v),L=langs(v)
  for(const[k,s]of SPECS){if(!L.has(s.lang))continue
    if(s.locales.some(l=>h.includes(l)))return k
    if(s.terms.some(t=>hasWord(h,t)))return k}
  return null}

// The real mis-casts from the account output, plus the ones that were correct.
const cases = [
  // [name, verified langs, expected]
  ["James - Professional British Male", ["en"], null],
  ["EN-Christina",                       ["en"], null],
  ["Olivia - Bright, Youthful and Engaging", ["en"], null],
  ["EN-Archer",                          ["en"], null],
  ["Sara - Soft, Calm and Gentle",       ["ar","en"], null],
  ["Romanian narrator",                  ["en"], null],
  // Not a false positive: this voice NAMES its language and is verified for
  // English, which is exactly what EN_JP is for — a Japanese speaker's English.
  // It expected null only because this test used to carry a truncated copy of
  // the table with no EN_JP row in it; running against the shipped specs is
  // what surfaced that. The rows above are the real guard — a name that merely
  // CONTAINS something accent-shaped ("R-omani-an") must still match nothing.
  ["Aya - Friendly Casual Japanese Voice", ["en","ja"], "EN_JP"],
  // must still be found
  ["Fatima - Expressive Egyptian",       ["ar"], "AR_EG"],
  ["Ghozlan - Professional Support Agent", ["ar"], null],   // name carries no accent
  ["Maryam E - Saudi Calm & Warm",       ["ar"], "AR_GULF"],
  ["Faisal Alotaibi - Warm Saudi",       ["ar"], "AR_GULF"],
  ["Mohammad - Warm Arabic Commercial",  ["ar"], null],
  ["Ghizlane - Warm, Natural and Encouraging", ["ar"], null],
  ["Houssam - Warm, Friendly & Multilingual", ["ar"], null],
  ["Mehdi - Sharp and Lively",           ["ar"], null],
  ["Artem Lebedev - Captivating and Engaging", ["en"], null],
  ["Sharanya - Warm, Natural & Expressive", ["en"], null],
  ["Priya - Indian Storyteller",         ["en"], "EN_IN"],
  ["Layla - Modern Arabic",              ["ar"], null],
]
let fail=0
for(const [name, ls, want] of cases){
  const got = accentOf({name, langs: ls, vl: ls.map(l=>({language:l}))})
  const ok = got === want
  if(!ok) fail++
  console.log(`${ok?"ok  ":"FAIL"} ${String(got).padEnd(8)} (want ${String(want).padEnd(8)}) ${name}`)
}
// locale-driven: the strongest and most reliable signal
console.log("\nlocale-driven:")
for (const [loc, want] of [["ar-EG","AR_EG"],["ar-SA","AR_GULF"],["ar-MA","AR_MA"],["ar-LB","AR_LB"],["ar-TN","AR_TN"]]) {
  const got = accentOf({name:"Generic Voice", langs:["ar"], vl:[{language:"ar", locale:loc}]})
  const ok = got===want; if(!ok) fail++
  console.log(`${ok?"ok  ":"FAIL"} ${loc} -> ${got}`)
}
console.log(fail===0?"\nPASS":`\nFAIL — ${fail}`)
process.exit(fail?1:0)
