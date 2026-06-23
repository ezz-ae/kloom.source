import type { Metadata } from "next"
import { ChessRoom } from "@/components/airroom/ChessRoom"

export const metadata: Metadata = {
  title: { absolute: "AIRRAW — the arena · chess" },
  description: "Play chess against the house — a real board, a real opponent, and real trash talk. It's the now.",
}

// AIRRAW — the arena's first real game: live chess vs an AI character.
export default function ChessPage() {
  return <ChessRoom />
}
