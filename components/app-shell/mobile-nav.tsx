"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { Menu, X, Home, Search, Plus, MessageSquare, Users } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

// KLOOM Mobile Logo
function KloomMobileLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <span className="font-black text-base tracking-tight text-white">KLOOM</span>
    </div>
  )
}

const MOBILE_NAV = [
  { label: "Home", href: "/app/discover", icon: Home },
  { label: "Search", href: "/app/search", icon: Search },
  { label: "Create", href: "/app/create", icon: Plus },
  { label: "Chat", href: "/app/chat", icon: MessageSquare },
  { label: "Rooms", href: "/app/rooms", icon: Users },
]

export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { publicKey } = useWallet()

  return (
    <>
      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-stone-950/95 backdrop-blur-md border-b border-stone-800">
        <div className="flex items-center justify-between h-14 px-4">
          <KloomMobileLogo />
          
          <div className="flex items-center gap-2">
            {publicKey && (
              <Button variant="ghost" size="icon" asChild>
                <Link href="/app/settings">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </Link>
              </Button>
            )}
            
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              
              <SheetContent side="left" className="w-[280px] bg-stone-950 border-r-stone-800 p-0">
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-stone-800">
                    <KloomMobileLogo />
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <X className="w-4 h-4" />
                      </Button>
                    </SheetTrigger>
                  </div>
                  
                  {/* Navigation */}
                  <nav className="flex-1 p-4 space-y-2">
                    {MOBILE_NAV.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                      return (
                        <SheetTrigger asChild key={item.href}>
                          <Link
                            href={item.href}
                            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all ${
                              isActive
                                ? "bg-purple-500/10 text-purple-400"
                                : "text-white/60 hover:bg-stone-800/50"
                            }`}
                          >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                          </Link>
                        </SheetTrigger>
                      )
                    })}
                  </nav>
                  
                  {/* Bottom */}
                  <div className="p-4 border-t border-stone-800">
                    <SheetTrigger asChild>
                      <Link
                        href="/app/settings"
                        className="flex items-center gap-3 p-3 rounded-xl text-sm font-medium text-white/60 hover:bg-stone-800/50"
                      >
                        <Settings className="w-5 h-5" />
                        Settings
                      </Link>
                    </SheetTrigger>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      
      {/* Spacer to prevent content from hiding behind header */}
      <div className="md:hidden h-14" />
    </>
  )
}

// Import Settings for mobile nav
import { Settings } from "lucide-react"
