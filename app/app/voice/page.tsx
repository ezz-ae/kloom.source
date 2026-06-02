"use client"

import dynamic from "next/dynamic"

const AiOrb = dynamic(() => import("@/components/ai-orb").then((m) => m.AiOrb), { ssr: false })

export default function VoicePage() {
  return (
    // On desktop the orb lives inside the sidebar layout main area.
    // The orb uses min-h-screen which fills the scrollable main column.
    <div className="min-h-screen">
      <AiOrb />
    </div>
  )
}
