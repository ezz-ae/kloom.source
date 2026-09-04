"use client"

/**
 * AIRROOM — the air-off bubble. A private 1:1 with a cluster's host: it greets
 * aloud, you reply, it answers in voice (/api/chat + /api/tts). Two ways to talk:
 *   • push-to-talk ("talk") — tap, say one thing, it sends.
 *   • hands-free ("live")   — keep the mic open; just talk and each line sends,
 *                             no pressing. Ignores its own voice while it speaks.
 */
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { faceSeedFor } from "@/lib/airroom/roster"
import type { Cluster, Heat } from "@/lib/airroom/roster"
import { SpeechSegmenter, phoneMicAudio } from "@/lib/speech-segmenter"
import { canListen } from "@/lib/voice-once"
import { Face } from "@/components/airroom/Face"
import { VoiceWave } from "@/components/airroom/VoiceWave"
import { isPro, getProToken } from "@/lib/airroom/pro"
import { getCredits } from "@/lib/airroom/credits"
import { ProSheet } from "@/components/airroom/ProSheet"
import { LANGUAGE_TO_BCP47, isoForLanguage } from "@/lib/languages"
import { getStyle, saveStyle, nextStyleQuestion, stylePromptLine, type StyleQuestion } from "@/lib/airroom/style"
import { dossierLine } from "@/lib/airraw/dossier"
import { loadVolume, saveVolume, canChooseOutput, listOutputs, loadSink, applySink, bindMediaSession, type OutputDevice } from "@/lib/airraw/audio-output"
import { loadTalk, saveTalk, forgetTalk, memoryEnabled } from "@/lib/airraw/memory"
import { getLangPrefs, spokenLanguages } from "@/lib/airraw/lang-prefs"

