"use client"

/**
 * Create a Room — the 4-step wizard. The whole product in one flow:
 *   ① Pick a world (category)  ② Build the cast  ③ Give them voices  ④ Name it & invite
 * Produces a standard Room via createCustomRoom, then hands out a portable
 * invite link (the room travels inside the link — see lib/room-share).
 */
import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createCustomRoom, getCustomRoom, type BuilderMember, type Gender } from "@/lib/custom-rooms"
import { publishRoom } from "@/lib/rooms-db"
import { CATEGORY_META, CATEGORY_ORDER, BADGE_LABELS } from "@/lib/category-meta"
import { buildInviteUrl } from "@/lib/room-share"
import { makeSessionId } from "@/lib/room-session"
import { VOICE_CATALOG, resolveVoiceId, voiceLabelFor, VIBE_TAGS } from "@/lib/voices"
import { hasUnrestricted } from "@/lib/account"
import { UnrestrictedUpsell } from "@/components/widgets/UnrestrictedUpsell"
import { castFor } from "@/lib/cast"
import { imageFor } from "@/lib/persona-utils"
import type { RoomCategory } from "@/lib/rooms"
import {
  Plus, X, Lock, ChevronLeft, Check, Copy, Link2, Loader2,
  Play, Youtube, Sparkles, ArrowRight, Volume2, UserPlus, DoorOpen,
} from "lucide-react"

const GENDERS: { id: Gender; label: string }[] = [
  { id: "female", label: "Female" }, { id: "male", label: "Male" }, { id: "nonbinary", label: "Non-binary" },
]

type WizMember = BuilderMember & { emoji?: string }

const STEP_LABELS = ["World", "Cast", "Voices", "Invite"] as const

