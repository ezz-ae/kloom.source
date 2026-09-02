"use client"

/**
 * YOU — a real screen, not a modal.
 *
 * Everything about the visitor used to live in a sheet that floated over the
 * floor: name, pass, balance, language, the talks you'd saved. A sheet is the
 * right shape for one decision and the wrong shape for a place you return to —
 * it has no back, no scroll position, and it makes the settings feel like an
 * interruption to the product rather than part of it.
 *
 * Built in the Kloom app's visual language (cards, glass, the active gradient)
 * on AIRRAW's palette, inside AirShell.
 */
import { useEffect, useState } from "react"
import { getProfile, setProfileName, rerollAvatar, type Profile } from "@/lib/airroom/profile"
import { getCredits, FREE_GRANT } from "@/lib/airroom/credits"
import { isPro, proUntil } from "@/lib/airroom/pro"
import { getFai, DAILY_EARN_CAP, PRO_EARN_CAP, earnedToday } from "@/lib/airraw/fai"
import { listTalks, forgetAll, forgetTalk, memoryEnabled, memoryOff, setMemoryOff, agoLabel, type SavedTalk } from "@/lib/airraw/memory"
import { getLangPrefs, saveLangPrefs, langPrefsPersist, type LangPrefs } from "@/lib/airraw/lang-prefs"
import { LANGUAGES } from "@/lib/languages"
import { VIBES } from "@/lib/airroom/roster"
import { getTaste, saveTaste, tasteIsSet, type Taste, type TasteGender } from "@/lib/airraw/taste"
import { Face } from "@/components/airroom/Face"

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">{title}</h2>
      {hint && <p className="mt-1 text-[11.5px] leading-snug text-white/35">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function YouPage({ onPass, onResume }: {
  onPass: () => void
  /** Reopen a saved conversation from where it stopped. */
  onResume?: (t: SavedTalk) => void
}) {
  const [p, setP] = useState<Profile | null>(null)
  const [name, setName] = useState("")
  const [fai, setFai] = useState(0)
  const [credits, setCredits] = useState(0)
  const [talks, setTalks] = useState<SavedTalk[]>([])
  const [prefs, setPrefs] = useState<LangPrefs>({ primary: "English", also: [] })
  const [off, setOff] = useState(false)
  const [alsoOpen, setAlsoOpen] = useState(false)
  const [pro, setPro] = useState(false)
  const [taste, setTaste] = useState<Taste>({ gender: "any", vibes: [] })

  // Everything here reads localStorage, so it has to wait for the client or the
  // server render and the first paint disagree (hydration).
  useEffect(() => {
    const prof = getProfile()
    setP(prof); setName(prof.name)
    setFai(getFai()); setCredits(getCredits())
    setTalks(listTalks()); setPrefs(getLangPrefs())
    setOff(memoryOff()); setPro(isPro())
    setTaste(getTaste())
  }, [])

  if (!p) return <div className="p-6 text-sm text-white/30">…</div>

  const until = proUntil()
  const untilStr = until ? new Date(until).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""
  const cap = pro ? PRO_EARN_CAP : DAILY_EARN_CAP
  const left = Math.max(0, cap - earnedToday())
  const avatarBg = `radial-gradient(120% 120% at 30% 25%, hsl(${p.hue},78%,64%), hsl(${(p.hue + 40) % 360},70%,40%))`

  const setPrimary = (v: string) => {
    const next: LangPrefs = { primary: v, also: prefs.also.filter((x) => x !== v) }
    setPrefs(next); saveLangPrefs(next)
  }
  const toggleAlso = (v: string) => {
    if (v === prefs.primary) return
    const also = prefs.also.includes(v) ? prefs.also.filter((x) => x !== v) : [...prefs.also, v]
    const next: LangPrefs = { primary: prefs.primary, also }
    setPrefs(next); saveLangPrefs(next)
  }

  // Taste writes through on every tap: there is no Save button, because a filter
  // you have to confirm is a filter people abandon half-set.
  const putTaste = (next: Taste) => { setTaste(next); saveTaste(next) }
  const setGender = (g: TasteGender) => putTaste({ ...taste, gender: taste.gender === g ? "any" : g })
  const toggleVibe = (k: string) =>
    putTaste({ ...taste, vibes: taste.vibes.includes(k) ? taste.vibes.filter((x) => x !== k) : [...taste.vibes, k] })

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      {/* ── who you are ── */}
      <div className="flex items-center gap-4 py-5">
        <button
          onClick={() => { const np = rerollAvatar(); setP({ ...np }) }}
          aria-label="reshuffle your avatar"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl text-white/95 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105"
          style={{ background: avatarBg, boxShadow: `0 12px 34px -10px hsla(${p.hue},80%,55%,.7)` }}
        >
          {p.glyph}
        </button>
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { const np = setProfileName(name); setP({ ...np }); setName(np.name) }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
            maxLength={24}
            aria-label="your name on the floor"
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-lg font-semibold text-white outline-none focus:border-fuchsia-400/40"
          />
          <div className="mt-1.5 text-[11px] text-white/35">
            {pro ? `✦ pass active${untilStr ? ` · until ${untilStr}` : ""}` : "free · tap the avatar to reshuffle"}
          </div>
        </div>
      </div>

      <div className="space-y-3 pb-8">
        {/* ── who you want to meet ──
            The one control that changes what the front door actually shows.
            Subtractive and empty by default (see lib/airraw/taste.ts), so this
            card reads as "narrow it down", never as a form to fill in first. */}
        <Card
          title="Who you want to meet"
          hint={tasteIsSet(taste)
            ? "the floor is filtered to this. tap again to unset."
            : "everyone, for now. pick anything to narrow the floor."}
        >
          <div className="flex gap-1.5">
            {([["any", "anyone"], ["female", "women"], ["male", "men"]] as Array<[TasteGender, string]>).map(([g, label]) => {
              const on = taste.gender === g
              return (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  aria-pressed={on}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    on ? "brand-gradient text-[#1a0a1f]" : "border border-white/12 bg-white/[0.05] text-white/55 hover:text-white/80"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {VIBES.map((v) => {
              const on = taste.vibes.includes(v.key)
              return (
                <button
                  key={v.key}
                  onClick={() => toggleVibe(v.key)}
                  aria-pressed={on}
                  className={`rounded-full px-2.5 py-1.5 text-[11.5px] transition ${
                    on ? "bg-fuchsia-400/90 text-[#1a0a1f]" : "border border-white/12 bg-white/[0.05] text-white/55 hover:text-white/80"
                  }`}
                >
                  {v.label}
                </button>
              )
            })}
          </div>

          {tasteIsSet(taste) && (
            <button
              onClick={() => putTaste({ gender: "any", vibes: [] })}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-[11.5px] font-semibold text-white/45 transition hover:text-white/75"
            >
              Show me everyone again
            </button>
          )}
        </Card>

        {/* ── FAI ── */}
        <Card title="Your FAI" hint="a seat in a talk costs one. it cannot be bought — you earn one every time you finish a talk.">
          <div className="flex items-end gap-3">
            <span className="brand-text text-3xl font-bold leading-none tabular-nums">{fai}</span>
            <span className="pb-1 text-xs text-white/40">
              {left > 0 ? `${left} more to find today` : "that's all of today's"}
            </span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="brand-gradient h-full transition-[width] duration-500" style={{ width: `${Math.round(100 * (1 - left / cap))}%` }} />
          </div>
        </Card>

        {/* ── the pass ── */}
        <Card title="Voice minutes" hint={pro ? "the pass covers your minutes." : "what's left of your free minutes on the floor."}>
          <div className="flex items-center justify-between gap-4">
            <span className="text-2xl font-bold tabular-nums text-white">{pro ? "∞" : credits}</span>
            {!pro && (
              <button onClick={onPass} className="brand-gradient brand-glow rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[#1a0a1f] transition-transform hover:scale-[1.02]">
                Get a pass
              </button>
            )}
          </div>
          {!pro && (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="brand-gradient h-full" style={{ width: `${Math.round(100 * Math.max(0, Math.min(1, credits / FREE_GRANT)))}%` }} />
            </div>
          )}
        </Card>

        {/* ── language ── */}
        <Card title="You speak" hint={langPrefsPersist() ? "saved as your default between visits." : "kept for this visit. a pass makes it stick."}>
          <select
            value={prefs.primary}
            onChange={(e) => setPrimary(e.target.value)}
            aria-label="your language"
            className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-400/40"
          >
            {LANGUAGES.map((l) => <option key={l.name} value={l.name} className="text-black">{l.name}</option>)}
          </select>
          <button
            onClick={() => setAlsoOpen((o) => !o)}
            aria-expanded={alsoOpen}
            className={`mt-2 w-full rounded-full px-4 py-2 text-xs font-semibold transition ${
              prefs.also.length ? "bg-emerald-400/90 text-[#06121e]" : "border border-white/12 bg-white/[0.05] text-white/55 hover:text-white/80"
            }`}
          >
            {prefs.also.length ? `also ${prefs.also.join(", ")}` : "+ another language"}
          </button>
          {alsoOpen && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {LANGUAGES.filter((l) => l.name !== prefs.primary).map((l) => {
                const on = prefs.also.includes(l.name)
                return (
                  <button
                    key={l.name}
                    onClick={() => toggleAlso(l.name)}
                    aria-pressed={on}
                    className={`rounded-full px-2.5 py-1.5 text-[11.5px] transition ${
                      on ? "bg-emerald-400/90 text-[#06121e]" : "border border-white/12 bg-white/[0.05] text-white/55 hover:text-white/80"
                    }`}
                  >
                    {l.name}
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        {/* ── memory ── */}
        <Card
          title="Conversations"
          hint={memoryEnabled()
            ? "kept on this device only, so you can pick one back up. nothing leaves your browser."
            : "a free session keeps nothing — nothing is stored, on this device or anywhere else."}
        >
          {memoryEnabled() ? (
            <>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                <span className="text-sm text-white/70">Remember my conversations</span>
                <input
                  type="checkbox"
                  checked={!off}
                  onChange={(e) => { const v = !e.target.checked; setMemoryOff(v); setOff(v); setTalks(listTalks()) }}
                  className="h-4 w-4 accent-fuchsia-400"
                />
              </label>
              {talks.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {talks.slice(0, 8).map((t) => (
                    <li key={t.key} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2">
                      <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#160f24]">
                        <Face persona={{ name: t.cluster.host, gender: t.cluster.gender }} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      </span>
                      <button onClick={() => onResume?.(t)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-medium text-white/85">{t.cluster.host}</span>
                        <span className="block truncate text-[11px] text-white/35">{agoLabel(t.at)}</span>
                      </button>
                      <button
                        onClick={() => { forgetTalk(t.key); setTalks(listTalks()) }}
                        aria-label={`forget your conversation with ${t.cluster.host}`}
                        className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-white/30 hover:bg-white/5 hover:text-rose-300"
                      >
                        forget
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {talks.length > 0 && (
                <button
                  onClick={() => { forgetAll(); setTalks(listTalks()) }}
                  className="mt-3 w-full rounded-xl border border-rose-400/25 bg-rose-500/[0.08] px-4 py-2.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/15"
                >
                  Forget everything
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-white/45">Nothing to erase — nothing was kept.</p>
          )}
        </Card>

        <div className="flex flex-wrap justify-center gap-5 pt-2 text-[11px] text-white/25">
          <a href="/legal/terms" className="hover:text-white/50">Terms</a>
          <a href="/legal/privacy" className="hover:text-white/50">Privacy</a>
          <a href="/legal/cookies" className="hover:text-white/50">Cookies</a>
          <a href="/legal/payments" className="hover:text-white/50">Payments</a>
        </div>
      </div>
    </div>
  )
}
