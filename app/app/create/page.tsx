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

  const create = () => {
    setErr(null)
    if (!name.trim()) return setErr("Give your room a name.")
    const clean = members.filter((m) => m.name.trim())
    if (clean.length < 2) return setErr("Add at least 2 members with names.")
    if (adultLocked) return setErr("Adult rooms need Unrestricted.")
    const id = createCustomRoom({
      name: name.trim(), topic: topic.trim(), category,
      members: clean.map((m) => ({ ...m, name: m.name.trim(), personality: m.personality.trim() || "easygoing" })),
    })
    router.push(`/app/rooms/${id}`)
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <div className="max-w-2xl mx-auto px-5 py-6 lg:py-10">
        <button onClick={() => router.push("/app/rooms")} className="flex items-center gap-1 text-white/40 hover:text-white text-sm mb-5">
          <ChevronLeft size={16} /> Rooms
        </button>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-white/10 flex items-center justify-center"><Sparkles size={18} /></div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Build a room</h1>
            <p className="text-xs text-white/40">Free to create · you only pay for voice calls</p>
          </div>
        </div>

        {/* Basics */}
        <div className="mt-7 space-y-4">
          <div>
            <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Room name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Late-night debate club"
              className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-xs font-bold text-white/50 uppercase tracking-wide">What's it about?</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="The topic, scene, or vibe"
              className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/50" />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Category</label>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((c) => {
                const active = category === c.id
                return (
                  <button key={c.id} onClick={() => setCategory(c.id)}
                    className={`text-left rounded-xl border px-3 py-2.5 transition-all ${active ? "border-amber-500/60 bg-amber-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                    <div className="flex items-center gap-1.5 text-sm font-bold">
                      {c.adult && <Lock size={12} className="text-rose-400" />}{c.label}
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5 leading-tight">{c.hint}</div>
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

        {/* Members */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-bold"><Users size={15} /> Members <span className="text-white/30 font-normal">({members.length}/4)</span></div>
            {members.length < 4 && (
              <button onClick={addMember} className="flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200"><Plus size={13} /> Add member</button>
            )}
          </div>

          <div className="space-y-3">
            {members.map((m, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <input value={m.name} onChange={(e) => setMember(i, { name: e.target.value })} placeholder={`Member ${i + 1} name`}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
                  {members.length > 2 && (
                    <button onClick={() => delMember(i)} className="text-white/30 hover:text-white"><X size={16} /></button>
                  )}
                </div>

                {/* Gender */}
                <div className="flex gap-1.5 mb-3">
                  {GENDERS.map((g) => (
                    <button key={g.id} onClick={() => setMember(i, { gender: g.id })}
                      className={`flex-1 text-xs font-semibold py-1.5 rounded-lg border transition-all ${m.gender === g.id ? "border-amber-500/60 bg-amber-500/10 text-white" : "border-white/10 text-white/50 hover:text-white"}`}>
                      {g.label}
                    </button>
                  ))}
                </div>

                {/* Personality */}
                <input value={m.personality} onChange={(e) => setMember(i, { personality: e.target.value })} placeholder="Personality (or tap a trait)"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50 mb-2" />
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {TRAITS.map((t) => (
                    <button key={t} onClick={() => setMember(i, { personality: m.personality ? `${m.personality}, ${t}` : t })}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10">{t}</button>
                  ))}
                </div>

                {/* Relation */}
                <div className="flex flex-wrap gap-1.5">
                  {RELATIONS.map((r) => (
                    <button key={r} onClick={() => setMember(i, { relation: r })}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${m.relation === r ? "border-amber-500/60 bg-amber-500/10 text-white" : "bg-white/5 border-white/10 text-white/50 hover:text-white"}`}>{r}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {err && <p className="mt-4 text-sm text-red-400">{err}</p>}

        <button onClick={create} disabled={adultLocked}
          className="mt-6 w-full bg-white text-stone-950 font-bold py-3.5 rounded-2xl hover:bg-white/90 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:hover:scale-100">
          Create room — free
        </button>
        <p className="text-center text-[11px] text-white/30 mt-2">Chat is free · voice calls are pay-as-you-go</p>
      </div>
    </div>
  )
}
