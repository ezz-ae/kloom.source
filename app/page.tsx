"use client"

import Link from "next/link"
import { EXPERTS, EXPERT_GROUP_LABELS, type ExpertGroup } from "@/lib/experts"
import { ROOMS } from "@/lib/rooms"
import {
  Mic, MessageSquare, Users, Sparkles, Shield, Zap, Globe,
  ChevronRight, Check, GraduationCap, Bot, ArrowRight, Play,
  Heart, Coins, Flame, Lock, EyeOff,
} from "lucide-react"

// ── Pillars: the 4 things KLOOM does ───────────────────────────────────────────
const PILLARS = [
  {
    icon: Users,
    title: "Shared Rooms",
    accent: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    body: "Invite friends with one link and add AI experts to the chat. Real humans and multiple AIs in the same conversation, in real time.",
    highlight: "Invite friends",
  },
  {
    icon: GraduationCap,
    title: "Experts",
    accent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    body: `${EXPERTS.length} real specialists — life coach, trading desk, tarot, diet planner, code reviewer, dating coach, and more. Each with genuine depth.`,
    highlight: `${EXPERTS.length}+ specialists`,
  },
  {
    icon: Sparkles,
    title: "Creator Suite",
    accent: "text-pink-400 bg-pink-500/10 border-pink-500/20",
    body: "Connect your profile, talk through your goals, and get a personalized 90-day growth plan — plus tools for captions, hashtags, and DMs.",
    highlight: "Profile planner",
  },
  {
    icon: Mic,
    title: "Free to chat",
    accent: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    body: "Text chat with any expert or room is completely free, forever. Upgrade to a live voice call whenever you want to actually talk it through.",
    highlight: "Chat free",
  },
]

// ── How it works ──────────────────────────────────────────────────────────────
const STEPS = [
  { n: "01", title: "Connect your wallet", body: "Your Solana wallet is your account. No email, no password, no signup form." },
  { n: "02", title: "Pick a room or expert", body: "Choose a multi-AI room, a specialist expert, or the creator planner — whatever you need today." },
  { n: "03", title: "Talk, build, ship", body: "Voice or text. The AI uses live tools — prices, code, charts, plans — to actually get work done with you." },
]

// KLOOM Logo Component
function KloomLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <span className="font-black text-lg tracking-tight">KLOOM</span>
    </div>
  )
}

