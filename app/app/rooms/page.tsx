"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ROOMS, ROOM_CATEGORY_LABELS, ROOM_CATEGORY_COLORS, type RoomCategory, type Room } from "@/lib/rooms"
import { listCustomRooms, deleteCustomRoom } from "@/lib/custom-rooms"
import { getCharacter, scoreRoom, type UserCharacter } from "@/lib/character"
import { hasUnrestricted } from "@/lib/account"
import { PERSONALITY_PRESETS } from "@/components/persona-editor"
import { imageFor } from "@/lib/persona-utils"
import { ActivitySparkline } from "@/components/ui/sparkline"
import { Mic, MessageSquare, Zap, ChevronRight, Plus, Trash2, Lock, TrendingUp } from "lucide-react"

const ALL_CATS: Array<"all" | RoomCategory> = ["all", "fantasy", "trading", "workshop", "co-intelligence", "creator", "professional", "social", "romantic", "dark", "philosophy", "zero-memory"]

export default function RoomsPage() {
  const router = useRouter()
  const [activeCat, setActiveCat] = useState<"all" | RoomCategory>("all")
  const [mine, setMine] = useState<Room[]>([])
  const [unlocked, setUnlocked] = useState(true)
  const [char, setChar] = useState<UserCharacter | null>(null)
  useEffect(() => { setMine(listCustomRooms()); setUnlocked(hasUnrestricted()); setChar(getCharacter()) }, [])
  const removeMine = (id: string) => { deleteCustomRoom(id); setMine(listCustomRooms()) }

  // Reorder by the user's character — preferred categories + interests bubble up.
  // Stable for ties, so without a profile the original curated order is preserved.
  const filtered = useMemo(() => {
    const base = activeCat === "all" ? ROOMS : ROOMS.filter((r) => r.category === activeCat)
    if (!char) return base
    return base
      .map((r, i) => ({ r, i, s: scoreRoom(r, char) }))
      .sort((a, b) => (b.s - a.s) || (a.i - b.i))
      .map((x) => x.r)
  }, [activeCat, char])

  return (
    <div className="min-h-full text-foreground">

      {/* Header */}
      <div className="sticky top-0 z-20 glass-strong px-6 lg:px-8 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-5">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black tracking-[-0.02em]">Rooms</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Join a dynamic — or build your own. Chat free, calls pay-as-you-go.
              </p>
            </div>
            <button onClick={() => router.push("/app/create")}
              className="shrink-0 flex items-center gap-1.5 brand-gradient text-stone-950 font-bold text-sm px-4 py-2.5 rounded-full brand-glow hover:scale-[1.03] active:scale-95 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]">
              <Plus size={15} /> Build a room
            </button>
          </div>

          {/* Category filters */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide snap-x">
            {ALL_CATS.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`shrink-0 snap-start px-4 py-2 rounded-full text-xs font-bold border transition-[background-color,color,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  activeCat === cat
                    ? "brand-gradient text-stone-950 border-transparent shadow-[0_4px_14px_-3px_rgba(251,146,60,0.5)]"
                    : "bg-white/[0.04] border-white/[0.08] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
                }`}
              >
                {cat === "all" ? "All rooms" : ROOM_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Your rooms (user-built) */}
      {mine.length > 0 && activeCat === "all" && (
        <div className="max-w-6xl mx-auto px-6 lg:px-8 pt-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/35 mb-3">Your rooms</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {mine.map((room) => (
              <div key={room.id}
                className={`group relative rounded-3xl overflow-hidden border border-white/[0.07] bg-gradient-to-br ${room.gradient} ring-1 ring-inset ring-white/[0.04] hover:border-amber-400/30 hover:-translate-y-1 hover:shadow-[0_20px_50px_-16px_rgba(0,0,0,0.6)] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer p-5`}
                onClick={() => router.push(`/app/rooms/${room.id}`)}>
                <button onClick={(e) => { e.stopPropagation(); removeMine(room.id) }}
                  className="absolute top-3 right-3 text-muted-foreground/60 hover:text-red-400 z-10"><Trash2 size={15} /></button>
                <div className="flex -space-x-3 mb-3">
                  {room.personas.map((p) => (
                    <img key={p.name} src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(p.avatarSeed ?? p.name)}`}
                      alt={p.name} className="w-12 h-12 rounded-xl object-cover ring-2 ring-stone-950 bg-stone-800" />
                  ))}
                </div>
                <div className="font-bold">{room.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{room.tagline}</div>
                <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
                  <span className={`px-1.5 py-0.5 rounded-full border ${ROOM_CATEGORY_COLORS[room.category]}`}>{ROOM_CATEGORY_LABELS[room.category]}</span>
                  <span>{room.personas.length} members</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-6 pb-24 lg:pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 auto-rows-max">
          {filtered.map((room, index) => {
            // Each seat → an avatar. Human personas get photos; workshop AI
            // seats (Claude/Gemini) get a bot avatar via their seed.
            const seats = room.personas.map((rp) => {
              const preset = PERSONALITY_PRESETS.find((p) => p.name === rp.name)
              return {
                name: rp.name,
                avatar: preset
                  ? imageFor(preset)
                  : `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(rp.avatarSeed ?? rp.name)}`,
              }
            })

            const isFeatured = index % 5 === 0 && filtered.length > 5;

            return (
              <div
                key={room.id}
                className={`group relative rounded-3xl overflow-hidden border border-white/[0.07] bg-gradient-to-br ${room.gradient} ring-1 ring-inset ring-white/[0.04] hover:border-amber-400/30 hover:shadow-[0_20px_50px_-16px_rgba(0,0,0,0.6),0_0_0_1px_rgba(251,191,36,0.15)] hover:-translate-y-1 transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer flex flex-col justify-between ${
                  isFeatured ? "md:col-span-2 xl:col-span-2 md:row-span-2" : ""
                }`}
                onClick={() => router.push(`/app/rooms/${room.id}`)}
              >
                {room.category === "dark" && !unlocked && (
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-rose-500/20 border border-rose-500/40 text-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                    <Lock size={10} /> 18+ · $10
                  </div>
                )}
                {/* Sparkline for featured */}
                {isFeatured && (
                  <div className="absolute bottom-0 left-0 right-0 z-0 opacity-40 pointer-events-none">
                    <ActivitySparkline height={120} color={room.category === 'trading' ? '#10b981' : room.category === 'romantic' ? '#f43f5e' : '#a78bfa'} />
                  </div>
                )}
                
                {/* Header Section */}
                <div className="relative z-10 flex items-end gap-0 p-5 pb-0">
                  {seats.map((s, i) => (
                    <div
                      key={s.name}
                      className="relative"
                      style={{ marginLeft: i > 0 ? "-16px" : 0, zIndex: seats.length - i }}
                    >
                      <img
                        src={s.avatar}
                        alt={s.name}
                        className="w-16 h-16 rounded-2xl object-cover ring-2 ring-stone-950 bg-stone-800"
                      />
                    </div>
                  ))}

                  {/* Online indicator */}
                  <div className="ml-auto flex items-center gap-1.5 bg-black/30 backdrop-blur-sm border border-border/50 px-2.5 py-1 rounded-full self-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-foreground/60">Live</span>
                  </div>
                </div>

                {/* Info */}
                <div className={`relative z-10 p-5 pt-3 flex flex-col flex-1 ${isFeatured ? 'space-y-4' : 'space-y-3'}`}>
                  {/* Category + name */}
                  <div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${ROOM_CATEGORY_COLORS[room.category]}`}>
                      {ROOM_CATEGORY_LABELS[room.category]}
                    </span>
                    <h3 className={`font-black mt-2 leading-tight ${isFeatured ? 'text-2xl' : 'text-lg'}`}>{room.name}</h3>
                    <p className={`text-muted-foreground italic mt-0.5 ${isFeatured ? 'text-sm' : 'text-xs'}`}>{room.tagline}</p>
                  </div>

                  {/* Personas list */}
                  <div className={`text-muted-foreground space-y-0.5 flex-1 ${isFeatured ? 'text-sm' : 'text-xs'}`}>
                    {room.personas.map((p) => (
                      <div key={p.name} className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-white/25 shrink-0" />
                        <span className="font-medium text-foreground/60">{p.name}</span>
                        <span className="text-muted-foreground/60">— {p.role}</span>
                      </div>
                    ))}
                  </div>

                  {/* Capabilities chips */}
                  {room.capabilities.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {room.capabilities.tools.slice(0, 3).map((t) => (
                        <span
                          key={t.id}
                          className="flex items-center gap-1 text-[10px] font-semibold bg-foreground/5 border border-border/50 px-2 py-0.5 rounded-full text-muted-foreground"
                        >
                          <span>{t.icon}</span>{t.label}
                        </span>
                      ))}
                      {room.capabilities.tools.length > 3 && (
                        <span className="text-[10px] text-muted-foreground/60 px-1 py-0.5">
                          +{room.capabilities.tools.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/app/rooms/${room.id}?mode=chat`) }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-xs font-bold text-foreground/70 hover:text-foreground transition-colors duration-200"
                    >
                      <MessageSquare size={12} /> Chat
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/app/rooms/${room.id}?mode=voice`) }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full brand-gradient text-stone-950 hover:scale-[1.03] active:scale-95 text-xs font-bold shadow-[0_4px_14px_-4px_rgba(251,146,60,0.5)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    >
                      <Mic size={12} /> Voice
                    </button>
                  </div>
                </div>

                {/* Arrow */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
