// THE APP'S LANGUAGE IS A CHOICE, AND IT IS FINDABLE.
//
// The interface used to follow whichever language conversations were set to,
// with no way to set it on its own. So a visitor from an Arab country whose
// phone reports English got an English app — and the setting that would have
// fixed it was itself written in English, which is no use to someone who cannot
// read it.
//
// Two rules. The interface language is its own preference, and where Arabic is
// plausibly theirs the words عربي and English are on the screen, each written
// in its own script so that whichever one they read, one of them is readable.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const store = {}
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v }, removeItem: (k) => { delete store[k] } }
globalThis.window = { location: { search: "" }, dispatchEvent: () => true }
globalThis.CustomEvent = class { constructor(t) { this.type = t } }

const setZone = (tz) => { globalThis.Intl = { ...Intl, DateTimeFormat: function () { return { resolvedOptions: () => ({ timeZone: tz }) } } } }
// navigator is a getter-only global in Node, so it is redefined rather than assigned.
const setLangs = (langs) => Object.defineProperty(globalThis, "navigator", {
  value: { languages: langs, language: langs[0] || "" }, configurable: true, writable: true,
})

const ui = await import("../lib/airraw/ui-lang.ts")
const i18n = await import("../lib/airraw/i18n.ts")

console.log("— the choice is its own, and it wins —")
setZone("America/New_York"); setLangs(["en-US"])
check(ui.uiLangChoice() === null, "no choice by default")
check(i18n.currentLocale() === "en", "and the app follows the conversation language, as it always did")
ui.setUiLang("ar")
check(ui.uiLangChoice() === "ar" && i18n.currentLocale() === "ar", "choosing Arabic turns the app Arabic, wherever they are")
ui.setUiLang("en")
check(i18n.currentLocale() === "en", "and choosing English turns it back, even if conversations are Arabic")
ui.setUiLang(null)
check(ui.uiLangChoice() === null && i18n.currentLocale() === "en", "clearing it returns to following the conversation language")

console.log("— and it is offered to the people it is for —")
setZone("America/New_York"); setLangs(["en-US"])
check(ui.inArabRegion() === false && ui.offerArabic() === false, "an American visitor is never shown a language picker they have no use for")
for (const z of ["Asia/Riyadh", "Asia/Dubai", "Africa/Cairo", "Africa/Casablanca", "Asia/Baghdad", "Asia/Beirut", "Africa/Khartoum"]) {
  setZone(z); setLangs(["en-US"])
  check(ui.offerArabic() === true, `${z} sees عربي even on a phone set to English`)
}
setZone("Europe/London"); setLangs(["ar-EG", "en-GB"])
check(ui.offerArabic() === true, "and so does an Arabic-speaking phone anywhere in the world")
setZone("Europe/London"); setLangs(["en-GB"]); ui.setUiLang("ar")
check(ui.offerArabic() === true, "once the app IS Arabic the way back out is just as visible")
ui.setUiLang(null)

console.log("— on the screen, in both scripts —")
{
  const t = readFileSync("components/airroom/LangToggle.tsx", "utf8")
  const planet = readFileSync("components/airroom/Planet.tsx", "utf8")
  const you = readFileSync("components/airroom/YouPage.tsx", "utf8")
  check(/btn\("ar", "عربي"\)/.test(t) && /btn\("en", "English"\)/.test(t), "each label is written in its own language")
  check(/if \(!show\) return null/.test(t) && /setShow\(offerArabic\(\)\)/.test(t), "and nothing renders where it is not offered")
  check(/window\.location\.reload\(\)/.test(t), "picking one reloads, so every mounted label changes at once")
  const gate = planet.slice(planet.indexOf("function OnboardGate"))
  check(/<LangToggle/.test(gate), "it is on the first screen a visitor sees")
  check(/title=\{tr\("App language"\)\}/.test(you) && /<LangToggle/.test(you), "and permanently on the page that is theirs")
}

console.log(fail ? `\n${fail} FAILED` : "\nPASS")
process.exit(fail ? 1 : 0)
