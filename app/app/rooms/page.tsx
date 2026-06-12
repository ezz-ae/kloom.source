"use client"

/**
 * Rooms — the community feed. Every room ever built (curated + community) in one
 * searchable, infinitely-scrollable grid. Clone any room into your own with one
 * tap. Built to scale to millions: the community half pages by a created_at
 * cursor, so deep scroll never slows down.
 */
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { VISIBLE_ROOMS, type Room, type RoomCategory } from "@/lib/rooms"
import { CATEGORY_META, CATEGORY_ORDER, isAdultRoom } from "@/lib/category-meta"
import { adultEnabled } from "@/lib/variant"
import { listCustomRooms, deleteCustomRoom, cloneRoom } from "@/lib/custom-rooms"
import { fetchCommunityFeed, bumpRoomClones, type FeedSort } from "@/lib/rooms-db"
import { imageFor } from "@/lib/persona-utils"
import { Plus, Search, Copy, ArrowRight, Trash2, Loader2, Check, Flame, Clock, TrendingUp } from "lucide-react"

type Filter = "all" | RoomCategory

const SORTS: { id: FeedSort; label: string; icon: typeof Flame }[] = [
  { id: "trending",    label: "Trending",    icon: Flame },
  { id: "newest",      label: "Newest",      icon: Clock },
  { id: "most_cloned", label: "Most cloned", icon: TrendingUp },
]

