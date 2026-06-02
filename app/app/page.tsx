"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"

const AiOrb = dynamic(() => import("@/components/ai-orb").then((m) => m.AiOrb), { ssr: false })

export default function AppPage() {
  const router = useRouter()

  useEffect(() => {
    // Desktop users go to the discover page; mobile keeps the orb
    if (window.innerWidth >= 1024) {
      router.replace("/app/discover")
    }
  }, [router])

  // Mobile: full-screen orb experience
  return <AiOrb />
}
