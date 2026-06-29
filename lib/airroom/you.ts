/**
 * AIRRAW — "your person".
 *
 * The one constant of the whole app: you shape this person once (name, who they
 * are to you), and every situation is played by THEM. Stored on-device only.
 */
import type { Cluster, Heat } from "@/lib/airroom/roster"

export interface YourPerson {
  name: string
  gender: "female" | "male"
  /** one line: who they are to you — woven into every situation. */
  who: string
}

const KEY = "airraw_person_v1"

export const DEFAULT_PERSON: YourPerson = {
  name: "Mara",
  gender: "female",
  who: "the one who always pulls you back in",
}

export function getPerson(): YourPerson {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_PERSON, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_PERSON
}

export function savePerson(p: YourPerson) {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch {}
}

export function hasPerson(): boolean {
  try { return !!localStorage.getItem(KEY) } catch { return false }
}

/** Adapt "your person" + the chosen situation into the Cluster the chat expects.
 *  The host is your person; the situation rides in via name/vibe/archetype, which
 *  personaFor() reads — and the page also injects the full scene + opener. */
export function personCluster(p: YourPerson, situationTitle: string, h: Heat): Cluster {
  return {
    f: 0.5,
    n: 1,
    h,
    name: situationTitle,
    vibe: p.who,
    archetype: "your person",
    host: p.name,
    gender: p.gender,
    lines: [],
  }
}
