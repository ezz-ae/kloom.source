"use client"

/**
 * AIRROOM — the air-off bubble. A private 1:1 with a cluster's host: it greets
 * aloud, you reply, it answers in voice (/api/chat + /api/tts). Two ways to talk:
 *   • push-to-talk ("talk") — tap, say one thing, it sends.
 *   • hands-free ("live")   — keep the mic open; just talk and each line sends,
 *                             no pressing. Ignores its own voice while it speaks.
 */
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { useT, translate, currentLocale } from "@/lib/airraw/i18n"
import { unlockAudio, registerAudio } from "@/lib/airraw/audio-unlock"
import { displayName } from "@/lib/airraw/arabic-names"
import { faceSeedFor } from "@/lib/airroom/roster"
import { pinnedVoice, pinFromResponse, awaitPin, claimFirst } from "@/lib/airraw/voice-pin"
import { visitorId } from "@/lib/airraw/visitor"
import type { Cluster, Heat } from "@/lib/airroom/roster"
import { SpeechSegmenter, phoneMicAudio } from "@/lib/speech-segmenter"
import { canListen } from "@/lib/voice-once"
import { inAppBrowser } from "@/lib/airraw/in-app"
import { Face } from "@/components/airroom/Face"
import { VoiceWave } from "@/components/airroom/VoiceWave"
import { isPro, getProToken, markProRefused } from "@/lib/airroom/pro"
import { getCredits } from "@/lib/airroom/credits"
import { ProSheet } from "@/components/airroom/ProSheet"
import { track } from "@/lib/airraw/track"
import { lookFor, saveCharacter, addMedia } from "@/lib/airraw/character"
import { writtenFor, identityFor, soulPrompt, langFor } from "@/lib/airraw/cast50"
import { LANGUAGE_TO_BCP47, isoForLanguage } from "@/lib/languages"
import { getStyle, saveStyle, nextStyleQuestion, stylePromptLine, type StyleQuestion } from "@/lib/airroom/style"
import { renderPersona } from "@/lib/airraw/persona"
import { loadVolume, saveVolume, canChooseOutput, listOutputs, loadSink, applySink, bindMediaSession, type OutputDevice } from "@/lib/airraw/audio-output"
import { loadTalk, saveTalk, forgetTalk, memoryEnabled } from "@/lib/airraw/memory"
import { shouldPickUp, gapLabel, pickupInstruction, cleanPickup, worthPickingUp } from "@/lib/airraw/pickup"
import { MicTest } from "@/components/airroom/MicTest"
import { GoldenRoom } from "@/components/airroom/GoldenRoom"
import { openGolden, openSession, closeSession, goldHeld, onGold, refreshGold } from "@/lib/airroom/golden-client"
import { goldenGame, type GoldenSession } from "@/lib/airraw/golden"
import { getLangPrefs, spokenLanguages } from "@/lib/airraw/lang-prefs"

interface Msg { who: "host" | "you"; text: string; image?: string }

/**
 * "send me a photo of you in the kitchen" — typed or spoken — is a photo request,
 * not a chat turn. The scene is whatever is left once the asking is stripped.
 * Rough on purpose: being wrong costs one odd reply, and a photo has to be
 * askable the way a person would ask for one.
 */
const PHOTO_ASK = /\b(?:send|show|give|take)\s+me\s+(?:a\s+|another\s+|one\s+)?(?:photo|pic|picture|selfie|snap|pics|photos)\b(?:\s+of\s+(?:you|yourself|u))?/i
function photoScene(text: string): string | null {
  if (!PHOTO_ASK.test(text)) return null
  return text.replace(PHOTO_ASK, "").replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "").replace(/^(?:in|on|at|with)\s+/i, (m) => m).trim()
}

// Adult heat palette — purple → pink → red (matches the floor)
const HEAT_COLOR: Record<Heat, string> = { w: "#c084fc", m: "#f472b6", f: "#fb7185" }
const HEAT_GLOW:  Record<Heat, string> = { w: "rgba(192,132,252,.55)", m: "rgba(244,114,182,.55)", f: "rgba(251,113,133,.55)" }
const HEAT_FILL:  Record<Heat, string> = { w: "rgba(192,132,252,.13)", m: "rgba(244,114,182,.13)", f: "rgba(251,113,133,.13)" }
const HEAT_GRAD:  Record<Heat, string> = {
  w: "linear-gradient(135deg,#a855f7,#c084fc)",
  m: "linear-gradient(135deg,#db2777,#f472b6)",
  f: "linear-gradient(135deg,#e11d48,#fb7185)",
}

// Pure CHARACTER description — who they are, how they sound. All behavior rules
// (short replies, answer-don't-deflect, content ceiling vs. the paid unlock) live
// in the server prompt; repeating them here diluted the prompt, and a client-side
// "no limits" line would let free sessions talk past the paid content gate.
//
// This used to be one generic sentence — the same adjectives for everybody, with
// only the name and the room swapped in. No character had a single FACT about
// themselves, so when the conversation needed content they had none of their own
// and echoed the user's instead. The dossier fixes that at the source: every
// character arrives with a job, a place they're sitting, something on their mind
// and an opinion they'll argue.
//
// The two halves are drawn INDEPENDENTLY and joined only in the registry:
// the dossier
// knows nothing about where the character's voice is from, and `arabicDialectLine`
// knows nothing about their personality. So a Gulf accent is just as likely to
// come with the filthiest dossier in the pool as a European one — accent never
// implies character.
/**
 * Give her prompt the shape of a game, without touching who she is.
 *
 * The game text is APPENDED to personality. It never rewrites the name, the
 * backstory or the seed — those are what make this Sami rather than a character
 * called Sami — so a game can change what the conversation is doing and can
 * never change who is having it.
 */
function withGame<T extends { personality: string }>(persona: T, gameId?: string | null): T {
  const g = goldenGame(gameId)
  return g ? { ...persona, personality: `${persona.personality} ${g.play}` } : persona
}

function personaFor(c: Cluster, lang?: string, pro = false) {
  // The caller's language wins when the surface pinned one; otherwise the user's
  // own setting decides, rather than everyone starting in English.
  const prefs = getLangPrefs()
  const spoken = spokenLanguages(prefs)
  return renderPersona(c, "call", {
    language: lang || prefs.primary || "English",
    // Every language they speak, so switching mid-call is expected rather than
    // treated as a mistake to correct.
    speaks: spoken,
    // One of the fifty brings her written inner life and her voice registers;
    // everyone else gets the generated dossier. The registry does not know about
    // cast50, so the lookup stays here and the choice is made there.
    soul: (() => { const m = writtenFor(c.key); return m ? soulPrompt(identityFor(m, langFor(prefs.primary))) : "" })(),
  })
}

// How many chunk requests may be in flight at once, across every call on the
// page. Two keeps the next sentence downloading while this one plays; more than
// that mostly bought 429s from the voice engine's concurrency cap.
const TTS_LANES = 2
let ttsLanesBusy = 0
const ttsLaneWaiters: Array<() => void> = []
const acquireTtsLane = () => new Promise<void>((r) => {
  if (ttsLanesBusy < TTS_LANES) { ttsLanesBusy++; r() }
  else ttsLaneWaiters.push(() => { ttsLanesBusy++; r() })
})
const releaseTtsLane = () => { ttsLanesBusy = Math.max(0, ttsLanesBusy - 1); const next = ttsLaneWaiters.shift(); if (next) next() }

/* eslint-disable @typescript-eslint/no-explicit-any */
const PARTING = [
  "wait — don't disappear on me. i'm still chewing on what you said. come back and finish the thought.",
  "leaving already? fine. but you're gonna think about this later, i can tell. find me when you do.",
  "go on, then. but you started something here — you don't get to leave it unfinished. come back to me.",
  "take it with you, whatever we just stirred up. i'll be right here on the floor when it clicks.",
  "okay, drift off. but that thing you said? it's not done. come tell me how it ends.",
]

