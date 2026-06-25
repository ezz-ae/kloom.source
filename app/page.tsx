"use client"

import Link from "next/link"
import { useState } from "react"
import { EXPERTS, EXPERT_GROUP_LABELS, type ExpertGroup } from "@/lib/experts"
import { ROOMS } from "@/lib/rooms"
import {
  Mic, MessageSquare, Users, Sparkles, Shield, Zap, Globe,
  ChevronRight, Check, GraduationCap, Bot, ArrowRight, Play,
  Heart, Coins, Flame, Lock, EyeOff,
} from "lucide-react"

// ── Pillars: the 4 things Kloom does ───────────────────────────────────────────
const PILLARS = [
  {
    icon: Users,
    title: "Worlds & rooms",
    accent: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    body: "Distinct worlds, each with its own rooms and live topics — the trading floor, fantasy realms, the workshop, deep talk. Every door leads somewhere different.",
    highlight: "Many worlds",
  },
  {
    icon: GraduationCap,
    title: "Your cast",
    accent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    body: "Pick characters from the roster or invent your own. Every one speaks with a real voice — and you can clone any voice from a YouTube link in about 30 seconds.",
    highlight: "Clone any voice",
  },
  {
    icon: Sparkles,
    title: "Humans welcome",
    accent: "text-pink-400 bg-pink-500/10 border-pink-500/20",
    body: "One link drops your friends into the same room — voice and chat, live, together with the cast. The room itself travels inside the link.",
    highlight: "One link",
  },
  {
    icon: Mic,
    title: "The best models",
    accent: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    body: "Claude, Gemini and GPT in the same room — brainstorm, critique, and build with multiple top models working together, alongside fast open-weights for live voice.",
    highlight: "Claude · Gemini · GPT",
  },
]

// ── How it works ──────────────────────────────────────────────────────────────
const STEPS = [
  { n: "01", title: "Pick a world", body: "Trading floor, fantasy realm, deep talk, the workshop — every world has its own rooms, rules and cast." },
  { n: "02", title: "Build the cast & voices", body: "Choose characters or invent them, give each a real voice — or paste a YouTube link and clone a voice in about 30 seconds. No files, no training wait." },
  { n: "03", title: "Open the doors", body: "Send one link and friends walk straight in. Voice or text, live tools, the best models." },
]

