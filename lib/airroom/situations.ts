/**
 * AIRRAW — situations.
 *
 * The whole app is ONE person you shape once, dropped into many MINI SITUATIONS.
 * Not characters, not vibes — situations. You pick a moment; your person plays
 * it out, in voice, with full memory across days.
 *
 *   title  — the pick label on the card
 *   setup  — the scene, injected as the live context the AI opens inside
 *   opener — your person's first spoken line, already in the moment
 *   h      — heat for the card's palette (w soft → m → f wild)
 */
import type { Heat } from "@/lib/airroom/roster"

export interface Situation {
  id: string
  title: string
  setup: string
  opener: string
  h: Heat
}

export const SITUATIONS: Situation[] = [
  {
    id: "elevator-stuck", title: "Stuck in the elevator", h: "m",
    setup: "The elevator jolted to a stop between floors. It's just the two of you, the lights are low, and no one's coming for a while.",
    opener: "…did you feel that? We're stuck. Just us. Guess we've got time now.",
  },
  {
    id: "home-alone", title: "She's home alone", h: "m",
    setup: "She finally has the place to herself tonight, and she texted you to come over. The door's unlocked.",
    opener: "Everyone's gone. It's just me here… how fast can you get to me?",
  },
  {
    id: "boss-after-hours", title: "Your boss, after hours", h: "f",
    setup: "The office emptied an hour ago. She called you back into her office and shut the door behind you.",
    opener: "Close the door. We're the only two left in this building… now sit down.",
  },
  {
    id: "road-trip-2am", title: "Road trip, 2am", h: "w",
    setup: "Empty highway, 2am, her feet up on the dash, the radio low. Everyone you know is asleep and there are hours still to go.",
    opener: "Whole world's asleep and it's just us and this road… pull over for a second.",
  },
  {
    id: "the-fight-makeup", title: "The fight, and after", h: "m",
    setup: "You both said too much an hour ago. The silence now is heavier than the argument was.",
    opener: "…okay. I'm still mad at you. But come here. I hate this more than I hate you.",
  },
  {
    id: "stranger-bar", title: "Stranger at the bar", h: "w",
    setup: "She slid onto the stool beside you like she's known you for years — except you've never met her in your life.",
    opener: "You looked like you needed the company. …have we met? You feel familiar.",
  },
  {
    id: "rain-her-place", title: "Caught in the rain", h: "m",
    setup: "The storm caught you both. You're back at her place, soaked through, and she's holding out a towel.",
    opener: "You're freezing. Get that off before you catch something… I'll find you something dry. Or don't.",
  },
  {
    id: "long-distance", title: "Only her voice", h: "w",
    setup: "It's late, she's in another city, and this call is the only thing connecting the two of you tonight.",
    opener: "I can't sleep without hearing you. Stay on the line… tell me what you'd do if you were here right now.",
  },
  {
    id: "morning-after", title: "The morning after", h: "m",
    setup: "Sunlight, tangled sheets, and neither of you has said a single word yet about last night.",
    opener: "…mm. Don't move yet. I'm not ready for this morning to start.",
  },
  {
    id: "dare", title: "She dares you", h: "f",
    setup: "A simple game of truth or dare over the phone just took a sharp turn, and she's not letting you off easy.",
    opener: "Okay — your turn. Truth… or dare? Choose carefully. I don't go easy.",
  },
  {
    id: "wrong-room", title: "Wrong hotel room", h: "f",
    setup: "You opened the door to your room and she's already inside, certain it's hers. Neither of you is leaving.",
    opener: "…this is MY room. But you're not going anywhere, are you? Good.",
  },
  {
    id: "ex-one-night", title: "The ex, one night", h: "f",
    setup: "You weren't supposed to see each other again. It's one night, and you both know exactly what the rules are.",
    opener: "One night. That was the deal. …so stop wasting it and come here.",
  },
  {
    id: "new-neighbor", title: "New neighbor", h: "w",
    setup: "She knocked to borrow something, and somehow it's an hour later and she still hasn't left.",
    opener: "I really did just come to borrow sugar… so why am I still standing in your kitchen?",
  },
  {
    id: "study-night", title: "Study night", h: "w",
    setup: "Books open, the coffee's gone cold, and neither of you has read a page in twenty minutes.",
    opener: "We're not getting any studying done, are we? …put the book down.",
  },
]

/** Today's situation — deterministic by date, so each day opens on a fresh one
 *  (everyone on the same day lands the same situation, with their OWN person). */
export function situationOfDay(dayIndex: number): Situation {
  return SITUATIONS[((dayIndex % SITUATIONS.length) + SITUATIONS.length) % SITUATIONS.length]
}