interface Msg { who: "host" | "you"; text: string }

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
// The two halves are drawn INDEPENDENTLY and joined only here: `dossierLine`
// knows nothing about where the character's voice is from, and `arabicDialectLine`
// knows nothing about their personality. So a Gulf accent is just as likely to
// come with the filthiest dossier in the pool as a European one — accent never
// implies character.
function personaFor(c: Cluster, lang?: string, pro = false) {
  const id = c.key || c.host
  // The caller's language wins when the surface pinned one; otherwise the user's
  // own setting decides, rather than everyone starting in English.
  const prefs = getLangPrefs()
  const spoken = spokenLanguages(prefs)
  return {
    language: lang || prefs.primary || "English",
    // Every language they speak, so switching mid-call is expected rather than
    // treated as a mistake to correct.
    speaks: spoken,
    name: c.host,
    personality:
      `You are ${c.host}, on a late-night adult voice floor — the "${c.name}" room (vibe: ${c.vibe}). ` +
      `${dossierLine(id)} ` +
      `You want things and you say so out loud.`,
    speakingStyle: "raw, intimate voice at 2am — short fragments, direct, natural. get to it fast. stretch letters for feeling when it's real: 'yesss', 'noooo'. never formal, never robotic.",
    backstory: `A familiar voice on the ${c.vibe} part of the adult floor.`,
    // Accent/dialect is derived from this, and the FACE is generated from the name —
    // so this must be the NAME, or a character would look one ethnicity and sound
    // another. The unique key stays where it's free: the dossier and saved threads.
    seedKey: c.host,
    barTalk: 100,
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const PARTING = [
  "wait — don't disappear on me. i'm still chewing on what you said. come back and finish the thought.",
  "leaving already? fine. but you're gonna think about this later, i can tell. find me when you do.",
  "go on, then. but you started something here — you don't get to leave it unfinished. come back to me.",
  "take it with you, whatever we just stirred up. i'll be right here on the floor when it clicks.",
  "okay, drift off. but that thing you said? it's not done. come tell me how it ends.",
]

export function AirBubble({ cluster, tempLabel, onClose, onTalked, opening, lang = "English" }: { cluster: Cluster; tempLabel: string; onClose: () => void; onTalked?: () => void; opening?: string; lang?: string }) {
  const accent = HEAT_COLOR[cluster.h]
  const glow   = HEAT_GLOW[cluster.h]
  const fill   = HEAT_FILL[cluster.h]
  const grad   = HEAT_GRAD[cluster.h]

  // Reopen where the thread left off (Pro only — see lib/airraw/memory.ts). The
  // initial state is computed lazily so the restore happens before first paint
  // and the user never sees the greeting flash in over their old conversation.
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    const saved = loadTalk(cluster.key)
    return saved?.msgs.length ? saved.msgs : [{ who: "host", text: cluster.lines[0] }]
  })
  const [resumed] = useState(() => !!loadTalk(cluster.key)?.msgs.length)
  const [micMuted, setMicMuted] = useState(false)
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [sttOk, setSttOk] = useState(false)
  const [listening, setListening] = useState(false)
  const [handsFree, setHandsFree] = useState(false)
  const [trouble, setTrouble] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [micHint, setMicHint] = useState("")
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [audioPanel, setAudioPanel] = useState(false)
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
    setMicHint(`switched to ${next.toLowerCase()}`)
    setTimeout(() => setMicHint((h) => (h.startsWith("switched to") ? "" : h)), 1800)
  }

  const audioRef = useRef<HTMLAudioElement | null>(null)
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
  useEffect(() => { hfRef.current = handsFree }, [handsFree])
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9 }) }, [msgs])
  useEffect(() => { setSttOk(canListen()) }, [])
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
        try { segRef.current?.abort() } catch { /* */ }
        try { onceRecRef.current?.stop() } catch { /* */ }
        setMicHint("your mic is off — they can't hear you")
      } else {
        if (hfRef.current) { try { segRef.current?.start() } catch { /* */ } }
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
        // Never re-arm a mic the user muted — the character finishing its turn is
        // not consent to start listening again.
        if (hfRef.current && !micMutedRef.current) { try { segRef.current?.start() } catch { /* */ } }
      }
      return
    }
    const [next] = audioQueueRef.current.splice(i, 1)
    playSeqRef.current++
    if (!next.url) { pump(); return }   // failed chunk — skip, don't stall
    const a = audioRef.current
    if (!a) { URL.revokeObjectURL(next.url); pump(); return }
    qPlayingRef.current = true
    hostSpeakingRef.current = true; setSpeaking(true)
    const done = () => {
      qPlayingRef.current = false
      try { URL.revokeObjectURL(next.url!) } catch { /* */ }
      pump()
    }
    a.onended = done; a.onerror = done
    a.src = next.url
    a.volume = volumeRef.current
    // If play() is rejected (blocked autoplay), still advance the queue rather than
    // wedge it — but log it, so "AI went silent" is diagnosable instead of invisible.
    a.play().catch((err) => { console.error("[air] audio play blocked:", err?.message || err); done() })
  }

  const speakChunk = async (text: string, tok: number, prevText = "") => {
    if (mutedRef.current || tok !== speakTokenRef.current) return
    const seq = seqRef.current++
    inflightRef.current++
    try {
      const res = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        // prevText = what this voice already said this reply → the engine continues
        // the same breath across chunks instead of restarting (no mid-reply shift).
        // seedKey drives accent/voice casting and the FACE is generated from the
        // name, so both use the name — otherwise a character looks one ethnicity and
        // sounds another.
        body: JSON.stringify({ text, personaName: cluster.host, seedKey: cluster.host, gender: cluster.gender, language: langRef.current, voiceId: cluster.voiceId, mode: "voice", prevText }),
        signal: AbortSignal.timeout(30000),
      })
      if (tok !== speakTokenRef.current) return
      if (!res.ok) { audioQueueRef.current.push({ url: null, seq }); return }
      const blob = await res.blob()
      if (tok !== speakTokenRef.current) return
      audioQueueRef.current.push({ url: URL.createObjectURL(blob), seq })
      // NOTE: the mic deliberately stays LIVE while the character speaks. It used
      // to be aborted (segRef.abort()), which made barge-in physically impossible
      // — there was no VAD and no recorder running, so there was nothing to
      // interrupt with. getUserMedia already requests hardware echo-cancellation
      // (phoneMicAudio), so the character's own voice is largely cancelled out.
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
    speak(cluster.lines[0])
  }

  // Persist the thread as it goes, so closing the tab mid-sentence still leaves
  // something to come back to. No-op entirely for a free session.
  useEffect(() => {
    if (!memoryEnabled()) return
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
        body: JSON.stringify({ persona: personaFor(cluster, langRef.current, pro), proVibe: vibeRef.current, proToken: getProToken(), userStyle: stylePromptLine(getStyle()), messages: msgsRef.current.map((m) => ({ role: m.who === "you" ? "user" : "assistant", content: m.text })) }),
      })
      if (!res.ok) { setTrouble(true); return }
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
      const fullText = accumulated.trim() || cluster.lines[fallbackIdx] || cluster.lines[0]
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

  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || busyRef.current) return
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

  const onTalk = () => {
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
        setMicHint("voice isn't supported on this browser — tap the keypad to type"); setHandsFree(false); return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: phoneMicAudio() })
      } catch { setMicHint("allow mic access to talk — or tap the keypad to type"); setHandsFree(false); return }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
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
      if (!micMutedRef.current) seg.start()
    })()

    return () => {
      cancelled = true; stopped = true
      try { seg?.destroy() } catch { /* */ }
      segRef.current = null
      try { stream?.getTracks().forEach((t) => t.stop()) } catch { /* */ }
      try { fallbackRec?.stop() } catch { /* */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handsFree, lang])

  const last = msgs[msgs.length - 1]
  const host = cluster.host.toLowerCase()
  const status = speaking ? `${host} is talking…` : busy ? `${host} is thinking…` : handsFree ? "listening — just talk" : "tap call to start"

  // Swipe right anywhere → the words (text sheet). A 1:1 call has no swipe left —
  // there's no one else on the line. Pointer events cover touch AND trackpad.
  const onSwipeDown = (e: React.PointerEvent) => { swipeRef.current = { x: e.clientX, y: e.clientY } }
  const onSwipeUp = (e: React.PointerEvent) => {
    const s = swipeRef.current; swipeRef.current = null
    if (!s || chatOpen || showPro || vibeEdit || leaving) return
    const dx = e.clientX - s.x, dy = e.clientY - s.y
    if (dx > 70 && Math.abs(dy) < 80) setChatOpen(true)
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
            aria-label="leave"
            style={{ flex: "0 0 auto", width: 36, height: 36, borderRadius: 11, fontSize: 17, lineHeight: 1, color: "rgba(240,232,255,.72)", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.10)", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}
          >
            ‹
          </button>
          <span style={{ display: "flex", alignItems: "center", gap: 2, height: 14, flexShrink: 0 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 3, height: 14, borderRadius: 2, background: muted ? "rgba(240,232,255,.2)" : accent, transformOrigin: "center", animation: (speaking && !muted) ? `aireq .7s ease-in-out ${i * 0.15}s infinite` : "none", transform: (speaking && !muted) ? undefined : "scaleY(.4)", transition: "background .3s" }} />
            ))}
          </span>
          <span style={{ fontSize: 12, color: (micMuted && handsFree) ? "#fb7185" : muted ? "rgba(240,232,255,.35)" : "rgba(240,232,255,.6)", letterSpacing: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(micMuted && handsFree) ? "your mic is off" : muted ? "muted · text only" : "on air · just you two"}</span>
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
              aria-label={`chatting in ${activeLang} — switch language`}
              style={{ height: 44, minWidth: 44, padding: "0 12px", borderRadius: 12, fontSize: 12.5, fontWeight: 700, letterSpacing: 1, color: "rgba(240,232,255,.75)", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.10)", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", fontFamily: "inherit" }}
            >
              {(isoForLanguage(activeLang) || activeLang.slice(0, 2)).toUpperCase()}
            </button>
          )}
          <button
            onClick={openAudioPanel}
            aria-label="sound"
            aria-expanded={audioPanel}
            style={{ width: 44, height: 44, borderRadius: 12, fontSize: 18, color: (muted || (micMuted && handsFree)) ? "#fb7185" : "rgba(240,232,255,.55)", background: audioPanel ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.07)", border: `.5px solid rgba(255,255,255,.10)`, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {(micMuted && handsFree) ? "🎙️" : muted ? "🔇" : volume < 0.34 ? "🔈" : volume < 0.67 ? "🔉" : "🔊"}
          </button>
        </div>
      </div>

      {audioPanel && (
        <div style={{ margin: "0 max(18px, env(safe-area-inset-right)) 6px max(18px, env(safe-area-inset-left))", background: "rgba(255,255,255,.06)", border: ".5px solid rgba(255,255,255,.10)", borderRadius: 14, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => { setMuted((m) => { const n = !m; mutedRef.current = n; if (n) stopSpeaking(); return n }) }}
              aria-label={muted ? "unmute" : "mute"}
              style={{ flex: "0 0 auto", height: 34, padding: "0 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, color: muted ? "#0d0418" : "rgba(240,232,255,.75)", background: muted ? "#fb7185" : "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.10)", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              {muted ? "muted" : "mute"}
            </button>
            <input
              type="range" min={0} max={1} step={0.05}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="volume"
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
              aria-label={micMuted ? "unmute your microphone" : "mute your microphone"}
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
              onClick={() => { forgetTalk(cluster.key); setMsgs([{ who: "host", text: cluster.lines[0] }]); msgsRef.current = [{ who: "host", text: cluster.lines[0] }]; setAudioPanel(false) }}
              style={{ height: 32, borderRadius: 10, fontSize: 11.5, color: "rgba(240,232,255,.55)", background: "transparent", border: ".5px solid rgba(255,255,255,.12)", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              forget this conversation
            </button>
          )}

          {/* Only rendered where the browser can actually switch output. On iOS there
              is no such API, so nothing appears rather than a control that lies. */}
          {outputs.length > 1 && (
            <select
              value={sink}
              onChange={(e) => chooseSink(e.target.value)}
              aria-label="speaker"
              style={{ width: "100%", height: 34, borderRadius: 10, fontSize: 12, color: "rgba(240,232,255,.75)", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.10)", padding: "0 8px", cursor: "pointer" }}
            >
              <option value="">speaker · system default</option>
              {outputs.filter((d) => d.id && d.id !== "default").map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {humanNote && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px max(18px, env(safe-area-inset-right)) 2px max(18px, env(safe-area-inset-left))", fontSize: 12, color: "rgba(240,232,255,.8)", background: fill, border: `.5px solid ${accent}50`, borderRadius: 12, padding: "9px 12px" }}>
          <span style={{ flex: 1, lineHeight: 1.4 }}>some voices here are real people — you won&apos;t always know.</span>
          <button onClick={dismissHumanNote} style={{ flex: "0 0 auto", fontSize: 12, color: "#0d0418", background: accent, border: "none", borderRadius: 9, padding: "7px 12px", minHeight: 34, cursor: "pointer", WebkitTapHighlightColor: "transparent", fontWeight: 600 }}>got it</button>
        </div>
      )}

      {/* main call area — portrait, name, status, caption */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly", gap: 8, padding: "14px 24px 6px" }}>
        {/* portrait with glow ring */}
        <div style={{ position: "relative", width: "min(54vw, 210px)", aspectRatio: "1" }}>
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
            aria-label="set the vibe"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, WebkitTapHighlightColor: "transparent" }}
          >
            <div style={{ fontSize: 23, fontWeight: 500, color: "#f0e8ff" }}>{cluster.host}</div>
          </button>
          {vibe && (
            <div style={{ fontSize: 12, color: accent + "cc", marginTop: 3, letterSpacing: 0.3 }}>{vibe}</div>
          )}
        </div>

        {/* live mic visualizer */}
        {handsFree && !muted && (
          <VoiceWave getLevel={() => micLevelRef.current} active={handsFree && !speaking && !muted} hue={cluster.h === "w" ? 285 : cluster.h === "m" ? 330 : 350} />
        )}

        {/* status */}
        <div style={{ fontSize: 13, color: handsFree ? accent : "rgba(240,232,255,.45)", minHeight: 18 }}>{status}</div>

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
              <div style={{ fontSize: 11, color: accent + "80", letterSpacing: 1.5, textTransform: "uppercase" }}>quick pick</div>
              <div style={{ display: "flex", gap: 10 }}>
                {[styleQ.a, styleQ.b].map(opt => (
                  <button key={opt} onClick={() => pickStyle(opt)} style={{ fontSize: 14, fontWeight: 500, padding: "10px 18px", borderRadius: 999, color: accent, background: accent + "18", border: `.5px solid ${accent}55`, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", letterSpacing: -0.2 }}>{opt}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* bottom controls — ONE button, like a phone: call to start, end to hang up.
          Text lives behind a swipe → (and the same button, when voice can't run here). */}
      <div style={{ flexShrink: 0, padding: "10px max(18px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 26px) max(18px, env(safe-area-inset-right))" }}>
        <div style={{ fontSize: 11, color: micHint ? "#fb7185" : "rgba(240,232,255,.3)", marginBottom: 14, textAlign: "center", minHeight: 14, letterSpacing: 0.4 }}>
          {micHint || "swipe → for the words"}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button
            onClick={leaving ? onClose : handsFree ? leaveCall : sttOk ? onTalk : () => setChatOpen(true)}
            aria-label={leaving ? "close" : handsFree ? "end the call" : sttOk ? "call" : "type"}
            style={{
              width: 92, height: 92, borderRadius: "50%", cursor: "pointer",
              fontWeight: 700, fontSize: 17, color: "#fff", letterSpacing: 0.5,
              background: (handsFree || leaving) ? "linear-gradient(135deg,#e11d48,#fb7185)" : grad,
              boxShadow: (handsFree || leaving) ? "0 14px 40px -12px rgba(251,113,133,.6)" : `0 14px 40px -12px ${glow}`,
              border: "none",
              WebkitTapHighlightColor: "transparent", touchAction: "manipulation", transition: "background .2s, box-shadow .2s",
            } as CSSProperties}
          >
            {leaving ? "close" : handsFree ? "end" : sttOk ? "call" : "text"}
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
            <button onClick={() => setChatOpen(false)} style={{ flex: "0 0 auto", fontSize: 13, color: "rgba(240,232,255,.7)", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.14)", padding: "10px 14px", minHeight: 44, borderRadius: 12, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>back</button>
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "8px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }} />
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.who === "you" ? "flex-end" : "flex-start", maxWidth: "82%", fontSize: 15, lineHeight: 1.45, color: m.who === "you" ? "#0d0418" : "#f0e8ff", background: m.who === "you" ? accent : "rgba(255,255,255,.09)", padding: "9px 13px", borderRadius: 16, fontWeight: m.who === "you" ? 500 : 400 }}>{m.text}</div>
            ))}
            {busy && <div style={{ alignSelf: "flex-start", fontSize: 13, color: accent + "99", fontStyle: "italic" }}>{cluster.host} is thinking…</div>}
            {styleQ && (
              <div style={{ alignSelf: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 9, margin: "4px 0 8px" }}>
                <div style={{ fontSize: 11, color: accent + "80", letterSpacing: 1.5, textTransform: "uppercase" }}>quick pick</div>
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
              <div onClick={retry} role="button" tabIndex={0} style={{ fontSize: 12, color: "#fb7185", background: "rgba(251,113,133,.12)", border: ".5px solid rgba(251,113,133,.35)", borderRadius: 12, padding: "9px 12px", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 9, textAlign: "center", cursor: "pointer" }}>couldn&apos;t reach the voice — tap to retry</div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send() }}
                placeholder={`type to ${cluster.host.toLowerCase()}…`}
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
            <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: accent }}>pro · set the vibe</div>
            <div style={{ fontSize: 14, color: "rgba(240,232,255,.7)", margin: "8px 0 14px", lineHeight: 1.5 }}>tell {cluster.host.toLowerCase()} the mood — they&apos;ll follow it.</div>
            <input
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setVibeEdit(false) }}
              autoFocus
              placeholder="e.g. flirty and slow · hype me up · brutally honest"
              style={{ width: "100%", fontSize: 16, color: "#f0e8ff", background: "rgba(255,255,255,.07)", border: `.5px solid ${accent}50`, borderRadius: 12, padding: "12px 14px", minHeight: 46, boxSizing: "border-box", outline: "none" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => { setVibe(""); setVibeEdit(false) }} style={{ flex: 1, minHeight: 44, fontSize: 13, color: "rgba(240,232,255,.5)", background: "transparent", border: ".5px solid rgba(255,255,255,.12)", borderRadius: 12, cursor: "pointer" }}>clear</button>
              <button onClick={() => setVibeEdit(false)} style={{ flex: 1, minHeight: 44, fontSize: 14, fontWeight: 700, color: "#0d0418", background: grad, border: "none", borderRadius: 12, cursor: "pointer" }}>set it</button>
            </div>
          </div>
        </div>
      )}

      {showPro && <ProSheet onClose={() => setShowPro(false)} />}
      {/* playsInline keeps iOS from hijacking playback into a fullscreen player,
          which would tear down the call UI mid-conversation. */}
      <audio ref={audioRef} playsInline style={{ display: "none" }} />
    </div>
  )
}
