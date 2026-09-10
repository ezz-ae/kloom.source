// How a generated character is NAMED on the Arabic floor.
//
// The roster draws every name from one international list regardless of origin,
// so a Gulf Arab is called Frida and a Moroccan is called Pavel. Beside the
// written fifty — who render as غادة and بلال because cast50 gives them a name
// per language — that is the illusion gone.
//
// THE FIRST ATTEMPT WAS TO FILTER, AND IT COLLAPSED. Requiring an Arabic-looking
// name on top of an Arabic accent left five to seven eligible people per heat
// band, and none at all around f≈0.15–0.20, because a walk holds `f` fixed and
// therefore holds the ARCHETYPE fixed: the reachable set is one archetype's
// names, not the whole pool. A fourteen-person room cannot be filled from six,
// and no scan width fixes an empty set. Measured, not guessed.
//
// So this does what cast50 already does for the written fifty: ONE IDENTITY, a
// localised presentation. Everyone keeps their Latin `host` — it is half the
// face seed (`archetype:host`), so writing Arabic into it would change every key
// and regenerate every portrait in the product — and simply gets an Arabic name
// to be printed under.
//
// Deterministic on the host, so a character is the same person on the deck, in
// the room, on the call and tomorrow. Display only, and only in Arabic.

/** Pooled names that are already Arabic — kept so they map to themselves. */
const SCRIPT: Record<string, string> = {
  Noor: "نور", Zia: "ضياء", Rana: "رنا", Nadia: "ناديا", Leila: "ليلى",
  Sana: "سناء", Farah: "فرح", Rima: "ريما", Yasmin: "ياسمين", Zara: "زارا",
  Ghita: "غيثة", Isra: "إسراء", Jinan: "جنان", Kenza: "كنزة", Lamis: "لميس",
  Nawal: "نوال", Rania: "رانيا", Wafa: "وفاء", Zohra: "زهرة", Ghada: "غادة",
  Hind: "هند", Lina: "لينا", Dahlia: "داليا", Yara: "يارا", Mira: "ميرا",
  Maya: "مايا", Nira: "نيرة", Nyla: "نيلة", Qadira: "قديرة", Kalila: "كليلة",
  Adira: "أديرة", Amara: "عمارة",
  Idris: "إدريس", Omar: "عمر", Hassan: "حسن", Tariq: "طارق", Samir: "سمير",
  Umar: "عُمر", Yusuf: "يوسف", Said: "سعيد", Basim: "باسم", Fares: "فارس",
  Hakim: "حكيم", Karim: "كريم", Malik: "مالك", Nadir: "نادر", Rashid: "راشد",
  Wassim: "وسيم", Zaid: "زيد", Amir: "أمير", Hamza: "حمزة", Jamal: "جمال",
  Osman: "عثمان", Qasim: "قاسم", Hadi: "هادي", Mehdi: "مهدي", Rafiq: "رفيق",
  Sami: "سامي", Wesam: "وسام", Bilal: "بلال", Firas: "فراس", Halim: "حليم",
  Ihsan: "إحسان", Nuri: "نوري",
}

// The names everyone else is given. Wide enough that a fourteen-person room does
// not repeat, and ordinary rather than ornamental — these are meant to read as
// people you might actually be talking to at 2am, not as characters from a play.
const AR_F = [
  "نور", "رنا", "ليلى", "سناء", "فرح", "ريما", "ياسمين", "غادة", "هند", "لينا",
  "داليا", "يارا", "ميرا", "مايا", "نوال", "رانيا", "وفاء", "زهرة", "إسراء", "جنان",
  "كنزة", "لميس", "ناديا", "سلمى", "دانة", "شهد", "لمى", "جود", "ريم", "أمل",
  "هدى", "منى", "سارة", "نجود", "بشرى", "رغد", "عهود", "لطيفة", "مريم", "خلود",
]
const AR_M = [
  "عمر", "حسن", "طارق", "سمير", "يوسف", "سعيد", "باسم", "فارس", "كريم", "مالك",
  "نادر", "راشد", "وسيم", "زيد", "أمير", "حمزة", "جمال", "عثمان", "قاسم", "هادي",
  "رفيق", "سامي", "وسام", "بلال", "فراس", "خالد", "فيصل", "ماجد", "طلال", "نايف",
  "سلطان", "بدر", "تركي", "مشعل", "عادل", "رائد", "زياد", "أنس", "معاذ", "غانم",
]

/** Stable per name — the same character is the same person every time. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/**
 * What to PRINT for this person. Never what to store, key, or send to a model.
 *
 * The Latin name stays the identity everywhere — `faceSeedFor`, the @mention
 * system, the saved thread, the prompt. Only the pixels change.
 */
export function displayName(host: string, gender: "female" | "male" | undefined, locale: string): string {
  if (locale !== "ar" || !host) return host
  const already = SCRIPT[host]
  if (already) return already
  const pool = gender === "male" ? AR_M : AR_F
  return pool[hash(host) % pool.length]
}

/** Every Arabic name that can appear, for a test to check none is left in Latin. */
export const ALL_ARABIC_NAMES: readonly string[] = [...Object.values(SCRIPT), ...AR_F, ...AR_M]
