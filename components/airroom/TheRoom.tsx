"use client"

/**
 * THE ROOM — where the site lands, and the door into every private conversation.
 *
 * You arrive inside a conversation already happening. Fourteen people, most of
 * them writing, a few of them talking out loud. You read for ten seconds. You
 * can say something — type it, or hold the mic — and someone answers you by
 * name. When one of them catches you, you tap them, and their card peels them
 * off into a private thread.
 *
 * THE POINT IS THAT YOU CATCH SOMEONE. A card on a deck tells you a stranger is
 * interesting. A room lets you notice it — she said the sharp thing, he laughed
 * at the wrong moment, that one spoke instead of typing. Wanting someone because
 * of how they behaved in a crowd is the entire difference between this and a
 * catalogue, and it is why every line here is built to be DISTINCT rather than
 * merely present.
 *
 * ── HOW THEY WRITE: with texture ─────────────────────────────────────────────
 *
 * "One line, lowercase, casual" produced fourteen people writing in one voice —
 * a room that reads as a single bored narrator. Each person now has a fixed way
 * of writing (drawn once from their seed, like their face), a mood that changes
 * per line, and a rotating kind of thing to say: a jab, a confession, a callback
 * to something said earlier, a one-word reply, a question aimed at somebody by
 * name. Texture is what makes one of them stand out from the other thirteen.
 *
 * ── HOW THEY SPEAK: not all of them, not all the time ────────────────────────
 *
 * A few of them are TALKERS. Roughly one line in four from a talker is spoken
 * aloud rather than written — you hear a voice come out of the room, with a
 * small badge on the line. That is the product's actual capability shown
 * unprompted, and a spoken line is the single most noticeable thing a person in
 * a chat can do. It is also the expensive thing: a written line costs LLM
 * tokens, a spoken one costs a TTS request too. The ratio keeps it a garnish.
 *
 * ── AND IT NEVER SPENDS WITH NOBODY WATCHING ────────────────────────────────
 *
 * Stops on a hidden tab, stops while a card is open, never two requests in
 * flight. A room generating for an empty screen is a bill with no reader.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { RoomChips } from "@/components/airroom/ChipBar"
import { groupCast, faceSeedFor, type Cluster } from "@/lib/airroom/roster"
import { writtenCast, langFor, CAST_COUNT, writtenFor, identityFor, soulPrompt } from "@/lib/airraw/cast50"

/** The written soul behind a cluster, as prompt text — or "" if generated. */
function soulOf(c: Cluster): string {
  const m = writtenFor(c.key)
  if (!m) return ""
  return soulPrompt(identityFor(m, langFor(getLangPrefs().primary)))
}
import { dossierLine, cardLinesFor, dossierForSeed } from "@/lib/airraw/dossier"
import { renderPersona } from "@/lib/airraw/persona"
import { useT } from "@/lib/airraw/i18n"
import { displayName } from "@/lib/airraw/arabic-names"
import { getLangPrefs, matchesPrefs } from "@/lib/airraw/lang-prefs"
import { getProToken, isPro } from "@/lib/airroom/pro"
import { getProfile } from "@/lib/airroom/profile"
import { pinnedVoice, pinFromResponse, awaitPin, claimFirst } from "@/lib/airraw/voice-pin"
import { visitorId } from "@/lib/airraw/visitor"
import { listenOnce, canListen, type VoiceOnceHandle } from "@/lib/voice-once"
import { LANGUAGE_TO_BCP47 } from "@/lib/languages"
import { Face } from "@/components/airroom/Face"
import { keepLease, claimLease, holdsLease } from "@/lib/airraw/one-tab"
import { track } from "@/lib/airraw/track"

/** Heat → the colour a person is drawn in, same gradient as the rest of the floor. */
const dot = (f: number) => `hsl(${Math.round(320 - f * 300)},85%,${58 + f * 6}%)`

