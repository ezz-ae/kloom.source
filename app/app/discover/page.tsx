"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { PERSONALITY_PRESETS, CATEGORY_INFO, type PresetCategory } from "@/components/persona-editor"
import { imageFor } from "@/lib/persona-utils"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { Mic, MessageSquare, Search, Sparkles, Flame, Star } from "lucide-react"

const CATEGORY_COLORS: Record<PresetCategory, string> = {
  friends:      "bg-sky-500/15 text-sky-300 border-sky-500/20",
  romantic:     "bg-rose-500/15 text-rose-300 border-rose-500/20",
  family:       "bg-amber-500/15 text-amber-300 border-amber-500/20",
  professional: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  roleplay:     "bg-orange-500/15 text-orange-300 border-orange-500/20",
  dark:         "bg-stone-700/40 text-stone-300 border-stone-600/30",
  trading:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
}

// Featured personas shown at the top
const FEATURED_NAMES = ["Aria (Girlfriend)", "Victoria (Secretary)", "Luna (Life Coach)", "Nova (Coach)"]

function PersonaCard({
  persona,
  featured = false,
}: {
  persona: typeof PERSONALITY_PRESETS[0]
  featured?: boolean
}) {
  const router = useRouter()
  const img    = imageFor(persona)
  const catInfo = CATEGORY_INFO[persona.category]

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden border transition-all hover:scale-[1.015] ${
        featured
          ? "border-border bg-foreground/5 hover:border-white/25"
          : "border-white/8 bg-white/[0.02] hover:border-border hover:bg-white/[0.04]"
      }`}
    >
      {/* Portrait */}
      <div className={`relative overflow-hidden ${featured ? "h-52" : "h-40"}`}>
        <img
          src={img}
          alt={persona.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            const t = e.target as HTMLImageElement
            t.style.display = "none"
            t.nextElementSibling?.classList.remove("hidden")
          }}
        />
        {/* Emoji fallback */}
        <div className="hidden absolute inset-0 bg-gradient-to-br from-amber-800 to-orange-900 flex items-center justify-center text-5xl">
          {persona.emoji}
        </div>
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/20 to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border backdrop-blur-sm ${CATEGORY_COLORS[persona.category]}`}>
            {catInfo.label}
          </span>
          {featured && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 backdrop-blur-sm flex items-center gap-1">
              <Star size={9} /> Featured
            </span>
          )}
        </div>

        {/* Online indicator */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 backdrop-blur-sm border border-border/50 px-2 py-0.5 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-foreground/80">Online</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-bold text-sm leading-tight mb-1">{persona.name}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-4">
          {persona.personality?.slice(0, 90)}…
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/app/chat?persona=${encodeURIComponent(persona.name)}`)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-foreground/5 border border-border/50 hover:bg-foreground/10 text-xs font-semibold text-foreground/70 hover:text-foreground transition-all"
          >
            <MessageSquare size={12} /> Chat
          </button>
          <button
            onClick={() => router.push(`/app/voice?persona=${encodeURIComponent(persona.name)}`)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 hover:bg-amber-500/25 text-xs font-semibold text-amber-300 hover:text-amber-200 transition-all"
          >
            <Mic size={12} /> Voice
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DiscoverPage() {
  const [search, setSearch]           = useState("")
  const [activeCategory, setCategory] = useState<PresetCategory | "all">("all")

  const featured  = PERSONALITY_PRESETS.filter((p) => FEATURED_NAMES.includes(p.name))
  const categories: Array<PresetCategory | "all"> = ["all", "friends", "romantic", "family", "professional", "roleplay", "dark", "trading", "workshop", "co-intelligence", "zero-memory"]

  const filtered = useMemo(() => {
    return PERSONALITY_PRESETS.filter((p) => {
      const matchCat    = activeCategory === "all" || p.category === activeCategory
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.personality?.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
  }, [search, activeCategory])

  const showFeatured = !search && activeCategory === "all"

  return (
    <div className="min-h-full bg-background text-foreground">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-white/5 px-6 lg:px-8 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Discover</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{PERSONALITY_PRESETS.length} companions · all online</p>
            </div>
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-foreground/5 border border-border/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder-white/30 focus:outline-none focus:border-amber-500/50 transition-all"
              />
            </div>
          </div>

          {/* Category filters */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {categories.map((cat) => {
              const info = cat === "all" ? null : CATEGORY_INFO[cat]
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    activeCategory === cat
                      ? "bg-white text-stone-950 border-transparent"
                      : "bg-foreground/5 border-border/50 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                  }`}
                >
                  {info && <info.icon size={11} />}
                  {cat === "all" ? "All" : info!.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-6 space-y-8">

        {/* ── Featured ── */}
        {showFeatured && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Flame size={15} className="text-amber-400" />
              <h2 className="text-sm font-bold text-foreground/80 uppercase tracking-widest">Featured</h2>
            </div>
            <Carousel opts={{ align: "start", dragFree: true }} className="w-full relative">
              <CarouselContent className="-ml-4">
                {featured.map((p) => (
                  <CarouselItem key={p.name} className="pl-4 md:basis-1/2 lg:basis-1/4">
                    <PersonaCard persona={p} featured />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {/* Optional: Navigation buttons if there are many items */}
              <div className="hidden lg:block">
                <CarouselPrevious className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 bg-stone-900 border-border/50 hover:bg-stone-800" />
                <CarouselNext className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 bg-stone-900 border-border/50 hover:bg-stone-800" />
              </div>
            </Carousel>
          </section>
        )}

        {/* ── All companions ── */}
        <section>
          {showFeatured && (
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={15} className="text-amber-400" />
              <h2 className="text-sm font-bold text-foreground/80 uppercase tracking-widest">All companions</h2>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground/60">
              <Search size={30} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No companions match "{search}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((p) => <PersonaCard key={p.name} persona={p} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
