import type { MetadataRoute } from "next"
import { CATEGORY_ORDER } from "@/lib/category-meta"
import { PUBLIC_CAST_SIZE, slugFor } from "@/lib/airraw/public-cast"

const AIRRAW = process.env.AIRRAW_HOME === "1"
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || (AIRRAW ? "https://airraw.com" : "https://kloom.io")

export default function sitemap(): MetadataRoute.Sitemap {
  if (AIRRAW) {
    const core = ["", "/who", "/universe", "/airraw/privacy", "/airraw/terms"].map((p) => ({
      url: `${SITE_URL}${p}`,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1 : p === "/who" ? 0.9 : 0.6,
    }))
    // Every person on the public floor. This is the actual search surface of the
    // product: the four URLs above are a front door, and a front door does not
    // rank for anything a person would type. Bounded by PUBLIC_CAST_SIZE — a
    // sitemap is a promise to crawl, and an unbounded one is a promise nobody
    // keeps. See lib/airraw/public-cast.
    const people = Array.from({ length: PUBLIC_CAST_SIZE }, (_, i) => ({
      url: `${SITE_URL}/who/${slugFor(i)}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }))
    return [...core, ...people]
  }

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