export default function CreateRoomPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [category, setCategory] = useState<RoomCategory | null>(null)
  const [members, setMembers] = useState<WizMember[]>([])
  const [adultNotice, setAdultNotice] = useState(false)

  // Step 4 state
  const [name, setName] = useState("")
  const [topic, setTopic] = useState("")
  const [guests, setGuests] = useState<string[]>([])
  const [guestDraft, setGuestDraft] = useState("")
  const [publish, setPublish] = useState(true)
  const [created, setCreated] = useState<{ roomId: string; sessionId: string; published: boolean } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const meta = category ? CATEGORY_META[category] : null

  const pickCategory = (c: RoomCategory) => {
    if (CATEGORY_META[c].adult && !hasUnrestricted()) { setAdultNotice(true); setCategory(c); return }
    setAdultNotice(false)
    setCategory(c)
    setStep(2)
  }

  const addMember = (m: WizMember) =>
    setMembers((prev) => (prev.length >= 4 || prev.some((x) => x.name === m.name) ? prev : [...prev, m]))
  const removeMember = (idx: number) => setMembers((prev) => prev.filter((_, i) => i !== idx))
  const patchMember = (idx: number, patch: Partial<WizMember>) =>
    setMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)))

  const create = async () => {
    setErr(null)
    if (!category) return
    if (!name.trim()) { setErr("Give your room a name."); return }
    if (members.length < 1) { setErr("Your room needs at least one character."); return }
    const roomId = createCustomRoom({
      name: name.trim(),
      topic: topic.trim(),
      category,
      members: members.map(({ emoji: _e, ...m }) => ({ ...m, name: m.name.trim() })),
    })
    // Publish to the world's directory (best-effort — the portable link works
    // either way; publishing additionally lists it for everyone).
    let published = false
    if (publish) {
      const room = getCustomRoom(roomId)
      if (room) published = await publishRoom(room)
    }
    setCreated({ roomId, sessionId: makeSessionId(), published })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-5 py-6 lg:py-10 pb-32">

        {/* Top bar: back + progress rail */}
        <div className="flex items-center justify-between mb-10">
          <button
            onClick={() => {
              if (created) return
              if (step === 1) router.push("/app")
              else setStep((s) => (s - 1) as 1 | 2 | 3)
            }}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors">
            <ChevronLeft size={16} /> {step === 1 ? "Home" : "Back"}
          </button>
          <div className="flex items-center gap-2">
            {STEP_LABELS.map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3 | 4
              const active = step === n
              const done = step > n
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${active ? "text-amber-400" : done ? "text-foreground/60" : "text-muted-foreground/40"}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border transition-all ${active ? "border-amber-400 bg-amber-400/15" : done ? "border-foreground/30 bg-foreground/10" : "border-border/60"}`}>
                      {done ? <Check size={10} /> : n}
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                  {i < 3 && <div className={`w-4 h-px ${done ? "bg-foreground/30" : "bg-border/60"}`} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── STEP 1 — pick a world ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-black tracking-[-0.02em] mb-2">Pick a world.</h1>
            <p className="text-muted-foreground mb-8">Every world has its own rules, cast and capabilities.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CATEGORY_ORDER.map((c) => {
                const m = CATEGORY_META[c]
                const locked = m.adult && !hasUnrestricted()
                const selected = category === c
                return (
                  <button key={c} onClick={() => pickCategory(c)}
                    className={`relative text-left rounded-3xl border p-5 overflow-hidden bg-gradient-to-br ${m.gradient} transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.02] active:scale-[0.98] ${selected ? `border-amber-500/60 ring-1 ${m.glow}` : "border-border/40 hover:border-border"} ${locked ? "opacity-70" : ""}`}>
                    <div className="flex items-start justify-between">
                      <span className="text-3xl">{m.emoji}</span>
                      {locked && <Lock size={14} className="text-rose-400 mt-1" />}
                    </div>
                    <div className="mt-3 font-black text-lg tracking-tight">{m.label}</div>
                    <div className="text-xs text-muted-foreground mt-1 leading-snug">{m.tagline}</div>
                    {m.badges.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {m.badges.map((b) => (
                          <span key={b} className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border/50 bg-background/40 ${b === "18+" ? "text-rose-300" : "text-muted-foreground"}`}>
                            {BADGE_LABELS[b]}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {adultNotice && meta?.adult && (
              <div className="mt-6 animate-in fade-in duration-300">
                <UnrestrictedUpsell context="adult rooms" />
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2 — build the cast ───────────────────────────────────── */}
        {step === 2 && category && meta && (
          <CastStep
            category={category}
            members={members}
            onAdd={addMember}
            onRemove={removeMember}
            onContinue={() => setStep(3)}
          />
        )}

        {/* ── STEP 3 — voices ───────────────────────────────────────────── */}
        {step === 3 && (
          <VoicesStep
            members={members}
            onPatch={patchMember}
            onContinue={() => setStep(4)}
          />
        )}

        {/* ── STEP 4 — name & invite ────────────────────────────────────── */}
        {step === 4 && category && meta && !created && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-black tracking-[-0.02em] mb-2">Name it.</h1>
            <p className="text-muted-foreground mb-8">Last step — make it yours, then open the doors.</p>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Room name</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={`My ${meta.label} room`}
                  className="mt-2 w-full bg-foreground/5 border border-border/50 rounded-2xl px-4 py-3.5 text-base font-semibold focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">What&apos;s happening here?</label>
                <input value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="The scene, the vibe, the mission — one line"
                  className="mt-2 w-full bg-foreground/5 border border-border/50 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all" />
              </div>

              {/* Guests */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Invite humans <span className="normal-case font-normal text-muted-foreground/60">(optional — add names for personal links)</span></label>
                <div className="mt-2 flex gap-2">
                  <input value={guestDraft} onChange={(e) => setGuestDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && guestDraft.trim() && guests.length < 5) {
                        setGuests((g) => [...g, guestDraft.trim()]); setGuestDraft("")
                      }
                    }}
                    placeholder="Guest name"
                    className="flex-1 bg-foreground/5 border border-border/50 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 transition-all" />
                  <button
                    onClick={() => { if (guestDraft.trim() && guests.length < 5) { setGuests((g) => [...g, guestDraft.trim()]); setGuestDraft("") } }}
                    className="px-4 rounded-2xl border border-border/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all">
                    <UserPlus size={16} />
                  </button>
                </div>
                {guests.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {guests.map((g, i) => (
                      <span key={`${g}-${i}`} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-foreground/10 border border-border/50">
                        {g}
                        <button onClick={() => setGuests((gs) => gs.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-rose-400"><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Publish toggle */}
            <button onClick={() => setPublish((p) => !p)}
              className={`mt-6 w-full flex items-center gap-3 text-left rounded-2xl border p-4 transition-all ${publish ? "border-amber-500/40 bg-amber-500/[0.07]" : "border-border/50 bg-foreground/5"}`}>
              <span className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${publish ? "bg-amber-500" : "bg-foreground/15"}`}>
                <span className={`block w-5 h-5 rounded-full bg-background transition-transform ${publish ? "translate-x-4" : ""}`} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">List it in {meta.label}</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">
                  Your room appears in its world for everyone to join. Off = invite-link only.
                </span>
              </span>
            </button>

            {err && <p className="mt-5 text-sm text-rose-400 font-semibold">{err}</p>}

            <button onClick={create}
              className="mt-8 w-full brand-gradient text-stone-950 font-black text-lg py-4 rounded-2xl brand-glow hover:scale-[1.01] active:scale-[0.99] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]">
              Create the room
            </button>
          </div>
        )}

        {/* ── AFTERPARTY — created ──────────────────────────────────────── */}
        {created && <InvitePanel created={created} guests={guests} />}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 2 — cast builder
// ════════════════════════════════════════════════════════════════════════════
function CastStep({ category, members, onAdd, onRemove, onContinue }: {
  category: RoomCategory
  members: WizMember[]
  onAdd: (m: WizMember) => void
  onRemove: (i: number) => void
  onContinue: () => void
}) {
  const [tab, setTab] = useState<"picks" | "invent">("picks")
  const adultOk = hasUnrestricted()

  // Every world has its OWN cast — native characters with locked voices.
  const roster = useMemo(
    () => castFor(category).filter((p) => !p.adult || adultOk),
    [category, adultOk]
  )

  // Invent form
  const [iName, setIName] = useState("")
  const [iGender, setIGender] = useState<Gender>("female")
  const [iPersonality, setIPersonality] = useState("")
  const [iRelation, setIRelation] = useState("")
  const [iVibes, setIVibes] = useState<string[]>([])

  const invent = () => {
    if (!iName.trim()) return
    const personality = [iPersonality.trim() || "easygoing, real", iVibes.join(", ")].filter(Boolean).join(". Vibe: ")
    onAdd({ name: iName.trim(), gender: iGender, personality, relation: iRelation.trim() || "member of the room" })
    setIName(""); setIPersonality(""); setIRelation(""); setIVibes([])
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-4xl font-black tracking-[-0.02em] mb-2">Build the cast.</h1>
      <p className="text-muted-foreground mb-6">Up to four characters. Pick from the roster or invent your own.</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([["picks", "Roster"], ["invent", "Invent your own"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`text-sm font-bold px-4 py-2 rounded-full border transition-all ${tab === id ? "border-amber-500/60 bg-amber-500/10 text-amber-400" : "border-border/50 text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "picks" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {roster.map((p) => {
            const picked = members.some((m) => m.name === p.name)
            const img = imageFor({ name: p.name })
            return (
              <button key={p.id} disabled={picked || members.length >= 4}
                onClick={() => onAdd({
                  name: p.name, gender: p.gender,
                  personality: p.personality, relation: p.tagline,
                  speakingStyle: p.speakingStyle, emoji: p.emoji,
                  voiceId: p.voiceId,
                  ...(p.adult ? { unrestricted: true } : {}),
                })}
                className={`text-left rounded-2xl border p-3 transition-all duration-200 ${picked ? "border-amber-500/60 bg-amber-500/10 opacity-60" : "border-border/50 bg-foreground/5 hover:bg-foreground/10 hover:scale-[1.02]"} disabled:cursor-not-allowed`}>
                <div className="w-full aspect-square rounded-xl bg-background/60 border border-border/40 overflow-hidden mb-2 flex items-center justify-center">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">{p.emoji}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-bold truncate">{p.name}</span>
                  {picked && <Check size={13} className="text-amber-400 shrink-0" />}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{p.tagline}</div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {p.vibe.slice(0, 2).map((v) => (
                    <span key={v} className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-border/40 text-muted-foreground/80">{v}</span>
                  ))}
                  {p.adult && <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300">18+</span>}
                </div>
              </button>
            )
          })}
          {roster.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground py-6 text-center">No presets fit this world yet — invent your own cast.</p>
          )}
        </div>
      )}

      {tab === "invent" && (
        <div className="rounded-3xl border border-border/50 bg-foreground/5 p-5 space-y-4">
          <input value={iName} onChange={(e) => setIName(e.target.value)} placeholder="Name"
            className="w-full bg-background/50 border border-border/50 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-amber-500/50 transition-all" />
          <div className="grid grid-cols-3 gap-1.5">
            {GENDERS.map((g) => (
              <button key={g.id} onClick={() => setIGender(g.id)}
                className={`text-xs font-semibold py-2.5 rounded-xl border transition-all ${iGender === g.id ? "border-amber-500/60 bg-amber-500/10 text-amber-400" : "border-border/50 text-muted-foreground hover:text-foreground"}`}>
                {g.label}
              </button>
            ))}
          </div>
          <textarea value={iPersonality} onChange={(e) => setIPersonality(e.target.value)} rows={2}
            placeholder="Who are they? Personality, edge, energy…"
            className="w-full bg-background/50 border border-border/50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 transition-all resize-none" />
          <div className="flex flex-wrap gap-1.5">
            {VIBE_TAGS.slice(0, 16).map((v) => {
              const on = iVibes.includes(v)
              return (
                <button key={v} onClick={() => setIVibes((vs) => on ? vs.filter((x) => x !== v) : vs.length < 3 ? [...vs, v] : vs)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${on ? "border-amber-500/60 bg-amber-500/10 text-amber-400 font-semibold" : "border-border/50 text-muted-foreground hover:text-foreground"}`}>
                  {v}
                </button>
              )
            })}
          </div>
          <input value={iRelation} onChange={(e) => setIRelation(e.target.value)}
            placeholder="Their place in the room — host, rival, your partner…"
            className="w-full bg-background/50 border border-border/50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 transition-all" />
          <button onClick={invent} disabled={!iName.trim() || members.length >= 4}
            className="w-full flex items-center justify-center gap-2 bg-foreground text-background font-bold py-3 rounded-xl hover:bg-foreground/90 transition-all disabled:opacity-40">
            <Plus size={15} /> Add to cast
          </button>
        </div>
      )}

      {/* Cast bar */}
      <div className="sticky bottom-4 mt-8 glass-strong rounded-3xl border border-border/50 p-4 flex items-center gap-3">
        <div className="flex -space-x-2 min-w-0">
          {members.length === 0 && <span className="text-xs text-muted-foreground px-1">No one yet — pick your cast</span>}
          {members.map((m, i) => {
            const img = imageFor({ name: m.name })
            return (
              <div key={`${m.name}-${i}`} className="relative group">
                <div className="w-11 h-11 rounded-full border-2 border-background bg-foreground/10 overflow-hidden flex items-center justify-center">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={m.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-black">{m.emoji ?? m.name[0]?.toUpperCase()}</span>
                  )}
                </div>
                <button onClick={() => onRemove(i)}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white items-center justify-center hidden group-hover:flex">
                  <X size={10} />
                </button>
              </div>
            )
          })}
        </div>
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <span className="text-xs font-bold text-muted-foreground">{members.length}/4</span>
          <button onClick={onContinue} disabled={members.length < 1}
            className="flex items-center gap-1.5 brand-gradient text-stone-950 font-black text-sm px-5 py-2.5 rounded-full brand-glow hover:scale-[1.03] active:scale-95 transition-transform disabled:opacity-40 disabled:hover:scale-100">
            Voices <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 3 — voices
// ════════════════════════════════════════════════════════════════════════════
function VoicesStep({ members, onPatch, onContinue }: {
  members: WizMember[]
  onPatch: (i: number, patch: Partial<WizMember>) => void
  onContinue: () => void
}) {
  const [openFor, setOpenFor] = useState<number | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const blobCache = useRef<Map<string, string>>(new Map())
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const preview = async (voiceId: string, memberName: string) => {
    try {
      setPreviewing(voiceId)
      audioRef.current?.pause()
      let url = blobCache.current.get(voiceId)
      if (!url) {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `Hey — I'm ${memberName}. This is how I sound.`, voiceId }),
        })
        if (!res.ok) throw new Error("tts failed")
        url = URL.createObjectURL(await res.blob())
        blobCache.current.set(voiceId, url)
      }
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => setPreviewing(null)
      await audio.play()
    } catch {
      setPreviewing(null)
    }
  }

  const effectiveVoiceId = (m: WizMember) =>
    m.voiceId || resolveVoiceId(m.name, m.gender) || ""

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-4xl font-black tracking-[-0.02em] mb-2">Give them voices.</h1>
      <p className="text-muted-foreground mb-8">Every character gets a real voice. Preview, swap, or clone one from YouTube.</p>

      <div className="space-y-3">
        {members.map((m, i) => {
          const vid = effectiveVoiceId(m)
          const label = voiceLabelFor(vid) ?? (m.voiceId ? "Custom clone" : "Auto")
          const img = imageFor({ name: m.name })
          return (
            <div key={`${m.name}-${i}`} className="rounded-3xl border border-border/50 bg-foreground/5 overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <div className="w-11 h-11 rounded-full bg-background/60 border border-border/40 overflow-hidden flex items-center justify-center shrink-0">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={m.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-black">{m.emoji ?? m.name[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold truncate">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Volume2 size={10} /> {label}
                  </div>
                </div>
                <button onClick={() => preview(vid, m.name)} disabled={!vid || previewing === vid}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all disabled:opacity-50">
                  {previewing === vid ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Preview
                </button>
                <button onClick={() => setOpenFor(openFor === i ? null : i)}
                  className={`text-xs font-bold px-3.5 py-2 rounded-full border transition-all ${openFor === i ? "border-amber-500/60 bg-amber-500/10 text-amber-400" : "border-border/50 text-muted-foreground hover:text-foreground"}`}>
                  {openFor === i ? "Close" : "Change"}
                </button>
              </div>

              {openFor === i && (
                <VoiceSheet
                  member={m}
                  currentId={vid}
                  previewing={previewing}
                  onPreview={(id) => preview(id, m.name)}
                  onPick={(id) => { onPatch(i, { voiceId: id }); }}
                />
              )}
            </div>
          )
        })}
      </div>

      <button onClick={onContinue}
        className="mt-8 w-full flex items-center justify-center gap-2 brand-gradient text-stone-950 font-black text-base py-4 rounded-2xl brand-glow hover:scale-[1.01] active:scale-[0.99] transition-transform">
        Almost there <ArrowRight size={16} />
      </button>
    </div>
  )
}

function VoiceSheet({ member, currentId, previewing, onPreview, onPick }: {
  member: WizMember
  currentId: string
  previewing: string | null
  onPreview: (id: string) => void
  onPick: (id: string) => void
}) {
  const [ytUrl, setYtUrl] = useState("")
  const [cloneState, setCloneState] = useState<"idle" | "working" | "done" | "error">("idle")
  const [cloneMsg, setCloneMsg] = useState("")

  const sorted = useMemo(() => {
    const mine = VOICE_CATALOG.filter((v) => v.gender === (member.gender === "male" ? "male" : "female"))
    const rest = VOICE_CATALOG.filter((v) => !mine.includes(v))
    return [...mine, ...rest]
  }, [member.gender])

  const clone = async () => {
    if (!ytUrl.trim()) return
    setCloneState("working")
    setCloneMsg("Pulling audio and training the voice — about 30 seconds…")
    try {
      const res = await fetch("/api/voice-clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ytUrl.trim(), name: member.name }),
      })
      const data = await res.json()
      if (!res.ok || !data.voiceId) {
        setCloneState("error"); setCloneMsg(data.error || "Clone failed — try another video."); return
      }
      onPick(data.voiceId)
      setCloneState("done"); setCloneMsg("Cloned. This character now speaks with that voice.")
      setYtUrl("")
    } catch {
      setCloneState("error"); setCloneMsg("Network error — try again.")
    }
  }

  return (
    <div className="border-t border-border/40 p-4 space-y-4 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
        {sorted.map((v) => {
          const active = currentId === v.id
          return (
            <div key={v.id}
              className={`rounded-2xl border p-3 transition-all ${active ? "border-amber-500/60 bg-amber-500/10" : "border-border/50 bg-background/40 hover:bg-foreground/5"}`}>
              <button onClick={() => onPick(v.id)} className="text-left w-full">
                <div className="text-sm font-bold flex items-center gap-1.5">
                  {v.label}
                  {active && <Check size={12} className="text-amber-400" />}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{v.vibe}</div>
              </button>
              <button onClick={() => onPreview(v.id)} disabled={previewing === v.id}
                className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                {previewing === v.id ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />} Hear it
              </button>
            </div>
          )
        })}
      </div>

      {/* YouTube clone */}
      <div className="rounded-2xl border border-dashed border-border/60 p-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          <Youtube size={13} className="text-rose-400" /> Clone any voice from YouTube
        </div>
        <div className="flex gap-2">
          <input value={ytUrl} onChange={(e) => { setYtUrl(e.target.value); setCloneState("idle"); setCloneMsg("") }}
            placeholder="https://youtube.com/watch?v=…" disabled={cloneState === "working"}
            className="flex-1 bg-background/50 border border-border/50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50 transition-all" />
          <button onClick={clone} disabled={cloneState === "working" || !ytUrl.trim()}
            className="flex items-center gap-1.5 text-xs font-bold px-4 rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all disabled:opacity-40">
            {cloneState === "working" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {cloneState === "working" ? "Cloning…" : "Clone"}
          </button>
        </div>
        {cloneMsg && (
          <p className={`text-[11px] mt-2 ${cloneState === "error" ? "text-rose-400" : cloneState === "done" ? "text-emerald-400" : "text-muted-foreground"}`}>
            {cloneMsg}
          </p>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// AFTERPARTY — room created, hand out the keys
// ════════════════════════════════════════════════════════════════════════════
function InvitePanel({ created, guests }: {
  created: { roomId: string; sessionId: string; published: boolean }
  guests: string[]
}) {
  const router = useRouter()
  const [copied, setCopied] = useState<string | null>(null)
  const room = getCustomRoom(created.roomId)

  if (!room) return null

  const mainLink = buildInviteUrl({ room, sessionId: created.sessionId })
  const worldLabel = CATEGORY_META[room.category]?.label ?? room.category

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 text-center pt-8">
      <div className="w-20 h-20 mx-auto rounded-full brand-gradient brand-glow flex items-center justify-center mb-6">
        <DoorOpen size={34} className="text-stone-950" />
      </div>
      <h1 className="text-4xl font-black tracking-[-0.02em] mb-2">{room.name} is live.</h1>
      <p className="text-muted-foreground mb-3">The room travels inside the link — anyone who opens it walks straight in.</p>
      {created.published && (
        <p className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-full mb-8">
          <Check size={12} /> Listed in {worldLabel} — anyone browsing can join
        </p>
      )}
      {!created.published && <span className="block mb-7" />}

      <div className="space-y-3 text-left max-w-xl mx-auto">
        <div className="flex items-center gap-2 glass rounded-2xl border border-border/50 p-3">
          <Link2 size={15} className="text-amber-400 shrink-0 ml-1" />
          <span className="text-xs text-muted-foreground truncate flex-1">{mainLink}</span>
          <button onClick={() => copy(mainLink, "main")}
            className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all shrink-0">
            {copied === "main" ? <Check size={12} /> : <Copy size={12} />} {copied === "main" ? "Copied" : "Copy link"}
          </button>
        </div>

        {guests.map((g) => {
          const link = buildInviteUrl({ room, sessionId: created.sessionId, guestName: g })
          return (
            <div key={g} className="flex items-center gap-2 rounded-2xl border border-border/40 bg-foreground/5 p-3">
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-foreground/10 shrink-0">{g}</span>
              <span className="text-[11px] text-muted-foreground truncate flex-1">{link}</span>
              <button onClick={() => copy(link, g)}
                className="flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full border border-border/50 text-muted-foreground hover:text-foreground transition-all shrink-0">
                {copied === g ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </div>
          )
        })}
      </div>

      <button onClick={() => router.push(`/app/rooms/${created.roomId}?session=${created.sessionId}`)}
        className="mt-10 w-full max-w-xl mx-auto block brand-gradient text-stone-950 font-black text-lg py-4 rounded-2xl brand-glow hover:scale-[1.01] active:scale-[0.99] transition-transform">
        Enter your room
      </button>
    </div>
  )
}
