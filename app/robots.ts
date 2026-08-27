import { SITE_URL as BRAND_SITE } from "@/lib/brand"
import type { MetadataRoute } from "next"

const AIRRAW = process.env.AIRRAW_HOME === "1"
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || (AIRRAW ? BRAND_SITE : "https://kloom.io")

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // On the AIRRAW host, index the landing + universe + legal; keep API and
        // the (legacy Kloom) app surface out. Otherwise the Kloom rules.
        allow: AIRRAW ? ["/", "/universe", "/airraw"] : ["/", "/app/rooms/c/"],
        // /floor is the live 18+ chat surface — keep it (and the API/app) out of the index.
        disallow: AIRRAW ? ["/api/", "/app/", "/floor"] : ["/api/", "/app/rooms/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
