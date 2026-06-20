import Script from "next/script"

/**
 * Ad pixels — rendered only when their id env is set, so this is a no-op on the
 * Kloom build and live only on the AIRRAW deploy. Set the relevant ones in the
 * airraw Vercel project: NEXT_PUBLIC_FB_PIXEL_ID / NEXT_PUBLIC_TIKTOK_PIXEL_ID /
 * NEXT_PUBLIC_GA_ID. The funnel events themselves are fired from lib/airraw/track.
 */
export function PixelScripts() {
  const fb = process.env.NEXT_PUBLIC_FB_PIXEL_ID
  const tt = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID
  const ga = process.env.NEXT_PUBLIC_GA_ID
  if (!fb && !tt && !ga) return null

  return (
    <>
      {fb && (
        <Script id="fb-pixel" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html:
          `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${fb}');fbq('track','PageView');`
        }} />
      )}
      {tt && (
        <Script id="tt-pixel" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html:
          `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tt}');ttq.page()}(window,document,'ttq');`
        }} />
      )}
      {ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html:
            `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}');`
          }} />
        </>
      )}
    </>
  )
}
