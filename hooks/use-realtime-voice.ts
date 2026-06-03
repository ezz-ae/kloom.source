"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { isSubscribed } from "@/lib/account"

// Premium = full-unrestricted model tier. Guarded so it's safe if ever called SSR.
function getPremium(): boolean {
  try { return isSubscribed() } catch { return false }
}

export interface Persona {
  name: string
  personality: string
  speakingStyle: string
  backstory: string
  voice: "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage" | "shimmer" | "verse"
  /** Optional explicit Fish Audio reference_id. Overrides the env-based slot lookup. */
  voiceId?: string
  language: string
  /** 0 = cold/professional, 100 = warm/affectionate */
  warmth: number
  /** 0 = very formal, 100 = very casual */
  talkStyle: number
  /** 0 = clean (no swearing), 100 = dirty (vulgar / explicit). Default 30. */
  barTalk?: number
  /** Persona category — used by MCP server to select the right forcing prompt + tools */
  category?: string
  /** Which AI backend powers this persona's turn (local / claude / gemini) */
  model?: "local" | "claude" | "gemini" | "mistral" | "dolphin"
  gender?: "female" | "male" | "nonbinary"
}

interface UseRealtimeVoiceProps {
  /** Primary persona (Persona A). */
  persona: Persona
  /** Optional second persona — back-compat shortcut for `partners: [partner]`. */
  partner?: Persona
  /**
   * Optional list of OTHER AIs in the room (excluding `persona`). When provided,
   * the hook will round-robin replies through all of them: each user utterance
   * triggers replies from the next 2 in line, advancing across turns so every
   * AI in the room gets airtime.
   */
  partners?: Persona[]
  /** Free-text describing the room / how they all relate. */
  relationship?: string
  /**
   * Called for each finalized transcript line.
   * `speaker` is "user", "self" (the primary persona), or "partner" — for any
   * non-primary AI. `partnerName` identifies which one when speaker="partner".
   */
  onTranscript?: (text: string, speaker: "user" | "self" | "partner", partnerName?: string) => void
  /** Audio level. */
  onAudioLevel?: (level: number, speaker?: "self" | "partner") => void
  /** If true, the hook does not request the user's mic at all, acting as a listen-only client. */
  listenOnly?: boolean
  /** List of partner names to skip in the rotation pool. */
  disabledPartners?: Set<string>
}

// Internal canonical transcript entry.
interface TranscriptEntry {
  speaker: "user" | "self" | "partner"
  /** When speaker === "partner", the actual partner's name (for multi-AI rooms). */
  partnerName?: string
  content: string
}

// Map persona.language to a BCP-47 tag for the browser SpeechRecognition API.
const LANGUAGE_TO_BCP47: Record<string, string> = {
  English: "en-US",
  Spanish: "es-ES",
  French: "fr-FR",
  German: "de-DE",
  Italian: "it-IT",
  Portuguese: "pt-PT",
  Japanese: "ja-JP",
  Korean: "ko-KR",
  Chinese: "zh-CN",
  Arabic: "ar-SA",
  Hindi: "hi-IN",
  Russian: "ru-RU",
  Dutch: "nl-NL",
  Turkish: "tr-TR",
  Polish: "pl-PL",
}

