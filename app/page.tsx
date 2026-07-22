"use client"

import Link from "next/link"
import { useState } from "react"
import { EXPERTS, EXPERT_GROUP_LABELS, type ExpertGroup } from "@/lib/experts"
import { ROOMS } from "@/lib/rooms"
import { adultEnabled } from "@/lib/variant"
import { RoomFace } from "@/components/RoomFace"
import { HeroConversation } from "@/components/HeroConversation"
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
  // HARD GATE: the 18+ intimacy roster exists ONLY on the .fun build. On the .io ad
  // domain adultEnabled() is false, so the chip, the section, and the toggle are removed
  // entirely — no Meta reviewer or crawler can reach explicit personas from the ad page.
  const allowAdult = adultEnabled()
  const [activeGroup, setActiveGroup] = useState<ExpertGroup | "all">("all")
  const [show18, setShow18] = useState(false)
  const reveal18 = allowAdult && show18
  const chipGroups = groups.filter((g) => g !== ADULT || reveal18)        // 18+ chip: only on .fun, and only once opted in
  const visibleGroups = (activeGroup === "all" || (activeGroup === ADULT && !allowAdult))
    ? groups.filter((g) => g !== ADULT || reveal18)                       // 18+ section never on .io; opt-in elsewhere
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

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* No headline, no prompts — you land straight into the live room. The
              conversation IS the pitch; one button gets you in. (H1 for SEO/a11y only,
              visually hidden so screen readers + crawlers still get the page title.) */}
          <h1 className="sr-only">Talk to Claude, Gemini and GPT together, out loud</h1>
          <HeroConversation />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50 px-6 pt-12 pb-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500" />
              <span className="font-black text-foreground/70">Kloom</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-12 gap-y-7 text-sm">
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-widest text-foreground/35">Product</div>
                <Link href="/app/rooms" className="block text-foreground/55 hover:text-foreground transition-colors">Rooms</Link>
                <Link href="/app/create" className="block text-foreground/55 hover:text-foreground transition-colors">Create a room</Link>
                <Link href="/app" className="block text-foreground/55 hover:text-foreground transition-colors">Open app</Link>
              </div>
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-widest text-foreground/35">Legal</div>
                <a href="/legal/terms" className="block text-foreground/55 hover:text-foreground transition-colors">Terms</a>
                <a href="/legal/privacy" className="block text-foreground/55 hover:text-foreground transition-colors">Privacy</a>
                <a href="/legal/payments" className="block text-foreground/55 hover:text-foreground transition-colors">Payments</a>
                <a href="/legal/cookies" className="block text-foreground/55 hover:text-foreground transition-colors">Cookies</a>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-foreground/35">
            <p>Multi-AI voice rooms · Claude · Gemini · GPT · community-built</p>
            <p>© 2026 Kloom. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
