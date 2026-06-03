"use client"

/**
 * Room Builder — free for everyone (even brand-new accounts). You design the room:
 * topic, category, and 2–4 AI members each with a gender, personality and relation.
 * It produces a standard Room that runs through the same multi-AI engine. Only
 * voice calls cost money. The Adult category is locked behind Unrestricted ($10).
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createCustomRoom, type BuilderMember, type Gender } from "@/lib/custom-rooms"
import { hasUnrestricted } from "@/lib/account"
import { UnrestrictedUpsell } from "@/components/widgets/UnrestrictedUpsell"
import type { RoomCategory } from "@/lib/rooms"
import { Plus, X, Users, Sparkles, Lock, ChevronLeft } from "lucide-react"

const CATEGORIES: { id: RoomCategory; label: string; hint: string; adult?: boolean }[] = [
  { id: "social",       label: "Social / Topic", hint: "Hang out, debate, vibe on any topic" },
  { id: "romantic",     label: "Romantic",       hint: "A date, a partner, a slow burn" },
  { id: "creator",      label: "Creative & Work",hint: "Brainstorm, build, get things done" },
  { id: "trading",      label: "Trading",        hint: "Markets, calls, the trading desk" },
  { id: "dark",         label: "Adult (18+)",    hint: "No limits — needs Unrestricted", adult: true },
]

const GENDERS: { id: Gender; label: string }[] = [
  { id: "female", label: "Female" }, { id: "male", label: "Male" }, { id: "nonbinary", label: "Non-binary" },
]
const TRAITS = ["playful", "blunt", "shy", "dominant", "flirty", "caring", "nerdy", "chaotic", "calm", "witty", "mysterious", "bubbly"]
const RELATIONS = ["friend", "partner", "stranger", "rival", "sibling", "coworker", "mentor", "ex"]

const empty = (): BuilderMember => ({ name: "", gender: "female", personality: "", relation: "friend" })

export default function CreateRoomPage() {
  const router = useRouter()
  const [step, setStep]         = useState<1 | 2>(1)
  const [name, setName]         = useState("")
  const [topic, setTopic]       = useState("")
  const [category, setCategory] = useState<RoomCategory>("social")
  const [members, setMembers]   = useState<BuilderMember[]>([empty(), empty()])
  const [err, setErr]           = useState<string | null>(null)

  const adultLocked = category === "dark" && !hasUnrestricted()

  const setMember = (i: number, patch: Partial<BuilderMember>) =>
    setMembers((m) => m.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const addMember = () => setMembers((m) => (m.length < 4 ? [...m, empty()] : m))
  const delMember = (i: number) => setMembers((m) => (m.length > 2 ? m.filter((_, j) => j !== i) : m))

  const handleNext = () => {
    setErr(null)
    if (!name.trim()) return setErr("Give your room a name.")
    if (adultLocked) return setErr("Adult rooms need Unrestricted.")
    setStep(2)
  }

  const create = () => {
    setErr(null)
    const clean = members.filter((m) => m.name.trim())
    if (clean.length < 2) return setErr("Add at least 2 members with names.")
    const id = createCustomRoom({
      name: name.trim(), topic: topic.trim(), category,
      members: clean.map((m) => ({ ...m, name: m.name.trim(), personality: m.personality.trim() || "easygoing" })),
    })
    router.push(`/app/rooms/${id}`)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-5 py-6 lg:py-10">
        <button onClick={() => step === 1 ? router.push("/app/rooms") : setStep(1)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-5">
          <ChevronLeft size={16} /> {step === 1 ? "Rooms" : "Back to basics"}
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-border/50 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Sparkles size={20} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Build a room</h1>
            <p className="text-sm text-muted-foreground">Step {step} of 2</p>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Basics */}
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Room name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Late-night debate club"
                  className="mt-2 w-full bg-foreground/5 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">What's it about?</label>
                <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="The topic, scene, or vibe"
                  className="mt-2 w-full bg-foreground/5 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all" />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Category</label>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {CATEGORIES.map((c) => {
                    const active = category === c.id
                    return (
                      <button key={c.id} onClick={() => setCategory(c.id)}
                        className={`text-left rounded-xl border p-4 transition-all ${active ? "border-amber-500/60 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.1)] scale-[1.02]" : "border-border/50 bg-foreground/5 hover:bg-foreground/10"}`}>
                        <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                          {c.adult && <Lock size={12} className="text-rose-400" />}{c.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1 leading-tight">{c.hint}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Adult lock */}
            {adultLocked && (
              <div className="mt-5">
                <UnrestrictedUpsell context="adult rooms" />
              </div>
            )}

            {err && <p className="text-sm text-red-400 font-semibold">{err}</p>}

            <button onClick={handleNext} disabled={adultLocked}
              className="mt-6 w-full bg-foreground text-background font-bold py-4 rounded-2xl hover:bg-foreground/90 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:hover:scale-100 shadow-lg">
              Next: Add Members
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Members */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-bold"><Users size={15} /> Room Members <span className="text-muted-foreground/70 font-normal">({members.length}/4)</span></div>
              {members.length < 4 && (
                <button onClick={addMember} className="flex items-center gap-1 text-xs font-semibold text-amber-500 hover:text-amber-400 transition-colors"><Plus size={13} /> Add member</button>
              )}
            </div>

            <div className="space-y-4">
              {members.map((m, i) => (
                <div key={i} className="relative rounded-2xl border border-border/50 bg-foreground/5 p-5 overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/5 to-transparent rounded-bl-full pointer-events-none" />
                  
                  <div className="flex items-center gap-4 mb-4">
                    {/* Avatar Preview */}
                    <div className="w-12 h-12 rounded-xl bg-background border border-border/50 shrink-0 overflow-hidden shadow-inner">
                      {m.name ? (
                        <img src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(m.name)}`} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/50"><Users size={20} /></div>
                      )}
                    </div>
                    
                    <input value={m.name} onChange={(e) => setMember(i, { name: e.target.value })} placeholder={`Member ${i + 1} name`}
                      className="flex-1 bg-background/50 border border-border/50 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all" />
                    
                    {members.length > 2 && (
                      <button onClick={() => delMember(i)} className="text-muted-foreground/70 hover:text-red-400 p-2 rounded-lg hover:bg-red-400/10 transition-colors"><X size={16} /></button>
                    )}
                  </div>

                  {/* Gender */}
                  <div className="flex gap-2 mb-4">
                    {GENDERS.map((g) => (
                      <button key={g.id} onClick={() => setMember(i, { gender: g.id })}
                        className={`flex-1 text-xs font-semibold py-2 rounded-xl border transition-all ${m.gender === g.id ? "border-amber-500/60 bg-amber-500/10 text-amber-500 shadow-sm" : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}>
                        {g.label}
                      </button>
                    ))}
                  </div>

                  {/* Personality */}
                  <div className="space-y-2 mb-4">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Personality Traits</label>
                    <input value={m.personality} onChange={(e) => setMember(i, { personality: e.target.value })} placeholder="Describe their personality..."
                      className="w-full bg-background/50 border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all" />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {TRAITS.map((t) => (
                        <button key={t} onClick={() => setMember(i, { personality: m.personality ? `${m.personality}, ${t}` : t })}
                          className="text-[10px] px-2.5 py-1 rounded-full bg-background border border-border/50 text-muted-foreground hover:text-foreground hover:border-amber-500/30 hover:bg-amber-500/5 transition-all">{t}</button>
                      ))}
                    </div>
                  </div>

                  {/* Relation */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Relation to you</label>
                    <div className="flex flex-wrap gap-1.5">
                      {RELATIONS.map((r) => (
                        <button key={r} onClick={() => setMember(i, { relation: r })}
                          className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${m.relation === r ? "border-amber-500/60 bg-amber-500/10 text-amber-500 font-semibold shadow-sm" : "bg-background border-border/50 text-muted-foreground hover:text-foreground hover:border-border"}`}>{r}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {err && <p className="mt-5 text-sm text-red-400 font-semibold">{err}</p>}

            <button onClick={create}
              className="mt-6 w-full bg-amber-500 text-stone-950 font-black py-4 rounded-2xl hover:bg-amber-400 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              Launch Room
            </button>
            <p className="text-center text-[11px] text-muted-foreground/70 mt-3">Chat is free · Voice calls are pay-as-you-go</p>
          </div>
        )}
      </div>
    </div>
  )
}