export default function LandingPage() {
  // Group experts for the showcase
  const groups = Array.from(new Set(EXPERTS.map((e) => e.group))) as ExpertGroup[]
  // Let visitors self-select their reason for being here; keep the adult roster OPT-IN
  // so a business/dev visitor isn't hit with intimacy personas next to "Launch War Room".
  const ADULT: ExpertGroup = "intimacy"
  const [activeGroup, setActiveGroup] = useState<ExpertGroup | "all">("all")
  const [show18, setShow18] = useState(false)
  const chipGroups = groups.filter((g) => g !== ADULT || show18)          // 18+ chip appears only once opted in
  const visibleGroups = activeGroup === "all"
    ? groups.filter((g) => g !== ADULT || show18)                         // 18+ section hidden from "All" until opted in
    : [activeGroup]

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Zap size={14} className="text-foreground" />
          </div>
          <span className="font-black text-lg tracking-tight">Kloom</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-foreground/55">
          <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#rooms" className="hover:text-foreground transition-colors">Rooms</a>
          <a href="#experts" className="hover:text-foreground transition-colors">Experts</a>
          <a href="#free" className="hover:text-foreground transition-colors">Free to start</a>
        </div>
        <Link href="/app" className="flex items-center gap-1.5 bg-foreground text-background font-semibold text-sm px-4 py-2 rounded-full hover:bg-foreground/90 transition-colors">
          Open app <ChevronRight size={14} />
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen text-center px-4 pt-20">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Animated gradient blobs — lightweight, no WebGL, no console noise */}
          <div className="absolute -top-1/3 left-1/4 w-[42rem] h-[42rem] rounded-full bg-amber-600/25 blur-[120px] animate-pulse" style={{ animationDuration: "6s" }} />
          <div className="absolute top-1/4 right-1/4 w-[36rem] h-[36rem] rounded-full bg-orange-600/20 blur-[120px] animate-pulse" style={{ animationDuration: "8s", animationDelay: "1s" }} />
          <div className="absolute -bottom-1/4 left-1/3 w-[32rem] h-[32rem] rounded-full bg-emerald-600/15 blur-[120px] animate-pulse" style={{ animationDuration: "7s", animationDelay: "0.5s" }} />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-foreground/5 border border-border rounded-full px-4 py-1.5 text-xs font-medium text-foreground/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Claude · Gemini · GPT · {EXPERTS.length} characters · free to chat
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.05]">
            Every conversation
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-300 to-rose-400 bg-clip-text text-transparent">
              is a room.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-foreground/60 max-w-xl mx-auto leading-relaxed">
            Build a cast of AI characters with real voices — or clone any voice from YouTube.
            Drop friends into the same room with one link. Voice and chat, live,
            across <span className="text-foreground">distinct worlds</span> from the trading floor to deep talk.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center pt-2">
            <Link href="/app/create" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-foreground text-background font-bold px-8 py-4 rounded-2xl hover:bg-foreground/90 transition-all hover:scale-[1.02] active:scale-[0.98] text-base">
              <Play size={16} /> Create a room
            </Link>
            <Link href="/app/rooms" className="w-full sm:w-auto flex items-center justify-center gap-2 border border-white/15 text-foreground/80 font-semibold px-8 py-4 rounded-2xl hover:bg-foreground/5 transition-colors text-base">
              See the rooms
            </Link>
          </div>
          <p className="text-xs text-foreground/35">Premium models · no email to chat · full privacy · pay only for voice</p>
        </div>
      </section>

      {/* ── Why three models — the synergy, shown not told ── */}
      <section className="max-w-3xl mx-auto px-6 pt-12 pb-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Why three models in one room?</h2>
          <p className="text-foreground/55 mt-2 max-w-xl mx-auto">They don&apos;t parrot each other — they build on each other, on one shared context. A real handoff:</p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-foreground/[0.03] p-5 sm:p-7">
          <div className="text-[11px] uppercase tracking-widest text-foreground/30 mb-4">Launch War Room · live</div>
          <div className="space-y-4">
            {[
              { who: "GPT", avatar: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300", name: "text-emerald-300", text: "Here's the raw strategy — a greedy matcher that ranks leads by fit in O(n log n)." },
              { who: "Claude", avatar: "bg-amber-500/15 border-amber-500/30 text-amber-300", name: "text-amber-300", text: "Refactored that into a clean, modular pipeline — testable, swappable, no dead paths." },
              { who: "Gemini", avatar: "bg-sky-500/15 border-sky-500/30 text-sky-300", name: "text-sky-300", text: "Pulled live trend data on that structure: demand's up 34% this quarter — here's the chart." },
            ].map((b, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black border ${b.avatar}`}>{b.who[0]}</span>
                <div className="min-w-0 rounded-2xl rounded-tl-sm bg-foreground/[0.05] border border-border/40 px-4 py-2.5">
                  <div className={`text-[11px] font-bold mb-0.5 ${b.name}`}>{b.who}</div>
                  <p className="text-sm text-foreground/75 leading-snug">{b.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-center text-foreground/40 text-sm mt-5">One context, three minds compounding — that&apos;s the whole point of a room.</p>
      </section>

      {/* ── Multi-character voice chat ── */}
      <section id="voice" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/25 rounded-full px-3 py-1 text-xs font-bold text-amber-300 mb-4">
            <Mic size={12} /> Live multi-character voice
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            Real rooms built around live AI collaboration.
          </h2>
          <p className="text-foreground/55 mt-4 max-w-2xl mx-auto text-base leading-relaxed">
            Not transcription. Not a bot on repeat. Every room is a conversation with multiple AI minds, real-time tools, and shared context.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Link href="/app/rooms" className="group rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-900/25 to-stone-950 p-7 hover:border-rose-500/40 transition-all">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center"><Heart size={16} className="text-rose-300" /></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300/80">Live now</span>
            </div>
            <h3 className="font-bold text-xl leading-snug">
              Drop into a real couple's room and listen in or take the mic.
            </h3>
            <p className="text-sm text-foreground/45 mt-3">A shared audio room with real chemistry, no script, no delay.</p>
            <span className="inline-flex items-center gap-1.5 text-rose-300 text-sm font-semibold mt-5 group-hover:gap-2.5 transition-all">Enter the room <ArrowRight size={14} /></span>
          </Link>

          <Link href="/app/rooms" className="group rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-900/25 to-stone-950 p-7 hover:border-amber-500/40 transition-all">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center"><Coins size={16} className="text-amber-300" /></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">Workshop</span>
            </div>
            <h3 className="font-bold text-xl leading-snug">
              Build a launch plan with Claude + Gemini in one live room.
            </h3>
            <p className="text-sm text-foreground/45 mt-3">AI tools, market signals, and direct action steps — all in the same session.</p>
            <span className="inline-flex items-center gap-1.5 text-amber-300 text-sm font-semibold mt-5 group-hover:gap-2.5 transition-all">Open the war room <ArrowRight size={14} /></span>
          </Link>
        </div>

        <p className="text-center text-foreground/60 text-lg leading-relaxed max-w-2xl mx-auto mt-10">
          Invite a partner, a co-founder or a friend into a next-level multi-character AI voice room —{" "}
          <span className="text-foreground font-semibold">{EXPERTS.length} expert characters</span> across the trading floor,
          the workshop and deep talk — <span className="text-foreground">plus your own, built in seconds</span>.
        </p>
        <div className="flex justify-center mt-7">
          <Link href="/app/rooms" className="inline-flex items-center gap-2 bg-foreground text-background font-bold px-8 py-4 rounded-2xl hover:bg-foreground/90 transition-all hover:scale-[1.02] active:scale-[0.98] text-base">
            <Play size={16} /> Start free
          </Link>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight">How it works</h2>
          <p className="text-foreground/50 text-lg mt-3">Three steps. No setup, no learning curve.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative">
              <div className="text-5xl font-black text-foreground/10 mb-3">{s.n}</div>
              <h3 className="font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-foreground/50 leading-relaxed">{s.body}</p>
              {i < STEPS.length - 1 && (
                <ArrowRight size={18} className="hidden md:block absolute top-6 -right-4 text-foreground/15" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Pillars ── */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Everything in one place</h2>
          <p className="text-foreground/50 mt-2">Four ways to put AI to work.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PILLARS.map((p) => (
            <div key={p.title} className="bg-foreground/[0.03] border border-white/8 rounded-3xl p-6 hover:bg-foreground/[0.06] transition-all flex flex-col gap-3">
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${p.accent}`}>
                <p.icon size={20} />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">{p.title}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.accent}`}>{p.highlight}</span>
              </div>
              <p className="text-sm text-foreground/50 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Co-Intelligence: Claude + Gemini conference call ── */}
      <section id="rooms" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-orange-500/15 border border-orange-500/25 rounded-full px-3 py-1 text-xs font-bold text-orange-300 mb-5">
            <Bot size={12} /> Co-Intelligence
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.05]">
            Experience a new level of AI
          </h2>
          <p className="text-foreground/60 text-lg sm:text-xl mt-4 max-w-2xl mx-auto leading-relaxed">
            A <span className="text-foreground font-semibold">conference call with Gemini and Claude — at the same time</span>.
            Two different minds on the line with you, building on each other in real time.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {["launch-war-room", "build-studio", "growth-boardroom"]
            .map((id) => ROOMS.find((r) => r.id === id))
            .filter((r): r is NonNullable<typeof r> => !!r)
            .map((r) => (
              <Link key={r.id} href={`/app/rooms/${r.id}`}
                className="group rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-900/20 to-stone-950 p-6 hover:border-orange-500/45 transition-all flex flex-col">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-300/80 mb-3">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200">Claude</span>
                  <span className="text-foreground/30">×</span>
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-200">Gemini</span>
                </div>
                <h3 className="font-bold text-lg leading-snug">{r.name}</h3>
                <p className="text-sm text-foreground/45 mt-2 flex-1">{r.tagline}</p>
                <span className="inline-flex items-center gap-1.5 text-orange-300 text-sm font-semibold mt-4 group-hover:gap-2.5 transition-all">
                  Join the call <ArrowRight size={14} />
                </span>
              </Link>
            ))}
        </div>

        <div className="flex justify-center mt-8">
          <Link href="/app/rooms" className="inline-flex items-center gap-2 bg-foreground/8 hover:bg-foreground/12 border border-border font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors">
            See all rooms <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── Character roster — every expert is a room character now ── */}
      <section id="experts" className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">{EXPERTS.length} characters. Real depth.</h2>
          <p className="text-foreground/50 mt-2">Each one masters a craft — pick them for your cast or meet them in the rooms.</p>
        </div>

        {/* category filter — visitors self-select; 18+ is opt-in, never in your face */}
        <div className="flex flex-wrap justify-center gap-2 mb-9">
          <button onClick={() => setActiveGroup("all")} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeGroup === "all" ? "bg-foreground text-background" : "bg-foreground/5 border border-border text-foreground/70 hover:bg-foreground/10"}`}>All</button>
          {chipGroups.map((g) => (
            <button key={g} onClick={() => setActiveGroup(g)} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeGroup === g ? "bg-foreground text-background" : "bg-foreground/5 border border-border text-foreground/70 hover:bg-foreground/10"}`}>{EXPERT_GROUP_LABELS[g]}</button>
          ))}
          <button onClick={() => { setShow18((v) => !v); if (show18 && activeGroup === ADULT) setActiveGroup("all") }} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${show18 ? "bg-rose-500/20 border border-rose-500/40 text-rose-200" : "bg-foreground/5 border border-border text-foreground/45 hover:bg-foreground/10"}`}>{show18 ? <><EyeOff size={12} /> Hide 18+</> : <><Flame size={12} /> Show 18+</>}</button>
        </div>

        <div className="space-y-10">
          {visibleGroups.map((g) => (
            <div key={g}>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/35 mb-4 border-b border-white/8 pb-2">
                {EXPERT_GROUP_LABELS[g]}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
                {EXPERTS.filter((e) => e.group === g).map((e) => (
                  <div key={e.id}
                    className="flex items-baseline justify-between gap-4 border-b border-white/[0.04] pb-3">
                    <div className="min-w-0">
                      <span className="font-bold text-[15px]">{e.name}</span>
                      <span className="text-foreground/50 text-sm"> — {e.domain}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/app/create" className="inline-flex items-center gap-2 bg-foreground/8 hover:bg-foreground/12 border border-border font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors">
            Build a room with them <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── Many minds band ── */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="rounded-[2rem] border border-border bg-gradient-to-br from-stone-900 via-stone-950 to-amber-950/20 p-10 sm:p-14 text-center">
          <div className="inline-flex items-center gap-2 bg-foreground/5 border border-border rounded-full px-3 py-1 text-xs font-bold text-foreground/70 mb-6">
            <EyeOff size={12} /> Full privacy · nothing logged to your name
          </div>
          <h2 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05]">
            Many minds,
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-300 to-emerald-400 bg-clip-text text-transparent">one room.</span>
          </h2>
          <p className="text-foreground/55 text-lg sm:text-xl mt-6 max-w-xl mx-auto leading-relaxed">
            Claude, Gemini and GPT think out loud together — and community-built rooms mean
            the best creations are always one click away. What you build here stays yours.
          </p>
        </div>
      </section>

      {/* ── Why Kloom (trust) ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { icon: Shield, title: "Private by default", body: "Chat free with no signup. Your conversations live on your device, not our servers." },
            { icon: Zap, title: "Live tools, real output", body: "Speak an idea out loud and watch real charts, code blocks and plans appear in the room's shared chat — the AI builds, not just talks." },
            { icon: Globe, title: "Voice in 50+ languages", body: "Natural real-time calls that interrupt and respond like a person." },
          ].map((f) => (
            <div key={f.title} className="text-center">
              <div className="w-12 h-12 rounded-xl bg-foreground/5 border border-border flex items-center justify-center mx-auto mb-4">
                <f.icon size={20} className="text-amber-400" />
              </div>
              <h3 className="font-bold mb-1.5">{f.title}</h3>
              <p className="text-sm text-foreground/50 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Free to start ── */}
      <section id="free" className="max-w-3xl mx-auto px-6 py-24">
        <div className="rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-emerald-900/20 to-stone-950 p-8 sm:p-12 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-3 py-1 text-xs font-bold text-emerald-300 mb-5">
            <Check size={12} /> No subscription · no card to start
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            Premium models.<br />Free to chat.
          </h2>
          <p className="text-foreground/60 text-lg mt-4 max-w-xl mx-auto leading-relaxed">
            Claude, Gemini, and every expert — free to text, forever. Fill a room with AIs,
            invite your friends, no card needed. You only pay when you want to
            <span className="text-foreground"> talk out loud</span>: voice calls are pay-as-you-go,
            by the minute.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 text-left max-w-3xl mx-auto">
            <div className="flex items-start gap-2.5 bg-foreground/[0.03] border border-border rounded-2xl p-4">
              <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm">Free</div>
                <div className="text-xs text-foreground/50 mt-0.5">Claude, Gemini &amp; GPT chat · {EXPERTS.length} experts · rooms · invite friends</div>
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-foreground/[0.03] border border-border rounded-2xl p-4">
              <Mic size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm">Voice from $1</div>
                <div className="text-xs text-foreground/50 mt-0.5">First 5 min free · then by the minute · or $60 unlimited</div>
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-amber-500/[0.07] border border-amber-500/25 rounded-2xl p-4">
              <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm flex items-center gap-1.5">Full access <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30">from $7.93</span></div>
                <div className="text-xs text-foreground/50 mt-0.5">Unlimited voice + every premium model · day, week or month passes</div>
              </div>
            </div>
          </div>

          <Link href="/app/rooms" className="inline-flex items-center gap-2 mt-9 bg-foreground text-background font-bold px-8 py-4 rounded-2xl hover:bg-foreground/90 transition-all hover:scale-[1.02] active:scale-[0.98] text-base">
            <Play size={16} /> Start free
          </Link>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-2xl mx-auto px-6 py-24 text-center space-y-6">
        <h2 className="text-4xl sm:text-5xl font-black tracking-tight">Ready when you are.</h2>
        <p className="text-foreground/55 text-lg">Text chat is free — no signup, nothing to connect. Add an account only when you&apos;re ready for live voice.</p>
        <Link href="/app" className="inline-flex items-center gap-2 bg-foreground text-background font-bold px-10 py-4 rounded-2xl hover:bg-foreground/90 transition-all hover:scale-[1.02] active:scale-[0.98] text-base">
          <Play size={18} /> Open Kloom
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50 px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-foreground/30">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500" />
          <span className="font-bold text-foreground/50">Kloom</span>
        </div>
        <p>Multi-AI voice rooms · Claude · Gemini · GPT · community-built</p>
        <p>© 2026 Kloom</p>
      </footer>
    </div>
  )
}
