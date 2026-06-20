import type { MetadataRoute } from "next"

const AIRRAW = process.env.AIRRAW_HOME === "1"
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || (AIRRAW ? "https://airraw.com" : "https://www.kloom.io")

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // On the AIRRAW host, index the landing + universe + legal; keep API and
        // the (legacy Kloom) app surface out. Otherwise the Kloom rules.
        allow: AIRRAW ? ["/", "/universe", "/airraw"] : ["/", "/app/rooms/c/"],
        disallow: AIRRAW ? ["/api/", "/app/"] : ["/api/", "/app/rooms/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
