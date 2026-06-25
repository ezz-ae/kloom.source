"use client"

/**
 * Rooms — the community feed. Every room ever built (curated + community) in one
 * searchable, infinitely-scrollable grid. Clone any room into your own with one
 * tap. Built to scale to millions: the community half pages by a created_at
 * cursor, so deep scroll never slows down.
 */
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ROOMS, type Room, type RoomCategory } from "@/lib/rooms"
import { CATEGORY_META, CATEGORY_ORDER, isAdultRoom } from "@/lib/category-meta"
import { adultEnabled, isIo, funLive } from "@/lib/variant"
import { getShowAdult, hasUnrestricted } from "@/lib/account"
import { funHandoffUrl } from "@/lib/sso"
import { listCustomRooms, deleteCustomRoom, cloneRoom } from "@/lib/custom-rooms"
import { fetchCommunityFeed, bumpRoomClones, type FeedSort } from "@/lib/rooms-db"
import { getTopics } from "@/lib/topics"
import { RoomFace } from "@/components/RoomFace"
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
  // Adult rooms surface only when the variant allows it, OR a subscribed user has
  // explicitly opted in on the You page (getShowAdult + hasUnrestricted). Default false
  // (SSR-safe) so the logged-out / ad-landing feed is always clean.
  const [allowAdult, setAllowAdult] = useState(false)

  const [feed, setFeed] = useState<Room[]>([])
  const [offset, setOffset] = useState<number | null>(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const seen = useRef<Set<string>>(new Set())

  useEffect(() => {
    setMine(listCustomRooms())
    setAllowAdult(adultEnabled() || (getShowAdult() && hasUnrestricted()))
  }, [])

  // Seed the search from ?q= (the sitelinks search box / shared search links).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q")
    if (q) setQuery(q)
  }, [])

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // Curated built-ins that match the current filter + search — always shown
  // first, deduped against the community feed.
  const curated = ROOMS.filter((r) => {
    if (!allowAdult && isAdultRoom(r)) return false
    if (filter !== "all" && r.category !== filter) return false
    if (debounced && !`${r.name} ${r.tagline}`.toLowerCase().includes(debounced.toLowerCase())) return false
    return true
  })

  // (Re)load the first community page whenever filter, search or sort changes.
  const reload = useCallback(async () => {
    setLoading(true)
    seen.current = new Set(curated.map((r) => r.id))
    const { rooms, nextOffset } = await fetchCommunityFeed({ category: filter, search: debounced, sort, limit: 24, offset: 0 })
    const fresh = rooms.filter((r) => !seen.current.has(r.id) && (allowAdult || !isAdultRoom(r)))
    fresh.forEach((r) => seen.current.add(r.id))
    setFeed(fresh)
    setOffset(nextOffset)
    setHasMore(nextOffset !== null)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, debounced, sort, allowAdult])

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
      const fresh = rooms.filter((r) => !seen.current.has(r.id) && (allowAdult || !isAdultRoom(r)))
      fresh.forEach((r) => seen.current.add(r.id))
      setFeed((prev) => [...prev, ...fresh])
      setOffset(nextOffset)
      setHasMore(nextOffset !== null)
      loadingMore.current = false
    }, { rootMargin: "600px" })
    io.observe(el)
    return () => io.disconnect()
  }, [offset, hasMore, filter, debounced, sort, allowAdult])

  const all = [...curated, ...feed]
  // Top rooms — the standouts, pulled to a featured rail above the full grid. Ranked by
  // clones when the data's there; otherwise the curated order (hand-picked best first).
  const topRooms = [...all]
    .sort((a, b) => ((b as Room & { _clones?: number })._clones || 0) - ((a as Room & { _clones?: number })._clones || 0))
    .slice(0, 8)
  const showTop = filter === "all" && !debounced && topRooms.length >= 4
  // The grid must NOT re-show the rooms already in the Top rail above it — that double-
  // render is what made the feed look so repetitive. Also collapse rooms that share the
  // exact same cast (community clones) so the same faces don't carpet the page.
  const topIds = new Set(showTop ? topRooms.map((r) => r.id) : [])
  const castSig = (r: Room) => r.personas.map((p) => p.name).sort().join("|")
  const seenCast = new Set<string>(showTop ? topRooms.map(castSig) : [])
  const gridRooms = all.filter((r) => {
    if (topIds.has(r.id)) return false
    const sig = castSig(r)
    if (seenCast.has(sig)) return false
    seenCast.add(sig)
    return true
  })

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

        {/* The "no-limits" tap → kloom.fun, carrying the session so credits follow.
            Only on .io, and only once .fun is actually live. */}
        <FunTap />

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
                {label}
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
                <div key={r.id} className="snap-start shrink-0 w-64">
                  <RoomCard room={r} owned
                    onEnter={(t) => router.push(t ? `/app/rooms/${r.id}?t=${t}` : `/app/rooms/${r.id}`)}
                    onDelete={() => { deleteCustomRoom(r.id); setMine(listCustomRooms()) }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top rooms — a featured rail of standouts you can swipe through */}
        {showTop && (
          <div className="mb-8">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Flame size={13} className="text-amber-400" />
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Top rooms</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 snap-x scrollbar-hide">
              {topRooms.map((r) => (
                <div key={`top-${r.id}`} className="snap-start shrink-0 w-72">
                  <RoomCard room={r} featured
                    onEnter={(t) => router.push(t ? `/app/rooms/${r.id}?t=${t}` : `/app/rooms/${r.id}`)}
                    onClone={() => { bumpRoomClones(r.id); const id = cloneRoom(r); router.push(`/app/rooms/${id}`) }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* The feed — masonry so every room sizes to its own topics; cards are
            clusters of scenes, not uniform e-commerce tiles. Curated rooms paint
            instantly; the community half streams in and only shows skeletons when
            there's nothing on screen yet. */}
        {showTop && <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">All rooms</h2>}
        {all.length > 0 ? (
          <>
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-3">
              {gridRooms.map((r) => (
                <RoomCard key={r.id} room={r}
                  onEnter={(t) => router.push(t ? `/app/rooms/${r.id}?t=${t}` : `/app/rooms/${r.id}`)}
                  onClone={() => { bumpRoomClones(r.id); const id = cloneRoom(r); router.push(`/app/rooms/${id}`) }} />
              ))}
            </div>
            {(hasMore || loading) && (
              <div ref={sentinel} className="h-10 flex items-center justify-center mt-4">
                <Loader2 size={18} className="animate-spin text-muted-foreground/50" />
              </div>
            )}
          </>
        ) : loading ? (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-3">
            {[36, 52, 40, 56, 44, 48].map((h, i) => (
              <div key={i} style={{ height: `${h * 4}px` }} className="mb-3 break-inside-avoid rounded-2xl border border-border/40 bg-foreground/[0.02] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No rooms match that yet.</p>
            <button onClick={() => router.push("/app/create")} className="mt-3 text-sm font-semibold text-foreground hover:opacity-80">Build the first one →</button>
          </div>
        )}
      </div>
    </div>
  )
}

/** The "no-limits" tap — funnels .io users to the uncensored .fun experience,
 *  carrying their session so the same account + credits work there. Hidden until
 *  .fun is live (NEXT_PUBLIC_FUN_LIVE=1). */
function FunTap() {
  if (!isIo() || !funLive()) return null
  const go = async () => { window.location.href = await funHandoffUrl("/app/rooms") }
  return (
    <button onClick={go}
      className="group w-full mb-5 flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-fuchsia-500/[0.06] to-transparent px-4 py-3.5 text-left hover:border-rose-500/50 transition-all">
      <span className="text-xl">🔓</span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm">
          No-limits mode
          <span className="ml-1.5 align-middle text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">18+</span>
        </div>
        <div className="text-xs text-muted-foreground">Uncensored rooms on Kloom.fun — your account &amp; credits come with you.</div>
      </div>
      <ArrowRight size={16} className="text-rose-300 group-hover:translate-x-0.5 transition-transform shrink-0" />
    </button>
  )
}

// The cast as a wide face banner — the faces ARE the room. Real photos (generated once,
// cached forever), tiled to fill the top of the card so each room reads as a place full
// of people, not an e-commerce tile.
function FaceBanner({ room, tall }: { room: Room; tall?: boolean }) {
  const meta = CATEGORY_META[room.category]
  const cast = room.personas.slice(0, 3)
  return (
    <div className={`relative ${tall ? "h-36" : "h-28"} flex overflow-hidden bg-stone-900`}>
      {cast.map((p, i) => (
        <RoomFace key={`${p.name}-${i}`} name={p.avatarSeed ?? p.name} gender={p.gender} photoUrl={p.photoUrl}
          seed={p.avatarSeed ?? p.name} alt={p.name}
          className="flex-1 min-w-0 h-full object-cover" />
      ))}
      {/* category tint for cohesion + a scrim so the title below always reads */}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${room.gradient} opacity-30 mix-blend-soft-light`} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <span className="absolute top-2.5 left-2.5 text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-background/65 backdrop-blur-md border border-white/10 text-foreground/90">
        {meta?.label ?? room.category}
      </span>
    </div>
  )
}

function RoomCard({ room, onEnter, onClone, onDelete, owned, featured }: {
  room: Room
  onEnter: (topicSlug?: string) => void
  onClone?: () => void
  onDelete?: () => void
  owned?: boolean
  featured?: boolean
}) {
  const [cloned, setCloned] = useState(false)
  // The doors inside this room — concrete scenes, not just a name. This is what
  // makes a room read as "many topics" instead of one boring tile.
  const topics = getTopics(room.id, room.category).slice(0, owned ? 3 : 4)
  const clones = (room as Room & { _clones?: number })._clones

  return (
    <div className="group mb-3 break-inside-avoid rounded-2xl border border-border/60 bg-foreground/[0.02] hover:border-foreground/30 hover:bg-foreground/[0.04] transition-all overflow-hidden flex flex-col">
      {/* Hero — the faces */}
      <button onClick={() => onEnter()} className="block text-left">
        <FaceBanner room={room} tall={featured} />
      </button>

      <div className="px-4 pt-3 pb-4 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <button onClick={() => onEnter()} className="text-left min-w-0">
            <h3 className="font-bold text-[15px] tracking-tight leading-snug">{room.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">{room.tagline}</p>
          </button>
          {owned && onDelete && (
            <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-400 transition-all shrink-0 mt-0.5"><Trash2 size={13} /></button>
          )}
        </div>

        {/* Cast names + clone count */}
        <div className="flex items-center gap-2 mt-2.5 text-[10px] text-muted-foreground">
          <span className="truncate flex-1">
            {room.personas.map((p) => p.name.split(" ")[0]).slice(0, 3).join(" · ")}
          </span>
          {typeof clones === "number" && clones > 0 && (
            <span className="flex items-center gap-1 font-semibold shrink-0"><Copy size={10} /> {clones}</span>
          )}
        </div>

        {/* Topics — the doors inside. Each one drops you straight into that scene. */}
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {topics.map((tp) => (
              <button key={tp.slug} onClick={() => onEnter(tp.slug)}
                className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border border-border/50 bg-background/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-foreground/[0.06] transition-all">
                {tp.heat === 3 && <Flame size={10} className="text-rose-400/80" />}
                {tp.title}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3.5">
          <button onClick={() => onEnter()}
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
    </div>
  )
}
