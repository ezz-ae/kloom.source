// Plain-JS mirror of lib/text-dedup.ts's Arabic boilerplate filter.
// Kept in sync by hand — if the regexes below diverge from the .ts, this test lies.

function normArabic(s) {
  return s
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىی]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
}

const BOILERPLATE_AR =
  /اشترك\S*\s*(؟?)(في|ب)?\s*(ال)?قنا|الاشتراك\s*(في|ب)?\s*(ال)?قنا|لا\s*تنسو?ا?\s*الاشتراك|لايك\s*و?\s*اشتراك|فعل\S*\s*الجرس|تابعو?نا\s+(علي|في)|اشترك\S*\s*(في|ب)?\s*قناتنا/

const BOILERPLATE_EN =
  /subscribe\s+to\s+(?:my|the|our)\s+channel|like\s+and\s+subscribe|hit\s+the\s+bell|smash\s+that\s+(?:like|subscribe)|don'?t\s+forget\s+to\s+subscribe|thanks?\s+for\s+watching/i

function isHallucinatedBoilerplate(text) {
  return BOILERPLATE_EN.test(text) || BOILERPLATE_AR.test(normArabic(text))
}

// MUST be blocked. First entry is the user's exact reported string.
const MUST_BLOCK = [
  "اشتركو في القناه",
  "ااشتركو في القناه آ",
  "اشتركوا في القناة",
  "اشترك في القناة",
  "اشتركوا فى القناه",
  "لا تنسوا الاشتراك في القناة",
  "لايك واشتراك",
  "اشتركوا في قناتنا وفعلوا الجرس",
  "تابعونا على انستغرام",
  "subscribe to my channel",
  "like and subscribe",
  "thanks for watching",
]

// MUST survive — ordinary dialogue that shares roots with the boilerplate.
const MUST_KEEP = [
  "قال إنه يقول الحقيقة دايما",
  "انا مشترك في نادي رياضي",
  "شفت القناة اللي جنب البيت",
  "تابعت الفيلم لحد النهاية",
  "خليني اشترك معاك في الفكرة دي",
  "i subscribe to that idea completely",
  "she was watching me the whole time",
]

let fail = 0
for (const s of MUST_BLOCK) {
  const got = isHallucinatedBoilerplate(s)
  if (!got) { fail++; console.log(`LEAK  (should block): ${s}`) }
  else console.log(`ok    blocked: ${s}`)
}
console.log("")
for (const s of MUST_KEEP) {
  const got = isHallucinatedBoilerplate(s)
  if (got) { fail++; console.log(`OVER  (should keep): ${s}`) }
  else console.log(`ok    kept:    ${s}`)
}
console.log(`\n${fail === 0 ? "PASS" : `FAIL — ${fail} case(s)`}`)
process.exit(fail === 0 ? 0 : 1)
