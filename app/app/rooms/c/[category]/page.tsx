"use client"

/**
 * Inside a world — one category's rooms, each with its topics (the doors
 * within the door). Clicking a topic enters the room with that scene loaded.
 */
import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { ROOMS, type Room, type RoomCategory } from "@/lib/rooms"
import { CATEGORY_META, BADGE_LABELS, isAdultRoom } from "@/lib/category-meta"
import { adultEnabled } from "@/lib/variant"
import { getTopics } from "@/lib/topics"
import { listCustomRooms, importCustomRoom } from "@/lib/custom-rooms"
import { fetchCommunityRooms } from "@/lib/rooms-db"
import { hasUnrestricted } from "@/lib/account"
import { imageFor } from "@/lib/persona-utils"
import { ChevronLeft, Lock, Flame, ArrowRight, Settings } from "lucide-react"

const MODEL_BADGE: Record<string, string> = {
  claude:  "Claude",
  gemini:  "Gemini",
  mistral: "Mistral",
  dolphin: "Dolphin",
}

export default function CategoryPage() {
  const router = useRouter()
  const params = useParams<{ category: string }>()
  const category = params.category as RoomCategory
  const meta = CATEGORY_META[category]

  const [unlocked, setUnlocked] = useState(true)
  const [mine, setMine] = useState<Room[]>([])
  const [community, setCommunity] = useState<Room[]>([])
  useEffect(() => {
    setUnlocked(hasUnrestricted())
    const local = listCustomRooms().filter((r) => r.category === category)
    setMine(local)
    // Community rooms published to this world (skip ones already local).
    let cancelled = false
    fetchCommunityRooms(category).then((rooms) => {
      if (cancelled) return
      const localIds = new Set(local.map((r) => r.id))
      setCommunity(rooms.filter((r) => !localIds.has(r.id)))
    })
    return () => { cancelled = true }
  }, [category])

  useEffect(() => {
    // Unknown world, or an adult world on the .io variant → bounce home.
    if (!meta || (meta.adult && !adultEnabled())) router.replace("/app/rooms")
  }, [meta, router])

  const rooms = useMemo(
    () => ROOMS.filter((r) => r.category === category && (adultEnabled() || !isAdultRoom(r))),
    [category]
  )

  if (!meta) return null
  const gated = meta.adult && !unlocked

  return (
    <div className="min-h-full text-foreground">
      {/* Hero in the world's identity */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${meta.gradient}`}>
        <span className="absolute -right-8 -bottom-12 text-[14rem] opacity-[0.06] select-none pointer-events-none">{meta.emoji}</span>
        <div className="max-w-6xl mx-auto px-6 lg:px-8 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-10">
          <button onClick={() => router.push("/app/rooms")}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors">
            <ChevronLeft size={16} /> All worlds
          </button>
          <div className="flex items-center gap-4">
            <span className="text-5xl">{meta.emoji}</span>
            <div>
              <h1 className="text-4xl lg:text-5xl font-black tracking-[-0.02em]">{meta.label}</h1>
              <p className="text-muted-foreground mt-1">{meta.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-5">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${meta.text}`}>
              {rooms.length + mine.length} room{rooms.length + mine.length === 1 ? "" : "s"}
            </span>
            {meta.badges.map((b) => (
              <span key={b} className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border/50 bg-background/40 ${b === "18+" ? "text-rose-300" : "text-muted-foreground"}`}>
                {BADGE_LABELS[b]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8 pb-28">
        {/* 18+ gate */}
        {gated ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-10 text-center max-w-xl mx-auto mt-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-5">
              <Lock size={22} className="text-rose-400" />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-2">This world is 18+.</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {meta.label} runs with zero restrictions — it needs Unrestricted on your account.
            </p>
            <button onClick={() => router.push("/app/settings")}
              className="inline-flex items-center gap-2 brand-gradient text-stone-950 font-bold text-sm px-5 py-2.5 rounded-full brand-glow hover:scale-[1.03] active:scale-95 transition-transform">
              <Settings size={14} /> Unlock in Settings
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} category={category} accentText={meta.text} />
              ))}
            </div>

            {mine.length > 0 && (
              <div className="mt-10">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Your rooms here</h2>
                <div className="space-y-4">
                  {mine.map((room) => (
                    <RoomCard key={room.id} room={room} category={category} accentText={meta.text} />
                  ))}
                </div>
              </div>
            )}

            {community.length > 0 && (
              <div className="mt-10">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Community rooms</h2>
                <div className="space-y-4">
                  {community.map((room) => (
                    <div key={room.id} onClick={() => importCustomRoom(room)}>
                      <RoomCard room={room} category={category} accentText={meta.text} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rooms.length === 0 && mine.length === 0 && community.length === 0 && (
              <p className="text-center text-muted-foreground py-16">No rooms in this world yet — be the first to build one.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RoomCard({ room, category, accentText }: { room: Room; category: RoomCategory; accentText: string }) {
  const router = useRouter()
  const topics = getTopics(room.id, category)

  return (
    <div className={`rounded-3xl border border-border/40 bg-gradient-to-br ${room.gradient} p-5 lg:p-6 transition-all duration-300 hover:border-border`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-black tracking-tight">{room.name}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{room.tagline}</p>
        </div>
        <button onClick={() => router.push(`/app/rooms/${room.id}`)}
          className="shrink-0 flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground border border-border/50 hover:bg-foreground/5 px-3.5 py-2 rounded-full transition-all">
          Just enter <ArrowRight size={12} />
        </button>
      </div>

      {/* Cast */}
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <div className="flex -space-x-1.5">
          {room.personas.slice(0, 4).map((p) => {
            const img = imageFor({ name: p.name })
            return (
              <div key={`${p.name}-${p.role}`} title={p.name}
                className="w-8 h-8 rounded-full border-2 border-background bg-foreground/10 overflow-hidden flex items-center justify-center">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] font-black">{p.name[0]}</span>
                )}
              </div>
            )
          })}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {room.personas.map((p) => p.name.split(" ")[0]).slice(0, 4).join(", ")}
        </span>
        {room.personas.filter((p) => p.model && p.model !== "local").map((p) => (
          <span key={`${p.name}-model`} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border/50 bg-background/40 text-muted-foreground">
            {MODEL_BADGE[p.model!] ?? p.model}
          </span>
        ))}
        {room.capabilities.skills.slice(0, 3).map((s) => (
          <span key={s} className="text-[9px] px-2 py-0.5 rounded-full border border-border/40 text-muted-foreground/80">
            {s}
          </span>
        ))}
      </div>

      {/* Topics — the doors inside */}
      {topics.length > 0 && (
        <div className="mt-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Tonight in this room</div>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <button key={t.slug}
                onClick={() => router.push(`/app/rooms/${room.id}?t=${t.slug}`)}
                className={`group flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full border border-border/50 bg-background/30 hover:bg-foreground/10 hover:border-border transition-all duration-200 ${accentText.replace("text-", "hover:text-")}`}>
                {t.heat === 3 && <Flame size={11} className="text-rose-400" />}
                {t.heat === 2 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />}
                {t.title}
                <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 -ml-1 group-hover:ml-0 transition-all" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
