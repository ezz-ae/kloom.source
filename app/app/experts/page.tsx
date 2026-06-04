"use client"

import { useState, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { EXPERTS, EXPERT_GROUP_LABELS, EXPERT_GROUP_COLORS, expertTitle, type ExpertGroup } from "@/lib/experts"
import { Search, MessageSquare, Mic, Sparkles } from "lucide-react"

const ALL_GROUPS: Array<"all" | ExpertGroup> =
  ["all", "guidance", "creative", "wellness", "mind", "business", "future", "intimacy"]

// Per-group visual identity so the grid doesn't read as identical e-commerce
// cards. Each group gets its own hue for the card wash, emoji tile, and hover glow.
const GROUP_STYLE: Record<ExpertGroup, { wash: string; tile: string; glow: string; ring: string }> = {
  guidance: { wash: "from-emerald-500/10",  tile: "from-emerald-500/30 to-emerald-800/10",  glow: "hover:border-emerald-500/40",  ring: "text-emerald-300" },
  creative: { wash: "from-orange-500/10",   tile: "from-orange-500/30 to-orange-800/10",    glow: "hover:border-orange-500/40",   ring: "text-orange-300" },
  wellness: { wash: "from-amber-500/10",    tile: "from-amber-500/30 to-amber-800/10",      glow: "hover:border-amber-500/40",    ring: "text-amber-300" },
  mind:     { wash: "from-cyan-500/10",     tile: "from-cyan-500/30 to-cyan-800/10",        glow: "hover:border-cyan-500/40",     ring: "text-cyan-300" },
  business: { wash: "from-blue-500/10",     tile: "from-blue-500/30 to-blue-800/10",        glow: "hover:border-blue-500/40",     ring: "text-blue-300" },
  future:   { wash: "from-indigo-500/10",   tile: "from-indigo-500/30 to-indigo-800/10",    glow: "hover:border-indigo-500/40",   ring: "text-indigo-300" },
  intimacy: { wash: "from-rose-500/10",     tile: "from-rose-500/30 to-rose-800/10",        glow: "hover:border-rose-500/40",     ring: "text-rose-300" },
}

function ExpertsContent() {
  const router = useRouter()
  const params = useSearchParams()
  const initialGroup = (params.get("cat") as ExpertGroup | null) ?? "all"
  const [search, setSearch] = useState("")
  const [group, setGroup] = useState<"all" | ExpertGroup>(
    ALL_GROUPS.includes(initialGroup as any) ? (initialGroup as any) : "all"
  )

  const filtered = useMemo(() => EXPERTS.filter((expert) => {
    const matchGroup = group === "all" || expert.group === group
    const matchSearch = !search ||
      expert.name.toLowerCase().includes(search.toLowerCase()) ||
      expert.domain.toLowerCase().includes(search.toLowerCase()) ||
      expert.tagline.toLowerCase().includes(search.toLowerCase())
    return matchGroup && matchSearch
  }), [search, group])

  return (
    <div className="min-h-full bg-background text-foreground transition-colors duration-300">
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-border px-6 lg:px-8 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-amber-400/80 font-semibold">Expert marketplace</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight">Experts</h1>
              <p className="mt-1 text-sm text-muted-foreground">{EXPERTS.length} specialists · voice + chat · real expertise, no fluff.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-full max-w-sm">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search experts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-3xl border border-border bg-muted/40 py-3 pl-12 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {ALL_GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={`rounded-full px-4 py-2 text-xs font-semibold border transition-all ${
                  group === g
                    ? "bg-foreground text-background border-transparent"
                    : "bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {g === "all" ? "All" : EXPERT_GROUP_LABELS[g]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-6 pb-24 lg:pb-6">
        {filtered.length === 0 ? (
          <div className="rounded-[2rem] border border-border bg-card p-16 text-center text-muted-foreground">
            <Sparkles size={32} className="mx-auto mb-4 text-amber-400" />
            <p className="text-base">No experts match <span className="font-semibold text-foreground">"{search}"</span></p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 auto-rows-max">
            {filtered.map((expert, index) => {
              const s = GROUP_STYLE[expert.group]
              // Featured: every 6th card (when the set is large enough) gets a
              // wide, prominent treatment so the grid has rhythm, not uniformity.
              const featured = index % 6 === 0 && filtered.length > 6
              return (
              <article
                key={expert.id}
                onClick={() => router.push(`/app/experts/${expert.id}`)}
                className={`group cursor-pointer overflow-hidden rounded-[2rem] border border-border/50 bg-gradient-to-br ${s.wash} to-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 ${s.glow} ${featured ? "sm:col-span-2" : ""}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex items-center justify-center rounded-3xl bg-gradient-to-br ${s.tile} border border-border/50 ${featured ? "h-20 w-20 text-5xl" : "h-14 w-14 text-3xl"}`}>
                    {expert.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className={`font-bold leading-tight line-clamp-2 ${featured ? "text-2xl" : "text-lg"}`}>{expertTitle(expert)}</h2>
                    <p className="mt-2 text-xs uppercase tracking-[0.32em] text-muted-foreground">{expert.name}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${EXPERT_GROUP_COLORS[expert.group]}`}>
                    {EXPERT_GROUP_LABELS[expert.group]}
                  </span>
                  {expert.adult && (
                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold text-rose-300">
                      18+
                    </span>
                  )}
                </div>

                <p className={`mt-4 leading-6 text-muted-foreground ${featured ? "text-base line-clamp-2" : "text-sm line-clamp-3"}`}>{expert.tagline}</p>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      router.push(`/app/experts/${expert.id}?mode=chat`)
                    }}
                    className="flex-1 rounded-2xl border border-border/50 bg-foreground/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground"
                  >
                    <span className="inline-flex items-center gap-2">
                      <MessageSquare size={14} /> Chat
                    </span>
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      router.push(`/app/experts/${expert.id}?mode=voice`)
                    }}
                    className="flex-1 rounded-2xl bg-amber-500 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-950 transition hover:bg-amber-400"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Mic size={14} /> Voice
                    </span>
                  </button>
                </div>
              </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ExpertsPage() {
  return <Suspense fallback={<div className="min-h-full bg-background" />}><ExpertsContent /></Suspense>
}
