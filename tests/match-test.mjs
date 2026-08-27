// Plain-JS mirror of the rewritten matcher, run against the exact voices that
// were mis-cast in the real output.
const SPECS = [
  ["AR_EG",{lang:"ar",locales:["ar-eg"],terms:["egyptian","egypt","cairo","masri","masry"]}],
  ["AR_MA",{lang:"ar",locales:["ar-ma"],terms:["moroccan","morocco","darija","maghrebi"]}],
  ["AR_TN",{lang:"ar",locales:["ar-tn"],terms:["tunisian","tunisia","derja"]}],
  ["AR_LB",{lang:"ar",locales:["ar-lb","ar-sy","ar-jo","ar-ps"],terms:["lebanese","lebanon","levantine","syrian","jordanian","shami","palestinian"]}],
  ["AR_GULF",{lang:"ar",locales:["ar-sa","ar-ae","ar-kw","ar-qa","ar-bh","ar-om"],terms:["gulf","khaleeji","saudi","emirati","kuwaiti","qatari","bahraini","omani"]}],
  ["EN_RU",{lang:"en",locales:[],terms:["russian","slavic","ukrainian"]}],
  ["EN_TR",{lang:"en",locales:[],terms:["turkish"]}],
  ["EN_IN",{lang:"en",locales:["en-in"],terms:["indian","pakistani","bengali","sri lankan","hindi"]}],
  ["EN_LATAM",{lang:"en",locales:[],terms:["mexican","colombian","argentinian","chilean","latin american","latino","latina"]}],
]
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
  ["Aya - Friendly Casual Japanese Voice", ["en","ja"], null],
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