export function AirBubble({ cluster, tempLabel, onClose, onTalked, opening, lang, onGolden }: { cluster: Cluster; tempLabel: string; onClose: () => void; onTalked?: () => void; opening?: string; lang?: string; onGolden?: () => void }) {
  const t = useT()
  // The opener in the language of the room. Read synchronously: the lazy state
  // below is built on the first render, before useT has resolved the locale.
  const opener = (s: string) => translate(s, currentLocale())
  const accent = HEAT_COLOR[cluster.h]
  // Their pronouns, once. Half the floor is men and every one of them was being
  // described as "she" in the copy around the call.
  const they = cluster.gender === "male" ? "he" : "she"
  const them = cluster.gender === "male" ? "him" : "her"
  const glow   = HEAT_GLOW[cluster.h]
  const fill   = HEAT_FILL[cluster.h]
  const grad   = HEAT_GRAD[cluster.h]

  // Reopen where the thread left off (Pro only — see lib/airraw/memory.ts). The
  // initial state is computed lazily so the restore happens before first paint
  // and the user never sees the greeting flash in over their old conversation.
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    const saved = loadTalk(cluster.key)
    return saved?.msgs.length ? saved.msgs : [{ who: "host", text: opener(cluster.lines[0]) }]
  })
  const [resumed] = useState(() => !!loadTalk(cluster.key)?.msgs.length)
  /** When this thread was last spoken in — what makes coming back a return. */
  const [lastAt] = useState(() => loadTalk(cluster.key)?.at || 0)
  const [micMuted, setMicMuted] = useState(false)
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [sttOk, setSttOk] = useState(false)
  const [listening, setListening] = useState(false)
  const [handsFree, setHandsFree] = useState(false)
  const [trouble, setTrouble] = useState(false)
  // The free ceiling was just hit — see X-Ceiling-Hit in app/api/chat/route.ts.
  // Shown ONCE per conversation: this is a nudge at the one moment it is relevant,
  // not a nag. Twice and it stops being information and starts being pressure.
  const [ceiling, setCeiling] = useState(false)
  const ceilingShown = useRef(false)
  // What the nudge says. The content ceiling and a refused photo are the same
  // moment — "here is the wall, here is what removes it" — with a different
  // first sentence.
  const [nudge, setNudge] = useState("she stopped there because you\u2019re on the free floor.")
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoNote, setPhotoNote] = useState("")
  // The call timer. A phone shows one, and its absence is half of why this
  // screen never read as a call: nothing on it said "this is happening now".
  const [callSecs, setCallSecs] = useState(0)
  useEffect(() => {
    if (!handsFree) { setCallSecs(0); return }
    const id = setInterval(() => setCallSecs((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [handsFree])
  const mmss = `${String(Math.floor(callSecs / 60)).padStart(2, "0")}:${String(callSecs % 60).padStart(2, "0")}`
  const [speaking, setSpeaking] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  // Set when the SERVER refuses this pass. markProRefused() is what actually
  // records it; this exists to force the re-render, because everything that
  // shows paid state calls isPro() during render and would otherwise keep
  // painting the old answer until something else happened to move.
  const [, setPassRefused] = useState(false)
  const [micHint, setMicHint] = useState("")
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [audioPanel, setAudioPanel] = useState(false)
  // A golden session, if this conversation has been taken into one. The guest is
  // never re-derived: it is THIS cluster, carried in, which is the whole contract.
  const [golden, setGolden] = useState<GoldenSession | null>(() => {
    const s = openSession()
    return s && s.guest?.key === (faceSeedFor(cluster) || cluster.key) ? s : null
  })
  const [gold, setGold] = useState(goldHeld())
  const [goldBusy, setGoldBusy] = useState(false)
  /** Which game is running, read by the reply path so her prompt gains a shape, never a new identity. */
  const gameRef = useRef<string | null>(null)
  const [outputs, setOutputs] = useState<OutputDevice[]>([])
  const [sink, setSink] = useState("")
  const [humanNote, setHumanNote] = useState(false)
  const [pro] = useState(() => isPro())
  const [credits] = useState(() => pro ? Infinity : getCredits())
  const [vibe, setVibe] = useState("")
  const [vibeEdit, setVibeEdit] = useState(false)
  const [showPro, setShowPro] = useState(false)
  // Style profiling — once per account; 2-word choices reveal HOW the AI should talk
  const [styleQ, setStyleQ] = useState<StyleQuestion | null>(null)
  const mutedRef = useRef(false)
  const vibeRef = useRef("")
  // The language this call is actually in. Starts from whatever the surface asked
  // for, but is switchable mid-call from the top bar, so it can't just mirror the
  // prop. A bilingual person shouldn't have to leave the call to change it.
  // NO DEFAULT ON THE PROP. It was `lang = "English"` in the signature, which is a
  // truthy string, so `lang || getLangPrefs().primary` could never reach the
  // second term — and Lobby and ZoomBuffet render this without a lang at all.
  // Every visitor arriving at airraw.com therefore got an English character,
  // whatever language they had chosen, on the surface the ads land on.
  const [activeLang, setActiveLang] = useState(() => lang || getLangPrefs().primary || "English")
  const [myLangs] = useState(() => spokenLanguages())
  const langRef = useRef(activeLang)
  useEffect(() => { mutedRef.current = muted }, [muted])
  useEffect(() => { vibeRef.current = vibe }, [vibe])
  useEffect(() => { langRef.current = activeLang }, [activeLang])
  // A surface that changes the language out from under us still wins.
  useEffect(() => { if (lang) setActiveLang(lang) }, [lang])

  /** Step to the next language they speak. Only reachable when there's more than one. */
  const cycleLang = () => {
    if (myLangs.length < 2) return
    const i = myLangs.indexOf(activeLang)
    const next = myLangs[(i + 1) % myLangs.length]
    setActiveLang(next)
    langRef.current = next          // set now: the segmenter reads the ref, not the state
    // The one hint that carries a value, so it is translated here rather than at
    // the read site. Clearing it compares against the exact message instead of
    // its English prefix, which stops being a prefix in any other language.
    const msg = t("switched to {lang}", { lang: t(next).toLowerCase() })
    setMicHint(msg)
    setTimeout(() => setMicHint((h) => (h === msg ? "" : h)), 1800)
  }

  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Belt and braces with the unlock in onTalk: if sound ever starts from
  // somewhere other than the call button, the first touch has already armed it.
  useEffect(() => registerAudio(audioRef.current), [])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const msgsRef = useRef(msgs)
  const busyRef = useRef(false)
  const hostSpeakingRef = useRef(false)
  const onceRecRef = useRef<any>(null)
  const segRef = useRef<SpeechSegmenter | null>(null)
  const micLevelRef = useRef(0)
  const lastActivityRef = useRef(Date.now())
  const hfRef = useRef(false)
  const talkedRef = useRef(false)
  const speakTokenRef = useRef(0)
  const leavingRef = useRef(false)
  const swipeRef = useRef<{ x: number; y: number } | null>(null)
  const pickedUpRef = useRef(false)
  // A QUEUE, not a single slot. It used to be one string: if you spoke twice while
  // the character was thinking, the second utterance overwrote the first and the
  // first was silently lost. Coalesced on flush so two halves of one thought
  // ("I was thinking…" [breath] "…about last night") arrive as ONE message.
  const pendingRef = useRef<string[]>([])
  // Chunks are fetched in PARALLEL but must play in order, so each carries the
  // sequence number it was requested with and playback waits for the next one in
  // line rather than playing whatever landed first. A chunk whose TTS failed is
  // queued with a null url so it's skipped instead of stalling the queue forever.
  const audioQueueRef = useRef<Array<{ url: string | null; seq: number }>>([])
  const qPlayingRef = useRef(false)
  const seqRef = useRef(0)        // next sequence number to hand out
  const playSeqRef = useRef(0)    // next sequence number that may play
  const inflightRef = useRef(0)   // TTS requests still outstanding for this reply
  const volumeRef = useRef(1)
  const micMutedRef = useRef(false)

  useEffect(() => { msgsRef.current = msgs }, [msgs])
  useEffect(() => { const off = onGold(setGold); refreshGold().catch(() => { /* the door still opens the shop */ }); return off }, [])

  // ── she picks it back up ──────────────────────────────────────────────────
  // Reopening a saved thread used to restore the words and nothing else: the old
  // lines sat there and you had to start again, which is the one thing someone
  // who remembered you would not do. So on a real return she opens, once, with a
  // line about something that was actually said.
  //
  // TEXT, never voice. This line was not asked for, and spending a free
  // visitor's one minute on speech they did not request is taking something from
  // them to make a point. It costs one short completion — she talks, and the
  // voice starts when they answer.
  //
  // Nothing is shown unless it is real: cleanPickup drops the escape token, the
  // over-long answer and the generic "missed you" a model reaches for when it
  // has nothing. A character inventing a memory is worse than a quiet one.
  useEffect(() => {
    if (pickedUpRef.current) return
    if (!memoryEnabled() || !resumed || !shouldPickUp(lastAt)) return
    // They arrived with their own line (a mention, a tap-through). That is
    // already the opening, and two of them is a pile-up.
    if (opening?.trim()) return
    pickedUpRef.current = true
    const ctrl = new AbortController()
    let dropped = false
    ;(async () => {
      try {
        const history = msgsRef.current
        // Length at the moment we ask, so "did they get a word in while this was
        // in flight" is a real comparison. The obvious-looking test — is the last
        // message theirs — is wrong here and silently killed the feature: a
        // restored thread almost always ENDS with their line, because saying
        // something and then leaving is how a conversation gets left.
        const beforeLen = history.length
        // Never ASK when there is nothing to remember. Tested against the live
        // model: after "hey / hi / what's up / nm u" it answered "still editing
        // your sentences?" — a fabricated memory no output filter can catch,
        // because it is indistinguishable from a real one without the transcript.
        if (!worthPickingUp(history)) return
        const res = await fetch("/api/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            persona: personaFor(cluster, langRef.current, pro),
            proToken: getProToken(),
            messages: [
              ...history.map((m) => ({ role: m.who === "you" ? "user" : "assistant", content: m.text })),
              { role: "user" as const, content: pickupInstruction(gapLabel(lastAt)) },
            ],
          }),
        })
        if (!res.ok || !res.body) return
        let full = ""
        const rd = res.body.getReader()
        const dec = new TextDecoder()
        for (;;) {
          const { done, value } = await rd.read()
          if (done) break
          full += dec.decode(value)
          if (full.length > 240) { try { await rd.cancel() } catch { /* */ } break }
        }
        const line = cleanPickup(full)
        // The user starting to talk wins: an opener landing on top of their first
        // sentence is worse than no opener at all.
        if (!line || dropped || talkedRef.current) return
        // If anything arrived while this was in flight, theirs stays the most
        // recent thing on screen and the opener is dropped.
        setMsgs((m) => (m.length > beforeLen ? m : [...m, { who: "host", text: line }]))
        try { track("pickup_shown") } catch { /* */ }
      } catch { /* a thread that does not open is simply the old behaviour */ }
    })()
    return () => { dropped = true; ctrl.abort() }
    // Mount only: this is a property of arriving, not of anything that changes after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { hfRef.current = handsFree }, [handsFree])
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9 }) }, [msgs])
  // A WEBVIEW IS A PHONE WITH NO MICROPHONE, WHATEVER THE API CLAIMS.
  //
  // canListen() asks whether the browser HAS getUserMedia. The Instagram and
  // Facebook in-app browsers have it and will never grant it — and that is where
  // 101 of 117 ad visitors arrive. So the screen offered them "call", they
  // tapped it, the mic was refused, and a voice product met them with a dead
  // button and an apology. They left; almost nobody opened a second page.
  //
  // Treated as no-mic, the same screen still delivers the thing worth paying
  // for: she says hello OUT LOUD on the first tap, and they type back. Voice in
  // one direction is most of the product. A dead button is none of it.
  useEffect(() => { setSttOk(canListen() && !inAppBrowser()) }, [])
  useEffect(() => { try { if (!localStorage.getItem("airraw_human_note")) setHumanNote(true) } catch { /* */ } }, [])

  // Restore the saved volume / speaker choice, and register the call with the OS
  // so the sound keeps going when the page isn't on screen.
  useEffect(() => {
    const v = loadVolume()
    setVolume(v); volumeRef.current = v
    if (audioRef.current) audioRef.current.volume = v
    const saved = loadSink()
    if (saved && audioRef.current) {
      applySink(audioRef.current, saved).then((ok) => { if (ok) setSink(saved) })
    }
    const release = bindMediaSession({
      title: cluster.host,
      artist: cluster.vibe,
      onStop: () => { stopSpeaking(); setMuted(true); mutedRef.current = true },
    })
    return release
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Mute YOUR mic — distinct from the speaker control, which mutes the character.
   * There was no way to stay on a call without being heard: the only options were
   * to be recorded or to hang up.
   *
   * This aborts the segmenter rather than just flagging a boolean, so capture
   * genuinely stops and any part-recorded utterance is discarded. A mute that
   * only hid the transcript would still be uploading audio.
   */
  const toggleMicMute = () => {
    setMicMuted((m) => {
      const next = !m
      micMutedRef.current = next
      if (next) {
        // The tracks end too, not just the listening: a muted mic that keeps the
        // capture session open still degrades the speaker, and still shows the
        // OS's recording indicator.
        releaseMic()
        try { onceRecRef.current?.stop() } catch { /* */ }
        setMicHint("your mic is off — they can't hear you")
      } else {
        void reopenMic()
        setMicHint("")
      }
      return next
    })
  }

  const changeVolume = (v: number) => {
    setVolume(v); volumeRef.current = v; saveVolume(v)
    if (audioRef.current) audioRef.current.volume = v
  }

  const openAudioPanel = async () => {
    setAudioPanel((o) => !o)
    if (!outputs.length && canChooseOutput()) setOutputs(await listOutputs())
  }

  const chooseSink = async (id: string) => {
    if (audioRef.current && await applySink(audioRef.current, id)) setSink(id)
  }
  const dismissHumanNote = () => { setHumanNote(false); try { localStorage.setItem("airraw_human_note", "1") } catch { /* */ } }

  /**
   * HAND THE MIC BACK WHILE SHE SPEAKS.
   *
   * The server sends 192kbps ElevenLabs audio and the phone plays it like a
   * bad phone call: thin, metallic, "robot". Nothing in the file is wrong; the
   * phone does it. Any open microphone capture puts iOS into its play-and-record
   * session — voice processing on the OUTPUT, a lower volume ceiling — and on
   * AirPods (any Bluetooth, any OS) it switches from the music profile to the
   * headset profile, which is 8kHz mono. Muting the segmenter does not help: the
   * tracks stay live and the capture session with them. Only ending the tracks
   * ends it.
   *
   * So the tracks are stopped the moment the first chunk starts playing, and a
   * fresh stream is taken the moment the reply ends (or is cut off). The
   * segmenter stays alive and is re-sourced from the new stream. The cost: the
   * mic cannot hear you WHILE she speaks — the speaker button cuts her off —
   * which is what a phone does anyway when it is busy playing.
   *
   * The generation counter is the guard for the one race that matters: a reopen
   * still waiting on getUserMedia when she starts again, the user mutes, or the
   * call ends. A track that goes live after any of those is the bug itself.
   */
  const micStreamRef = useRef<MediaStream | null>(null)
  const micGenRef = useRef(0)
  const releaseMic = () => {
    micGenRef.current++
    try { segRef.current?.abort() } catch { /* */ }
    const s = micStreamRef.current
    micStreamRef.current = null
    try { s?.getTracks().forEach((t) => t.stop()) } catch { /* */ }
  }
  const reopenMic = async () => {
    if (!hfRef.current || micMutedRef.current || !segRef.current) return
    if (micStreamRef.current) { try { segRef.current.start() } catch { /* */ } ; return }
    const gen = ++micGenRef.current
    let s: MediaStream
    try { s = await navigator.mediaDevices.getUserMedia({ audio: phoneMicAudio() }) } catch { return }
    if (gen !== micGenRef.current || !hfRef.current || micMutedRef.current || !segRef.current) {
      try { s.getTracks().forEach((t) => t.stop()) } catch { /* */ }
      return
    }
    micStreamRef.current = s
    try { segRef.current.replaceStream(s); segRef.current.start() } catch { /* */ }
  }

  /** Play whatever is next IN ORDER. Returns quietly if the next chunk in the
   *  sequence hasn't finished downloading yet — the chunk's own arrival calls
   *  pump() again, so playback resumes the moment it lands. */
  const pump = () => {
    if (qPlayingRef.current) return
    const i = audioQueueRef.current.findIndex((q) => q.seq === playSeqRef.current)
    if (i === -1) {
      // Nothing playable. Either we're waiting on an earlier chunk (queue has
      // later ones) or the reply is finished.
      if (!audioQueueRef.current.length && !inflightRef.current) {
        hostSpeakingRef.current = false; setSpeaking(false)
        // Take the mic back now that she is quiet. Never for a mic the user muted
        // — the character finishing its turn is not consent to start listening.
        void reopenMic()
      }
      return
    }
    const [next] = audioQueueRef.current.splice(i, 1)
    playSeqRef.current++
    if (!next.url) { pump(); return }   // failed chunk — skip, don't stall
    const a = audioRef.current
    if (!a) { URL.revokeObjectURL(next.url); pump(); return }
    qPlayingRef.current = true
    // First chunk of a reply: the capture session ends BEFORE the speaker opens.
    if (!hostSpeakingRef.current) releaseMic()
    hostSpeakingRef.current = true; setSpeaking(true)
    const done = () => {
      qPlayingRef.current = false
      try { URL.revokeObjectURL(next.url!) } catch { /* */ }
      pump()
    }
    a.onended = done; a.onerror = done
    a.src = next.url
    a.volume = volumeRef.current
    a.play().catch((err) => {
      // Refused for want of a gesture — the first line of the call, fetched on
      // mount before anyone has tapped. The chunk STAYS loaded and the pump
      // stays parked on it: the next tap anywhere (registerAudio) or on the call
      // button (unlockAudio) plays this very element, onended fires, and the
      // queue moves on from here. Dropping it, as this used to, meant the first
      // thing she said was never heard on a phone — with nothing on screen.
      if (err?.name === "NotAllowedError") { console.warn("[air] first line waits for a tap"); return }
      // Anything else (a source that failed, a pause() from stopSpeaking): log
      // and advance rather than wedge the queue.
      console.error("[air] audio play blocked:", err?.message || err); done()
    })
  }

  const speakChunk = async (text: string, tok: number, prevText = "") => {
    if (mutedRef.current || tok !== speakTokenRef.current) return
    const seq = seqRef.current++
    inflightRef.current++
    // Settled when this chunk is done, whatever happened to it — it's what a
    // sibling chunk waits on when this one is the person's first (see voice-pin).
    let settleFirst: (() => void) | undefined
    try {
      // The SAME seed the face was generated from, so the voice and the dialect
      // belong to the person on screen.
      const who = faceSeedFor(cluster) || cluster.host
      const lang = langRef.current
      // Two things keep one reply in one voice. The first request for this person
      // goes alone, so its pin exists before any sibling asks (see voice-pin); and
      // at most TTS_LANES requests are ever in flight — enough to keep chunk N+1
      // downloading while N plays, few enough not to trip the engine's concurrency
      // limit, whose 429 used to hand a chunk to the fallback engine in a
      // different voice.
      await awaitPin(who, lang)
      // Claim "first" BEFORE queueing for a lane, so a sibling that arrives while
      // this one waits can't slip past and cast on its own.
      if (!pinnedVoice(who, lang)) claimFirst(who, lang, new Promise<void>((r) => { settleFirst = r }))
      await acquireTtsLane()
      let res: Response
      try {
        if (tok !== speakTokenRef.current) return
        res = await fetch("/api/tts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          // prevText = what this voice already said this reply → the engine continues
          // the same breath across chunks instead of restarting (no mid-reply shift).
          // elevenId = the voice this person has already been heard in; the server
          // honours it over its own casting, so nothing that changes server-side
          // (discovered pools, a different instance) can recast them mid-call.
          body: JSON.stringify({ text, personaName: cluster.host, seedKey: who, gender: cluster.gender, language: lang, voiceId: cluster.voiceId, elevenId: pinnedVoice(who, lang), proToken: getProToken(), visitorId: visitorId(), mode: "voice", prevText }),
          signal: AbortSignal.timeout(30000),
        })
      } finally { releaseTtsLane() }
      if (tok !== speakTokenRef.current) return
      if (!res.ok) {
        audioQueueRef.current.push({ url: null, seq })
        // 402 = the free minute (or the pass allowance) is used up. Say why and
        // open the sheet — a call that just goes quiet reads as broken, and the
        // moment someone wants more is the moment to sell it.
        if (res.status === 402) {
          const why = res.headers.get("X-Pass")
          if (why === "daily-cap") setMicHint("you've used today's voice — your pass resets at midnight")
          else if (why === "rejected" || why === "expired") {
            // They HAVE a pass and the server would not take it. Never the free
            // wall's words and never the buy sheet: asking someone to pay for
            // what they already bought is the worst thing this screen can do.
            setMicHint(why === "expired"
              ? "your pass has run out — restore or renew it to keep talking"
              : "we couldn't verify your pass — restore it and you're back")
            // And the UI stops claiming otherwise. isPro() reads the token's
            // expiry date without checking its signature, so the You page said
            // "pass active · until Oct 21" in green while this very request was
            // being refused. The server is the only thing that can settle it, and
            // it just did.
            markProRefused(); setPassRefused(true)
          }
          else if (res.headers.get("X-Free") === "daily-cap") {
            // The free voice ran out on their NETWORK, not on them: a carrier
            // address shared by many phones has spent today's bucket. "Your
            // minute is up" to someone who never heard a word is a lie that reads
            // as broken; the truth still sells the same pass.
            setMicHint("the free voice is spent on your network for today — the pass opens it now"); setShowPro(true)
          }
          else { setMicHint("your free minute is up — unlock the pass to keep talking"); setShowPro(true) }
          // THE CALL DOES NOT END HERE.
          //
          // This used to drop handsFree on every branch, so the first refused
          // chunk tore the call down mid-sentence: no voice, half a line of text
          // on screen, and a dead screen. For a refused PASS that is indefensible
          // — they are still a customer and the words still work. Even on the
          // genuine free wall, the words are free; what ran out is the voice. So
          // the transcript opens and the conversation carries on reading, which
          // is also the only state in which the pass is worth selling.
          setChatOpen(true)
          setHandsFree(false)
        }
        return
      }
      pinFromResponse(who, lang, res)
      const blob = await res.blob()
      if (tok !== speakTokenRef.current) return
      audioQueueRef.current.push({ url: URL.createObjectURL(blob), seq })
      // The mic is handed back to the phone while she speaks (see releaseMic
      // above the pump) — an open capture degrades the speaker to a phone-call
      // codec on iOS and to 8kHz on any Bluetooth — and taken again when the
      // reply ends. The speaker button is how she is cut off.
    } catch {
      // Queue a hole rather than nothing, or every later chunk waits forever on a
      // sequence number that will never arrive.
      if (tok === speakTokenRef.current) audioQueueRef.current.push({ url: null, seq })
    } finally {
      // Only touch the counter if this chunk still belongs to the current reply.
      // A chunk cancelled by stopSpeaking() would otherwise decrement a counter
      // that stopSpeaking already reset to 0, driving it negative — and a negative
      // count reads as "still generating", so `speaking` would never clear and the
      // mic would never be handed back.
      if (tok === speakTokenRef.current) { inflightRef.current--; pump() }
      settleFirst?.()
    }
  }

  /** Cut the character off mid-sentence: kill in-flight TTS, drop everything queued,
   *  and stop the audio element. This is what makes interrupting feel like a phone
   *  call instead of a walkie-talkie. */
  const stopSpeaking = () => {
    speakTokenRef.current++            // invalidates any TTS still in flight
    audioQueueRef.current.forEach((q) => { if (q.url) { try { URL.revokeObjectURL(q.url) } catch { /* */ } } })
    audioQueueRef.current = []
    qPlayingRef.current = false
    seqRef.current = 0; playSeqRef.current = 0; inflightRef.current = 0
    const a = audioRef.current
    if (a) { try { a.pause(); a.removeAttribute("src"); a.load() } catch { /* */ } }
    hostSpeakingRef.current = false; setSpeaking(false)
    void reopenMic()
  }

  /** Start a fresh reply: new token, empty queue, sequence counters back to zero. */
  const resetSpeech = () => {
    const tok = ++speakTokenRef.current
    audioQueueRef.current.forEach((q) => { if (q.url) { try { URL.revokeObjectURL(q.url) } catch { /* */ } } })
    audioQueueRef.current = []
    qPlayingRef.current = false
    seqRef.current = 0; playSeqRef.current = 0; inflightRef.current = 0
    return tok
  }

  const speak = async (text: string) => {
    if (mutedRef.current) return
    speakChunk(text, resetSpeech())
  }

  // The greeting is spoken when the CALL starts, not when the card opens.
  //
  // It used to fire on mount, so a character started talking at you while the
  // screen still said "tap call to start" — you hadn't called anyone and a voice
  // was already going. The line is on screen as text from the moment you open the
  // card; the voice now waits until you actually place the call.
  //
  // Not spoken at all when picking an old thread back up, where a canned opener
  // over a conversation you already had reads as amnesia.
  const greetedRef = useRef(false)
  const greetIfNeeded = () => {
    if (greetedRef.current || resumed) return
    greetedRef.current = true
    speak(opener(cluster.lines[0]))
  }

  // Persist the thread as it goes, so closing the tab mid-sentence still leaves
  // something to come back to. saveTalk decides what that is: the tail of the
  // thread for a pass, only WHO and WHEN for a free session, nothing when memory
  // is off (lib/airraw/memory.ts).
  useEffect(() => {
    saveTalk(cluster, msgs)
  }, [msgs, cluster])

  useEffect(() => {
    const idle = setInterval(() => {
      if (hfRef.current && Date.now() - lastActivityRef.current > 300_000) {
        setHandsFree(false)
        setMicHint("paused to save your minutes — tap talk to wake it up")
      }
    }, 30_000)
    return () => clearInterval(idle)
  }, [])

  const requestReply = async () => {
    busyRef.current = true; setBusy(true); setTrouble(false)
    // New speak token: cancels any in-flight TTS and clears the play queue
    const tok = resetSpeech()
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        // A game APPENDS to her personality; it never replaces it. That is the
        // difference between Sami playing a game and a game wearing Sami's face.
        body: JSON.stringify({ persona: withGame(personaFor(cluster, langRef.current, pro), gameRef.current), proVibe: vibeRef.current, proToken: getProToken(), userStyle: stylePromptLine(getStyle()), messages: msgsRef.current.map((m) => ({ role: m.who === "you" ? "user" : "assistant", content: m.text })) }),
      })
      if (!res.ok) { setTrouble(true); return }
      // She deflected because of the free floor, not because she wasn't interested.
      // That distinction is the entire product difference, and until now the user
      // had no way to know which one just happened.
      if (res.headers.get("X-Ceiling-Hit") === "1" && !ceilingShown.current && !pro) {
        ceilingShown.current = true
        setCeiling(true)
        // The single most important funnel number: how often a free user is
        // SHOWN the wall they are being asked to pay to remove.
        try { track("ceiling_hit") } catch { /* */ }
      }
      let accumulated = ""
      let spokenUpTo = 0        // how much of `accumulated` has been sent to TTS
      let spokenSoFar = ""      // for prosody continuity across chunks

      // Sentence end. Includes the Arabic question mark and a newline. The old
      // pattern was Latin-only: it caught an Arabic full stop, but never ؟, so any
      // Arabic reply made of questions ("شو عم تعمل هلق؟ وانت شو قصتك؟") matched
      // nothing at all and no audio started until the whole reply had generated.
      const SENT_END = /[.!?…؟](?:\s|$)|\n/

      // Speak every sentence the moment it completes, not just the first. The
      // rest of the reply used to be requested only after the stream ENDED, so
      // there was a dead gap after sentence one while its TTS round-trip ran.
      // Now chunk N+1 is already downloading while chunk N plays.
      const flush = (final: boolean) => {
        for (;;) {
          const rest = accumulated.slice(spokenUpTo)
          const m = SENT_END.exec(rest)
          if (!m) break
          const end = m.index + m[0].length
          const piece = rest.slice(0, end).trim()
          // Too short to be worth its own request — wait for more text so we don't
          // cut a reply into one-word audio files with seams between them.
          if (piece.length < 12 && !final) break
          spokenUpTo += end
          if (piece) {
            speakChunk(piece, tok, spokenSoFar)
            spokenSoFar = `${spokenSoFar} ${piece}`.trim().slice(-280)
          }
        }
        if (final) {
          const tail = accumulated.slice(spokenUpTo).trim()
          spokenUpTo = accumulated.length
          if (tail) speakChunk(tail, tok, spokenSoFar)
        }
      }

      if (res.body) {
        const reader = res.body.getReader(); const dec = new TextDecoder()
        for (;;) {
          const { done, value } = await reader.read(); if (done) break
          accumulated += dec.decode(value, { stream: true })
          flush(false)
        }
      }
      const fallbackIdx = (msgsRef.current.filter(m => m.who === "host").length) % cluster.lines.length
      const fullText = accumulated.trim() || opener(cluster.lines[fallbackIdx] || cluster.lines[0])
      const after: Msg[] = [...msgsRef.current, { who: "host", text: fullText }]
      msgsRef.current = after; setMsgs(after)
      // Nothing streamed at all → speak the fallback line; otherwise flush the tail.
      if (!accumulated.trim()) speakChunk(fullText, tok)
      else flush(true)
      // Style profiling: show one 2-word choice after AI's 2nd, 5th, 9th, 13th reply.
      // Never while leaving (it would cover the parting line — the emotional peak the
      // upsell rides on), and auto-dismiss after 12s: the quiz borrows the caption
      // slot, so an ignored question must never blind the live captions forever.
      const aiCount = after.filter(m => m.who === "host").length
      if ([2, 5, 9, 13].includes(aiCount)) {
        const q = nextStyleQuestion(getStyle())
        if (q) setTimeout(() => {
          if (leavingRef.current) return
          setStyleQ(q)
          setTimeout(() => setStyleQ((cur) => (cur === q ? null : cur)), 12000)
        }, 700)
      }
    } catch {
      setTrouble(true)
    } finally {
      busyRef.current = false; setBusy(false)
      // Flush everything said while the character was busy, joined into one line —
      // nothing spoken is ever dropped now.
      if (pendingRef.current.length) {
        const p = pendingRef.current.join(" ").trim()
        pendingRef.current = []
        if (p) setTimeout(() => send(p), 0)
      }
    }
  }

  /**
   * A PHOTO OF HER. Pass-only, and the client enforces it too: a free user gets
   * the nudge and NO request is made — a photo is two cents of cash, and a
   * teaser is two cents spent on someone who has not paid. A pass holder gets
   * the same person every time (lib/airraw/character.ts freezes her appearance
   * and the route leads with it), three a day, and she keeps them on her card.
   */
  const askPhoto = async (scene = "") => {
    if (photoBusy) return
    if (!pro) {
      setNudge("she\u2019d send you a photo \u2014 but you\u2019re on the free floor.")
      setCeiling(true)
      try { track("photo_nudge") } catch { /* */ }
      return
    }
    setPhotoBusy(true); setPhotoNote(scene ? `taking one\u2026 ${scene}` : "taking one\u2026")
    try { track("photo_ask", { scene: !!scene }) } catch { /* */ }
    try {
      const r = await fetch("/api/media", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ look: lookFor(cluster), name: cluster.host, gender: cluster.gender, key: cluster.key, scene, kind: "image", proToken: getProToken() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d?.url) {
        setPhotoNote(d?.error || "she couldn\u2019t right now")
        try { track(r.status === 429 ? "photo_capped" : "photo_failed") } catch { /* */ }
        return
      }
      const next: Msg[] = [...msgsRef.current, { who: "host", text: scene ? `\ud83d\udcf7 ${scene}` : "\ud83d\udcf7", image: d.url }]
      msgsRef.current = next; setMsgs(next)
      // Keep it on her card, so a photo is something she has rather than a
      // one-off. Stored with the same privacy as the thread itself.
      try { addMedia(saveCharacter(cluster).key, { url: d.url, kind: "image", scene, at: Date.now() }) } catch { /* */ }
      setPhotoNote(typeof d.left === "number" ? `${d.left} left on this pass` : "")
      try { track("photo_sent") } catch { /* */ }
    } catch { setPhotoNote("she couldn\u2019t right now") }
    finally { setPhotoBusy(false); setTimeout(() => setPhotoNote(""), 6000) }
  }

  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || busyRef.current) return
    // Asking for a photo is a photo, not a chat turn — typed or spoken.
    const scene = photoScene(text)
    if (scene !== null) { setInput(""); await askPhoto(scene); return }
    // Typing counts as starting too — the canned hello must never arrive on top
    // of a conversation the user has already begun in their own words.
    greetedRef.current = true
    lastActivityRef.current = Date.now()
    setInput("")
    if (!talkedRef.current) { talkedRef.current = true; onTalked?.() }
    const next: Msg[] = [...msgsRef.current, { who: "you", text }]
    msgsRef.current = next; setMsgs(next)
    await requestReply()
  }

  const retry = () => { if (!busyRef.current) requestReply() }

  const pickStyle = (choice: string) => {
    if (!styleQ) return
    const profile = getStyle()
    profile.choices[styleQ.key] = choice
    if (Object.keys(profile.choices).length >= 5) profile.done = true
    saveStyle(profile)
    setStyleQ(null)
  }

  useEffect(() => {
    const o = opening?.trim()
    if (!o) return
    greetedRef.current = true   // they opened with their own line; no canned hello
    const id = setTimeout(() => send(o), 500)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * The no-mic path: she speaks, you type.
   *
   * This tap is the gesture the phone wants, so it unlocks the speaker and
   * starts her greeting out loud — the same first line a caller hears — and
   * then opens the keypad. Before this it only opened the keypad, so a visitor
   * with no microphone met a silent screen and never learned she had a voice.
   */
  const onType = () => {
    unlockAudio(audioRef.current)
    lastActivityRef.current = Date.now()
    greetIfNeeded()
    setChatOpen(true)
  }

  const onTalk = () => {
    unlockAudio(audioRef.current)   // FIRST, and synchronously: this is the gesture.
    setMicHint(""); lastActivityRef.current = Date.now()
    setHandsFree((h) => {
      const next = !h
      if (next) greetIfNeeded()   // the call is starting — now they say hello
      return next
    })
  }

  const leaveCall = () => {
    if (leaving || msgs.length <= 1) { onClose(); return }
    setLeaving(true); leavingRef.current = true
    setStyleQ(null)   // the parting line owns the caption slot — no quiz over it
    setHandsFree(false)
    const parting = PARTING[(msgs.length + cluster.host.length) % PARTING.length]
    setMsgs((m) => [...m, { who: "host", text: parting }])
    speak(parting)
    // Catch users at the emotional peak — show the upsell mid-parting when running low
    if (!pro && credits <= 3) setTimeout(() => setShowPro(true), 1800)
    setTimeout(() => onClose(), 4500)
  }

  useEffect(() => {
    if (!handsFree) return
    try { onceRecRef.current?.stop() } catch { /* */ }
    setListening(false)

    let cancelled = false
    let seg: SpeechSegmenter | null = null
    let stream: MediaStream | null = null
    let fallbackRec: any = null
    let stopped = false

    const startBrowserFallback = () => {
      const w = window as any
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition
      if (!SR) { setMicHint("voice isn't supported on this browser — tap the keypad to type"); setHandsFree(false); return }
      const rec = new SR()
      rec.lang = LANGUAGE_TO_BCP47[langRef.current] || "en-US"; rec.interimResults = false; rec.continuous = true
      rec.onresult = (e: any) => {
        const r = e.results?.[e.results.length - 1]
        if (!r || !r.isFinal) return
        const t = r[0]?.transcript?.trim()
        // Same barge-in contract as the Whisper path: interrupting cuts the
        // character off instead of the user's words being discarded.
        if (t) {
          if (hostSpeakingRef.current) stopSpeaking()
          if (busyRef.current) pendingRef.current.push(t)
          else send(t)
        }
      }
      rec.onerror = (ev: any) => { if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") setHandsFree(false) }
      rec.onend = () => { if (!stopped) { try { rec.start() } catch { /* */ } } }
      fallbackRec = rec
      try { rec.start() } catch { /* */ }
    }

    ;(async () => {
      const w = window as any
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition

      // PRIMARY mic path on EVERY browser and language: record real audio through the
      // phone-call capture chain (mono 48k, hardware echo-cancel/noise-suppression/AGC)
      // and transcribe it server-side with Whisper — the same model quality a phone
      // system gets. Browser SpeechRecognition (which mangles names, accents and
      // Arabic, and can't drive the mic visualizer) is ONLY the fallback: when this
      // browser can't record at all, or the STT backend is unconfigured (onUnavailable).
      const canRecord = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia
      if (!canRecord) {
        if (SR) { startBrowserFallback(); return }
        // Inside Facebook / Instagram the mic is not the phone's to give: the hint
        // has to name the way out, or "not supported" reads as "this product is broken".
        setMicHint(inAppBrowser() ? "voice needs your real browser — tap ⋯ at the top, then “open in browser” — or tap the keypad to type" : "voice isn't supported on this browser — tap the keypad to type"); setHandsFree(false); return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: phoneMicAudio() })
      } catch { setMicHint(inAppBrowser() ? "voice needs your real browser — tap ⋯ at the top, then “open in browser” — or tap the keypad to type" : "allow mic access to talk — or tap the keypad to type"); setHandsFree(false); return }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
      micStreamRef.current = stream
      seg = new SpeechSegmenter({
        stream,
        // Snappier endpoint for a live call — 800ms felt like a lag between turns.
        // 600ms still clears natural mid-sentence pauses (the RMS gate re-arms on the
        // next word) but hands the turn back ~200ms sooner.
        silenceMs: 600,
        getLanguage: () => (LANGUAGE_TO_BCP47[langRef.current] || "en").split("-")[0],
        onLevel: (l) => { micLevelRef.current = l },
        onCapture: () => { if (!hostSpeakingRef.current) setMicHint("heard you — one sec…") },
        // Say it out loud rather than letting the mic go quiet for reasons the
        // user can't see. They left the screen; they should know the mic went off
        // with them, and that it came back when they did.
        onPrivacyPause: () => setMicHint("mic off — you left the call screen"),
        onPrivacyResume: () => {
          // The segmenter un-pauses itself on return; if the USER had muted, put it
          // straight back. Their mute outranks the visibility handler's resume.
          if (micMutedRef.current) { try { segRef.current?.abort() } catch { /* */ } ; setMicHint("your mic is off — they can't hear you"); return }
          setMicHint("mic back on"); setTimeout(() => setMicHint((h) => (h === "mic back on" ? "" : h)), 2000)
        },
        onText: (t) => {
          setMicHint("")
          // BARGE-IN: this used to be `if (hostSpeakingRef.current) return` — your
          // words were thrown away whenever the character happened to be talking,
          // with no feedback at all. Now speaking over it CUTS IT OFF, like a phone.
          if (hostSpeakingRef.current) stopSpeaking()
          if (busyRef.current) { pendingRef.current.push(t); return }
          send(t)
        },
        onError: () => setMicHint(`couldn't catch that — try again`),
        onUnavailable: () => {
          try { seg?.destroy() } catch { /* */ }
          seg = null; segRef.current = null
          if (!cancelled) {
            const w = window as any
            const SR = w.SpeechRecognition || w.webkitSpeechRecognition
            if (SR) startBrowserFallback()
            else { setMicHint("voice unavailable — tap the keypad to type"); setHandsFree(false) }
          }
        },
      })
      segRef.current = seg
      // Hands-free switched on mid-reply (the opener, usually): the mic must not
      // sit live under her voice. The end of the reply takes it back.
      if (hostSpeakingRef.current || micMutedRef.current) releaseMic()
      else seg.start()
    })()

    return () => {
      cancelled = true; stopped = true
      releaseMic()
      try { seg?.destroy() } catch { /* */ }
      segRef.current = null
      try { stream?.getTracks().forEach((t) => t.stop()) } catch { /* */ }
      try { fallbackRec?.stop() } catch { /* */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handsFree, lang])

  const last = msgs[msgs.length - 1]
  const host = cluster.host.toLowerCase()
  const status = speaking ? t("{name} is talking…", { name: host }) : busy ? t("{name} is thinking…", { name: host }) : handsFree ? t("listening — just talk") : sttOk ? t("tap call to start") : t("tap — she talks, you type")

  // Swipe right anywhere → the words (text sheet). A 1:1 call has no swipe left —
  // there's no one else on the line. Pointer events cover touch AND trackpad.
  const onSwipeDown = (e: React.PointerEvent) => { swipeRef.current = { x: e.clientX, y: e.clientY } }
  const onSwipeUp = (e: React.PointerEvent) => {
    const s = swipeRef.current; swipeRef.current = null
    if (!s || chatOpen || showPro || vibeEdit || leaving) return
    const dx = e.clientX - s.x, dy = e.clientY - s.y
    if (dx > 70 && Math.abs(dy) < 80) setChatOpen(true)
  }

  // ── the golden room ───────────────────────────────────────────────────────
  // Rendered INSTEAD of the call, over the same conversation and the same
  // person. `msgs` and `send` are handed straight in, so the thread continues
  // rather than restarting, and the guest is the cluster we are already holding.
  if (golden) {
    return (
      <GoldenRoom
        guest={cluster}
        session={golden}
        lines={msgs}
        busy={busy}
        onSay={(t, gameId) => { gameRef.current = gameId ?? null; send(t) }}
        onLeave={() => { closeSession(); setGolden(null); gameRef.current = null }}
      />
    )
  }

  return (
    <div onPointerDown={onSwipeDown} onPointerUp={onSwipeUp} className="air-rise" style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100dvh", background: `radial-gradient(130% 90% at 50% 0%, #1a0828 0%, #0d0418 55%, #07040f 100%)`, display: "flex", flexDirection: "column", zIndex: 20, fontFamily: "var(--font-geist), system-ui, sans-serif", color: "#f0e8ff" }}>
      <style>{`@keyframes airpulse{0%{transform:scale(1);opacity:.7}70%{transform:scale(1.18);opacity:0}100%{transform:scale(1.18);opacity:0}}@keyframes aireq{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}@keyframes airblink{0%,50%{opacity:1}51%,100%{opacity:0}}`}</style>

      {/* top bar — leave + status + sound */}
      <div style={{ padding: "calc(env(safe-area-inset-top) + 14px) max(18px, env(safe-area-inset-right)) 6px max(18px, env(safe-area-inset-left))", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
          {/* The way OUT. There wasn't one: opening a face gave you a screen whose
              only control was "call", and the only escape was an undiscoverable
              swipe-down. Backing out of someone you opened by mistake is the most
              basic thing this screen has to do. */}
          <button
            onClick={() => (leaving ? onClose() : leaveCall())}
            aria-label={t("leave")}
            style={{ flex: "0 0 auto", width: 36, height: 36, borderRadius: 11, fontSize: 17, lineHeight: 1, color: "rgba(240,232,255,.72)", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.10)", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}
          >
            ‹
          </button>
          <span style={{ display: "flex", alignItems: "center", gap: 2, height: 14, flexShrink: 0 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 3, height: 14, borderRadius: 2, background: muted ? "rgba(240,232,255,.2)" : accent, transformOrigin: "center", animation: (speaking && !muted) ? `aireq .7s ease-in-out ${i * 0.15}s infinite` : "none", transform: (speaking && !muted) ? undefined : "scaleY(.4)", transition: "background .3s" }} />
            ))}
          </span>
          <span style={{ fontSize: 12, color: (micMuted && handsFree) ? "#fb7185" : muted ? "rgba(240,232,255,.35)" : "rgba(240,232,255,.6)", letterSpacing: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(micMuted && handsFree) ? t("your mic is off") : muted ? t("muted · text only") : t("on air · just you two")}</span>
        </div>
        {/* One button, not three. It opens the sound panel below — mute, level and
            (where the browser allows it) which speaker — so the top bar keeps
            exactly the one control it had. */}
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* Language switch. Only exists when they actually speak more than one —
              a switch with a single option is clutter pretending to be a feature. */}
          {myLangs.length > 1 && (
            <button
              onClick={cycleLang}
              aria-label={t("chatting in {lang} — switch language", { lang: t(activeLang) })}
              style={{ height: 44, minWidth: 44, padding: "0 12px", borderRadius: 12, fontSize: 12.5, fontWeight: 700, letterSpacing: 1, color: "rgba(240,232,255,.75)", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.10)", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", fontFamily: "inherit" }}
            >
              {(isoForLanguage(activeLang) || activeLang.slice(0, 2)).toUpperCase()}
            </button>
          )}
          <button
            onClick={openAudioPanel}
            aria-label={t("sound")}
            aria-expanded={audioPanel}
            style={{ width: 44, height: 44, borderRadius: 12, fontSize: 18, color: (muted || (micMuted && handsFree)) ? "#fb7185" : "rgba(240,232,255,.55)", background: audioPanel ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.07)", border: `.5px solid rgba(255,255,255,.10)`, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {(micMuted && handsFree) ? "🎙️" : muted ? "🔇" : volume < 0.34 ? "🔈" : volume < 0.67 ? "🔉" : "🔊"}
          </button>
        </div>
      </div>

      {/* ── THE CALL DRAWER ──────────────────────────────────────────────────
          Everything you might need mid-call and almost never do, in one place
          that is closed until you ask for it. It exists because the alternative
          was leaving: to change language you went out to a sheet, and the call
          you were in is the thing you were trying not to interrupt.

          A drawer rather than the old inline block: this panel grew to five
          controls and was pushing the portrait, the caption and the call button
          around every time it opened. Sliding it over the call leaves the call
          exactly where it was, which is the whole point of a control you reach
          for WHILE talking to someone. */}
      {audioPanel && (
        <div onClick={() => setAudioPanel(false)}
          style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(6,3,12,.55)", backdropFilter: "blur(3px)" }} />
      )}
      {audioPanel && (
        <div role="dialog" aria-label={t("call settings")} onClick={(e) => e.stopPropagation()}
          style={{ position: "absolute", top: 0, bottom: 0, right: 0, zIndex: 41, width: "min(320px, 86vw)", overflowY: "auto",
            background: "linear-gradient(180deg, #17111f 0%, #0e0916 100%)", borderLeft: ".5px solid rgba(255,255,255,.12)",
            padding: "calc(env(safe-area-inset-top) + 16px) 14px calc(env(safe-area-inset-bottom) + 16px)",
            display: "flex", flexDirection: "column", gap: 10, boxShadow: "-24px 0 60px -20px rgba(0,0,0,.9)" }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 11.5, letterSpacing: 1.3, textTransform: "uppercase", color: "rgba(240,232,255,.4)" }}>{t("while you talk")}</span>
            {/* A 44px target: the glyph is 20px but a thumb is not. */}
            <button onClick={() => setAudioPanel(false)} aria-label={t("close settings")}
              style={{ background: "none", border: "none", color: "rgba(240,232,255,.5)", fontSize: 20, lineHeight: 1, cursor: "pointer", width: 44, height: 44, margin: "-12px -12px -12px 0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>×</button>
          </div>

          {/* Language, as one button that names where it goes. Not a picker:
              a list of forty languages is a settings screen, and this is a
              thing you do mid-sentence. Hidden entirely when there is only one
              language to be in. */}
          {myLangs.length > 1 && (
            <button onClick={cycleLang} aria-label={t("switch to {lang}", { lang: t(myLangs[(myLangs.indexOf(activeLang) + 1) % myLangs.length]) })}
              style={{ width: "100%", minHeight: 44, borderRadius: 10, padding: "0 12px", cursor: "pointer", textAlign: "left",
                background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.10)", color: "rgba(240,232,255,.8)",
                fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span>{activeLang.toLowerCase()}</span>
              <span style={{ color: accent }}>→ {myLangs[(myLangs.indexOf(activeLang) + 1) % myLangs.length].toLowerCase()}</span>
            </button>
          )}

          {/* Read it instead of hearing it, and hear it instead of reading it.
              Two directions of the same door, and both were previously only
              reachable from a different screen. */}
          <button onClick={() => { setChatOpen((v) => !v); setAudioPanel(false) }} aria-pressed={chatOpen}
            style={{ width: "100%", minHeight: 44, borderRadius: 10, padding: "0 12px", cursor: "pointer", textAlign: "left",
              background: chatOpen ? `${accent}22` : "rgba(255,255,255,.08)", border: `.5px solid ${chatOpen ? `${accent}55` : "rgba(255,255,255,.10)"}`,
              color: "rgba(240,232,255,.8)", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit" }}>
            {chatOpen ? t("hide the words") : t("show the words while we talk")}
          </button>

          <button onClick={() => { setMuted((m) => { const n = !m; mutedRef.current = n; if (n) stopSpeaking(); return n }) }} aria-pressed={!muted}
            style={{ width: "100%", minHeight: 44, borderRadius: 10, padding: "0 12px", cursor: "pointer", textAlign: "left",
              background: muted ? "rgba(255,255,255,.08)" : `${accent}22`, border: `.5px solid ${muted ? "rgba(255,255,255,.10)" : `${accent}55`}`,
              color: "rgba(240,232,255,.8)", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit" }}>
            {/* Two keys per gender rather than an interpolated pronoun: Arabic attaches
                 the object pronoun as a SUFFIX (تسمعه / تسمعها), so a slot in the
                 middle of the sentence cannot be filled with a word. */}
            {muted
              ? t(cluster.gender === "male" ? "he is on mute — tap to hear him" : "she is on mute — tap to hear her")
              : t(cluster.gender === "male" ? "you hear him out loud" : "you hear her out loud")}
          </button>

          <MicTest accent={accent} />

          {/* THE DOOR. You are already talking to this person; this takes THEM
              with you. The guest is the cluster in hand, so nothing is recast. */}
          <button
            disabled={goldBusy}
            onClick={async () => {
              setAudioPanel(false)
              if (gold < 1) { onGolden?.(); return }
              setGoldBusy(true)
              const r = await openGolden({ key: faceSeedFor(cluster) || cluster.key, host: cluster.host, gender: cluster.gender })
              setGoldBusy(false)
              if (r.ok && r.session) { setGolden(r.session); try { track("golden_open") } catch { /* */ } }
              else onGolden?.()
            }}
            aria-label={gold > 0 ? t("take {name} into the golden room", { name: displayName(cluster.host, cluster.gender, t.locale) }) : t("get a golden room")}
            style={{ width: "100%", minHeight: 46, borderRadius: 11, cursor: goldBusy ? "default" : "pointer", padding: "0 13px",
              background: "linear-gradient(135deg, #f7e3a1 0%, #e8c46a 42%, #a97c24 100%)", border: "none",
              color: "#0a0805", fontSize: 13.5, fontWeight: 800, fontFamily: "inherit", textAlign: "left",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, opacity: goldBusy ? .6 : 1 }}>
            <span>{gold > 0 ? t("take {name} to the golden room", { name: displayName(cluster.host, cluster.gender, t.locale) }) : t("the golden room")}</span>
            <span style={{ opacity: .7, fontWeight: 700 }}>{gold > 0 ? `${gold} held` : "✦"}</span>
          </button>

          <span style={{ height: 1, background: "rgba(255,255,255,.08)", margin: "4px 0" }} />

          <div style={{ background: "rgba(255,255,255,.04)", border: ".5px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 11px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Volume only. Muting her moved up into the drawer's own row, where it
              reads as one of the four things you came in here to do — two mute
              buttons a centimetre apart was the panel telling you the same thing
              twice. */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: "0 0 auto", fontSize: 11.5, color: "rgba(240,232,255,.45)" }}>{t("volume")}</span>
            <input
              type="range" min={0} max={1} step={0.05}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label={t("volume")}
              style={{ flex: 1, accentColor: accent, height: 34, cursor: "pointer" }}
            />
            <span style={{ flex: "0 0 auto", width: 34, textAlign: "right", fontSize: 11, color: "rgba(240,232,255,.5)", fontVariantNumeric: "tabular-nums" }}>{Math.round(volume * 100)}</span>
          </div>

          {/* Your mic. Separate row from the speaker controls above on purpose —
              muting THEM and muting YOU are opposite things and sat one tap apart.
              Only shown while the mic is actually live: with no live mic there is
              nothing to mute, and a control that acts on nothing is clutter. */}
          {handsFree && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={toggleMicMute}
              aria-label={micMuted ? t("unmute your microphone") : t("mute your microphone")}
              aria-pressed={micMuted}
              style={{ flex: 1, height: 34, borderRadius: 10, fontSize: 12, fontWeight: 600, color: micMuted ? "#0d0418" : "rgba(240,232,255,.75)", background: micMuted ? "#fb7185" : "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.10)", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              {micMuted ? "🎙️ your mic is off" : "🎙️ your mic is on"}
            </button>
          </div>
          )}

          {/* Only shown to someone who actually has a saved thread, so it never
              advertises storage that isn't happening. */}
          {memoryEnabled() && resumed && (
            <button
              onClick={() => { forgetTalk(cluster.key); setMsgs([{ who: "host", text: opener(cluster.lines[0]) }]); msgsRef.current = [{ who: "host", text: cluster.lines[0] }]; setAudioPanel(false) }}
              style={{ height: 32, borderRadius: 10, fontSize: 11.5, color: "rgba(240,232,255,.55)", background: "transparent", border: ".5px solid rgba(255,255,255,.12)", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              {t("forget this conversation")}
            </button>
          )}

          {/* Only rendered where the browser can actually switch output. On iOS there
              is no such API, so nothing appears rather than a control that lies. */}
          {outputs.length > 1 && (
            <select
              value={sink}
              onChange={(e) => chooseSink(e.target.value)}
              aria-label={t("speaker")}
              style={{ width: "100%", height: 34, borderRadius: 10, fontSize: 12, color: "rgba(240,232,255,.75)", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.10)", padding: "0 8px", cursor: "pointer" }}
            >
              <option value="">{t("speaker · system default")}</option>
              {outputs.filter((d) => d.id && d.id !== "default").map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          )}
          </div>
        </div>
      )}

      {humanNote && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px max(18px, env(safe-area-inset-right)) 2px max(18px, env(safe-area-inset-left))", fontSize: 12, color: "rgba(240,232,255,.8)", background: fill, border: `.5px solid ${accent}50`, borderRadius: 12, padding: "9px 12px" }}>
          <span style={{ flex: 1, lineHeight: 1.4 }}>{t("some voices here are real people — you won't always know.")}</span>
          <button onClick={dismissHumanNote} style={{ flex: "0 0 auto", fontSize: 12, color: "#0d0418", background: accent, border: "none", borderRadius: 9, padding: "7px 12px", minHeight: 34, cursor: "pointer", WebkitTapHighlightColor: "transparent", fontWeight: 600 }}>{t("got it")}</button>
        </div>
      )}

      {/* main call area — portrait, name, status, caption */}
      {/* minHeight:0 lets this shrink; without an overflow it then SPILLS.
          On a phone with browser chrome the call screen is about 660px tall, the
          phone row and end button take a fixed slice of it, and what is left is
          shorter than the portrait plus her name plus the caption — measured at
          60px over. With overflow visible that surplus was drawn straight on top
          of the controls, which is why "mute" and "keypad" had her Arabic line
          printed through them. Scroll it instead of hiding it: on a tall screen
          nothing scrolls and nothing changes, and on a short one the caption is
          reachable rather than lost behind a button. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly", gap: 8, padding: "14px 24px 6px" }}>
        {/* portrait with glow ring */}
        <div style={{ position: "relative", width: "min(54vw, 210px, 30vh)", flexShrink: 0, aspectRatio: "1" }}>
          {speaking && <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: `2px solid ${accent}`, animation: "airpulse 1.5s ease-out infinite" }} />}
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", border: `1.5px solid ${speaking ? accent : accent + "50"}`, boxShadow: `0 22px 70px -22px ${glow}`, transition: "border-color .3s" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Face persona={{ name: cluster.host, gender: cluster.gender, seed: faceSeedFor(cluster) }} lazy={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        </div>

        {/* name — tap to set vibe */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => pro ? setVibeEdit(true) : setShowPro(true)}
            aria-label={t("set the vibe")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, WebkitTapHighlightColor: "transparent" }}
          >
            <div style={{ fontSize: 23, fontWeight: 500, color: "#f0e8ff" }}>{cluster.host}</div>
          </button>
          {vibe && (
            <div style={{ fontSize: 12, color: accent + "cc", marginTop: 3, letterSpacing: 0.3 }}>{vibe}</div>
          )}
          {handsFree && (
            <div style={{ fontSize: 15, color: "rgba(240,232,255,.7)", marginTop: 6, fontVariantNumeric: "tabular-nums", letterSpacing: 1 }}>{mmss}</div>
          )}
        </div>

        {/* live mic visualizer */}
        {handsFree && !muted && (
          <VoiceWave getLevel={() => micLevelRef.current} active={handsFree && !speaking && !muted} hue={cluster.h === "w" ? 285 : cluster.h === "m" ? 330 : 350} />
        )}

        {/* status */}
        <div style={{ fontSize: 13, color: handsFree ? accent : "rgba(240,232,255,.45)", minHeight: 18 }}>{status}</div>

        {/* the newest photo, on the call screen itself — a photo that only lives
            behind the keypad is a photo nobody finds */}
        {(() => { const ph = [...msgs].reverse().find((m) => m.image); return ph && !styleQ ? (
          <button onClick={() => setChatOpen(true)} aria-label={t("see her photos")} style={{ width: "min(46vw, 180px)", aspectRatio: "3 / 4", borderRadius: 14, overflow: "hidden", border: `.5px solid ${accent}66`, boxShadow: `0 16px 40px -16px ${glow}`, padding: 0, background: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ph.image} alt={cluster.host} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        ) : null })()}
        {photoNote && <div style={{ fontSize: 12, color: accent + "cc" }}>{photoNote}</div>}

        {/* live caption — no speaker label, the color tells you who's talking */}
        <div style={{ width: "min(92vw, 430px)", minHeight: 60, textAlign: "center", overflow: "hidden" }}>
          {last && !styleQ && (
            <div style={{ fontSize: 15.5, lineHeight: 1.55, letterSpacing: -0.2, color: last.who === "you" ? accent + "dd" : "#e8daf8", fontFamily: "var(--font-geist-mono), ui-monospace, 'SF Mono', Menlo, monospace", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}>
              {last.text}{speaking && last.who !== "you" && <span style={{ marginLeft: 1, opacity: 0.85, animation: "airblink 1s step-end infinite" }}>▍</span>}
            </div>
          )}
          {/* style profile question — 2-word choice, shown once per question slot */}
          {styleQ && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 4 }}>
              <div style={{ fontSize: 11, color: accent + "80", letterSpacing: 1.5, textTransform: "uppercase" }}>{t("quick pick")}</div>
              <div style={{ display: "flex", gap: 10 }}>
                {[styleQ.a, styleQ.b].map(opt => (
                  <button key={opt} onClick={() => pickStyle(opt)} style={{ fontSize: 14, fontWeight: 500, padding: "10px 18px", borderRadius: 999, color: accent, background: accent + "18", border: `.5px solid ${accent}55`, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", letterSpacing: -0.2 }}>{opt}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* bottom controls — A PHONE'S.
          Before the call: one big green button, like a dialler. During it: the
          row every phone has had for fifteen years — mute · speaker · keypad —
          over a big red end button. People know this layout without reading it,
          which is the point; a call screen that has to be learned is not a call
          screen. Each button is wired to something that already existed here:
          the mic mute, the sound panel, the text transcript, hanging up. */}
      <div style={{ flexShrink: 0, padding: "10px max(18px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 22px) max(18px, env(safe-area-inset-right))" }}>
        <div style={{ fontSize: 11, color: micHint ? "#fb7185" : "rgba(240,232,255,.3)", marginBottom: 12, textAlign: "center", minHeight: 14, letterSpacing: 0.4 }}>
          {micHint ? t(micHint) : (handsFree ? "" : t("swipe → for the words"))}
        </div>

        {/* The row is there BEFORE the call starts too. It used to appear only in
            hands-free — so when the mic was refused (every in-app browser) the hint
            said "tap the keypad to type" under a screen with no keypad on it. Mute
            is the one button that only means something with a live mic. */}
        {!leaving && (
          <div style={{ display: "flex", justifyContent: "center", gap: 26, marginBottom: 18 }}>
            {([
              ...(handsFree ? [{ label: micMuted ? t("unmute") : t("mute"), icon: micMuted ? "🔇" : "🎙", on: micMuted, act: toggleMicMute, aria: micMuted ? t("unmute your microphone") : t("mute your microphone") }] : []),
              // Named "speaker", not "sound": the header button is already
              // aria-labelled "sound" and opens this same drawer, and two
              // controls with one name is a screen reader reading the screen
              // wrong — and a test clicking the wrong one.
              { label: t("speaker"), icon: "🔊", on: audioPanel, act: () => setAudioPanel((v) => !v), aria: t("speaker") },
              { label: t("keypad"), icon: "⌨", on: false, act: () => setChatOpen(true), aria: t("type") },
              { label: photoBusy ? t("taking…") : t("photo"), icon: "\ud83d\udcf7", on: photoBusy, act: () => askPhoto(), aria: t("ask her for a photo") },
            ] as Array<{ label: string; icon: string; on: boolean; act: () => void; aria: string }>).map((b) => (
              <button key={b.label} onClick={b.act} aria-label={b.aria} aria-pressed={b.on}
                style={{ width: 64, background: "none", border: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", color: "rgba(240,232,255,.8)", fontFamily: "inherit" }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "50%", fontSize: 24, background: b.on ? "rgba(240,232,255,.92)" : "rgba(255,255,255,.12)", color: b.on ? "#0d0418" : "inherit", border: ".5px solid rgba(255,255,255,.12)", transition: "background .2s" }}>{b.icon}</span>
                <span style={{ display: "block", marginTop: 7, fontSize: 12, letterSpacing: .3 }}>{b.label}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button
            onClick={leaving ? onClose : handsFree ? leaveCall : sttOk ? onTalk : onType}
            aria-label={leaving ? t("close") : handsFree ? t("end the call") : sttOk ? t("call") : t("type")}
            style={{
              width: (handsFree || leaving) ? 72 : 92, height: (handsFree || leaving) ? 72 : 92, borderRadius: "50%", cursor: "pointer",
              fontWeight: 700, fontSize: (handsFree || leaving) ? 26 : 17, color: "#fff", letterSpacing: 0.5,
              background: (handsFree || leaving) ? "linear-gradient(135deg,#e11d48,#fb7185)" : "linear-gradient(135deg,#16a34a,#4ade80)",
              boxShadow: (handsFree || leaving) ? "0 14px 40px -12px rgba(251,113,133,.6)" : "0 14px 40px -12px rgba(74,222,128,.55)",
              border: "none",
              WebkitTapHighlightColor: "transparent", touchAction: "manipulation", transition: "background .2s, box-shadow .2s, width .2s, height .2s",
            } as CSSProperties}
          >
            {leaving ? t("close") : handsFree ? "📞" : sttOk ? t("call") : t("text")}
          </button>
        </div>

        {/* AIR credit counter — visible to free users, urgent amber when ≤3 */}
        {!pro && (
          <div
            onClick={() => setShowPro(true)}
            role="button"
            style={{ textAlign: "center", fontSize: 11, letterSpacing: 0.5, cursor: "pointer", marginTop: 6,
              color: credits <= 3 ? "#f59e0b" : "rgba(240,232,255,.25)",
              animation: credits <= 3 ? "airpulse 2.5s ease-in-out infinite" : undefined,
            }}
          >
            {credits <= 0 ? "out of AIR — unlock to keep going" : credits <= 3 ? `${credits} AIR left` : `${credits} AIR`}
          </div>
        )}
      </div>

      {/* text transcript overlay */}
      {chatOpen && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(7,4,15,.95)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", display: "flex", flexDirection: "column", zIndex: 25 }}>
          <div style={{ padding: "calc(env(safe-area-inset-top) + 14px) max(20px, env(safe-area-inset-right)) 8px max(20px, env(safe-area-inset-left))", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: accent + "cc", letterSpacing: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>the words · {cluster.host}</span>
            <button onClick={() => setChatOpen(false)} style={{ flex: "0 0 auto", fontSize: 13, color: "rgba(240,232,255,.7)", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.14)", padding: "10px 14px", minHeight: 44, borderRadius: 12, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>{t("back")}</button>
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "8px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }} />
            {msgs.map((m, i) => m.image ? (
              <div key={i} style={{ alignSelf: "flex-start", maxWidth: "82%", borderRadius: 16, overflow: "hidden", border: `.5px solid ${accent}55`, background: "rgba(255,255,255,.06)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.image} alt={`${cluster.host}${m.text.replace(/^\ud83d\udcf7\s*/, "") ? ` \u2014 ${m.text.replace(/^\ud83d\udcf7\s*/, "")}` : ""}`} style={{ display: "block", width: "100%", aspectRatio: "3 / 4", objectFit: "cover" }} />
                {m.text.replace(/^\ud83d\udcf7\s*/, "") && <div style={{ padding: "7px 11px", fontSize: 12.5, color: "rgba(240,232,255,.7)" }}>{m.text.replace(/^\ud83d\udcf7\s*/, "")}</div>}
              </div>
            ) : (
              <div key={i} style={{ alignSelf: m.who === "you" ? "flex-end" : "flex-start", maxWidth: "82%", fontSize: 15, lineHeight: 1.45, color: m.who === "you" ? "#0d0418" : "#f0e8ff", background: m.who === "you" ? accent : "rgba(255,255,255,.09)", padding: "9px 13px", borderRadius: 16, fontWeight: m.who === "you" ? 500 : 400 }}>{m.text}</div>
            ))}
            {busy && <div style={{ alignSelf: "flex-start", fontSize: 13, color: accent + "99", fontStyle: "italic" }}>{cluster.host} is thinking…</div>}
            {styleQ && (
              <div style={{ alignSelf: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 9, margin: "4px 0 8px" }}>
                <div style={{ fontSize: 11, color: accent + "80", letterSpacing: 1.5, textTransform: "uppercase" }}>{t("quick pick")}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[styleQ.a, styleQ.b].map(opt => (
                    <button key={opt} onClick={() => pickStyle(opt)} style={{ fontSize: 13, fontWeight: 500, padding: "9px 16px", borderRadius: 999, color: accent, background: accent + "18", border: `.5px solid ${accent}55`, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>{opt}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: "10px max(18px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 18px) max(18px, env(safe-area-inset-right))", boxSizing: "border-box" }}>
            {trouble && (
              <div onClick={retry} role="button" tabIndex={0} style={{ fontSize: 12, color: "#fb7185", background: "rgba(251,113,133,.12)", border: ".5px solid rgba(251,113,133,.35)", borderRadius: 12, padding: "9px 12px", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 9, textAlign: "center", cursor: "pointer" }}>{t("couldn't reach the voice — tap to retry")}</div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send() }}
                placeholder={t("type to {name}…", { name: cluster.host.toLowerCase() })}
                style={{ flex: 1, minWidth: 0, fontSize: 16, color: "#f0e8ff", background: "rgba(255,255,255,.07)", border: `.5px solid ${accent}40`, borderRadius: 14, padding: "12px 14px", minHeight: 44, boxSizing: "border-box", outline: "none" }}
              />
              <button
                onClick={() => send()}
                disabled={busy}
                style={{ fontSize: 14, minHeight: 44, color: "#0d0418", background: grad, border: "none", borderRadius: 14, padding: "11px 16px", cursor: "pointer", opacity: busy ? 0.6 : 1, WebkitTapHighlightColor: "transparent", touchAction: "manipulation", fontWeight: 600 }}
              >
                send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* pro vibe edit overlay */}
      {vibeEdit && pro && (
        <div style={{ position: "absolute", inset: 0, zIndex: 26, background: "rgba(7,4,15,.88)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "min(88vw, 400px)", background: "#0f041a", border: `.5px solid ${accent}50`, borderRadius: 18, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: accent }}>{t("pro · set the vibe")}</div>
            <div style={{ fontSize: 14, color: "rgba(240,232,255,.7)", margin: "8px 0 14px", lineHeight: 1.5 }}>tell {cluster.host.toLowerCase()} the mood — they&apos;ll follow it.</div>
            <input
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setVibeEdit(false) }}
              autoFocus
              placeholder={t("e.g. flirty and slow · hype me up · brutally honest")}
              style={{ width: "100%", fontSize: 16, color: "#f0e8ff", background: "rgba(255,255,255,.07)", border: `.5px solid ${accent}50`, borderRadius: 12, padding: "12px 14px", minHeight: 46, boxSizing: "border-box", outline: "none" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => { setVibe(""); setVibeEdit(false) }} style={{ flex: 1, minHeight: 44, fontSize: 13, color: "rgba(240,232,255,.5)", background: "transparent", border: ".5px solid rgba(255,255,255,.12)", borderRadius: 12, cursor: "pointer" }}>{t("clear")}</button>
              <button onClick={() => setVibeEdit(false)} style={{ flex: 1, minHeight: 44, fontSize: 14, fontWeight: 700, color: "#0d0418", background: grad, border: "none", borderRadius: 12, cursor: "pointer" }}>{t("set it")}</button>
            </div>
          </div>
        </div>
      )}

      {/* THE MOMENT SOMEONE MIGHT ACTUALLY PAY.
          They asked for something, she deflected, and until now that read as "she
          isn't into it" — indistinguishable from the product simply being tame.
          This says which of the two just happened, once, at the only point where
          the upgrade means something concrete. It names the limit plainly rather
          than teasing: someone who has just been deflected has earned a straight
          answer, and "unlock" language on top of a brush-off reads as a trick. */}
      {ceiling && !pro && (
        <div
          onClick={() => { try { track("ceiling_tap") } catch { /* */ } ; setCeiling(false); setShowPro(true) }}
          role="button"
          style={{
            position: "absolute", left: 16, right: 16, bottom: "calc(env(safe-area-inset-bottom) + 88px)",
            zIndex: 30, cursor: "pointer", padding: "11px 14px", borderRadius: 14,
            background: "rgba(12,8,22,.92)", backdropFilter: "blur(10px)",
            border: `.5px solid ${accent}55`, color: "#f0e8ff",
            fontSize: 13, lineHeight: 1.35, textAlign: "center",
            boxShadow: "0 14px 40px -14px rgba(0,0,0,.8)",
          }}
        >
          {nudge}{" "}
          <span style={{ fontWeight: 700, color: accent }}>{t("$9 opens her all the way →")}</span>
          <span
            onClick={(e) => { e.stopPropagation(); setCeiling(false) }}
            style={{ display: "block", marginTop: 5, fontSize: 11, color: "rgba(240,232,255,.4)" }}
          >
            {t("not now")}
          </span>
        </div>
      )}
      {showPro && <ProSheet onClose={() => setShowPro(false)} />}
      {/* playsInline keeps iOS from hijacking playback into a fullscreen player,
          which would tear down the call UI mid-conversation. */}
      <audio ref={audioRef} playsInline style={{ display: "none" }} />
    </div>
  )
}