export default function RoomsPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [sort, setSort] = useState<FeedSort>("trending")
  const [mine, setMine] = useState<Room[]>([])

  const [feed, setFeed] = useState<Room[]>([])
  const [offset, setOffset] = useState<number | null>(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const seen = useRef<Set<string>>(new Set())

  useEffect(() => { setMine(listCustomRooms()) }, [])

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // Curated built-ins that match the current filter + search — always shown
  // first, deduped against the community feed.
  const curated = VISIBLE_ROOMS.filter((r) => {
    if (filter !== "all" && r.category !== filter) return false
    if (debounced && !`${r.name} ${r.tagline}`.toLowerCase().includes(debounced.toLowerCase())) return false
    return true
  })

  // (Re)load the first community page whenever filter, search or sort changes.
  const reload = useCallback(async () => {
    setLoading(true)
    seen.current = new Set(curated.map((r) => r.id))
    const { rooms, nextOffset } = await fetchCommunityFeed({ category: filter, search: debounced, sort, limit: 24, offset: 0 })
    const fresh = rooms.filter((r) => !seen.current.has(r.id) && (adultEnabled() || !isAdultRoom(r)))
    fresh.forEach((r) => seen.current.add(r.id))
    setFeed(fresh)
    setOffset(nextOffset)
    setHasMore(nextOffset !== null)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, debounced, sort])

  useEffect(() => { reload() }, [reload])

  // Infinite scroll — load the next community page when the sentinel appears.
  const sentinel = useRef<HTMLDivElement | null>(null)
  const loadingMore = useRef(false)
  useEffect(() => {
    if (!sentinel.current || !hasMore) return
    const el = sentinel.current
    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting || loadingMore.current || offset === null) return
      loadingMore.current = true
      const { rooms, nextOffset } = await fetchCommunityFeed({ category: filter, search: debounced, sort, limit: 24, offset })
      const fresh = rooms.filter((r) => !seen.current.has(r.id) && (adultEnabled() || !isAdultRoom(r)))
      fresh.forEach((r) => seen.current.add(r.id))
      setFeed((prev) => [...prev, ...fresh])
      setOffset(nextOffset)
      setHasMore(nextOffset !== null)
      loadingMore.current = false
    }, { rootMargin: "600px" })
    io.observe(el)
    return () => io.disconnect()
  }, [offset, hasMore, filter, debounced, sort])

  const all = [...curated, ...feed]

  return (
    <div className="min-h-full text-foreground">
      <div className="max-w-6xl mx-auto px-5 lg:px-8 pt-[calc(env(safe-area-inset-top)+1.75rem)] pb-28">

        {/* Header */}
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.02em]">Rooms</h1>
            <p className="text-muted-foreground text-sm mt-1">Every room the community has built. Enter one, or clone it and make it yours.</p>
          </div>
          <button onClick={() => router.push("/app/create")}
            className="shrink-0 flex items-center gap-1.5 bg-foreground text-background font-semibold text-sm px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
            <Plus size={15} /> Create
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rooms…"
            className="w-full bg-foreground/[0.03] border border-border/60 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-foreground/30 transition-colors" />
        </div>

        {/* Sort tabs */}
        <div className="flex gap-1 mb-3">
          {SORTS.map((s) => {
            const active = sort === s.id
            return (
              <button key={s.id} onClick={() => setSort(s.id)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${active ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <s.icon size={13} /> {s.label}
              </button>
            )
          })}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide mb-6">
          {(["all", ...CATEGORY_ORDER] as Filter[]).map((c) => {
            const active = filter === c
            const label = c === "all" ? "All" : CATEGORY_META[c].label
            return (
              <button key={c} onClick={() => setFilter(c)}
                className={`shrink-0 text-sm font-medium px-3.5 py-1.5 rounded-full border whitespace-nowrap transition-all ${active ? "bg-foreground text-background border-transparent" : "border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30"}`}>
                {c !== "all" && <span className="mr-1">{CATEGORY_META[c].emoji}</span>}{label}
              </button>
            )
          })}
        </div>

        {/* Your rooms */}
        {mine.length > 0 && filter === "all" && !debounced && (
          <div className="mb-7">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">Your rooms</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
              {mine.map((r) => (
                <div key={r.id} className="snap-start shrink-0 w-56">
                  <RoomCard room={r} onEnter={() => router.push(`/app/rooms/${r.id}`)} owned
                    onDelete={() => { deleteCustomRoom(r.id); setMine(listCustomRooms()) }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* The feed */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl border border-border/40 bg-foreground/[0.02] animate-pulse" />
            ))}
          </div>
        ) : all.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No rooms match that yet.</p>
            <button onClick={() => router.push("/app/create")} className="mt-3 text-sm font-semibold text-foreground hover:opacity-80">Build the first one →</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {all.map((r) => (
                <RoomCard key={r.id} room={r}
                  onEnter={() => router.push(`/app/rooms/${r.id}`)}
                  onClone={() => { bumpRoomClones(r.id); const id = cloneRoom(r); router.push(`/app/rooms/${id}`) }} />
              ))}
            </div>
            {hasMore && (
              <div ref={sentinel} className="h-10 flex items-center justify-center mt-4">
                <Loader2 size={18} className="animate-spin text-muted-foreground/50" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RoomCard({ room, onEnter, onClone, onDelete, owned }: {
  room: Room
  onEnter: () => void
  onClone?: () => void
  onDelete?: () => void
  owned?: boolean
}) {
  const meta = CATEGORY_META[room.category]
  const [cloned, setCloned] = useState(false)

  return (
    <div className="group rounded-2xl border border-border/60 bg-foreground/[0.02] hover:border-foreground/25 hover:bg-foreground/[0.04] transition-all p-4 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${meta?.text ?? "text-muted-foreground"}`}>
          {meta?.emoji} {meta?.label ?? room.category}
        </span>
        {owned && onDelete && (
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-400 transition-all"><Trash2 size={13} /></button>
        )}
      </div>

      <button onClick={onEnter} className="text-left flex-1">
        <h3 className="font-semibold tracking-tight leading-snug line-clamp-1">{room.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{room.tagline}</p>
      </button>

      {/* Cast */}
      <div className="flex items-center gap-2 mt-3">
        <div className="flex -space-x-1.5">
          {room.personas.slice(0, 4).map((p) => {
            const img = imageFor({ name: p.name })
            return (
              <div key={`${p.name}-${p.role}`} title={p.name} className="w-6 h-6 rounded-full border-2 border-background bg-foreground/10 overflow-hidden flex items-center justify-center">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={p.name} className="w-full h-full object-cover" />
                ) : <span className="text-[9px] font-semibold">{p.name[0]}</span>}
              </div>
            )
          })}
        </div>
        <span className="text-[10px] text-muted-foreground truncate">
          {room.personas.map((p) => p.name.split(" ")[0]).slice(0, 3).join(", ")}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3.5">
        <button onClick={onEnter}
          className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-2 rounded-lg bg-foreground/[0.06] hover:bg-foreground/10 transition-colors">
          Enter <ArrowRight size={12} />
        </button>
        {onClone && (
          <button onClick={() => { setCloned(true); onClone() }}
            title="Clone into your rooms"
            className="flex items-center justify-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">
            {cloned ? <Check size={12} /> : <Copy size={12} />} Clone
          </button>
        )}
      </div>
    </div>
  )
}
