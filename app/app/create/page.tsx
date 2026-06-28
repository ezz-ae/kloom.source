"use client"

/**
 * Create a room — intent-first.
 *   ① Describe it → the architect proposes 3 directions
 *   ② Pick one → it builds a recommended cast (slider) + Kloomer card
 *   ③ Voices  ④ Name & invite
 * Professional, restrained surface — a platform, not a toy. Produces a standard
 * Room via createCustomRoom and a portable invite link.
 */
import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createCustomRoom, getCustomRoom, type BuilderMember, type Gender } from "@/lib/custom-rooms"
import { publishRoom } from "@/lib/rooms-db"
import { CATEGORY_META } from "@/lib/category-meta"
import { buildInviteUrl, FUN_ORIGIN } from "@/lib/room-share"
import { isIo } from "@/lib/variant"
import { makeSessionId } from "@/lib/room-session"
import { VOICE_CATALOG, resolveVoiceId, voiceLabelFor } from "@/lib/voices"
import { imageFor } from "@/lib/persona-utils"
import type { RoomCategory } from "@/lib/rooms"
import {
  Plus, X, Lock, ChevronLeft, Check, Copy, Link2, Loader2,
  Play, Youtube, Sparkles, ArrowRight, Volume2, DoorOpen, ArrowUpRight,
} from "lucide-react"

type WizMember = BuilderMember & { emoji?: string }
type Phase = "intent" | "build" | "voices" | "invite"

interface Suggestion { title: string; angle: string; category: RoomCategory }
interface CastCandidate { name: string; gender: Gender; role: string; personality: string; tagline: string; voiceId?: string }

