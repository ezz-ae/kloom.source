// THE IN-APP BROWSER IS WHERE THE ADS LAND, AND WHERE THE PRODUCT CANNOT SPEAK.
//
// Measured over two days of ad traffic: 101 of 117 visitors arrived inside the
// Facebook or Instagram in-app browser and averaged one pageview. The six who
// arrived in real Safari averaged seven. Same page, same ad, same phones — the
// difference is the browser. A Facebook or Instagram webview on iOS does not
// hand the page a microphone at all, and on Android it usually does not; a
// product whose first line is "tap a face and talk, out loud" then has nothing
// to offer, and they leave.
//
// Nothing here changes what the page does. It tells the visitor, once, that
// voice needs their real browser, and gives the one-tap way there where one
// exists (Android: an intent link opens Chrome). iOS has no link — the ⋯ menu
// has "Open in Safari" / "Open in browser", and the bar says so.
export type InApp = "facebook" | "instagram" | "tiktok" | "snapchat" | null

export function inAppBrowser(ua?: string): InApp {
  const u = ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "")
  if (!u) return null
  if (/Instagram/i.test(u)) return "instagram"
  // FBAN/FBAV: Facebook and Messenger on iOS. FB_IAB/FB4A: Facebook's Android webview.
  if (/FBAN|FBAV|FB_IAB|FB4A|FBIOS|MessengerForiOS/i.test(u)) return "facebook"
  if (/BytedanceWebview|TikTok|musical_ly/i.test(u)) return "tiktok"
  if (/Snapchat/i.test(u)) return "snapchat"
  return null
}

export function isAndroid(ua?: string): boolean {
  const u = ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "")
  return /Android/i.test(u)
}

/**
 * Where a tap can take the visitor OUT of the webview, or null where it cannot.
 *
 * Android webviews honour an intent: URL and hand it to the named package —
 * Chrome here, with the plain https URL as the fallback for a phone without it.
 * iOS offers nothing programmatic; the bar gives the menu instruction instead.
 */
export function openInBrowserUrl(href?: string, ua?: string): string | null {
  const u = ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "")
  if (!isAndroid(u)) return null
  const h = href ?? (typeof location !== "undefined" ? location.href : "")
  let url: URL
  try { url = new URL(h) } catch { return null }
  if (url.protocol !== "https:") return null
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`
}