function hash(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
const pickBy = <T,>(arr: T[], seed: string, salt: string): T => arr[hash(seed + "|" + salt) % arr.length]
const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

interface Line {
  who: Cluster | null      // null = the visitor
  text: string
  at: number
  spoken?: boolean         // came out loud
  toYou?: boolean          // addressed to the visitor
  /**
   * A WHISPER: sent to one person, in the public room, and only that person can
   * read it. From a character to the visitor it is the hook — a private line in
   * a public place, an invitation to go somewhere alone. From the visitor to a
   * character it is how you get a little of that conversation before committing
   * to the whole one. Nobody else in the room ever sees a whisper, and the room
   * transcript sent to the model enforces that.
   */
  whisper?: boolean
  /** For a visitor's whisper: the key of the one person who can read it. */
  to?: string
}

const CAST = 14
// How many of the room are hand-written. The rest is generated depth.
const WRITTEN_IN_ROOM = 10
const MAX_LINES = 48
const GAP_MS = 6500
/** How many of the fourteen ever speak aloud. */
const TALKERS = 5
/** Of a talker's lines, one in this many is spoken. */
const VOICE_EVERY = 4
/**
 * After this many lines from the room, and every this-many after, one person
 * whispers to the visitor. Rare on purpose: a whisper is an invitation, and an
 * invitation every minute is spam. Each person whispers at most once.
 */
const WHISPER_EVERY = 5
/**
 * THE FREE ROOM HAS AN END. A visitor without a pass gets this many lines from
 * the room — a few minutes of it, long enough to be whispered to several times
 * and to catch someone — and then the room goes quiet behind a soft wall that
 * says exactly what keeps it going. Two reasons, and they are the same reason:
 * a free visitor generating lines for an hour is a bill with no sale in it, and
 * the moment the room stops is the moment the pass is worth something concrete.
 * A pass holder never sees the wall.
 */
const FREE_ROOM_LINES = 30
/**
 * How long the room keeps talking to itself with nobody touching anything.
 *
 * This loop is the only thing in the product that spends money without being
 * asked to: fourteen characters, a line every few seconds, one in four of them
 * spoken aloud in the premium engine. Left running on a focused tab that is
 * roughly 550 model calls and 140 voice calls an hour, for an empty chair.
 *
 * The line cap above bounds a free visitor, but it is written `!pro` — a pass
 * holder had no ceiling at all, which is precisely backwards: they are the ones
 * whose minutes we are paying for. Presence is the right gate, not tier. A room
 * nobody is in is worth nothing to watch and costs the same as one that is.
 *
 * Five minutes, not one — someone can reasonably sit and listen for a while
 * without touching the screen, and the room saying "still there?" every sixty
 * seconds would be worse than the spend it saves.
 */
const IDLE_MS = 5 * 60_000
/**
 * And a much shorter fuse once the window is no longer the one in front.
 *
 * `document.hidden` only becomes true when the tab is properly backgrounded. A
 * tab that is still "visible" behind another window, or on a second monitor
 * nobody is looking at, keeps generating at full rate — that is the same empty
 * chair, and it is the common case on a desktop. Blur is the honest signal that
 * attention left, and five seconds is enough to absorb clicking the address bar
 * or alt-tabbing to paste something and coming straight back.
 */
const BLUR_MS = 5_000

/**
 * HOW EACH PERSON WRITES — fixed per person, like a face. This is what makes
 * one of them recognisable from across the room three lines later.
 */
const TEXTURE = [
  "you write in fragments. two, three words. never a full sentence when a shard will do",
  "you write long messy run-on lines with no punctuation that arrive all at once like you thought them",
  "you use CAPS on exactly one word per line, the one that matters, and never anywhere else",
  "you trail off... a lot... and then land the point in the last two words",
  "you write short flat declaratives. no hedging. period at the end of everything.",
  "you tease — every line has a hook in it, a 'oh really' or a 'says you', aimed at someone",
  "you write like you're half-laughing, 'lmao', 'no bc', 'wait', but the actual point underneath is sharp",
  "you type like you're texting one person even though it's a room — 'u', 'rn', 'idk', no caps",
  "you ask instead of tell. almost everything you write ends in a question, but never a soft one",
  "you're blunt to the point of rude and you don't soften it — one clause, done",
  "you write in lowercase with the occasional line that's just one word. 'no.' 'obviously.' 'god.'",
  "you overshare in a single breath and then act like you didn't — a confession then a shrug",
]

/** Where their head is THIS line. Changes every time; this is the weather. */
const MOOD = [
  "bored and looking for trouble", "amused at someone in the room", "flirting, but with the whole room, not one person",
  "tired and honest because of it", "arguing, and enjoying it", "confessing something small", "restless, wants something to happen",
  "warm tonight, uncharacteristically", "suspicious of what was just said", "showing off a little", "quietly into someone here and hiding it badly",
]

/** What KIND of thing to say. Rotated so the room isn't fourteen reactions in a row. */
const KIND = [
  "react to the last thing said — agree hard, or don't",
  "say something about your own night, unprompted",
  "answer someone in the room BY NAME, pushing back on what they said",
  "make a small confession, then move on like it was nothing",
  "one word or two. that's the whole line.",
  "call back to something said earlier in the room and twist it",
  "ask one specific person in the room a question they won't want to answer",
  "say the hot take you actually believe (from your facts), no warm-up",
]

/** A line with its @mentions lit up in that person's colour and tappable. */
function Mentions({ text, cast, you, onTap }: { text: string; cast: Cluster[]; you: string; onTap: (c: Cluster) => void }) {
  const parts = text.split(/(@[\p{L}\p{N}_'-]+)/u)
  return (
    <>
      {parts.map((part, i) => {
        if (!part.startsWith("@")) return <span key={i}>{part}</span>
        const name = part.slice(1).toLowerCase()
        const c = cast.find((x) => x.host.toLowerCase() === name)
        if (c) return (
          <button key={i} onClick={(e) => { e.stopPropagation(); onTap(c) }}
            style={{ display: "inline", background: `${dot(c.f)}22`, color: dot(c.f), border: "none", borderRadius: 6, padding: "0 4px", fontWeight: 700, fontSize: "inherit", fontFamily: "inherit", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>{part}</button>
        )
        if (name === you.toLowerCase()) return <span key={i} style={{ background: "rgba(240,232,255,.16)", color: "#fff", borderRadius: 6, padding: "0 4px", fontWeight: 700 }}>{part}</span>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export function TheRoom({ onPrivate, onPass, onChips, topic = "tonight" }: {
  onPrivate: (c: Cluster) => void
  /** Open the pass sheet — the free room has reached its end. */
  onPass: () => void
  /** Open the chip cage. Optional: a room without it simply doesn't show a balance. */
  onChips?: () => void
  topic?: string
}) {
  // NO ONE REPEATS. groupCast seeds member i as seed*7+i+1, so two rooms whose
  // seeds are one apart share seven of fourteen people — the same faces back the
  // next hour. Spacing the room seed by 3 puts consecutive rooms 21 seeds apart,
  // past the 14 a room draws, so this hour's crowd and the next hour's share
  // nobody. And a room can never hold the same person twice: names walk a
  // permutation, but this is the guarantee the visitor was promised, so it is
  // enforced rather than assumed — dedupe by face key AND by name.
  const t = useT()
  const seed = useMemo(() => Math.floor(Date.now() / 3_600_000) * 3, [])
  // WHO IS IN THE ROOM: the written cast first, the generated floor behind them.
  //
  // The generator can make thousands of plausible people and that is what makes
  // this place feel endless — but plausible is the register that reads as filler,
  // and a room built entirely from it felt like nobody in particular. The fifty
  // hand-written characters (lib/airraw/cast50) are who you actually meet; the
  // rest fill the room out so it is still a crowd rather than a line-up.
  //
  // They arrive in the language the visitor set, which changes their name and
  // face and nothing else about them — see the localisation rule in cast50.
  const cast = useMemo(() => {
    const lang = langFor(getLangPrefs().primary)
    const written = writtenCast(seed, Math.min(WRITTEN_IN_ROOM, CAST_COUNT), lang)
    const seenFace = new Set<string>(written.map((c) => faceSeedFor(c) || c.host))
    const seenName = new Set<string>(written.map((c) => c.host))
    // The filler behind the written cast goes through the SAME language and
    // origin filter the deck uses. It did not before — groupCast calls
    // makeCharacter directly and never consulted matchesPrefs — so an Arabic
    // floor came up with Faye, Mireille and Remi sitting in it, which is the one
    // thing the Arabic entrance promises will not happen.
    //
    // Drawn from a deliberately larger pool: about one generated character in
    // seven opens in Arabic, so asking for CAST + 6 and then filtering would
    // leave the room half empty.
    // groupCast is a pure function over a seed — no I/O — so a wide draw costs
    // microseconds, once per hourly room seed.
    const filled = groupCast(seed, 0.5, (CAST + 6) * 10).filter((c) => {
      const fk = faceSeedFor(c) || c.host
      if (!matchesPrefs(fk)) return false
      if (seenFace.has(fk) || seenName.has(c.host)) return false
      seenFace.add(fk); seenName.add(c.host); return true
    }).slice(0, Math.max(0, CAST - written.length))
    return [...written, ...filled]
  }, [seed])
  // The talkers: a stable subset, so the same person is "the one who speaks"
  // for the whole visit. Being one of the few who speaks IS part of who they are.
  const talkers = useMemo(() => new Set(cast.filter((_, i) => hash(`${seed}|talk|${i}`) % CAST < TALKERS).slice(0, TALKERS).map((c) => c.key)), [cast, seed])

  const [lines, setLines] = useState<Line[]>([])
  const [open, setOpen] = useState<Cluster | null>(null)
  const [draft, setDraft] = useState("")
  const [mic, setMic] = useState<"idle" | "listening" | "thinking">("idle")
  const [speaking, setSpeaking] = useState<string | null>(null)   // key of who is talking aloud
  const [walled, setWalled] = useState(false)                     // the free room has ended
  const walledRef = useRef(false)                                 // so the wall event fires once, not every tick
  const pro = useMemo(() => (typeof window !== "undefined" ? isPro() : false), [])
  const [recent, setRecent] = useState<Set<string>>(new Set())    // who has said something lately — their face glows

  const scroller = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const busy = useRef(false)
  const openRef = useRef(false)
  const linesRef = useRef<Line[]>([])
  const replyDue = useRef(false)          // the visitor just spoke — the next line answers them
  const spokenCount = useRef<Record<string, number>>({})
  const micHandle = useRef<VoiceOnceHandle | null>(null)
  const aiLines = useRef(0)                          // how much the room has said — paces the whispers
  /** Last sign of a person. The room only talks while someone is here to hear it. */
  const lastSeen = useRef(Date.now())
  /** When the window lost focus, or 0 while it has it. */
  const blurredAt = useRef(0)
  /** False while another tab holds the room — see lib/airraw/one-tab. */
  const [live, setLive] = useState(true)
  const [dozing, setDozing] = useState(false)
  const wake = () => { lastSeen.current = Date.now(); setDozing((d) => (d ? false : d)) }
  const whispered = useRef<Set<string>>(new Set())   // who has already whispered to the visitor
  const whisperBack = useRef<Cluster | null>(null)   // the visitor whispered to this person; they answer in kind
  const replyTo = useRef<Cluster | null>(null)       // the visitor @mentioned this person; they answer, in public
  const you = useMemo(() => (typeof window !== "undefined" ? getProfile().name : "you"), [])

  /**
   * @NAME. Typing @ and a name aims a line at one person, and that person is the
   * one who answers — in public, so the room sees it. Mentions are also how the
   * characters address each other and you, and they are highlighted in every
   * line so "someone just said something to me" is visible at a glance.
   */
  const mentionOf = (text: string): Cluster | null => {
    const m = text.match(/@([\p{L}\p{N}_'-]+)/u)
    if (!m) return null
    const name = m[1].toLowerCase()
    return cast.find((c) => c.host.toLowerCase() === name) || null
  }
  // The unfinished @token at the end of the draft — what the picker filters by.
  const typing = draft.match(/(?:^|\s)@([\p{L}\p{N}_'-]*)$/u)
  const suggestions = typing
    ? cast.filter((c) => c.host.toLowerCase().startsWith(typing[1].toLowerCase())).slice(0, 8)
    : []
  const insertMention = (c: Cluster) =>
    setDraft((d) => d.replace(/(?:^|\s)@[\p{L}\p{N}_'-]*$/u, (m) => (m.startsWith(" ") ? " " : "") + `@${c.host} `))

  useEffect(() => { linesRef.current = lines }, [lines])
  useEffect(() => { openRef.current = !!open }, [open])

  const push = (l: Line) => {
    setLines((prev) => [...prev, l].slice(-MAX_LINES))
    if (l.who) {
      const k = l.who.key
      setRecent((r) => new Set([...r, k]))
      setTimeout(() => setRecent((r) => { const n = new Set(r); n.delete(k); return n }), 12_000)
    }
  }

  // ── say a line out loud ───────────────────────────────────────────────────
  const speakAloud = async (text: string, m: Cluster) => {
    try {
      const who = faceSeedFor(m) || m.host
      const lang = getLangPrefs().primary || "English"
      await awaitPin(who, lang)
      const req = fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, personaName: m.host, seedKey: who, gender: m.gender, language: lang, voiceId: m.voiceId, elevenId: pinnedVoice(who, lang), proToken: getProToken(), visitorId: visitorId(), mode: "voice" }),
      })
      claimFirst(who, lang, req)
      const res = await req
      if (!res.ok) return false
      pinFromResponse(who, lang, res)
      const url = URL.createObjectURL(await res.blob())
      const a = audioRef.current
      if (!a) return false
      a.src = url
      setSpeaking(m.key)
      // NEVER WEDGE THE ROOM ON AUDIO. This awaited `ended`/`error` after a
      // play() that might have been refused — and a refused play() fires
      // neither, so `busy` stayed true forever and the room went silent for
      // good. On a phone with autoplay blocked that is every visitor. Now: if
      // play() is refused, give up on the sound at once (the text is already on
      // screen); if it plays, wait for the end but never longer than a clip
      // could be. Found by a probe whose stubbed audio could not play.
      const played = await a.play().then(() => true).catch(() => false)
      if (played) {
        await Promise.race([
          new Promise<void>((r) => { a.onended = () => r(); a.onerror = () => r() }),
          new Promise<void>((r) => setTimeout(r, 30_000)),
        ])
      }
      setSpeaking(null)
      URL.revokeObjectURL(url)
      return played
    } catch { setSpeaking(null); return false }
  }

  // ── the room talks ────────────────────────────────────────────────────────
  useEffect(() => {
    let stopped = false
    const ctrl = new AbortController()

    const speak = async () => {
      if (stopped || busy.current) return
      if (typeof document !== "undefined" && document.hidden) return
      if (openRef.current) return
      // Nobody has touched anything in a while. Stop generating and say so —
      // going quiet without a word reads as broken, and one tap brings it back.
      if (Date.now() - lastSeen.current > IDLE_MS) { setDozing(true); return }
      // Another tab is the live one. Nothing to show and nothing to spend.
      if (!holdsLease()) return
      // The window is not the one in front any more.
      if (blurredAt.current && Date.now() - blurredAt.current > BLUR_MS) return
      // The free room's end. Checked BEFORE a request is spent, so the wall
      // costs nothing to stand behind. Pass holders are never counted.
      if (!pro && aiLines.current >= FREE_ROOM_LINES) {
        if (!walledRef.current) { walledRef.current = true; setWalled(true); try { track("room_wall") } catch { /* */ } }
        return
      }
      busy.current = true
      try {
        const history = linesRef.current
        const answering = replyDue.current
        replyDue.current = false

        const lately = history.slice(-5).map((l) => l.who?.key).filter(Boolean)
        const eligible = cast.filter((c) => !lately.includes(c.key))
        // When the visitor has just spoken, prefer someone who can answer OUT
        // LOUD. Being spoken to is the strongest thing this room can do to a
        // person, and it is spent only at the moment they engaged — the one time
        // a TTS request is plainly worth it. Anyone else's lines stay cheap.
        const talkersFree = (eligible.length ? eligible : cast).filter((c) => talkers.has(c.key))
        // A whisper turn: the visitor whispered to someone and they answer in
        // kind; or the room has said enough that somebody leans in. Never on a
        // turn that is already answering the visitor out loud — one thing at a time.
        const back = whisperBack.current
        whisperBack.current = null
        const called = replyTo.current
        replyTo.current = null
        const leanIn = !answering && !back && aiLines.current >= 3 && aiLines.current % WHISPER_EVERY === 0
        const unwhispered = (eligible.length ? eligible : cast).filter((c) => !whispered.current.has(c.key))
        const whisper = !!back || (leanIn && unwhispered.length > 0)
        const who = back
          ? back
          : called ? called
          : whisper ? rand(unwhispered)
          : rand(answering && talkersFree.length ? talkersFree : (eligible.length ? eligible : cast))
        const id = faceSeedFor(who) || who.host
        const texture = pickBy(TEXTURE, id, "texture")
        const mood = rand(MOOD)
        const kind = whisper
          ? `WHISPER one line to ${you}, privately — nobody else in the room can read it. ` +
            `Something you would not say out loud in front of them: an invitation, a tease, a small secret, a "come here". ` +
            `Make them want to answer you alone.${back ? ` They just whispered to you first; answer that.` : ""}`
          : answering
          ? `${you} just said something to the room${called ? ` — to YOU, by name` : ""}. Answer THEM as @${you}, and mean it — this is the one line that decides whether they stay.`
          : rand(KIND)

        const prefs = getLangPrefs()
        const persona = renderPersona(who, "room", {
          soul: soulOf(who),
          language: prefs.primary || "English",
          mood, kind, texture, you,
        })

        // A whisper is readable only by its two ends. Everyone else's transcript
        // simply does not contain it — the model cannot react to what its
        // character could not have read.
        const canRead = (l: Line) => !l.whisper || l.who?.key === who.key || (l.who === null && l.to === who.key)
        const msgs = history.slice(-14).filter(canRead).slice(-12).map((l) =>
          l.who?.key === who.key
            ? { role: "assistant" as const, content: l.text }
            : { role: "user" as const, content: `${l.who ? l.who.host : you}${l.whisper ? " (whispering to you)" : ""}: ${l.text}` },
        )
        if (!msgs.length) msgs.push({ role: "user" as const, content: `(the room just went quiet — ${topic})` })

        const res = await fetch("/api/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ persona, proToken: getProToken(), messages: msgs }),
          signal: ctrl.signal,
        })
        if (!res.ok || !res.body) return
        let full = ""
        const rd = res.body.getReader()
        const dec = new TextDecoder()
        for (;;) {
          const { done, value } = await rd.read()
          if (done) break
          full += dec.decode(value)
          if (full.length > 400) { try { await rd.cancel() } catch { /* */ } break }
        }
        const text = full.replace(/^\s*[\w\s]{0,20}:\s*/, "").replace(/^["“]|["”]$/g, "").replace(/\s+/g, " ").trim().slice(0, 240)
        if (!text || stopped) return

        // Spoken, or written? Talkers speak one line in VOICE_EVERY; everyone
        // else only ever writes. Answering the visitor is always worth a voice.
        aiLines.current++
        if (whisper) {
          // A whisper is text by nature — and it is never spoken into the room,
          // which would rather defeat it.
          whispered.current.add(who.key)
          push({ who, text, at: Date.now(), toYou: true, whisper: true })
          try { track("room_whisper_received") } catch { /* */ }
          return
        }
        const n = (spokenCount.current[who.key] = (spokenCount.current[who.key] || 0) + 1)
        const aloud = talkers.has(who.key) && (answering || n % VOICE_EVERY === 0)
        push({ who, text, at: Date.now(), toYou: answering, spoken: aloud })
        if (aloud) await speakAloud(text, who)
      } catch { /* a dropped line is not worth surfacing */ }
      finally { busy.current = false }
    }

    speak()
    const id = setInterval(speak, GAP_MS)
    const onVis = () => { if (!document.hidden) { wake(); speak() } }
    document.addEventListener("visibilitychange", onVis)
    // Any real sign of a person counts, not just speaking — scrolling the room
    // or reaching for the mic is someone being here.
    const onUse = () => { lastSeen.current = Date.now() }
    window.addEventListener("pointerdown", onUse, { passive: true })
    window.addEventListener("keydown", onUse, { passive: true })
    // Focus is a better signal than visibility on a desktop, where a window can
    // be "visible" and entirely unattended behind another one.
    const onBlur = () => { blurredAt.current = Date.now() }
    const onFocus = () => { blurredAt.current = 0; wake(); speak() }
    window.addEventListener("blur", onBlur)
    window.addEventListener("focus", onFocus)
    // Only one tab generates. The newest claims it, so the tab in front of you
    // is always the live one; the others go quiet and say why.
    const release = keepLease((mine) => setLive(mine))
    return () => {
      stopped = true
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("pointerdown", onUse)
      window.removeEventListener("keydown", onUse)
      window.removeEventListener("blur", onBlur)
      window.removeEventListener("focus", onFocus)
      release()
      ctrl.abort()
      try { micHandle.current?.cancel() } catch { /* */ }
    }
  }, [cast, talkers, topic, you])

  // ── you say something ─────────────────────────────────────────────────────
  const say = (t: string) => {
    const text = t.replace(/\s+/g, " ").trim().slice(0, 240)
    if (!text) return
    push({ who: null, text, at: Date.now() })
    setDraft("")
    wake()
    replyDue.current = true
    // THE FUNNEL, named. Every step from "read the room" to "paid" fires an
    // event, so where people leave is a number and not a guess. Say → whisper →
    // answer alone → wall → pass. Without these the room is a black box that
    // either converts or doesn't, with nothing to change.
    try { track("room_say", { mention: !!mentionOf(text) }) } catch { /* never block the room on analytics */ }
    // Aimed at someone? Then they are the one who answers, in public.
    replyTo.current = mentionOf(text)
  }

  /** Whisper to one person. They alone can read it, and they answer in kind. */
  const whisperTo = (c: Cluster, t: string) => {
    const text = t.replace(/\s+/g, " ").trim().slice(0, 240)
    if (!text) return
    push({ who: null, text, at: Date.now(), whisper: true, to: c.key })
    whisperBack.current = c
    try { track("room_whisper_sent") } catch { /* */ }
  }

  /**
   * Go private WITH the whisper already said. The private thread opens on the
   * character's first line (cluster.lines[0]), so prepending the whisper means
   * she has already said it when you arrive — the conversation continues instead
   * of restarting from a canned hello.
   */
  const answerAlone = (c: Cluster, said: string) => {
    try { track("room_whisper_answered") } catch { /* */ }
    onPrivate({ ...c, lines: [said, ...c.lines] })
  }

  const holdMic = () => {
    if (mic !== "idle" || !canListen()) return
    const lang = getLangPrefs().primary || "English"
    micHandle.current = listenOnce({
      lang: (LANGUAGE_TO_BCP47[lang] || "en").split("-")[0],
      bcp47: LANGUAGE_TO_BCP47[lang] || "en-US",
      maxMs: 12_000,
      onState: (s) => setMic(s),
      onText: (t) => { setMic("idle"); say(t) },
      onError: () => setMic("idle"),
    })
  }

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140
    if (atBottom) el.scrollTop = el.scrollHeight
  }, [lines])

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <audio ref={audioRef} playsInline />

      {/* ── who is here ── faces first, so the room has people before it has words.
          A face glows while its person has been talking lately; one of them pulses
          while they are actually speaking. That is how you notice someone. */}
      {/* The faces scroll; the chip count does not. They share one band rather
          than the count floating above it — a balance overlaid on this strip sits
          on top of whoever is at that end of the scroll. */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px 6px" }}>
      <div style={{ flex: 1, minWidth: 0, overflowX: "auto", display: "flex", gap: 10, WebkitOverflowScrolling: "touch" }}>
        {cast.map((c) => {
          const live = speaking === c.key
          const warm = recent.has(c.key)
          return (
            <button key={c.key} onClick={() => setOpen(c)} aria-label={t("open {name}'s profile", { name: displayName(c.host, c.gender, t.locale) })}
              style={{ flexShrink: 0, width: 54, background: "none", border: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              <span style={{ position: "relative", display: "block", width: 54, height: 54 }}>
                {live && <span style={{ position: "absolute", inset: -5, borderRadius: "50%", border: `2px solid ${dot(c.f)}`, animation: "roompulse 1.4s ease-out infinite" }} />}
                <span style={{ display: "block", width: 54, height: 54, borderRadius: "50%", overflow: "hidden", border: `1.5px solid ${dot(c.f)}${warm || live ? "" : "44"}`, boxShadow: warm ? `0 0 16px -2px ${dot(c.f)}88` : "none", transition: "box-shadow .4s, border-color .4s", background: "#160f24" }}>
                  <Face persona={{ name: c.host, gender: c.gender, seed: faceSeedFor(c) }} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: warm || live ? 1 : 0.72, transition: "opacity .4s" }} />
                </span>
                {talkers.has(c.key) && <span aria-hidden style={{ position: "absolute", right: -2, bottom: -2, fontSize: 10, background: "#0d0818", borderRadius: 8, padding: "1px 3px", border: ".5px solid rgba(255,255,255,.15)" }}>🎙</span>}
              </span>
              <span style={{ display: "block", fontSize: 10.5, color: warm ? "#f0e8ff" : "rgba(240,232,255,.5)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color .4s" }}>{displayName(c.host, c.gender, t.locale)}</span>
            </button>
          )
        })}
      </div>
        {onChips && <RoomChips onOpen={onChips} />}
      </div>

      {/* ── the conversation ── */}
      <div ref={scroller} style={{ flex: 1, overflowY: "auto", padding: "4px 12px 12px", WebkitOverflowScrolling: "touch" }}>
        {!lines.length && (
          <div style={{ color: "rgba(240,232,255,.3)", fontSize: 13, textAlign: "center", padding: "28px 0" }}>{t("the room is waking up…")}</div>
        )}
        {lines.map((l, i) => l.who && l.whisper ? (
          // A whisper to you. Only you can read it, and tapping it is how you
          // answer — alone, with what they said already on the table.
          <button key={`${l.at}-${i}`} onClick={() => answerAlone(l.who as Cluster, l.text)}
            aria-label={t("{name} whispered to you — answer alone", { name: displayName(l.who.host, l.who.gender, t.locale) })}
            style={{ display: "flex", gap: 9, alignItems: "flex-start", width: "calc(100% + 20px)", margin: "0 -10px 11px", padding: "9px 10px", borderRadius: 12, textAlign: "left", cursor: "pointer", background: `${dot(l.who.f)}10`, border: `.5px dashed ${dot(l.who.f)}77`, WebkitTapHighlightColor: "transparent" }}>
            <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", overflow: "hidden", border: `1px solid ${dot(l.who.f)}88`, background: "#160f24" }}>
              <Face persona={{ name: l.who.host, gender: l.who.gender, seed: faceSeedFor(l.who) }} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontSize: 10, color: `${dot(l.who.f)}dd`, letterSpacing: .8, textTransform: "uppercase" }}>🤫 {t("{name} whispered to you · only you can see this", { name: displayName(l.who.host, l.who.gender, t.locale) })}</span>
              <span style={{ display: "block", fontSize: 14.5, lineHeight: 1.4, color: "#f3ecff", fontStyle: "italic", marginTop: 2 }}>{l.text}</span>
              <span style={{ display: "block", fontSize: 11, color: `${dot(l.who.f)}`, marginTop: 5, fontWeight: 700 }}>{t("answer {name} alone →", { name: displayName(l.who.host, l.who.gender, t.locale) })}</span>
            </span>
          </button>
        ) : !l.who && l.whisper ? (
          <div key={`${l.at}-${i}`} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginBottom: 11 }}>
            <span style={{ fontSize: 10, color: "rgba(240,232,255,.4)", letterSpacing: .8, textTransform: "uppercase", marginBottom: 3 }}>🤫 whispered to {cast.find((c) => c.key === l.to)?.host || "them"}</span>
            <div style={{ maxWidth: "78%", background: "rgba(240,232,255,.06)", border: ".5px dashed rgba(240,232,255,.3)", borderRadius: "14px 14px 3px 14px", padding: "8px 12px", fontSize: 14.5, lineHeight: 1.4, color: "#f6f1ff", fontStyle: "italic" }}>{l.text}</div>
          </div>
        ) : l.who ? (
          <div key={`${l.at}-${i}`} style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 11, padding: l.toYou ? "8px 10px" : 0, marginLeft: l.toYou ? -10 : 0, marginRight: l.toYou ? -10 : 0, borderRadius: 12, background: l.toYou ? `${dot(l.who.f)}14` : "transparent", border: l.toYou ? `.5px solid ${dot(l.who.f)}44` : ".5px solid transparent" }}>
            <button onClick={() => setOpen(l.who)} aria-label={t("open {name}'s profile", { name: displayName(l.who.host, l.who.gender, t.locale) })}
              style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", overflow: "hidden", border: `1px solid ${dot(l.who.f)}55`, background: "#160f24", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              <Face persona={{ name: l.who.host, gender: l.who.gender, seed: faceSeedFor(l.who) }} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                <button onClick={() => setOpen(l.who)} style={{ fontSize: 12, fontWeight: 700, color: dot(l.who.f), background: "none", border: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>{l.who.host}</button>
                {l.spoken && <span style={{ fontSize: 10, color: `${dot(l.who.f)}cc`, letterSpacing: .8, textTransform: "uppercase" }}>🎙 said out loud</span>}
                {l.toYou && <span style={{ fontSize: 10, color: "rgba(240,232,255,.5)", letterSpacing: .8, textTransform: "uppercase" }}>to you</span>}
              </div>
              <div style={{ fontSize: 14.5, lineHeight: 1.4, color: "#ece4f8" }}><Mentions text={l.text} cast={cast} you={you} onTap={setOpen} /></div>
            </div>
          </div>
        ) : (
          <div key={`${l.at}-${i}`} style={{ display: "flex", justifyContent: "flex-end", marginBottom: 11 }}>
            <div style={{ maxWidth: "78%", background: "rgba(240,232,255,.1)", border: ".5px solid rgba(240,232,255,.14)", borderRadius: "14px 14px 3px 14px", padding: "8px 12px", fontSize: 14.5, lineHeight: 1.4, color: "#f6f1ff" }}><Mentions text={l.text} cast={cast} you={you} onTap={setOpen} /></div>
          </div>
        ))}
      </div>

      {/* ── the wall ── the free room has ended. It says so plainly and names
          what keeps it going; a visitor who just got whispered to three times
          has been shown the product, not told about it. */}
      {walled && !pro && (
        <button onClick={() => { try { track("room_wall_tap") } catch { /* */ } ; onPass() }}
          style={{ flexShrink: 0, margin: "0 12px 8px", padding: "13px 14px", borderRadius: 14, textAlign: "center", cursor: "pointer", background: "rgba(232,121,249,.1)", border: ".5px solid rgba(232,121,249,.4)", color: "#f0e8ff", fontSize: 13.5, lineHeight: 1.4, WebkitTapHighlightColor: "transparent" }}>
          the room went quiet — that was the free part.{" "}
          <span style={{ fontWeight: 700, color: "#e879f9" }}>$9 keeps it going for 90 days →</span>
        </button>
      )}

      {/* ── say something ── typed, or held. Cheap for us, and the thing that
          turns watching into being there: you say one line and someone answers
          you by name. That reply is voiced when it can be, because being spoken
          to is the moment people decide to stay. */}
      {suggestions.length > 0 && (
        <div role="listbox" aria-label={t("mention someone")} style={{ flexShrink: 0, display: "flex", gap: 6, overflowX: "auto", padding: "0 12px 6px", WebkitOverflowScrolling: "touch" }}>
          {suggestions.map((c) => (
            <button key={c.key} role="option" onClick={() => insertMention(c)} aria-label={`mention ${c.host}`}
              style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "5px 10px 5px 5px", borderRadius: 999, background: `${dot(c.f)}1a`, border: `.5px solid ${dot(c.f)}55`, color: "#f0e8ff", fontSize: 13, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", overflow: "hidden", background: "#160f24", flexShrink: 0 }}>
                <Face persona={{ name: c.host, gender: c.gender, seed: faceSeedFor(c) }} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </span>
              @{c.host}
            </button>
          ))}
        </div>
      )}
      {/* The room has stopped talking to itself because nobody is here. Said out
          loud, because a room that simply goes silent reads as broken — and the
          honest version is better anyway: it is waiting for you, not failing. */}
      {/* Another tab has the room. Say so and offer it back, rather than leaving
          this one looking broken — and taking it is one tap, because the tab you
          are looking at should be the live one. */}
      {!live && (
        <button onClick={() => { claimLease(); setLive(true); wake() }} aria-label="talk here instead"
          style={{ flexShrink: 0, margin: "0 12px 8px", padding: "11px 14px", borderRadius: 12, textAlign: "left",
            background: "rgba(255,255,255,.05)", border: ".5px solid rgba(255,255,255,.12)", color: "rgba(240,232,255,.65)",
            fontSize: 13.5, fontFamily: "inherit", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          the room is running in another tab — <span style={{ color: "#ff5f8a", fontWeight: 600 }}>{t("tap to move it here")}</span>
        </button>
      )}
      {live && dozing && (
        <button onClick={wake} aria-label="carry on"
          style={{ flexShrink: 0, margin: "0 12px 8px", padding: "11px 14px", borderRadius: 12, textAlign: "left",
            background: "rgba(255,255,255,.05)", border: ".5px solid rgba(255,255,255,.12)", color: "rgba(240,232,255,.65)",
            fontSize: 13.5, fontFamily: "inherit", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          the room went quiet while you were away — <span style={{ color: "#ff5f8a", fontWeight: 600 }}>{t("tap to carry on")}</span>
        </button>
      )}
      <div style={{ flexShrink: 0, display: "flex", gap: 8, alignItems: "center", padding: "8px 12px calc(env(safe-area-inset-bottom) + 5.5rem)" }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") say(draft) }}
          placeholder={mic === "listening" ? t("listening…") : mic === "thinking" ? t("one sec…") : t("say something to the room")}
          aria-label={t("say something to the room")}
          style={{ flex: 1, minHeight: 44, fontSize: 15, color: "#f0e8ff", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.14)", borderRadius: 14, padding: "0 14px", outline: "none" }}
        />
        {canListen() && (
          <button onClick={holdMic} aria-label={t("hold to talk to the room")} disabled={mic !== "idle"}
            style={{ width: 44, height: 44, borderRadius: 14, fontSize: 18, background: mic === "listening" ? "#ff5f8a" : "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.16)", cursor: "pointer", WebkitTapHighlightColor: "transparent", animation: mic === "listening" ? "roompulse 1.2s ease-out infinite" : "none" }}>🎙</button>
        )}
        <button onClick={() => say(draft)} disabled={!draft.trim()} aria-label={t("send")}
          style={{ width: 44, height: 44, borderRadius: 14, fontSize: 16, fontWeight: 700, color: "#180a20", background: draft.trim() ? "#e879f9" : "rgba(255,255,255,.12)", border: "none", cursor: draft.trim() ? "pointer" : "default", WebkitTapHighlightColor: "transparent" }}>↑</button>
      </div>

      <style>{`@keyframes roompulse { 0% { transform: scale(1); opacity: .9 } 100% { transform: scale(1.35); opacity: 0 } }`}</style>

      {open && <ProfileCard c={open} talker={talkers.has(open.key)} onClose={() => setOpen(null)} onPrivate={onPrivate} onWhisper={(t) => { whisperTo(open, t); setOpen(null) }} />}
    </div>
  )
}

/**
 * WHO THIS PERSON IS — the card that turns someone you noticed into someone you
 * message. Everything on it is already true of them: the dossier is what the
 * character is actually told about themselves, drawn from the same seed as the
 * face and the accent, so the card cannot promise one person and open another.
 */
function ProfileCard({ c, talker, onClose, onPrivate, onWhisper }: { c: Cluster; talker: boolean; onClose: () => void; onPrivate: (c: Cluster) => void; onWhisper: (text: string) => void }) {
  const t = useT()
  const [w, setW] = useState("")
  const id = faceSeedFor(c) || c.host
  const card = cardLinesFor(id)
  const d = dossierForSeed(id)
  const accent = dot(c.f)
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(6,5,16,.82)", backdropFilter: "blur(12px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        // Bottom padding clears the fixed dock — a sheet that stops at the safe
        // area lands its last control underneath it.
        style={{ width: "100%", maxWidth: 460, background: "linear-gradient(180deg, rgba(26,20,42,.98), rgba(9,8,16,.98))", borderTop: `.5px solid ${accent}44`, borderRadius: "22px 22px 0 0", padding: "18px 18px calc(env(safe-area-inset-bottom) + 5.75rem)", color: "#eef4f8" }}>
        <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
          <span style={{ flexShrink: 0, width: 68, height: 68, borderRadius: "50%", overflow: "hidden", border: `1.5px solid ${accent}77`, background: "#160f24" }}>
            <Face persona={{ name: c.host, gender: c.gender, seed: id }} lazy={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: accent, fontWeight: 600 }}>{c.vibe}{talker ? " · 🎙 talks" : ""}</div>
            <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, marginTop: 2 }}>{displayName(c.host, c.gender, t.locale)}</div>
            <div style={{ fontSize: 12.5, color: "rgba(240,232,255,.5)", marginTop: 3 }}>{card.work} · {card.where}</div>
          </div>
        </div>
        <div style={{ marginTop: 15, display: "flex", flexDirection: "column", gap: 9 }}>
          <Fact label="tonight" text={d.onMind} accent={accent} />
          {/* Their pronoun, not a default. Half this floor is men, and every one
              of them was being introduced as "she" on their own profile card. */}
          <Fact label={`${c.gender === "male" ? "he" : "she"}'ll argue`} text={d.opinion} accent={accent} />
        </div>
        {/* A little of the conversation before the whole one. Whisper something
            only she can read; she whispers back, in the room, and nobody else
            sees either line. Cheaper to try than a private thread, and the thing
            that makes people want the private thread. */}
        <div style={{ marginTop: 15, display: "flex", gap: 8 }}>
          <input value={w} onChange={(e) => setW(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && w.trim()) onWhisper(w) }}
            placeholder={`whisper to ${c.host} — only ${c.gender === "male" ? "he" : "she"} reads it`} aria-label={`whisper to ${c.host}`}
            style={{ flex: 1, minHeight: 44, fontSize: 14, fontStyle: "italic", color: "#f0e8ff", background: "rgba(255,255,255,.06)", border: `.5px dashed ${accent}66`, borderRadius: 13, padding: "0 13px", outline: "none" }} />
          <button onClick={() => { if (w.trim()) onWhisper(w) }} disabled={!w.trim()} aria-label={t("send whisper")}
            style={{ width: 44, height: 44, borderRadius: 13, fontSize: 18, background: w.trim() ? `${accent}33` : "rgba(255,255,255,.06)", border: `.5px solid ${accent}55`, cursor: w.trim() ? "pointer" : "default", WebkitTapHighlightColor: "transparent" }}>🤫</button>
        </div>
        <button onClick={() => { onClose(); onPrivate(c) }}
          style={{ marginTop: 10, width: "100%", minHeight: 52, fontSize: 16, fontWeight: 700, color: "#180a20", background: accent, border: "none", borderRadius: 15, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
          message {c.host} privately
        </button>
        <button onClick={onClose}
          style={{ marginTop: 8, width: "100%", minHeight: 42, fontSize: 13, color: "rgba(240,232,255,.45)", background: "transparent", border: ".5px solid rgba(255,255,255,.12)", borderRadius: 13, cursor: "pointer" }}>
          back to the room
        </button>
      </div>
    </div>
  )
}

function Fact({ label, text, accent }: { label: string; text: string; accent: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,.04)", border: ".5px solid rgba(255,255,255,.07)", borderRadius: 13, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: `${accent}bb`, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.4, color: "rgba(240,232,255,.82)", marginTop: 3 }}>{text}</div>
    </div>
  )
}
