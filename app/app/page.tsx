"use client"

/**
 * The Hub — two doors. Create a room, or walk into one.
 * Everything in Kloom is a room; this is the entryway.
 */
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { VISIBLE_ROOMS as ROOMS, type Room } from "@/lib/rooms"
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/category-meta"
import { listCustomRooms } from "@/lib/custom-rooms"
import { getTopics } from "@/lib/topics"
import { imageFor } from "@/lib/persona-utils"
import { Plus, DoorOpen, ChevronRight, ArrowRight } from "lucide-react"

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return "Still up."
  if (h < 12) return "Good morning."
  if (h < 18) return "Good afternoon."
  return "Good evening."
}

export default function HubPage() {
  const router = useRouter()
  const [mine, setMine] = useState<Room[]>([])
  const [hello, setHello] = useState("Welcome.")
  useEffect(() => { setMine(listCustomRooms()); setHello(greeting()) }, [])

  // Tonight's picks — one flagship + one fantasy + the decision engine.
  const tonight = useMemo(() => {
    const picks: Room[] = []
    const desk = ROOMS.find((r) => r.id === "the-desk")
    if (desk) picks.push(desk)
    const fantasy = ROOMS.filter((r) => r.category === "fantasy")
    if (fantasy.length) picks.push(fantasy[new Date().getDay() % fantasy.length])
    const engine = ROOMS.find((r) => r.id === "decision-engine")
    if (engine) picks.push(engine)
    return picks
  }, [])

  return (
    <div className="min-h-full text-foreground">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-28">

        <p className="text-sm text-muted-foreground mb-8">{hello}</p>

        {/* The two doors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* CREATE */}
          <button onClick={() => router.push("/app/create")}
            className="group relative text-left rounded-3xl brand-gradient brand-glow p-8 lg:p-10 min-h-[38vh] flex flex-col justify-between overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.015] active:scale-[0.99]">
            <div className="absolute -right-10 -bottom-14 opacity-10 pointer-events-none">
              <Plus size={220} strokeWidth={1} className="text-stone-950" />
            </div>
            <div className="w-12 h-12 rounded-2xl bg-stone-950/15 flex items-center justify-center">
              <Plus size={24} className="text-stone-950" />
            </div>
            <div>
              <h2 className="text-3xl lg:text-4xl font-black tracking-[-0.02em] text-stone-950">Create a room</h2>
              <p className="text-stone-900/70 font-medium mt-2 max-w-xs">
                Pick a world. Build the cast. Send the link.
              </p>
              <span className="inline-flex items-center gap-1.5 mt-5 text-sm font-black text-stone-950 group-hover:gap-2.5 transition-all">
                Start building <ArrowRight size={15} />
              </span>
            </div>
          </button>

          {/* JOIN */}
          <button onClick={() => router.push("/app/rooms")}
            className="group relative text-left rounded-3xl glass-strong border border-border/50 p-8 lg:p-10 min-h-[38vh] flex flex-col justify-between overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.015] hover:border-border active:scale-[0.99]">
            {/* drifting category emojis */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none select-none text-6xl leading-none p-6 flex flex-wrap gap-6 items-center justify-center">
              {CATEGORY_ORDER.slice(0, 8).map((c) => <span key={c}>{CATEGORY_META[c].emoji}</span>)}
            </div>
            <div className="w-12 h-12 rounded-2xl bg-foreground/10 border border-border/40 flex items-center justify-center">
              <DoorOpen size={24} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-3xl lg:text-4xl font-black tracking-[-0.02em]">Join a room</h2>
              <p className="text-muted-foreground font-medium mt-2 max-w-xs">
                {CATEGORY_ORDER.length} worlds. {ROOMS.length} rooms. Pick a door.
              </p>
              <span className="inline-flex items-center gap-1.5 mt-5 text-sm font-black text-amber-400 group-hover:gap-2.5 transition-all">
                Browse the worlds <ArrowRight size={15} />
              </span>
            </div>
          </button>
        </div>

        {/* Your rooms */}
        {mine.length > 0 && (
          <div className="mt-10">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Your rooms</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
              {mine.slice(0, 8).map((r) => (
                <button key={r.id} onClick={() => router.push(`/app/rooms/${r.id}`)}
                  className={`snap-start shrink-0 w-60 text-left rounded-3xl border border-border/50 bg-gradient-to-br ${r.gradient} p-4 hover:border-border transition-all duration-200 hover:scale-[1.02]`}>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {CATEGORY_META[r.category]?.label ?? r.category}
                  </span>
                  <div className="font-black text-base truncate mt-1.5">{r.name}</div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex -space-x-1.5">
                      {r.personas.slice(0, 4).map((p) => {
                        const img = imageFor({ name: p.name, photoUrl: p.photoUrl })
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
                    <ChevronRight size={14} className="text-amber-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tonight */}
        {tonight.length > 0 && (
          <div className="mt-10">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Tonight</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {tonight.map((room) => {
                const meta = CATEGORY_META[room.category]
                const topic = getTopics(room.id, room.category)[0]
                return (
                  <button key={room.id}
                    onClick={() => router.push(topic ? `/app/rooms/${room.id}?t=${topic.slug}` : `/app/rooms/${room.id}`)}
                    className={`group text-left rounded-3xl border border-border/40 bg-gradient-to-br ${room.gradient} p-5 hover:border-border transition-all duration-300 hover:scale-[1.01]`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{meta?.emoji}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${meta?.text ?? "text-muted-foreground"}`}>
                        {meta?.label ?? room.category}
                      </span>
                    </div>
                    <div className="font-black text-lg tracking-tight">{room.name}</div>
                    {topic && (
                      <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border/50 bg-background/30 text-muted-foreground group-hover:text-foreground transition-colors">
                        {topic.title} <ArrowRight size={11} />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
