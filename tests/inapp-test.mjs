// THE IN-APP BROWSER IS TOLD THE WAY OUT.
//
// 101 of 117 ad visitors arrived inside the Facebook or Instagram in-app
// browser and averaged one pageview; the six in real Safari averaged seven.
// A webview mostly cannot open a mic, and a voice product without one reads as
// broken. The rule: an in-app visitor is told, once, that voice needs their
// real browser — with a working link where one exists (Android) and the menu
// instruction where none does (iOS) — and the mic's own failure hint says the
// same instead of "not supported on this browser".
import { readFileSync } from "node:fs"
import { inAppBrowser, openInBrowserUrl } from "../lib/airraw/in-app.ts"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

const FB_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0;FBBV/1;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]"
const FB_ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.0;]"
const IG_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0 (iPhone15,3; iOS 17_5; en_US; scale=3.00)"
const IG_ANDROID = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36 Instagram 330.0.0.0 Android"
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
const CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36"

console.log("— the webview is recognised, the real browser is not —")
check(inAppBrowser(FB_IOS) === "facebook", "Facebook on iOS")
check(inAppBrowser(FB_ANDROID) === "facebook", "Facebook on Android")
check(inAppBrowser(IG_IOS) === "instagram", "Instagram on iOS")
check(inAppBrowser(IG_ANDROID) === "instagram", "Instagram on Android")
check(inAppBrowser(SAFARI) === null, "Mobile Safari is not in-app")
check(inAppBrowser(CHROME) === null, "Chrome on Android is not in-app")
check(inAppBrowser("") === null, "and no UA at all is not in-app (SSR)")

console.log("— the way out —")
{
  const u = openInBrowserUrl("https://airraw.com/?x=1", IG_ANDROID)
  check(typeof u === "string" && u.startsWith("intent://airraw.com/?x=1#Intent;scheme=https;package=com.android.chrome;"), "Android gets an intent link that opens Chrome on the same page")
  check(typeof u === "string" && u.includes("S.browser_fallback_url=https%3A%2F%2Fairraw.com%2F%3Fx%3D1"), "with the plain URL as the fallback for a phone without Chrome")
  check(openInBrowserUrl("https://airraw.com/", IG_IOS) === null, "iOS gets no link — there is none — so the bar gives the menu instruction")
  check(openInBrowserUrl("http://airraw.com/", IG_ANDROID) === null, "never for a non-https page")
}

console.log("— the front door says it, once, and the mic hint says it too —")
{
  const planet = readFileSync("components/airroom/Planet.tsx", "utf8")
  const page = readFileSync("app/airraw/page.tsx", "utf8")
  const bar = readFileSync("components/airroom/OpenInBrowser.tsx", "utf8")
  const bubble = readFileSync("components/airroom/AirBubble.tsx", "utf8")
  const ar = readFileSync("lib/airraw/ar.ts", "utf8")
  // The FRONT DOOR renders it — which is the planet: "/" rewrites to /airraw
  // and /airraw renders <Planet />. The first version put it on the lobby, a
  // component no page imports, and a headless Instagram visit to production
  // showed nothing.
  check(/return <Planet \/>/.test(page), "the AIRRAW front page is the planet")
  // In the FLOW of the onboarding gate — the screen every new visitor sees
  // first — not fixed over the product: a fixed top bar sat over the planet's
  // header and over a call's back button, so "leave" tapped the bar.
  const gate = planet.slice(planet.indexOf("function OnboardGate"))
  check(/<OpenInBrowser inline \/>/.test(gate), "the onboarding gate renders the notice inline, above the name box")
  check(!/<OpenInBrowser \/>/.test(planet), "and nothing renders it as a fixed bar over the planet")
  check(/inline\s*\?\s*\{ position: "relative"/.test(bar), "inline is a block in the flow")
  check(/if \(!a\) return/.test(bar) && /inAppBrowser\(\)/.test(bar), "which renders nothing on a real browser")
  check(/localStorage\.getItem\(KEY\) === "1"/.test(bar) && /localStorage\.setItem\(KEY, "1"\)/.test(bar), "and stays dismissed")
  check(/track\("inapp_shown"/.test(bar) && /track\("inapp_open_tap"/.test(bar), "and is measured — shown, and tapped")
  check(/open in browser” — or tap the keypad to type/.test(bubble) && /inAppBrowser\(\) \?/.test(bubble), "the mic's own failure names the way out inside a webview")
  for (const k of ["voice needs your real browser.", "open in Chrome", "dismiss"]) check(ar.includes(`"${k}":`), `Arabic: ${k}`)
  check(ar.includes("open in browser” — or tap the keypad to type\":"), "Arabic: the mic hint")
}

console.log("— Kloom is not in this —")
{
  const kloomUsers = ["components/widgets", "app/app"].map((d) => { try { return readFileSync(d + "/page.tsx", "utf8") } catch { return "" } })
  check(!kloomUsers.some((s) => /OpenInBrowser|in-app/.test(s)), "no Kloom surface imports the bar or the detector")
}

console.log(fail ? `\n${fail} FAILED` : "\nPASS")
process.exit(fail ? 1 : 0)