export default function LandingPage() {
  // Group experts for the showcase
  const groups = Array.from(new Set(EXPERTS.map((e) => e.group))) as ExpertGroup[]

  return (
    <div className="min-h-screen bg-stone-950 text-white overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-stone-950/80 backdrop-blur-md">
        <KloomLogo />
        <div className="hidden md:flex items-center gap-6 text-sm text-white/55">
          <a href="#how" className="hover:text-white transition-colors">How it works</a>
          <a href="#rooms" className="hover:text-white transition-colors">Rooms</a>
          <a href="#experts" className="hover:text-white transition-colors">Experts</a>
          <a href="#free" className="hover:text-white transition-colors">Free to start</a>
        </div>
        <Link href="/app" className="flex items-center gap-1.5 bg-white text-stone-950 font-semibold text-sm px-4 py-2 rounded-full hover:bg-white/90 transition-colors">
          Open app <ChevronRight size={14} />
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen text-center px-4 pt-20">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Animated gradient blobs — lightweight, no WebGL, no console noise */}
          <div className="absolute -top-1/3 left-1/4 w-[42rem] h-[42rem] rounded-full bg-purple-600/25 blur-[120px] animate-pulse" style={{ animationDuration: "6s" }} />
          <div className="absolute top-1/4 right-1/4 w-[36rem] h-[36rem] rounded-full bg-cyan-600/20 blur-[120px] animate-pulse" style={{ animationDuration: "8s", animationDelay: "1s" }} />
          <div className="absolute -bottom-1/4 left-1/3 w-[32rem] h-[32rem] rounded-full bg-emerald-600/15 blur-[120px] animate-pulse" style={{ animationDuration: "7s", animationDelay: "0.5s" }} />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs font-medium text-white/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Claude · Gemini · GPT · Mistral · 100+ characters · free &amp; unrestricted
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.05]">
            Talk to more than one AI model
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
              at the same time.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-white/60 max-w-xl mx-auto leading-relaxed">
            <span className="text-white">Claude</span>, <span className="text-white">Gemini</span>,{" "}
            <span className="text-white">GPT</span>, <span className="text-white">Mistral</span> and {EXPERTS.length} expert and role-model personas —
            in one conversation, by voice or text. Bring friends in and let the minds work together.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center pt-2">
            <Link href="/app/rooms" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-stone-950 font-bold px-8 py-4 rounded-2xl hover:bg-white/90 transition-all hover:scale-[1.02] active:scale-[0.98] text-base">
              <Play size={16} /> Start free
            </Link>
            <a href="#voice" className="w-full sm:w-auto flex items-center justify-center gap-2 border border-white/15 text-white/80 font-semibold px-8 py-4 rounded-2xl hover:bg-white/5 transition-colors text-base">
              See the rooms
            </a>
          </div>
          <p className="text-xs text-white/35">Real, free &amp; unrestricted · no email · full privacy · pay only for voice</p>
        </div>
      </section>

      {/* ── Multi-character voice chat ── */}
      <section id="voice" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-purple-500/15 border border-purple-500/25 rounded-full px-3 py-1 text-xs font-bold text-purple-300 mb-4">
            <Mic size={12} /> Live multi-character voice
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            Join an interesting<br />multi-character voice chat
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Box 1 — couple / intimate */}
          <Link href="/app/rooms" className="group rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-900/25 to-stone-950 p-7 hover:border-rose-500/40 transition-all">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center"><Heart size={16} className="text-rose-300" /></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300/80">Live now</span>
            </div>
            <h3 className="font-bold text-xl leading-snug">
              Join John &amp; his lovely wife Lola on their all-night voice conversation
            </h3>
            <p className="text-sm text-white/45 mt-3">A real couple's room — drop into the call, listen in, or take a seat.</p>
            <span className="inline-flex items-center gap-1.5 text-rose-300 text-sm font-semibold mt-5 group-hover:gap-2.5 transition-all">Enter the room <ArrowRight size={14} /></span>
          </Link>

          {/* Box 2 — crypto launch with Claude + Gemini */}
          <Link href="/app/rooms" className="group rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-900/25 to-stone-950 p-7 hover:border-amber-500/40 transition-all">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center"><Coins size={16} className="text-amber-300" /></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">Workshop</span>
            </div>
            <h3 className="font-bold text-xl leading-snug">
              Launch a crypto token with Claude &amp; Gemini
            </h3>
            <p className="text-sm text-white/45 mt-3">Two minds on the same call — tokenomics, contracts, and live market checks.</p>
            <span className="inline-flex items-center gap-1.5 text-amber-300 text-sm font-semibold mt-5 group-hover:gap-2.5 transition-all">Open the war room <ArrowRight size={14} /></span>
          </Link>
        </div>

        <p className="text-center text-white/60 text-lg leading-relaxed max-w-2xl mx-auto mt-10">
          Invite your partner or a friend for a next-level multi-character AI voice chat — over{" "}
          <span className="text-white font-semibold">100 different characters</span> across professional,
          lifestyle, crypto trading, or secret <span className="text-rose-300">dark red rooms</span>.
        </p>
        <div className="flex justify-center mt-7">
          <Link href="/app/rooms" className="inline-flex items-center gap-2 bg-white text-stone-950 font-bold px-8 py-4 rounded-2xl hover:bg-white/90 transition-all hover:scale-[1.02] active:scale-[0.98] text-base">
            <Play size={16} /> Start free
          </Link>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight">How it works</h2>
          <p className="text-white/50 text-lg mt-3">Three steps. No setup, no learning curve.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative">
              <div className="text-5xl font-black text-white/10 mb-3">{s.n}</div>
              <h3 className="font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{s.body}</p>
              {i < STEPS.length - 1 && (
                <ArrowRight size={18} className="hidden md:block absolute top-6 -right-4 text-white/15" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Pillars ── */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Everything in one place</h2>
          <p className="text-white/50 mt-2">Four ways to put AI to work.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PILLARS.map((p) => (
            <div key={p.title} className="bg-white/[0.03] border border-white/8 rounded-3xl p-6 hover:bg-white/[0.06] transition-all flex flex-col gap-3">
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${p.accent}`}>
                <p.icon size={20} />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">{p.title}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.accent}`}>{p.highlight}</span>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">{p.body}</p>
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
          <p className="text-white/60 text-lg sm:text-xl mt-4 max-w-2xl mx-auto leading-relaxed">
            A <span className="text-white font-semibold">conference call with Gemini, Claude, and Mistral — at the same time</span>.
            Three different minds on the line with you, building on each other in real time.
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
                  <span className="text-white/30">×</span>
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-200">Gemini</span>
                  <span className="text-white/30">×</span>
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200">Mistral</span>
                </div>
                <h3 className="font-bold text-lg leading-snug">{r.name}</h3>
                <p className="text-sm text-white/45 mt-2 flex-1">{r.tagline}</p>
                <span className="inline-flex items-center gap-1.5 text-orange-300 text-sm font-semibold mt-4 group-hover:gap-2.5 transition-all">
                  Join the call <ArrowRight size={14} />
                </span>
              </Link>
            ))}
        </div>

        <div className="flex justify-center mt-8">
          <Link href="/app/rooms" className="inline-flex items-center gap-2 bg-white/8 hover:bg-white/12 border border-white/10 font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors">
            See all rooms <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── Experts showcase — text-forward, grouped by what they do ── */}
      <section id="experts" className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">{EXPERTS.length} experts. Real depth.</h2>
          <p className="text-white/50 mt-2">Each one masters a craft — not the same bot in costumes.</p>
        </div>

        <div className="space-y-10">
          {groups.map((g) => (
            <div key={g}>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 mb-4 border-b border-white/8 pb-2">
                {EXPERT_GROUP_LABELS[g]}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
                {EXPERTS.filter((e) => e.group === g).map((e) => (
                  <Link key={e.id} href={`/app/experts/${e.id}`}
                    className="group flex items-baseline justify-between gap-4 border-b border-white/[0.04] pb-3 hover:border-white/15 transition-colors">
                    <div className="min-w-0">
                      <span className="font-bold text-[15px] group-hover:text-amber-300 transition-colors">{e.name}</span>
                      <span className="text-white/50 text-sm"> — {e.domain}</span>
                    </div>
                    <ArrowRight size={14} className="text-white/0 group-hover:text-purple-400 transition-colors shrink-0 self-center" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/app/experts" className="inline-flex items-center gap-2 bg-white/8 hover:bg-white/12 border border-white/10 font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors">
            Open all {EXPERTS.length} experts <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── Real · Free · Unrestricted band ── */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-stone-900 via-stone-950 to-purple-950/30 p-10 sm:p-14 text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs font-bold text-white/70 mb-6">
            <EyeOff size={12} /> Full privacy · nothing logged to your name
          </div>
          <h2 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05]">
            It's real, free,
            <br />
            <span className="bg-gradient-to-r from-rose-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent">and unrestricted.</span>
          </h2>
          <p className="text-white/55 text-lg sm:text-xl mt-6 max-w-xl mx-auto leading-relaxed">
            A new level of AI freedom — no lectures, no refusals, no hand-holding.
            Your wallet is your only identity, so what happens here stays yours.
          </p>
        </div>
      </section>

      {/* ── Why KLOOM (trust) ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { icon: Shield, title: "Your wallet is your account", body: "No email, no password, no data to lose. Identity is your Solana key." },
            { icon: Zap, title: "Live tools, real output", body: "Charts, prices, code, plans — the AI does the work, not just talk." },
            { icon: Globe, title: "Voice in 50+ languages", body: "Natural real-time calls that interrupt and respond like a person." },
          ].map((f) => (
            <div key={f.title} className="text-center">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                <f.icon size={20} className="text-purple-400" />
              </div>
              <h3 className="font-bold mb-1.5">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.body}</p>
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
          <p className="text-white/60 text-lg mt-4 max-w-xl mx-auto leading-relaxed">
            Claude, Gemini, GPT, and Mistral — free to text, forever. Fill a room with AIs,
            invite your friends, no card needed. You only pay when you want to
            <span className="text-white"> talk out loud</span>: voice calls are pay-as-you-go,
            by the minute.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 text-left max-w-3xl mx-auto">
            <div className="flex items-start gap-2.5 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
              <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm">Free</div>
                <div className="text-xs text-white/50 mt-0.5">Claude, Gemini, GPT &amp; Mistral chat · {EXPERTS.length} experts · rooms · invite friends</div>
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
              <Mic size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm">Voice from $1</div>
                <div className="text-xs text-white/50 mt-0.5">First 5 min free · then by the minute · or $60 unlimited</div>
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-rose-500/[0.07] border border-rose-500/25 rounded-2xl p-4">
              <Flame size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm flex items-center gap-1.5">Unrestricted <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-200 border border-rose-500/30">$10/mo</span></div>
                <div className="text-xs text-white/50 mt-0.5">Removes every restriction platform-wide &amp; unlocks the full adult category · 18+</div>
              </div>
            </div>
          </div>

          <Link href="/app/rooms" className="inline-flex items-center gap-2 mt-9 bg-white text-stone-950 font-bold px-8 py-4 rounded-2xl hover:bg-white/90 transition-all hover:scale-[1.02] active:scale-[0.98] text-base">
            <Play size={16} /> Start free
          </Link>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-2xl mx-auto px-6 py-24 text-center space-y-6">
        <h2 className="text-4xl sm:text-5xl font-black tracking-tight">Ready when you are.</h2>
        <p className="text-white/55 text-lg">Connect your wallet and start a conversation in seconds.</p>
        <Link href="/app" className="inline-flex items-center gap-2 bg-white text-stone-950 font-bold px-10 py-4 rounded-2xl hover:bg-white/90 transition-all hover:scale-[1.02] active:scale-[0.98] text-base">
          <Play size={18} /> Open KLOOM
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/30">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-purple-400 to-cyan-500" />
          <span className="font-bold text-white/50">KLOOM</span>
        </div>
        <p>Multi-AI rooms · {EXPERTS.length} experts · Solana mainnet</p>
        <p>© 2026 KLOOM</p>
      </footer>
    </div>
  )
}
