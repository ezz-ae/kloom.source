// THE VISITOR'S BROWSER PICKS THE LANGUAGE. NOBODY ELSE DOES.
//
// /ar was built as an Arabic entrance for a Gulf ad, and for a while airraw.com
// itself defaulted to Arabic so an Arabic visitor would not have to find that
// door. Then the traffic was measured: 101 visitors in a day, 92 from the US,
// three from the UAE, none from Saudi. The ads run in English and deliver
// English speakers, so a house Arabic default — even as a fallback — hands a
// language to someone who never asked for one.
//
// The rule now: whatever the browser asks for, if it is supported; English when
// it is not. An Arabic phone gets the Arabic product with no door to find.
import { readFileSync } from "node:fs"
import { detectLanguage, DEFAULT_LANGUAGE } from "@/lib/languages"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const asBrowser = (langs) => Object.defineProperty(globalThis, "navigator", {
  value: { languages: langs, language: langs[0] || "" }, configurable: true, writable: true,
})
const seen = (langs) => { asBrowser(langs); return detectLanguage() }

console.log("— an Arabic browser gets Arabic, wherever it lands —")
for (const l of [["ar"], ["ar-SA"], ["ar-AE"], ["ar-EG", "en-US"]]) {
  check(seen(l) === "Arabic", `${l.join(",")} -> Arabic`)
}

console.log("\n— and everyone else gets their own —")
check(seen(["en-US"]) === "English", "en-US -> English")
check(seen(["fr-FR"]) === "French", "fr-FR -> French")
check(seen(["tr"]) === "Turkish", "tr -> Turkish")

console.log("\n— with English, not Arabic, when we recognise nothing —")
check(seen(["xx-YY"]) === DEFAULT_LANGUAGE, `an unsupported locale -> ${DEFAULT_LANGUAGE}`)
check(seen([""]) === DEFAULT_LANGUAGE, `no locale at all -> ${DEFAULT_LANGUAGE}`)
check(DEFAULT_LANGUAGE === "English", "and that default is English")

console.log("\n— no house language is imposed on top —")
{
  const src = readFileSync("lib/airraw/lang-prefs.ts", "utf8")
  const body = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  check(/return detectLanguage\(\)/.test(body), "the AIRRAW default IS the browser's answer")
  check(!/AIRRAW_DEFAULT_LANGUAGE/.test(body), "there is no hardcoded AIRRAW language left")
  // Assignment only. The first version of this matched the tail of `=== "Arabic"`
  // and flagged the two places that legitimately COMPARE against it.
  check(!/(?<![=!<>])=\s*"Arabic"/.test(body), "and nothing assigns Arabic as a default")
  // The door still works — it sets the choice explicitly, and a saved choice wins.
  const door = readFileSync("app/ar/ArabicDoor.tsx", "utf8")
  check(/saveLangPrefs\(\{ primary: "Arabic"/.test(door), "/ar still sets Arabic explicitly for ad traffic")
  check(/if \(!raw\) return \{ \.\.\.DEFAULTS \}/.test(src), "and a saved choice beats the default, so a picked language sticks")
}

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
