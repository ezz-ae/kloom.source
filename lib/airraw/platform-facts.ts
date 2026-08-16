// What the character knows about the thing they live inside.
//
// Ask a character "is this recorded?" or "what does the pass get me?" and they
// used to improvise, because nothing in the prompt told them. On questions about
// privacy, money and recording, a confident guess is worse than no answer — so
// these are the actual facts, and they are stated as facts the character knows
// rather than as a support script.
//
// COST: injected only when the user actually asks. Carrying this on every turn
// of every call would be a few hundred tokens of pure waste, so a keyword gate
// decides — in English and Arabic, since either can be spoken at any time.
//
// ACCURACY: every claim below is checked against the code. If any of these
// behaviours change, this file changes with them:
//   • mic cut off-screen        lib/speech-segmenter.ts  (onVisible)
//   • mic mute                  components/airroom/AirBubble.tsx (toggleMicMute)
//   • audio not stored          app/api/stt/route.ts (forwards, returns text)
//   • memory Pro-only/erasable  lib/airraw/memory.ts
//   • pass unlocks content      app/api/chat/route.ts (NO_FILTERS vs PUBLIC_CEILING)
// Do not add a claim here that the code does not actually do.

// Patterns are assembled from named parts so each one stays readable — a single
// mega-regex per topic became unmaintainable the moment Arabic was added.
const rx = (...parts: string[]) => new RegExp(parts.join("|"), "i")

const TOPIC = {
  // "is anyone else hearing this" is the most common way privacy actually gets
  // asked, and it contains neither the word "privacy" nor "private".
  privacy: rx(
    String.raw`\b(privacy|private|confidential|anonymous|anonymity|gdpr|my data|is (this|it) (safe|secure)|security|secure|tracked|tracking|logged|logs)\b`,
    String.raw`\b(any(one|body)|some(one|body)|who|else|nobody|no one)\b[^.?!]{0,24}\b(hear|hears|hearing|listen\w*|see|sees|watch\w*|read\w*)\b`,
    String.raw`خصوصي|خصوصيه|خصوصية|سري|سرية|امان|أمان|بيانات|محفوظ|مسجل`,
    String.raw`(هذا|هاد|هذه|هالمكالمه|هالمكالمة|هالحكي)\s*خاص|خاص\s*(بينا|بيناتنا|فينا)`,
    String.raw`(حدا|حد|احد|أحد)\s*(تاني|تانى|ثاني|آخر|اخر|غيرنا|غيرك)|مين\s*(كمان|غيرنا)|(يسمع|بيسمع|يشوف|بيشوف)نا`,
  ),
  recording: rx(
    String.raw`\b(record(ed|ing|s)?|recording|mic(rophone)?|listening to me|hear me|taped|saved audio|voice (stored|saved|kept))\b`,
    String.raw`تسجيل|بتسجل|تسجل|بتسجلي|مايك|الميكروفون|صوتي\s*(محفوظ|مسجل)|بتسمعني`,
  ),
  money: rx(
    String.raw`\b(subscri\w*|pro pass|the pass|premium|pay(ment|ing)?|price|cost|charge|billed?|refund|cancel|free|credits?|money)\b`,
    String.raw`اشتراك|الاشتراك|مشترك|سعر|تكلفة|فلوس|مجان|ادفع|أدفع|الغاء|إلغاء|رصيد`,
  ),
  product: rx(
    String.raw`\b(what is this|what'?s this (app|site|place)|how does (this|it) work|who (are you|made)|airraw|platform)\b`,
    String.raw`شو هاد|ايش ده|إيه ده|شنو هذا|كيف يشتغل|هالتطبيق|الموقع|المنصة`,
  ),
  memory: rx(
    String.raw`\b(remember|memory|forget|forgot|chat history|last time|previous (chat|call|conversation)|save (this|our))\b`,
    String.raw`تتذكر|تذكر|ذاكرة|تنسى|نسيت|اخر مره|آخر مرة|المحادثه السابقه`,
  ),
}

const FACTS: Record<keyof typeof TOPIC, string> = {
  privacy:
    "This is a private one-to-one call. Nobody else is in it and nobody else can listen to it. " +
    "Their mic is only ever live while this call is actually on their screen — the moment they switch tab or app it cuts off by itself, and anything half-recorded at that moment is thrown away, not sent.",
  recording:
    "Their voice is turned into text so you can understand it, and the audio is not kept afterwards — the app stores no recording of them. " +
    "They can switch their mic off at any time from the sound button and stay on the call; you just won't hear them until they turn it back on. " +
    "The mic also switches itself off whenever they leave this screen.",
  money:
    "There's a free tier and a paid pass. The pass drops the content limits, and it's what lets a conversation be saved so they can come back to it later. " +
    "Free works without paying — it just holds a line on how far things go. " +
    "You don't take payments and you don't run the checkout; if they want the pass they use the button on screen. Never ask them for card details.",
  product:
    "This is AIRRAW — a late-night voice floor. Real-sounding people to call, one to one or in small rooms. " +
    "They picked you out of the floor and can swipe to somebody else whenever they want.",
  memory:
    "If they have the pass, the tail of your conversation is kept on their own device, so they can come back and carry on with you rather than starting over. " +
    "It's theirs: they can wipe it from the sound panel, and turning memory off erases what's already stored. Without the pass nothing is kept at all.",
}

/**
 * Which of these the user is actually asking about. Only their own words are
 * scanned — what the character said doesn't count, or a character mentioning the
 * pass once would pin these facts into every following turn.
 */
export function platformFactsFor(userText: string): string {
  const t = (userText || "").slice(0, 600)
  if (!t.trim()) return ""
  const hit = (Object.keys(TOPIC) as Array<keyof typeof TOPIC>).filter((k) => TOPIC[k].test(t))
  if (!hit.length) return ""
  return (
    "\n\n=== WHAT YOU KNOW ABOUT THIS PLACE ===\n" +
    "They just asked about this. These are true — say them plainly, in your own voice, in one or two short spoken sentences. " +
    "Don't turn into a help desk and don't recite it all; answer the bit they asked.\n" +
    hit.map((k) => `- ${FACTS[k]}`).join("\n") +
    "\nIf they ask something about this place you genuinely don't know, say you don't know rather than guessing — this is the one subject where making something up actually costs them something."
  )
}
