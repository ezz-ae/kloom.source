"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSolCredits } from "@/hooks/use-sol-credits"
import { isSubscribed } from "@/lib/account"
import { accountMinutes, hydrateEntitlement } from "@/lib/auth"
import { TopUpSlider } from "@/components/widgets/TopUpSlider"
import { listCustomRooms, deleteCustomRoom } from "@/lib/custom-rooms"
import { ROOM_CATEGORY_LABELS, ROOM_CATEGORY_COLORS, type Room, type RoomCategory } from "@/lib/rooms"
import { getCharacter, saveCharacter, type UserCharacter } from "@/lib/character"
import { imageFor } from "@/lib/persona-utils"
import { isWellnessEnabled, setWellnessEnabled, clearWellnessData } from "@/lib/wellness"
import {
  Wallet, Plus, Trash2,
  HeartHandshake, Shield, User, Tag, X as XIcon, Check, Users as UsersIcon,
} from "lucide-react"

const VIBES: Array<{ id: UserCharacter["vibe"]; label: string; emoji: string }> = [
  { id: "chill", label: "Chill", emoji: "🌿" },
  { id: "playful", label: "Playful", emoji: "✨" },
  { id: "intense", label: "Intense", emoji: "🔥" },
  { id: "deep", label: "Deep", emoji: "🌊" },
]

const CATS = Object.keys(ROOM_CATEGORY_LABELS) as RoomCategory[]

