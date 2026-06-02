// Shared persona utilities — used by Discover, Chat, and any future pages

export const FEMALE_PERSONAS = new Set<string>([
  "Mistress Vale", "Mia (Submissive)", "Aria (Girlfriend)", "Camila (Stepmom)",
  "Yuki (Tsundere)", "Selene (Sadist)", "Vera (Femme Fatale)", "Adira (Hot Wife)",
  "Luna (Life Coach)", "Nova", "Emma (Sister)", "Victoria (Secretary)",
  "Nova (Coach)", "Professor Hale", "Sage (Switch)", "Sage (Mentor)",
  "Pip (Little)", "Stepsister", "Friend's Mom", "Best Friend's Wife",
  "The Babysitter", "Fantasy Maker", "Mommy June", "Obsession",
  "Stranger at the Bar",
])

export function nameHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function imageFor(persona: { name: string }): string {
  const gender = FEMALE_PERSONAS.has(persona.name) ? "women" : "men"
  const id = nameHash(persona.name) % 96
  return `https://randomuser.me/api/portraits/${gender}/${id}.jpg`
}

/**
 * Avatar for any room seat by name + optional seed. Returns a photo for human
 * personas, a bot avatar for AI seats not in the preset list (Claude, Gemini,
 * invited experts). Pass `bot: true` to force the bot style.
 */
export function avatarForName(name: string, opts?: { bot?: boolean; seed?: string }): string {
  if (opts?.bot) {
    return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(opts.seed ?? name)}`
  }
  return imageFor({ name })
}
