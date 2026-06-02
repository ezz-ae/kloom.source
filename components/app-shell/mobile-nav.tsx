"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Compass, MessageSquare, Sparkles, Users, GraduationCap } from "lucide-react"

// Group-chat-first ordering. Rooms is primary. Voice lives inside rooms/experts
// now, so the standalone orb is reachable via Discover rather than a bottom tab.
const TABS = [
  { href: "/app/rooms",    icon: Users,         label: "Rooms"    },
  { href: "/app/experts",  icon: GraduationCap, label: "Experts"  },
  { href: "/app/discover", icon: Compass,       label: "Discover" },
  { href: "/app/chat",     icon: MessageSquare, label: "Chat"     },
  { href: "/app/creator",  icon: Sparkles,      label: "Creator"  },
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
    <nav className="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-stone-950/95 backdrop-blur-md border-t border-white/8 pb-safe">
      <div className="flex items-center justify-around px-2 py-2">
        {TABS.map((tab) => {
          const isActive = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                isActive ? "text-white" : "text-white/35 hover:text-white/60"
              }`}
            >
              <div className={`relative p-1.5 rounded-xl transition-all ${
                isActive ? "bg-amber-500/20" : ""
              }`}>
                <tab.icon size={20} className={isActive ? "text-amber-400" : ""} />
                {tab.label === "Chat" && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full" />
                )}
              </div>
              <span className={`text-[10px] font-medium ${isActive ? "text-amber-300" : ""}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
