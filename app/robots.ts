import type { MetadataRoute } from "next"

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.kloom.io"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Index the marketing + legal surface and the world (category) landing
        // pages; keep the API and individual (infinite, user-built) room URLs out.
        allow: ["/", "/app/rooms/c/"],
        disallow: ["/api/", "/app/rooms/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
