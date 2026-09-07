"use client"

/**
 * THE AIRRAW SHELL — a sidebar on desktop, a glass dock on mobile.
 *
 * Kloom's app shell is the best-built surface in this repo and the adult side
 * had nothing like it: every screen was a full-bleed canvas or a modal sheet, so
 * anything that wasn't the swipe deck felt like it was floating in front of the
 * product rather than being part of it. This is that shell, with AIRRAW's
 * information architecture and palette.
 *
 * TWO DIFFERENCES FROM KLOOM'S, both deliberate:
 *
 * 1. It navigates by STATE, not by route. AIRRAW is one canvas whose surface is
 *    chosen by React state (the deck, a talk, a call), so there is no pathname
 *    to read — the caller passes the current tab and gets a callback.
 *
 * 2. `immersive` for the front door. The full-screen person owns the viewport —
 *    no scroll container, no padding reserved at the bottom — because the card
 *    is absolutely positioned and would ignore that padding anyway. It clears
 *    the dock itself (see FrontDoor's bottom block). A LIVE CALL still renders
 *    outside the shell entirely: its own controls sit where the dock would be,
 *    and you should not be one mis-tap from leaving a conversation.
 */
import { useEffect, useState, type ReactNode } from "react"
import { Flame, MessagesSquare, Users, User, Drama } from "lucide-react"

export type AirTab = "room" | "people" | "scenes" | "talks" | "you"

const TABS: Array<{ id: AirTab; label: string; icon: typeof Flame }> = [
  // The room comes FIRST because it is the only surface that shows the product
  // working before you decide anything. The deck asks a visitor to judge one
  // stranger; the room just lets them read.
  { id: "room",   label: "Room",   icon: MessagesSquare },
  { id: "people", label: "People", icon: Flame },
  // Scenes sit in the middle, where a thumb lands. It is the paid tab: a free
  // visitor should walk past it often enough to wonder what is behind it.
  { id: "scenes", label: "Scenes", icon: Drama },
  { id: "talks",  label: "Talks",  icon: Users },
  { id: "you",    label: "You",    icon: User },
]

