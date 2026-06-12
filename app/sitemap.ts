import type { MetadataRoute } from "next"
import { CATEGORY_ORDER } from "@/lib/category-meta"

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kloom.io"

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    "", "/app", "/app/rooms", "/app/create",
    "/legal/terms", "/legal/privacy", "/legal/cookies", "/legal/payments",
  ].map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.7,
  }))

  // One indexable page per world — the SEO surface for "<world> AI rooms".
  const worldPages = CATEGORY_ORDER.map((c) => ({
    url: `${SITE_URL}/app/rooms/c/${c}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }))

  return [...staticPages, ...worldPages]
}