export function useRealtimeVoice({
  persona,
  partner,
  partners,
  relationship,
  onTranscript,
  onAudioLevel,
  listenOnly,
  disabledPartners,
}: UseRealtimeVoiceProps) {
  // Normalize: callers either pass `partner` (legacy, single) or `partners`
  // (array). Combine into one canonical list throughout the hook.
  const partnersList: Persona[] = useMemo(
    () => (partners?.length ? partners : partner ? [partner] : []),
    [partners, partner]
  )
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [activeSpeaker, setActiveSpeaker] = useState<"self" | "partner" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const transcriptRef = useRef<TranscriptEntry[]>([])
  const personaRef = useRef(persona)
  // AbortController for the current AI turn — lets us cancel mid-generation on barge-in
  const turnAbortRef = useRef<AbortController | null>(null)
  const partnersRef = useRef<Persona[]>(partnersList)
  const disabledRef = useRef(disabledPartners)
  const relationshipRef = useRef(relationship)
  const isSpeakingRef = useRef(false)
  const shouldListenRef = useRef(false)
  // Round-robin pointer over partnersRef — every user utterance bumps it by 2
  // so each speaker eventually gets airtime.
  const nextPartnerIdxRef = useRef(0)

  useEffect(() => { partnersRef.current = partnersList }, [partnersList])
  useEffect(() => { relationshipRef.current = relationship }, [relationship])
  useEffect(() => { disabledRef.current = disabledPartners }, [disabledPartners])

  useEffect(() => {
    personaRef.current = persona
  }, [persona])

  const startAudioAnalysis = useCallback(
    (mediaElement: HTMLAudioElement) => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext()
        }
        const ctx = audioContextRef.current
        analyserRef.current = ctx.createAnalyser()
        analyserRef.current.fftSize = 256

        const source = ctx.createMediaElementSource(mediaElement)
        source.connect(analyserRef.current)
        analyserRef.current.connect(ctx.destination)

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)

        const updateLevel = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray)
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
            const normalized = Math.min(average / 128, 1)
            onAudioLevel?.(normalized)
          }
          animationFrameRef.current = requestAnimationFrame(updateLevel)
        }
        updateLevel()
      } catch (err) {
        console.warn("Audio analysis setup failed:", err)
      }
    },
    [onAudioLevel]
  )

  /** Immediately silence the AI: pause audio, abort turn, reset speaking state. */
  const stopAI = useCallback(() => {
    try { turnAbortRef.current?.abort(new DOMException("stopped", "AbortError")) } catch {}
    turnAbortRef.current = null
    try {
      if (audioElRef.current) {
        audioElRef.current.pause()
        audioElRef.current.currentTime = 0
        audioElRef.current.removeAttribute("src")
        audioElRef.current.load()
      }
    } catch {}
    isSpeakingRef.current = false
    setIsSpeaking(false)
    setActiveSpeaker(null)
  }, [])

  const fetchTTS = useCallback(async (text: string, speakerPersona: Persona, signal?: AbortSignal): Promise<Blob | null> => {
    // Stheno-class roleplay models tend to wrap dialogue in quotes or include
    // stage directions in *asterisks*, |pipes|, or [brackets]. Strip all of
    // them before TTS so the speech engine doesn't read "*she smiles*" or
    // "|grin|" out loud. Also strip self-name prefixes the model sometimes
    // leaks ("Aria: hey") and other-speaker prefixes if the model wrote a
    // multi-character reply.
    const cleaned = text
      // Drop other-speaker lines the model may have leaked
      .split(/\n\s*[A-Z][A-Za-z'\s]{0,30}:\s/)[0]
      .replace(/^[A-Z][A-Za-z'\s]{0,30}:\s+/, "")
      // Stage directions / emotional descriptions — strip every wrapper form,
      // including UNCLOSED ones (model often writes "*she smiles softly" with no
      // closing asterisk). These narrate feelings and must never be spoken.
      .replace(/\*[^*]*\*/g, "")        // *closed actions*
      .replace(/\*[^*\n]*$/g, "")       // *unclosed action to end of line
      .replace(/^\s*\*[^*\n]*/g, "")    // unclosed action at start
      .replace(/\|[^|]*\|/g, "")        // |actions|
      .replace(/\[[^\]]*\]/g, "")       // [actions]
      .replace(/\([^)]*\)/g, "")        // (parentheticals — ANY length now)
      .replace(/_[^_]+_/g, "")          // _emphasised actions_
      .replace(/^["'`""''「『]+|["'`""''」』]+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
    if (!cleaned) return null
    // No truncation — speak the FULL sentence. The turn-level sentence cap in
    // runAITurn controls overall length; truncating here cut words mid-thought.
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          text: cleaned,
          voice: speakerPersona.voice,
          voiceId: speakerPersona.voiceId,
          personaName: speakerPersona.name,
          gender: (speakerPersona as any).gender,
        }),
      })
      if (!response.ok) {
        console.warn("TTS failed:", await response.text())
        return null
      }
      return await response.blob()
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") console.warn("TTS fetch error:", err)
      return null
    }
  }, [])

  const playAudioBlob = useCallback(async (blob: Blob): Promise<void> => {
    const audioEl = audioElRef.current
    if (!audioEl) return
    // AudioContexts can drift to "suspended" between turns on Chrome.
    const ctx = audioContextRef.current
    if (ctx && ctx.state === "suspended") {
      try { await ctx.resume() } catch {}
    }
    // Ensure nothing else is playing on this element before we swap source.
    // Critical: without this, a stale 'ended' event from the previous src can
    // fire AFTER we set the new src, resolving the new playback prematurely.
    try { audioEl.pause() } catch {}
    audioEl.currentTime = 0
    await new Promise<void>((resolve) => {
      const url = URL.createObjectURL(blob)
      let done = false
      const cleanup = () => {
        if (done) return
        done = true
        audioEl.removeEventListener("ended", cleanup)
        audioEl.removeEventListener("error", cleanup)
        URL.revokeObjectURL(url)
        resolve()
      }
      audioEl.addEventListener("ended", cleanup)
      audioEl.addEventListener("error", cleanup)
      audioEl.src = url
      audioEl.load()
      audioEl.play().catch(() => cleanup())
    })
  }, [])

  /**
   * Runs one AI turn: calls /api/chat as the given speaker, streams the
   * reply, sentence-chunks it, fires TTS per sentence with that speaker's
   * voice, plays the audio in order, and appends the reply to the transcript.
   */
  /**
   * Runs one AI turn for the given speaker. Translates the canonical transcript
   * into the speaker's POV, calls the chat route with the other AIs as
   * `partners`, streams the reply, chunks it for TTS, plays it, and appends to
   * the transcript.
   */
  const runAITurn = useCallback(
    async (speakerPersona: Persona) => {
      const self       = speakerPersona
      const isSelf     = self.name === personaRef.current.name
      const speakerTag: "self" | "partner" = isSelf ? "self" : "partner"
      const others     = [personaRef.current, ...partnersRef.current].filter(
        (p) => p.name !== self.name
      )

      // Create a fresh AbortController for this entire turn
      const abort = new AbortController()
      turnAbortRef.current = abort

      setActiveSpeaker(speakerTag)

      const messages = transcriptRef.current.map((entry) => {
        if (entry.speaker === "user") return { role: "user", content: `[USER]: ${entry.content}` }
        const entryName =
          entry.speaker === "self"
            ? personaRef.current.name
            : entry.partnerName || others[0]?.name || "Someone"
        if (entryName === self.name) return { role: "assistant", content: entry.content }
        return { role: "user", content: `[${entryName}]: ${entry.content}` }
      })

      // Use MCP-powered chat — loads forcing prompt + live tools based on persona category.
      // Falls back gracefully if MCP server is down (mcp-chat route handles it internally).
      let response: Response
      try {
        response = await fetch("/api/mcp-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abort.signal,
          body: JSON.stringify({
            mode:    "voice",            // strict word cap, companion prompt in voice mode
            persona: self,               // includes category for MCP routing
            premium: getPremium(),       // unlocks the full-unrestricted model tier
            partners: others.length > 0 ? others : undefined,
            relationship: others.length > 0 ? relationshipRef.current : undefined,
            messages,
          }),
        })
      } catch (err: unknown) {
        // Aborted by barge-in / disconnect — clean stop, not an error.
        if ((err as Error)?.name === "AbortError" || abort.signal.aborted) return
        throw err
      }

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Chat request failed")
      }

      const audioQueue: Promise<Blob | null>[] = []
      let streamDone  = false
      let aborted     = false

      const playbackWorker = (async () => {
        let idx = 0
        while (true) {
          if (aborted) break
          if (idx >= audioQueue.length) {
            if (streamDone) break
            await new Promise((r) => setTimeout(r, 20))
            continue
          }
          const blob = await audioQueue[idx++]
          if (abort.signal.aborted) break
          if (blob) await playAudioBlob(blob)
        }
      })()

      const reader     = response.body.getReader()
      const decoder    = new TextDecoder()
      let buffer       = ""
      let fullReply    = ""
      let sentenceCount = 0
      // Cap by COMPLETE sentences, never mid-sentence. The AI always finishes
      // the thought it started; we just stop after enough of them.
      const SENTENCE_CAP = 4
      let capReached     = false
      const sentenceRe   = /[^.!?。！？؟۔\n]{8,}?[.!?。！？؟۔\n]+["')\]]*\s*/g

      try {
        while (true) {
          if (abort.signal.aborted) { aborted = true; break }
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          buffer    += chunk
          fullReply += chunk

          sentenceRe.lastIndex = 0
          let lastEnd = 0
          let m: RegExpExecArray | null
          while ((m = sentenceRe.exec(buffer))) {
            const sentence = m[0].trim()
            if (sentence) {
              audioQueue.push(fetchTTS(sentence, self, abort.signal))
              sentenceCount++
            }
            lastEnd = sentenceRe.lastIndex
          }
          if (lastEnd > 0) buffer = buffer.slice(lastEnd)

          // Only stop once we've completed enough WHOLE sentences. We cancel the
          // upstream LLM to save tokens, but everything already queued still plays
          // in full — nothing is cut mid-sentence.
          if (sentenceCount >= SENTENCE_CAP) {
            capReached = true
            reader.cancel()
            break
          }
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") throw err
        aborted = true
      }

      // Speak any trailing partial sentence ONLY if we didn't hit the sentence
      // cap (if we did, the buffer is a fragment we intentionally drop).
      const tail = buffer.trim()
      if (tail && !aborted && !capReached) audioQueue.push(fetchTTS(tail, self, abort.signal))

      streamDone = true
      await playbackWorker

      const finalText = fullReply.trim()
      if (finalText && !aborted) {
        onTranscript?.(finalText, speakerTag, isSelf ? undefined : self.name)
        transcriptRef.current = [
          ...transcriptRef.current,
          {
            speaker:     speakerTag,
            partnerName: isSelf ? undefined : self.name,
            content:     finalText,
          },
        ].slice(-30)
      }
    },
    [fetchTTS, playAudioBlob, onTranscript]
  )

  const handleUserUtterance = useCallback(
    async (userText: string) => {
      if (!userText.trim()) return

      // BARGE-IN: if the AI is currently speaking, stop it immediately and
      // process the user's interruption. This makes voice feel truly natural.
      if (isSpeakingRef.current) {
        console.log("Barge-in detected — stopping AI, processing:", userText)
        stopAI()
        // Brief pause so audio element fully stops before we start a new turn
        await new Promise((r) => setTimeout(r, 80))
      }

      onTranscript?.(userText, "user" as const)
      transcriptRef.current = [
        ...transcriptRef.current,
        { speaker: "user" as const, content: userText },
      ].slice(-30)

      // Pause mic immediately so the AI's response doesn't echo back through it.
      isSpeakingRef.current = true
      setIsSpeaking(true)
      try {
        recognitionRef.current?.abort()
      } catch {}

      try {
        // Build the rotation pool: [primary, ...partners]. Round-robin so each
        // AI eventually gets a turn. Skip any AIs disabled by the user.
        const pool = [personaRef.current, ...partnersRef.current].filter(p => !disabledRef.current?.has(p.name))
        if (pool.length === 0) {
           // No AIs enabled to respond
        } else if (pool.length === 1) {
          await runAITurn(pool[0])
        } else if (pool.length === 2) {
          // Classic Third Mode: both AIs reply every user turn.
          for (const r of pool) await runAITurn(r)
        } else {
          // 3+ rooms: one responder per user turn, rotating. Keeps each line
          // clean and bounds total latency.
          const r = pool[nextPartnerIdxRef.current % pool.length]
          nextPartnerIdxRef.current = (nextPartnerIdxRef.current + 1) % pool.length
          await runAITurn(r)
        }
      } catch (err) {
        // Barge-in / disconnect aborts are intentional — never surface them.
        if ((err as Error)?.name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Conversation failed")
          console.error("Conversation error:", err)
        }
      } finally {
        // Grace period so any speaker echo decays before mic reopens.
        await new Promise((r) => setTimeout(r, 350))

        isSpeakingRef.current = false
        setIsSpeaking(false)
        setActiveSpeaker(null)
        onAudioLevel?.(0)

        if (shouldListenRef.current) {
          try {
            recognitionRef.current?.start()
          } catch {}
        }
      }
    },
    [onTranscript, runAITurn, onAudioLevel, stopAI]
  )

  const connect = useCallback(async (options?: { listenOnly?: boolean }) => {
    setIsConnecting(true)
    setError(null)

    try {
      // Create reusable <audio> element for TTS playback + analysis. Attaching
      // it to the DOM avoids a Chromium bug where a detached element's second
      // `.play()` after a `src` swap silently no-ops.
      if (!audioElRef.current) {
        const audioEl = document.createElement("audio")
        audioEl.autoplay = false
        audioEl.preload = "auto"
        audioEl.style.display = "none"
        document.body.appendChild(audioEl)
        audioElRef.current = audioEl
        startAudioAnalysis(audioEl)
      }

      const isListenOnly = options?.listenOnly || false

      if (!isListenOnly) {
        const SpeechRecognition =
          (typeof window !== "undefined" &&
            ((window as any).SpeechRecognition ||
              (window as any).webkitSpeechRecognition)) ||
          null

        if (!SpeechRecognition) {
          throw new Error(
            "Speech recognition isn't supported in this browser. Try Chrome or Edge."
          )
        }

        // Ask for mic permission up-front
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        stream.getTracks().forEach((t) => t.stop())

        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = false
        recognition.lang =
          LANGUAGE_TO_BCP47[personaRef.current.language] || "en-US"

        recognition.onresult = (event: any) => {
          if (isSpeakingRef.current) return
          let finalText = ""
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i]
            if (result.isFinal) {
              finalText += result[0].transcript
            }
          }
          if (finalText.trim()) {
            handleUserUtterance(finalText.trim())
          }
        }

        recognition.onerror = (event: any) => {
          if (event.error === "no-speech" || event.error === "aborted") return
          console.warn("SpeechRecognition error:", event.error)
          if (event.error === "not-allowed") {
            setError("Microphone access denied")
          }
        }

        recognition.onend = () => {
          // Auto-restart if we're still meant to be listening and not speaking.
          if (shouldListenRef.current && !isSpeakingRef.current) {
            try {
              recognition.start()
            } catch {}
          }
        }

        recognitionRef.current = recognition
        shouldListenRef.current = true
        recognition.start()
      } else {
        shouldListenRef.current = false // No mic listening
      }

      transcriptRef.current = []
      setIsConnected(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed")
      console.error("Voice connection error:", err)
    } finally {
      setIsConnecting(false)
    }
  }, [handleUserUtterance, startAudioAnalysis])

  const disconnect = useCallback(() => {
    shouldListenRef.current = false

    // Abort any in-flight AI turn cleanly (no unhandled AbortError on unmount).
    try { turnAbortRef.current?.abort(new DOMException("disconnected", "AbortError")) } catch {}
    turnAbortRef.current = null

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }

    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current.src = ""
      audioElRef.current.remove()
      audioElRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    analyserRef.current = null

    transcriptRef.current = []
    isSpeakingRef.current = false

    setIsConnected(false)
    setIsSpeaking(false)
    setActiveSpeaker(null)
    onAudioLevel?.(0)
  }, [onAudioLevel])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    isConnected,
    isConnecting,
    isSpeaking,
    activeSpeaker,
    error,
    connect,
    disconnect,
    /** Stop the AI mid-sentence (barge-in from UI button). */
    stopAI,
    /** Inject text as a user message (same path as a spoken transcript). */
    submitText: handleUserUtterance,
  }
}