export function AirShell({ tab, onTab, fai, onPass, pro, immersive, dots, children }: {
  tab: AirTab
  onTab: (t: AirTab) => void
  /** Balance shown in the rail. Earned only — see lib/airraw/fai.ts. */
  fai: string
  onPass: () => void
  pro?: boolean
  /** Full-viewport content that positions itself (the front door). */
  immersive?: boolean
  /**
   * Tabs with something waiting. A DOT, not a count and not a banner — the front
   * door is one person and does not get interrupted, so news lives in the tab it
   * belongs to and only says "there's something here".
   */
  dots?: Partial<Record<AirTab, boolean>>
  children: ReactNode
}) {
  // Is the on-screen keyboard up? Tracked by what has focus rather than by
  // measuring the viewport: a visualViewport resize also fires for the URL bar
  // collapsing on scroll, which would make the dock flicker away while someone is
  // just reading. A focused text field is the thing that actually means "typing".
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const isField = (el: EventTarget | null) => {
      const n = el as HTMLElement | null
      return !!n && (n.tagName === "INPUT" || n.tagName === "TEXTAREA" || n.isContentEditable)
    }
    const on = (e: FocusEvent) => { if (isField(e.target)) setTyping(true) }
    const off = () => setTyping(false)
    document.addEventListener("focusin", on)
    document.addEventListener("focusout", off)
    return () => { document.removeEventListener("focusin", on); document.removeEventListener("focusout", off) }
  }, [])

  return (
    <div className="airraw-skin fixed inset-0 z-[19] flex h-[100dvh] overflow-hidden bg-[#07040f] text-[#f0e8ff]">
      {/* Ambient backdrop — the same drifting blobs as the Kloom app, re-skinned
          to the floor's purple/pink in globals.css. */}
      {!immersive && <div className="app-ambient" aria-hidden><div className="blob-3" /></div>}

      {/* ── desktop rail ── */}
      <aside className="relative z-10 hidden w-60 shrink-0 flex-col border-r border-white/[0.06] bg-black/40 px-3 py-5 lg:flex">
        <div className="mb-7 flex items-center gap-2.5 px-2">
          <div className="brand-gradient brand-glow flex h-9 w-9 items-center justify-center rounded-2xl text-lg">✦</div>
          <span className="brand-text text-sm font-extrabold uppercase tracking-[0.2em]">FAITALK</span>
        </div>

        <nav className="flex-1 space-y-1 px-1">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => onTab(t.id)}
                aria-current={active ? "page" : undefined}
                className={`group relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  active
                    ? "bg-fuchsia-500/[0.14] text-white shadow-[inset_0_0_0_1px_rgba(232,121,249,0.22)]"
                    : "text-white/45 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                {active && (
                  <span className="brand-gradient absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full shadow-[0_0_10px_rgba(232,121,249,0.7)]" />
                )}
                <t.icon size={18} className={`shrink-0 ${active ? "text-fuchsia-300" : ""}`} />
                <span className="flex-1 truncate text-left">{t.label}</span>
                {dots?.[t.id] && !active && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,.9)]" aria-hidden />
                )}
              </button>
            )
          })}
        </nav>

        <div className="mt-4 space-y-3 px-1">
          {/* FAI is earned, never sold — so the rail states the balance and how it
              arrives, and does NOT offer a way to buy more. */}
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.07] px-4 py-3">
            <div className="text-sm font-bold tracking-wide text-emerald-300">✦ {fai} FAI</div>
            <div className="mt-1 text-[11px] leading-snug text-white/40">
              one takes a seat. you earn one every time you finish a talk.
            </div>
          </div>
          {!pro && (
            <button
              onClick={onPass}
              className="brand-gradient brand-glow flex w-full items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#1a0a1f] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.02]"
            >
              Get a pass
            </button>
          )}
        </div>
      </aside>

      {/* ── content, rendered exactly once ──
          Kloom's shell learned this the hard way: rendering children in a
          desktop block AND a mobile block double-mounts every page, which for a
          live room meant two realtime channels and two voice hooks per user. */}
      <main className={`relative z-10 min-w-0 flex-1 ${
        immersive
          ? "overflow-hidden"
          : "overflow-y-auto pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+5rem))] lg:pb-0"
      }`}>
        {children}
      </main>

      {/* ── mobile dock ──
          ICON ONLY UNTIL IT IS THE ONE YOU ARE ON. Five icons with five labels
          under them is the default phone tab bar, and it read like one: a row of
          small grey text competing with itself for attention. Only the active
          tab says its name now, in a filled pill that grows to fit — so the dock
          answers "where am I" at a glance instead of listing everywhere you
          could be.

          IT ALSO GETS OUT OF THE WAY WHILE YOU TYPE. In the room the chat input
          sits directly above this, so opening the keyboard stacked two bars on
          top of each other and put "send" a few pixels from "Scenes". The dock
          drops away on focus and comes back when the keyboard closes; navigation
          is not what you are reaching for mid-sentence. */}
      <nav
        className={`pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
          typing ? "pointer-events-none translate-y-[130%] opacity-0" : "translate-y-0 opacity-100"
        }`}
        aria-hidden={typing}
      >
        <div className="glass-strong pointer-events-auto mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-0.5 rounded-full p-1 shadow-[0_14px_34px_-14px_rgba(0,0,0,0.75)]">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => onTab(t.id)}
                aria-current={active ? "page" : undefined}
                aria-label={t.label}
                className={`relative flex shrink-0 items-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  active
                    ? "bg-fuchsia-500/25 px-3 py-2 text-fuchsia-200 shadow-[0_0_16px_-4px_rgba(232,121,249,0.7)]"
                    : "px-2.5 py-2 text-white/45 active:text-white/80"
                }`}
              >
                <t.icon size={19} className="shrink-0" />
                {/* Collapsed rather than removed: the label stays in the DOM so the
                    control keeps its name, and animates open when it becomes active. */}
                <span
                  className={`overflow-hidden whitespace-nowrap text-[11.5px] font-semibold tracking-tight transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    active ? "ml-1.5 max-w-[6rem] opacity-100" : "ml-0 max-w-0 opacity-0"
                  }`}
                >
                  {t.label}
                </span>
                {dots?.[t.id] && !active && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,.9)]" aria-hidden />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
