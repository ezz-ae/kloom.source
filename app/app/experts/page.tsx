"use client"

import { useState, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { EXPERTS, EXPERT_GROUP_LABELS, EXPERT_GROUP_COLORS, expertTitle, type ExpertGroup } from "@/lib/experts"
import { Search, MessageSquare, Mic, Sparkles } from "lucide-react"

// Every real group, in order. (Was previously missing future/intimacy and had a
// bogus "mystic" tab that matched nothing.)
const ALL_GROUPS: Array<"all" | ExpertGroup> =
  ["all", "guidance", "creative", "wellness", "mind", "business", "future", "intimacy"]

function ExpertsContent() {
  const router = useRouter()
  const params = useSearchParams()
  const initialGroup = (params.get("cat") as ExpertGroup | null) ?? "all"
  const [search, setSearch] = useState("")
  const [group, setGroup]   = useState<"all" | ExpertGroup>(
    ALL_GROUPS.includes(initialGroup as any) ? (initialGroup as any) : "all"
  )

  const filtered = useMemo(() => EXPERTS.filter((e) => {
    const matchG = group === "all" || e.group === group
    const matchS = !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.domain.toLowerCase().includes(search.toLowerCase()) ||
      e.tagline.toLowerCase().includes(search.toLowerCase())
    return matchG && matchS
  }), [search, group])

  return (
    <div className="min-h-full bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border/30 px-6 lg:px-8 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Experts</h1>
              <p className="text-sm text-foreground/40 mt-0.5">{EXPERTS.length} specialists · voice + chat · real expertise</p>
            </div>
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30" />
              <input
                type="text" placeholder="Search experts…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-foreground/5 border border-border/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder-white/30 focus:outline-none focus:border-amber-500/50 transition-all"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {ALL_GROUPS.map((g) => (
              <button key={g} onClick={() => setGroup(g)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  group === g ? "bg-white text-stone-950 border-transparent" : "bg-foreground/5 border-border/50 text-foreground/50 hover:bg-white/10 hover:text-foreground"
                }`}>
                {g === "all" ? "All" : EXPERT_GROUP_LABELS[g]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-foreground/30">
            <Sparkles size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No experts match "{search}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((e) => (
              <div key={e.id}
                onClick={() => router.push(`/app/experts/${e.id}`)}
                className="group rounded-2xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 transition-all p-5 cursor-pointer flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-border/50 flex items-center justify-center text-2xl shrink-0">
                    {e.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Title-first: lead with the ROLE, name is secondary */}
                    <h3 className="font-bold text-[15px] leading-snug capitalize line-clamp-2">{expertTitle(e)}</h3>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className="text-[11px] text-foreground/45">{e.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${EXPERT_GROUP_COLORS[e.group]}`}>
                        {EXPERT_GROUP_LABELS[e.group]}
                      </span>
                      {e.adult && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-rose-500/40 text-rose-300 bg-rose-500/10">18+</span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-foreground/45 italic leading-relaxed line-clamp-2">{e.tagline}</p>
                <div className="flex gap-2 mt-auto">
                  <button onClick={(ev) => { ev.stopPropagation(); router.push(`/app/experts/${e.id}?mode=chat`) }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-foreground/5 border border-border/50 hover:bg-white/10 text-xs font-semibold text-foreground/65 hover:text-foreground transition-all">
                    <MessageSquare size={12} /> Chat
                  </button>
                  <button onClick={(ev) => { ev.stopPropagation(); router.push(`/app/experts/${e.id}?mode=voice`) }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 hover:bg-amber-500/25 text-xs font-semibold text-amber-300 transition-all">
                    <Mic size={12} /> Voice
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ExpertsPage() {
  return <Suspense fallback={<div className="min-h-full bg-background" />}><ExpertsContent /></Suspense>
}
