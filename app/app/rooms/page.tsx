"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ROOMS, ROOM_CATEGORY_LABELS, ROOM_CATEGORY_COLORS, type RoomCategory, type Room } from "@/lib/rooms"
import { listCustomRooms, deleteCustomRoom } from "@/lib/custom-rooms"
import { hasUnrestricted } from "@/lib/account"
import { PERSONALITY_PRESETS } from "@/components/persona-editor"
import { imageFor } from "@/lib/persona-utils"
import { Mic, MessageSquare, Zap, ChevronRight, Plus, Trash2, Lock } from "lucide-react"

const ALL_CATS: Array<"all" | RoomCategory> = ["all", "trading", "creator", "professional", "social", "romantic", "dark", "philosophy"]

export default function RoomsPage() {
  const router = useRouter()
  const [activeCat, setActiveCat] = useState<"all" | RoomCategory>("all")
  const [mine, setMine] = useState<Room[]>([])
  const [unlocked, setUnlocked] = useState(true)
  useEffect(() => { setMine(listCustomRooms()); setUnlocked(hasUnrestricted()) }, [])
  const removeMine = (id: string) => { deleteCustomRoom(id); setMine(listCustomRooms()) }

  const filtered = activeCat === "all" ? ROOMS : ROOMS.filter((r) => r.category === activeCat)

  return (
    <div className="min-h-full bg-stone-950 text-white">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-stone-950/90 backdrop-blur-md border-b border-white/5 px-6 lg:px-8 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Rooms</h1>
              <p className="text-sm text-white/40 mt-0.5">
                Join a dynamic — or build your own. Chat free, calls pay-as-you-go.
              </p>
            </div>
            <button onClick={() => router.push("/app/create")}
              className="shrink-0 flex items-center gap-1.5 bg-white text-stone-950 font-bold text-sm px-4 py-2 rounded-xl hover:bg-white/90 transition-all hover:scale-[1.02]">
              <Plus size={15} /> Build a room
            </button>
          </div>

          {/* Category filters */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {ALL_CATS.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  activeCat === cat
                    ? "bg-white text-stone-950 border-transparent"
                    : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
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
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 mb-3">Your rooms</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {mine.map((room) => (
              <div key={room.id}
                className={`group relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br ${room.gradient} hover:border-white/20 transition-all hover:scale-[1.01] cursor-pointer p-5`}
                onClick={() => router.push(`/app/rooms/${room.id}`)}>
                <button onClick={(e) => { e.stopPropagation(); removeMine(room.id) }}
                  className="absolute top-3 right-3 text-white/30 hover:text-red-400 z-10"><Trash2 size={15} /></button>
                <div className="flex -space-x-3 mb-3">
                  {room.personas.map((p) => (
                    <img key={p.name} src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(p.avatarSeed ?? p.name)}`}
                      alt={p.name} className="w-12 h-12 rounded-xl object-cover ring-2 ring-stone-950 bg-stone-800" />
                  ))}
                </div>
                <div className="font-bold">{room.name}</div>
                <div className="text-xs text-white/45 mt-0.5 line-clamp-1">{room.tagline}</div>
                <div className="flex items-center gap-2 mt-3 text-[10px] text-white/40">
                  <span className={`px-1.5 py-0.5 rounded-full border ${ROOM_CATEGORY_COLORS[room.category]}`}>{ROOM_CATEGORY_LABELS[room.category]}</span>
                  <span>{room.personas.length} members</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((room) => {
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

            return (
              <div
                key={room.id}
                className={`group relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br ${room.gradient} hover:border-white/20 transition-all hover:scale-[1.01] cursor-pointer`}
                onClick={() => router.push(`/app/rooms/${room.id}`)}
              >
                {room.category === "dark" && !unlocked && (
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-rose-500/20 border border-rose-500/40 text-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                    <Lock size={10} /> 18+ · $10
                  </div>
                )}
                {/* Persona portraits */}
                <div className="flex items-end gap-0 p-5 pb-0">
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
                  <div className="ml-auto flex items-center gap-1.5 bg-black/30 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded-full self-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-white/60">Live</span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-5 pt-3 space-y-3">
                  {/* Category + name */}
                  <div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${ROOM_CATEGORY_COLORS[room.category]}`}>
                      {ROOM_CATEGORY_LABELS[room.category]}
                    </span>
                    <h3 className="font-black text-lg mt-2 leading-tight">{room.name}</h3>
                    <p className="text-xs text-white/50 italic mt-0.5">{room.tagline}</p>
                  </div>

                  {/* Personas list */}
                  <div className="text-xs text-white/40 space-y-0.5">
                    {room.personas.map((p) => (
                      <div key={p.name} className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-white/25 shrink-0" />
                        <span className="font-medium text-white/60">{p.name}</span>
                        <span className="text-white/30">— {p.role}</span>
                      </div>
                    ))}
                  </div>

                  {/* Capabilities chips */}
                  {room.capabilities.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {room.capabilities.tools.slice(0, 3).map((t) => (
                        <span
                          key={t.id}
                          className="flex items-center gap-1 text-[10px] font-semibold bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-white/50"
                        >
                          <span>{t.icon}</span>{t.label}
                        </span>
                      ))}
                      {room.capabilities.tools.length > 3 && (
                        <span className="text-[10px] text-white/30 px-1 py-0.5">
                          +{room.capabilities.tools.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/app/rooms/${room.id}?mode=chat`) }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white/65 hover:text-white transition-all"
                    >
                      <MessageSquare size={12} /> Chat
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/app/rooms/${room.id}?mode=voice`) }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/8 border border-white/15 hover:bg-white/12 text-xs font-semibold text-white/80 hover:text-white transition-all"
                    >
                      <Mic size={12} /> Voice
                    </button>
                  </div>
                </div>

                {/* Arrow */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={16} className="text-white/40" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