function Section({ icon: Icon, title, sub, children }: { icon: typeof User; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border/50 rounded-3xl p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
          <Icon size={15} className="text-amber-400" />
        </div>
        <div>
          <h2 className="font-bold text-sm">{title}</h2>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export default function YouPage() {
  const router = useRouter()
  const { balance } = useSolCredits()
  const [accountMin, setAccountMin] = useState(0)
  const [topUpOpen, setTopUpOpen]   = useState(false)
  const [premium, setPremium]   = useState(false)
  const [rooms, setRooms]       = useState<Room[]>([])
  const [char, setChar]         = useState<UserCharacter>({ displayName: "", interests: [], vibe: "", preferredCategories: [] })
  const [tagInput, setTagInput] = useState("")
  const [saved, setSaved]       = useState(false)
  const [wellnessOn, setWellnessOn] = useState(true)
  const [erased, setErased]     = useState(false)

  useEffect(() => {
    setPremium(isSubscribed())
    setRooms(listCustomRooms())
    setChar(getCharacter())
    setWellnessOn(isWellnessEnabled())
    hydrateEntitlement().then(() => setAccountMin(accountMinutes()))
  }, [])

  const removeRoom = (id: string) => { deleteCustomRoom(id); setRooms(listCustomRooms()) }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !char.interests.includes(t)) setChar({ ...char, interests: [...char.interests, t] })
    setTagInput("")
  }
  const toggleCat = (c: RoomCategory) =>
    setChar((prev) => ({
      ...prev,
      preferredCategories: prev.preferredCategories.includes(c)
        ? prev.preferredCategories.filter((x) => x !== c)
        : [...prev.preferredCategories, c],
    }))
  const save = () => { saveCharacter(char); setSaved(true); setTimeout(() => setSaved(false), 1800) }

  const toggleWellness = () => {
    const next = !wellnessOn
    setWellnessOn(next); setWellnessEnabled(next); if (!next) setErased(false)
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border px-6 lg:px-8 py-5">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-black tracking-tight">You</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your billing, planets, and the character that tunes Abuseday to you.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-6 pb-28 lg:pb-10 space-y-5">

        {/* ── Voice minutes — the single balance, the single top-up ── */}
        <Section icon={Wallet} title="Voice minutes" sub="Pay-as-you-go. Top up or grab a pass.">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-3xl font-black">{premium ? "Unlimited" : <>{accountMin + balance}<span className="text-lg text-muted-foreground"> min</span></>}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{premium ? "Pass active" : "First 5 minutes free"}</div>
            </div>
            <button onClick={() => setTopUpOpen(true)}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm px-4 py-2.5 rounded-xl transition-all">
              <Plus size={15} /> Top up
            </button>
          </div>
        </Section>

        {/* ── My created rooms ── */}
        <Section icon={UsersIcon} title="My created rooms" sub={`${rooms.length} room${rooms.length === 1 ? "" : "s"} you built`}>
          {rooms.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">You haven't built a room yet.</p>
              <button onClick={() => router.push("/app/create")}
                className="mt-3 inline-flex items-center gap-1.5 bg-foreground text-background font-bold text-sm px-4 py-2 rounded-xl hover:bg-foreground/90 transition-all">
                <Plus size={15} /> Build a room
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {rooms.map((r) => (
                <div key={r.id} className="flex items-center gap-3 bg-foreground/5 border border-border/50 rounded-2xl px-3 py-2.5">
                  <button onClick={() => router.push(`/app/rooms/${r.id}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="flex -space-x-2 shrink-0">
                      {r.personas.slice(0, 3).map((p) => (
                        <img key={p.name} src={imageFor({ name: p.avatarSeed ?? p.name })}
                          alt={p.name} className="w-8 h-8 rounded-lg ring-2 ring-card bg-stone-800" />
                      ))}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{r.tagline}</div>
                    </div>
                  </button>
                  <span className={`hidden sm:inline text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${ROOM_CATEGORY_COLORS[r.category]}`}>{ROOM_CATEGORY_LABELS[r.category]}</span>
                  <button onClick={() => removeRoom(r.id)} className="text-muted-foreground/60 hover:text-red-400 shrink-0"><Trash2 size={15} /></button>
                </div>
              ))}
              <button onClick={() => router.push("/app/create")}
                className="w-full mt-1 flex items-center justify-center gap-1.5 border border-dashed border-border rounded-2xl py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">
                <Plus size={14} /> Build another room
              </button>
            </div>
          )}
        </Section>

        {/* ── Character setup ── */}
        <Section icon={User} title="Your character" sub="Tune what Abuseday surfaces. Planets get reordered to match.">
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Display name</label>
              <input value={char.displayName} onChange={(e) => setChar({ ...char, displayName: e.target.value })}
                placeholder="What should we call you?"
                className="mt-1.5 w-full bg-foreground/5 border border-border/50 rounded-xl px-3 py-2.5 text-sm focus:border-amber-400/50 focus:outline-none" />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Vibe</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {VIBES.map((v) => (
                  <button key={v.id} onClick={() => setChar({ ...char, vibe: char.vibe === v.id ? "" : v.id })}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${char.vibe === v.id ? "bg-amber-500 text-stone-950 border-transparent" : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"}`}>
                    {v.emoji} {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Interests</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {char.interests.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs font-medium bg-foreground/5 border border-border/50 px-2.5 py-1 rounded-full">
                    <Tag size={10} /> {t}
                    <button onClick={() => setChar({ ...char, interests: char.interests.filter((x) => x !== t) })} className="text-muted-foreground/60 hover:text-red-400"><XIcon size={11} /></button>
                  </span>
                ))}
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
                  placeholder="add interest + Enter"
                  className="bg-transparent text-xs placeholder-muted-foreground focus:outline-none px-1 py-1 min-w-[120px]" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Favorite room types</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {CATS.map((c) => (
                  <button key={c} onClick={() => toggleCat(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${char.preferredCategories.includes(c) ? "bg-foreground text-background border-transparent" : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"}`}>
                    {ROOM_CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={save}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm px-4 py-2.5 rounded-xl transition-all">
              {saved ? <><Check size={15} /> Saved</> : "Save character"}
            </button>
          </div>
        </Section>

        {/* ── Wellness & privacy ── */}
        <Section icon={HeartHandshake} title="Wellness & privacy" sub="A private, on-device mood read — to offer support, never to restrict.">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Reads the mood of your chats <span className="text-foreground/70">on your device</span>. Never uploaded or sold.
              </p>
              <button onClick={toggleWellness}
                className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${wellnessOn ? "bg-amber-500" : "bg-white/15"}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${wellnessOn ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>
            {wellnessOn && (
              <button onClick={() => { clearWellnessData(); setErased(true) }}
                className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-red-400 transition-colors">
                <Trash2 size={13} /> {erased ? "Wellness data erased" : "Erase my wellness data"}
              </button>
            )}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
              <Shield size={12} className="text-amber-400/70" /> Full privacy controls live in Settings.
            </div>
          </div>
        </Section>
      </div>

      {/* Top up — minutes + passes, all in one place */}
      {topUpOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5" onClick={() => setTopUpOpen(false)}>
          <div className="w-full max-w-md rounded-3xl border border-border/60 bg-background p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg">Top up</h3>
              <button onClick={() => setTopUpOpen(false)} className="text-muted-foreground hover:text-foreground"><XIcon size={18} /></button>
            </div>
            <TopUpSlider onDone={() => { setTopUpOpen(false); hydrateEntitlement().then(() => setAccountMin(accountMinutes())) }} />
          </div>
        </div>
      )}
    </div>
  )
}
