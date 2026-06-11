"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Plus, DoorOpen, User } from "lucide-react"

// Rooms-only IA: Home (the two doors), Rooms (browse worlds), Create, You.
const TABS = [
  { href: "/app",        icon: Home,     label: "Home"   },
  { href: "/app/rooms",  icon: DoorOpen, label: "Rooms"  },
  { href: "/app/create", icon: Plus,     label: "Create" },
  { href: "/app/you",    icon: User,     label: "You"    },
]

export function MobileNav() {
  const pathname = usePathname()

  // Hide on immersive full-screen routes (they have their own back nav and
  // bottom inputs the fixed bar would cover): a live room, the create wizard,
  // an expert session.
  const immersive =
    pathname === "/app/create" ||
    /^\/app\/rooms\/(?!c\/)[^/]+$/.test(pathname) ||
    /^\/app\/experts\/[^/]+$/.test(pathname)
  if (immersive) return null

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 lg:hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none">
      <div className="glass-strong pointer-events-auto mx-auto max-w-md rounded-[1.75rem] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)] flex items-center justify-around px-2 py-2">
        {TABS.map((tab) => {
          const isActive = tab.href === "/app" ? pathname === "/app" : pathname.startsWith(tab.href)
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
