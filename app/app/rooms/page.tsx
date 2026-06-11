"use client"

/**
 * Join a Room — the doors. Every category is a world with its own identity;
 * this page is the hallway. Click a door → that world's rooms and topics.
 */
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ROOMS, type Room } from "@/lib/rooms"
import { CATEGORY_META, CATEGORY_ORDER, BADGE_LABELS } from "@/lib/category-meta"
import { listCustomRooms, deleteCustomRoom } from "@/lib/custom-rooms"
import { hasUnrestricted } from "@/lib/account"
import { imageFor } from "@/lib/persona-utils"
import { Plus, Lock, ChevronRight, Trash2, DoorOpen } from "lucide-react"

export default function RoomsPage() {
  const router = useRouter()
  const [mine, setMine] = useState<Room[]>([])
  const [unlocked, setUnlocked] = useState(true)
  useEffect(() => { setMine(listCustomRooms()); setUnlocked(hasUnrestricted()) }, [])

  const removeMine = (id: string) => { deleteCustomRoom(id); setMine(listCustomRooms()) }

  return (
    <div className="min-h-full text-foreground">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 pt-[calc(env(safe-area-inset-top)+2rem)] pb-28">

        {/* Header */}
        <div className="flex items-end justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-black tracking-[-0.02em]">Join a room.</h1>
            <p className="text-muted-foreground mt-2">{CATEGORY_ORDER.length} worlds. {ROOMS.length} rooms. Pick a door.</p>
          </div>
          <button onClick={() => router.push("/app/create")}
            className="shrink-0 flex items-center gap-1.5 brand-gradient text-stone-950 font-bold text-sm px-4 py-2.5 rounded-full brand-glow hover:scale-[1.03] active:scale-95 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]">
            <Plus size={15} /> Create your own
          </button>
        </div>

        {/* Your rooms */}
        {mine.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Your rooms</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
              {mine.map((r) => (
                <div key={r.id}
                  className={`snap-start shrink-0 w-64 rounded-3xl border border-border/50 bg-gradient-to-br ${r.gradient} p-4 group`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {CATEGORY_META[r.category]?.label ?? r.category}
                    </span>
                    <button onClick={() => removeMine(r.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-400 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="font-black text-base truncate">{r.name}</div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex -space-x-1.5">
                      {r.personas.slice(0, 4).map((p) => {
                        const img = imageFor({ name: p.name })
                        return (
                          <div key={p.name} className="w-7 h-7 rounded-full border-2 border-background bg-foreground/10 overflow-hidden flex items-center justify-center">
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
                    <button onClick={() => router.push(`/app/rooms/${r.id}`)}
                      className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors">
                      Enter <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* The doors */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {CATEGORY_ORDER.map((c) => {
            const m = CATEGORY_META[c]
            const count = ROOMS.filter((r) => r.category === c).length
            const locked = m.adult && !unlocked
            const hero = c === "fantasy"
            return (
              <button key={c} onClick={() => router.push(`/app/rooms/c/${c}`)}
                className={`relative text-left rounded-3xl border border-border/40 overflow-hidden bg-gradient-to-br ${m.gradient} p-6 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.02] hover:border-border hover:ring-1 ${m.glow} active:scale-[0.99] ${hero ? "xl:col-span-2 xl:row-span-1" : ""} ${locked ? "opacity-75" : ""}`}>
                {/* Watermark emoji */}
                <span className="absolute -right-4 -bottom-6 text-[7rem] opacity-[0.07] select-none pointer-events-none">{m.emoji}</span>

                <div className="flex items-start justify-between">
                  <span className="text-4xl">{m.emoji}</span>
                  {locked && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-rose-300 border border-rose-500/30 bg-rose-500/10 px-2 py-1 rounded-full">
                      <Lock size={10} /> 18+
                    </span>
                  )}
                </div>

                <div className={`mt-4 font-black tracking-tight ${hero ? "text-2xl" : "text-xl"}`}>{m.label}</div>
                <div className="text-sm text-muted-foreground mt-1 leading-snug max-w-md">{m.tagline}</div>

                <div className="flex items-center gap-2 mt-5 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${m.text}`}>
                    {count} room{count === 1 ? "" : "s"}
                  </span>
                  {m.badges.map((b) => (
                    <span key={b} className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border/50 bg-background/40 ${b === "18+" ? "text-rose-300" : "text-muted-foreground"}`}>
                      {BADGE_LABELS[b]}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>

        {/* Empty-state hint when no custom rooms */}
        {mine.length === 0 && (
          <div className="mt-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <DoorOpen size={15} />
            Or build a room of your own — your cast, your voices, your rules.
          </div>
        )}
      </div>
    </div>
  )
}
