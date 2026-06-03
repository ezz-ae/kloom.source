"use client"

import { useState, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { EXPERTS, EXPERT_GROUP_LABELS, EXPERT_GROUP_COLORS, expertTitle, type ExpertGroup } from "@/lib/experts"
import { Search, MessageSquare, Mic, Sparkles } from "lucide-react"

const ALL_GROUPS: Array<"all" | ExpertGroup> =
  ["all", "guidance", "creative", "wellness", "mind", "business", "future", "intimacy"]

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
    <div className="min-h-full bg-slate-950 text-slate-100">
      <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/70 px-6 lg:px-8 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/80 font-semibold">Expert marketplace</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white">Experts</h1>
              <p className="mt-2 text-sm text-slate-400">{EXPERTS.length} specialists · voice + chat · real expertise, no fluff.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-full max-w-sm">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search experts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-3xl border border-slate-800/80 bg-slate-900/80 py-3 pl-12 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {ALL_GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  group === g
                    ? "bg-white text-slate-950 shadow-lg shadow-slate-950/10"
                    : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {g === "all" ? "All" : EXPERT_GROUP_LABELS[g]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-6">
        {filtered.length === 0 ? (
          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-16 text-center text-slate-400">
            <Sparkles size={32} className="mx-auto mb-4 text-cyan-300" />
            <p className="text-base">No experts match <span className="font-semibold text-white">"{search}"</span></p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((expert) => (
              <article
                key={expert.id}
                onClick={() => router.push(`/app/experts/${expert.id}`)}
                className="group cursor-pointer overflow-hidden rounded-[2rem] border border-slate-800/90 bg-gradient-to-br from-slate-900/90 via-slate-950/80 to-slate-950/95 p-6 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.9)] transition duration-300 hover:-translate-y-0.5 hover:border-cyan-500/20 hover:bg-slate-900/95"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500/15 to-slate-900 border border-slate-800 text-3xl shadow-sm shadow-cyan-500/10">
                    {expert.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-white leading-tight line-clamp-2">{expertTitle(expert)}</h2>
                    <p className="mt-2 text-xs uppercase tracking-[0.32em] text-slate-500">{expert.name}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${EXPERT_GROUP_COLORS[expert.group]}`}>
                    {EXPERT_GROUP_LABELS[expert.group]}
                  </span>
                  {expert.adult && (
                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold text-rose-200">
                      18+
                    </span>
                  )}
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-300 line-clamp-3">{expert.tagline}</p>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      router.push(`/app/experts/${expert.id}?mode=chat`)
                    }}
                    className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-cyan-500/30 hover:bg-slate-800"
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
                    className="flex-1 rounded-2xl bg-cyan-500 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-cyan-400"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Mic size={14} /> Voice
                    </span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ExpertsPage() {
  return <Suspense fallback={<div className="min-h-full bg-slate-950" />}><ExpertsContent /></Suspense>
}
