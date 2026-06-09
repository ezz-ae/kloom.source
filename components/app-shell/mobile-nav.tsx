"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Compass, Sparkles, Users, GraduationCap, User } from "lucide-react"

// Group-chat-first ordering. Rooms is primary. 1:1 Chat now lives inside the
// Creator suite; the freed slot is "You" (billing, your rooms, character setup).
const TABS = [
  { href: "/app/rooms",    icon: Users,         label: "Rooms"    },
  { href: "/app/experts",  icon: GraduationCap, label: "Experts"  },
  { href: "/app/discover", icon: Compass,       label: "Discover" },
  { href: "/app/creator",  icon: Sparkles,      label: "Creator"  },
  { href: "/app/you",      icon: User,          label: "You"      },
]

export function MobileNav() {
  const pathname = usePathname()

  // Hide on immersive full-screen routes (they have their own back nav and
  // bottom inputs the fixed bar would cover): orb, a room, voice, an expert.
  const immersive =
    pathname === "/app" ||
    pathname === "/app/voice" ||
    /^\/app\/rooms\/[^/]+$/.test(pathname) ||
    /^\/app\/experts\/[^/]+$/.test(pathname)
  if (immersive) return null

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 lg:hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none">
      <div className="glass-strong pointer-events-auto mx-auto max-w-md rounded-[1.75rem] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)] flex items-center justify-around px-2 py-2">
        {TABS.map((tab) => {
          const isActive = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isActive ? "text-amber-300" : "text-white/40 hover:text-white/70"
              }`}
            >
              <div className={`relative p-1.5 rounded-xl transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isActive ? "bg-amber-500/20 shadow-[0_0_16px_-2px_rgba(251,146,60,0.5)]" : ""
              }`}>
                <tab.icon size={20} className={isActive ? "text-amber-400" : ""} />
              </div>
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
