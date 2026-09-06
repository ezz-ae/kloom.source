import { ImageResponse } from "next/og"
import { BRAND } from "@/lib/brand"
import { PUBLIC_CAST_SIZE, publicProfile, accentFor } from "@/lib/airraw/public-cast"

// THE SHARE CARD — what a link to one of the /who pages looks like on X.
//
// ── WHY THIS IS A ROUTE AND NOT app/who/[slug]/opengraph-image.tsx ───────────
//
// That is where this belongs, and it does not work. A file-based image route
// nested under a dynamic segment failed on every render with Satori's "expected
// <div> to have explicit display: flex" — for a card whose every node declared
// it, and for a hardcoded one-div card with a literal string in it. The same
// tree renders fine from app/opengraph-image.tsx at the root, under both the
// edge and nodejs runtimes and with or without the page's force-static. The
// failure is the nested position, not the markup, and it happens at REQUEST time
// so the build stays green while every scraper gets a stack trace.
//
// A plain route handler at the top level renders the identical tree. It also has
// to sit outside /api, because robots.txt disallows that prefix and a card no
// crawler may fetch is not a card.
//
// Costs nothing to draw: no portrait API, no per-render spend. See public-cast.
// NODEJS, not edge. The edge runtime does not carry non-public env vars, so
// AIRRAW_HOME read as undefined there and this route 404'd on the AIRRAW host
// itself — the brand gate silently turned into a permanent block.
export const runtime = "nodejs"

const IS_AIRRAW = process.env.AIRRAW_HOME === "1"

export function GET(req: Request) {
  // Kloom is the SFW brand the ad credit points at, and this route is not under
  // the /who layout that guards the rest, so it carries its own gate.
  if (!IS_AIRRAW) return new Response("Not found", { status: 404 })

  const raw = new URL(req.url).searchParams.get("i")
  const n = Number(raw)
  const i = Number.isInteger(n) && n >= 0 && n < PUBLIC_CAST_SIZE ? n : 0
  const p = publicProfile(i)
  const accent = accentFor(p.c)
  // One line of her own voice. Trimmed so the card never overflows into a wall.
  const hook = p.says.onMind.length > 118 ? p.says.onMind.slice(0, 115).trimEnd() + "…" : p.says.onMind

  // Every text node is ONE interpolated string: `{a} · {b}` is three children in
  // JSX, and Satori rejects any element with more than one child unless it
  // declares a display.
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0d0418", padding: 72, fontFamily: "sans-serif", position: "relative" }}>
        <div style={{ display: "flex", position: "absolute", top: -240, left: -140, width: 780, height: 780, borderRadius: "50%", background: accent, opacity: .22 }} />
        <div style={{ display: "flex", alignItems: "center", zIndex: 1 }}>
          <div style={{ display: "flex", width: 26, height: 26, borderRadius: "50%", background: accent, marginRight: 18 }} />
          <div style={{ display: "flex", fontSize: 26, color: "rgba(240,232,255,.65)", letterSpacing: 3, fontWeight: 700 }}>{BRAND.toUpperCase()}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", zIndex: 1 }}>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 800, color: "#f0e8ff", letterSpacing: -3, lineHeight: 1 }}>{p.name}</div>
          <div style={{ display: "flex", fontSize: 34, color: accent, marginTop: 18, fontWeight: 600 }}>{`${p.work} · ${p.where}`}</div>
          <div style={{ display: "flex", fontSize: 31, color: "rgba(240,232,255,.72)", marginTop: 26, lineHeight: 1.35, maxWidth: 940 }}>{`“${hook}”`}</div>
        </div>
        <div style={{ display: "flex", fontSize: 25, color: "rgba(240,232,255,.5)", zIndex: 1 }}>{`talk to ${p.name.toLowerCase()} out loud · 18+`}</div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