export default function CreateRoomPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("intent")

  // Intent
  const [idea, setIdea] = useState("")
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [chosen, setChosen] = useState<Suggestion | null>(null)

  // Build
  const [roster, setRoster] = useState<CastCandidate[]>([])
  const [loadingCast, setLoadingCast] = useState(false)
  const [members, setMembers] = useState<WizMember[]>([])

  // Invite
  const [name, setName] = useState("")
  const [guests, setGuests] = useState<string[]>([])
  const [guestDraft, setGuestDraft] = useState("")
  const [publish, setPublish] = useState(true)
  const [created, setCreated] = useState<{ roomId: string; sessionId: string; published: boolean; fun: boolean } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const category = chosen?.category ?? null
  const meta = category ? CATEGORY_META[category] : null
  // An adult room described on .io isn't refused — it's built and handed off to
  // Abuseday.fun, so the user never gets a "no" and no sexual room shows on .io.
  const funMode = !!meta?.adult && isIo()

  // ── Intent → 3 directions ──
  const propose = async () => {
    if (!idea.trim()) return
    setSuggesting(true); setSuggestions([])
    try {
      const res = await fetch("/api/room-architect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "suggest", text: idea.trim() }),
      })
      const data = await res.json()
      // Keep adult directions too — on .io they're built and handed off to
      // Abuseday.fun rather than refused, so the user never hits a "no".
      setSuggestions(data.suggestions ?? [])
    } catch { setSuggestions([]) }
    finally { setSuggesting(false) }
  }

  // ── Pick a direction → architect the cast ──
  const choose = async (s: Suggestion) => {
    setChosen(s)
    setName(s.title)
    setPhase("build")
    setLoadingCast(true); setRoster([])
    try {
      const res = await fetch("/api/room-architect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "cast", text: s.angle || idea, title: s.title, category: s.category }),
      })
      const data = await res.json()
      setRoster(data.cast ?? [])
    } catch { setRoster([]) }
    finally { setLoadingCast(false) }
  }

  const addMember = (m: WizMember) =>
    setMembers((prev) => (prev.length >= 4 || prev.some((x) => x.name === m.name) ? prev : [...prev, m]))
  const removeMember = (idx: number) => setMembers((prev) => prev.filter((_, i) => i !== idx))
  const patchMember = (idx: number, patch: Partial<WizMember>) =>
    setMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)))

  const create = async () => {
    setErr(null)
    if (!category) return
    if (!name.trim()) { setErr("Give the planet a name."); return }
    if (members.length < 1) { setErr("Add at least one character."); return }
    const roomId = createCustomRoom({
      name: name.trim(), topic: chosen?.angle?.trim() || idea.trim(), category,
      members: members.map(({ emoji: _e, ...m }) => ({ ...m, name: m.name.trim() })),
    })
    // Adult rooms always go to the shared directory so they surface on Abuseday.fun
    // (and never on .io). Otherwise honor the user's publish toggle.
    let published = false
    if (publish || funMode) {
      const room = getCustomRoom(roomId)
      if (room) published = await publishRoom(room)
    }
    setCreated({ roomId, sessionId: makeSessionId(), published, fun: funMode })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-5 py-6 lg:py-12 pb-32">

        {/* Top bar */}
        {!created && (
          <div className="flex items-center justify-between mb-12">
            <button
              onClick={() => {
                if (phase === "intent") router.push("/app")
                else if (phase === "build") setPhase("intent")
                else if (phase === "voices") setPhase("build")
                else setPhase("voices")
              }}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors">
              <ChevronLeft size={16} /> {phase === "intent" ? "Home" : "Back"}
            </button>
            <div className="flex items-center gap-1.5">
              {(["intent", "build", "voices", "invite"] as Phase[]).map((p) => (
                <span key={p} className={`h-1 rounded-full transition-all ${phase === p ? "w-6 bg-foreground" : "w-1.5 bg-foreground/20"}`} />
              ))}
            </div>
          </div>
        )}

        {/* ── INTENT ────────────────────────────────────────────────── */}
        {phase === "intent" && !created && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] mb-2">What&apos;s your planet about?</h1>
            <p className="text-muted-foreground mb-7">A topic, an idea, a vibe — anything. We&apos;ll shape it into a planet.</p>

            <div className="rounded-2xl border border-border/60 bg-foreground/[0.03] focus-within:border-foreground/30 transition-colors p-1.5">
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) propose() }}
                rows={3}
                placeholder="e.g. pressure-test our SaaS launch with a skeptical investor — or a late-night philosophy debate — or practice a job interview…"
                className="w-full bg-transparent resize-none px-3.5 py-3 text-[15px] leading-relaxed focus:outline-none placeholder:text-muted-foreground/50"
              />
              <div className="flex items-center justify-between px-2 pb-1">
                <span className="text-[11px] text-muted-foreground/50">⌘↵ to continue</span>
                <button onClick={propose} disabled={!idea.trim() || suggesting}
                  className="flex items-center gap-1.5 bg-foreground text-background font-semibold text-sm px-4 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                  {suggesting ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
                  Publish a planet
                </button>
              </div>
            </div>

            {suggestions.length > 0 && (
              <div className="mt-8 space-y-2.5 animate-in fade-in duration-500">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Three directions</div>
                {suggestions.map((s, i) => {
                  const m = CATEGORY_META[s.category]
                  const toFun = !!m?.adult && isIo()
                  return (
                    <button key={i} onClick={() => choose(s)}
                      className="w-full text-left rounded-2xl border border-border/60 bg-foreground/[0.02] hover:bg-foreground/[0.05] hover:border-foreground/25 p-4 transition-all group">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold">{s.title}</span>
                            <span className={`text-[10px] font-medium uppercase tracking-wider rounded-full px-1.5 py-0.5 border ${toFun ? "text-amber-300/90 border-amber-500/30 bg-amber-500/10" : "text-muted-foreground/70 border-border/50"}`}>
                              {toFun ? "Abuseday.fun" : (m?.label ?? s.category)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 leading-snug">{s.angle}</p>
                        </div>
                        <ArrowRight size={16} className="text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    </button>
                  )
                })}
                <p className="text-xs text-muted-foreground/60 pt-1">Not quite? Edit your idea above and publish again.</p>
              </div>
            )}
          </div>
        )}

        {/* ── BUILD (cast) ──────────────────────────────────────────── */}
        {phase === "build" && chosen && !created && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              {funMode ? "Opens on Abuseday.fun" : (meta?.label ?? chosen.category)}
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.02em] mb-1">{chosen.title}</h1>
            <p className="text-muted-foreground mb-5">{chosen.angle}</p>

            {funMode && (
              <div className="mb-6 rounded-2xl border border-border/60 bg-foreground/[0.03] p-4 flex items-start gap-3">
                <ArrowUpRight size={16} className="text-foreground/70 shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  This one runs with no limits — so it opens on <span className="text-foreground font-medium">Abuseday.fun</span>.
                  Build it here; you&apos;ll get a Abuseday.fun link at the end. No signup, no memory there.
                </p>
              </div>
            )}

            {false ? null : (
              <>
                {/* Recommended cast — a slider to pick from */}
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-sm font-semibold">Recommended cast</span>
                  <span className="text-xs text-muted-foreground">{members.length}/4 chosen</span>
                </div>

                {loadingCast ? (
                  <div className="flex gap-3 overflow-hidden">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="shrink-0 w-40 h-52 rounded-2xl border border-border/40 bg-foreground/[0.03] animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide snap-x">
                    {roster.map((c) => {
                      const picked = members.some((m) => m.name === c.name)
                      const img = imageFor({ name: c.name })
                      return (
                        <button key={c.name} disabled={picked || members.length >= 4}
                          onClick={() => addMember({ name: c.name, gender: c.gender, personality: c.personality, relation: c.role, voiceId: c.voiceId })}
                          className={`snap-start shrink-0 w-40 text-left rounded-2xl border p-3 transition-all ${picked ? "border-foreground/40 bg-foreground/[0.06] opacity-60" : "border-border/50 bg-foreground/[0.02] hover:border-foreground/25 hover:bg-foreground/[0.05]"} disabled:cursor-default`}>
                          <div className="w-full aspect-square rounded-xl bg-background/60 border border-border/30 overflow-hidden mb-2.5 flex items-center justify-center">
                            {img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img} alt={c.name} className="w-full h-full object-cover" />
                            ) : <span className="text-2xl font-semibold">{c.name[0]}</span>}
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-sm font-semibold truncate">{c.name}</span>
                            {picked && <Check size={13} className="text-foreground shrink-0" />}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">{c.role}</div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Kloomer card — bring anyone in */}
                <KloomerCard onAdd={addMember} world={category ?? ""} disabled={members.length >= 4}
                  onPhoto={(n, u) => setMembers((prev) => prev.map((m) => (m.name === n ? { ...m, photoUrl: u } : m)))} />

                {/* Cast bar */}
                <div className="sticky bottom-4 mt-8 rounded-2xl border border-border/60 bg-background/80 backdrop-blur-md p-3.5 flex items-center gap-3">
                  <div className="flex -space-x-2 min-w-0">
                    {members.length === 0 && <span className="text-xs text-muted-foreground px-1">Pick at least one character</span>}
                    {members.map((m, i) => {
                      const img = imageFor({ name: m.name, photoUrl: m.photoUrl })
                      return (
                        <div key={`${m.name}-${i}`} className="relative group">
                          <div className="w-10 h-10 rounded-full border-2 border-background bg-foreground/10 overflow-hidden flex items-center justify-center">
                            {img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img} alt={m.name} className="w-full h-full object-cover" />
                            ) : <span className="text-xs font-semibold">{m.name[0]}</span>}
                          </div>
                          <button onClick={() => removeMember(i)}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-foreground text-background items-center justify-center hidden group-hover:flex">
                            <X size={9} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <button onClick={() => setPhase("voices")} disabled={members.length < 1}
                    className="ml-auto flex items-center gap-1.5 bg-foreground text-background font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0">
                    Voices <ArrowRight size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── VOICES ────────────────────────────────────────────────── */}
        {phase === "voices" && !created && (
          <VoicesStep members={members} onPatch={patchMember} onContinue={() => setPhase("invite")} />
        )}

        {/* ── INVITE ────────────────────────────────────────────────── */}
        {phase === "invite" && chosen && meta && !created && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h1 className="text-3xl font-semibold tracking-[-0.02em] mb-1">Name it.</h1>
            <p className="text-muted-foreground mb-7">Last step — then the doors open.</p>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Room name</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full bg-foreground/[0.03] border border-border/60 rounded-xl px-4 py-3 text-[15px] font-medium focus:outline-none focus:border-foreground/30 transition-colors" />
              </div>

              {funMode ? (
                <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-foreground/[0.03] p-3.5">
                  <ArrowUpRight size={16} className="text-foreground/70 shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    This planet opens on <span className="text-foreground font-medium">Abuseday.fun</span> — you&apos;ll get the link next. It won&apos;t appear anywhere on the main site.
                  </span>
                </div>
              ) : (
                <label className="flex items-center gap-3 cursor-pointer">
                  <button type="button" onClick={() => setPublish((p) => !p)}
                    className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${publish ? "bg-foreground" : "bg-foreground/15"}`}>
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-background transition-transform ${publish ? "translate-x-5" : "translate-x-1"}`} />
                  </button>
                  <span className="text-sm">
                    <span className="font-medium">List in {meta.label}</span>
                    <span className="text-muted-foreground"> — anyone browsing can join. Off = invite-link only.</span>
                  </span>
                </label>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Invite people <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
                <div className="mt-2 flex gap-2">
                  <input value={guestDraft} onChange={(e) => setGuestDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && guestDraft.trim() && guests.length < 5) { setGuests((g) => [...g, guestDraft.trim()]); setGuestDraft("") } }}
                    placeholder="Guest name"
                    className="flex-1 bg-foreground/[0.03] border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-foreground/30 transition-colors" />
                  <button onClick={() => { if (guestDraft.trim() && guests.length < 5) { setGuests((g) => [...g, guestDraft.trim()]); setGuestDraft("") } }}
                    className="px-4 rounded-xl border border-border/60 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"><Plus size={16} /></button>
                </div>
                {guests.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {guests.map((g, i) => (
                      <span key={`${g}-${i}`} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-foreground/[0.06] border border-border/50">
                        {g}<button onClick={() => setGuests((gs) => gs.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground"><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {err && <p className="mt-5 text-sm text-rose-400">{err}</p>}

            <button onClick={create}
              className="mt-8 w-full bg-foreground text-background font-semibold text-base py-3.5 rounded-xl hover:opacity-90 transition-opacity">
              Create the planet
            </button>
          </div>
        )}

        {created && <InvitePanel created={created} guests={guests} />}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Kloomer — bring anyone in from a name, a description, or a link
// ════════════════════════════════════════════════════════════════════════════
function KloomerCard({ onAdd, onPhoto, world, disabled }: {
  onAdd: (m: WizMember) => void
  onPhoto: (name: string, url: string) => void
  world: string
  disabled: boolean
}) {
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const kloom = async () => {
    if (!input.trim() || disabled) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch("/api/kloomer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      })
      const c = await res.json()
      if (!res.ok || !c.name) { setMsg({ text: c.error || "Couldn't build that — try again.", ok: false }); return }
      onAdd({ name: c.name, gender: c.gender, personality: c.personality, speakingStyle: c.speakingStyle, relation: c.relation || c.tagline || "member of the planet", voiceId: c.voiceId })
      setMsg({ text: c.voiceCloned ? `${c.name} added — generating photo…` : `${c.name} added — generating photo…`, ok: true })
      setInput("")
      // Generate a real portrait on demand and patch it onto the character.
      fetch("/api/character-photo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: c.name, gender: c.gender, world, description: c.personality }),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((p) => {
          if (p?.url) { onPhoto(c.name, p.url); setMsg({ text: `${c.name} added — photo ready.`, ok: true }) }
          else setMsg({ text: `${c.name} added.`, ok: true })
        })
        .catch(() => setMsg({ text: `${c.name} added.`, ok: true }))
    } catch { setMsg({ text: "Network error — try again.", ok: false }) }
    finally { setBusy(false) }
  }

  return (
    <div className="mt-4 rounded-2xl border border-dashed border-border/60 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={14} className="text-foreground/70" />
        <span className="text-sm font-semibold">Beam in</span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">Bring anyone onto the planet</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">A name, a description, or a link (YouTube also clones the voice).</p>
      <div className="flex gap-2">
        <input value={input} onChange={(e) => { setInput(e.target.value); setMsg(null) }}
          onKeyDown={(e) => { if (e.key === "Enter") kloom() }}
          placeholder="e.g. a ruthless VC · Cleopatra · a video link…"
          disabled={busy}
          className="flex-1 bg-foreground/[0.03] border border-border/60 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-foreground/30 transition-colors" />
        <button onClick={kloom} disabled={busy || !input.trim() || disabled}
          className="flex items-center gap-1.5 bg-foreground text-background font-semibold text-sm px-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {busy ? "Building…" : "Beam in"}
        </button>
      </div>
      {msg && <p className={`text-xs mt-2 ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>{msg.text}</p>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// VOICES
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
          method: "POST", headers: { "Content-Type": "application/json" },
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
    } catch { setPreviewing(null) }
  }

  const effectiveVoiceId = (m: WizMember) => m.voiceId || resolveVoiceId(m.name, m.gender) || ""

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <h1 className="text-3xl font-semibold tracking-[-0.02em] mb-1">Give them voices.</h1>
      <p className="text-muted-foreground mb-7">Every character gets a real voice. Preview, swap, or clone one.</p>

      <div className="space-y-2.5">
        {members.map((m, i) => {
          const vid = effectiveVoiceId(m)
          const label = voiceLabelFor(vid) ?? (m.voiceId ? "Custom clone" : "Auto")
          const img = imageFor({ name: m.name, photoUrl: m.photoUrl })
          return (
            <div key={`${m.name}-${i}`} className="rounded-2xl border border-border/60 bg-foreground/[0.02] overflow-hidden">
              <div className="flex items-center gap-3 p-3.5">
                <div className="w-10 h-10 rounded-full bg-background/60 border border-border/30 overflow-hidden flex items-center justify-center shrink-0">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={m.name} className="w-full h-full object-cover" />
                  ) : <span className="text-sm font-semibold">{m.name[0]?.toUpperCase()}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Volume2 size={10} /> {label}</div>
                </div>
                <button onClick={() => preview(vid, m.name)} disabled={!vid || previewing === vid}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all disabled:opacity-50">
                  {previewing === vid ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Preview
                </button>
                <button onClick={() => setOpenFor(openFor === i ? null : i)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${openFor === i ? "border-foreground/40 bg-foreground/10" : "border-border/50 text-muted-foreground hover:text-foreground"}`}>
                  {openFor === i ? "Close" : "Change"}
                </button>
              </div>
              {openFor === i && (
                <VoiceSheet member={m} currentId={vid} previewing={previewing}
                  onPreview={(id) => preview(id, m.name)} onPick={(id) => onPatch(i, { voiceId: id })} />
              )}
            </div>
          )
        })}
      </div>

      <button onClick={onContinue}
        className="mt-8 w-full flex items-center justify-center gap-2 bg-foreground text-background font-semibold text-base py-3.5 rounded-xl hover:opacity-90 transition-opacity">
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
    setCloneState("working"); setCloneMsg("Pulling audio and training the voice — about 30 seconds…")
    try {
      const res = await fetch("/api/voice-clone", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ytUrl.trim(), name: member.name }),
      })
      const data = await res.json()
      if (!res.ok || !data.voiceId) { setCloneState("error"); setCloneMsg(data.error || "Clone failed — try another video."); return }
      onPick(data.voiceId)
      setCloneState("done"); setCloneMsg("Cloned. This character now speaks with that voice.")
      setYtUrl("")
    } catch { setCloneState("error"); setCloneMsg("Network error — try again.") }
  }

  return (
    <div className="border-t border-border/40 p-4 space-y-4 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
        {sorted.map((v) => {
          const active = currentId === v.id
          return (
            <div key={v.id} className={`rounded-xl border p-3 transition-all ${active ? "border-foreground/40 bg-foreground/10" : "border-border/50 bg-background/40 hover:bg-foreground/5"}`}>
              <button onClick={() => onPick(v.id)} className="text-left w-full">
                <div className="text-sm font-semibold flex items-center gap-1.5">{v.label}{active && <Check size={12} />}</div>
                <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{v.vibe}</div>
              </button>
              <button onClick={() => onPreview(v.id)} disabled={previewing === v.id}
                className="mt-2 flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                {previewing === v.id ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />} Hear it
              </button>
            </div>
          )
        })}
      </div>
      <div className="rounded-xl border border-dashed border-border/60 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          <Youtube size={13} /> Clone a voice from a link
        </div>
        <div className="flex gap-2">
          <input value={ytUrl} onChange={(e) => { setYtUrl(e.target.value); setCloneState("idle"); setCloneMsg("") }}
            placeholder="https://youtube.com/watch?v=…" disabled={cloneState === "working"}
            className="flex-1 bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-foreground/30 transition-all" />
          <button onClick={clone} disabled={cloneState === "working" || !ytUrl.trim()}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 rounded-lg bg-foreground text-background hover:opacity-90 transition-all disabled:opacity-40">
            {cloneState === "working" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {cloneState === "working" ? "Cloning…" : "Clone"}
          </button>
        </div>
        {cloneMsg && <p className={`text-[11px] mt-2 ${cloneState === "error" ? "text-rose-400" : cloneState === "done" ? "text-emerald-400" : "text-muted-foreground"}`}>{cloneMsg}</p>}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// AFTERPARTY
// ════════════════════════════════════════════════════════════════════════════
function InvitePanel({ created, guests }: {
  created: { roomId: string; sessionId: string; published: boolean; fun: boolean }
  guests: string[]
}) {
  const router = useRouter()
  const [copied, setCopied] = useState<string | null>(null)
  const room = getCustomRoom(created.roomId)
  if (!room) return null

  // Adult rooms built on .io live on Abuseday.fun — every link + the Enter button
  // point there.
  const origin = created.fun ? FUN_ORIGIN : undefined
  const mainLink = buildInviteUrl({ room, sessionId: created.sessionId, origin })
  const worldLabel = CATEGORY_META[room.category]?.label ?? room.category

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000) } catch { /* noop */ }
  }

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 text-center pt-10">
      <div className="w-16 h-16 mx-auto rounded-2xl border border-border/60 bg-foreground/[0.04] flex items-center justify-center mb-6">
        <DoorOpen size={28} className="text-foreground" />
      </div>
      <h1 className="text-3xl font-semibold tracking-[-0.02em] mb-2">{room.name} is ready.</h1>
      <p className="text-muted-foreground mb-3">
        {created.fun
          ? "Built — and waiting on Abuseday.fun. The planet travels inside the link."
          : "The planet travels inside the link — anyone who opens it lands straight on it."}
      </p>
      {created.fun ? (
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-full mb-8">
          <ArrowUpRight size={12} /> Opens on Abuseday.fun
        </p>
      ) : created.published ? (
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-full mb-8">
          <Check size={12} /> Listed in {worldLabel}
        </p>
      ) : (
        <span className="block mb-7" />
      )}

      <div className="space-y-2.5 text-left max-w-xl mx-auto">
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-foreground/[0.03] p-3">
          <Link2 size={15} className="text-muted-foreground shrink-0 ml-1" />
          <span className="text-xs text-muted-foreground truncate flex-1">{mainLink}</span>
          <button onClick={() => copy(mainLink, "main")}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity shrink-0">
            {copied === "main" ? <Check size={12} /> : <Copy size={12} />} {copied === "main" ? "Copied" : "Copy link"}
          </button>
        </div>
        {guests.map((g) => {
          const link = buildInviteUrl({ room, sessionId: created.sessionId, guestName: g, origin })
          return (
            <div key={g} className="flex items-center gap-2 rounded-xl border border-border/40 bg-foreground/[0.02] p-3">
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-foreground/[0.06] shrink-0">{g}</span>
              <span className="text-[11px] text-muted-foreground truncate flex-1">{link}</span>
              <button onClick={() => copy(link, g)} className="flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground transition-all shrink-0">
                {copied === g ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </div>
          )
        })}
      </div>

      <button onClick={() => { created.fun ? (window.location.href = mainLink) : router.push(`/app/rooms/${created.roomId}?session=${created.sessionId}`) }}
        className="mt-10 w-full max-w-xl mx-auto flex items-center justify-center gap-2 bg-foreground text-background font-semibold text-base py-3.5 rounded-xl hover:opacity-90 transition-opacity">
        {created.fun ? <>Open on Abuseday.fun <ArrowUpRight size={16} /></> : "Land on your planet"}
      </button>
    </div>
  )
}
