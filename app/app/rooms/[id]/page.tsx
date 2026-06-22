"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { toast } from "sonner"
import Link from "next/link"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { getRoomById, roomInvite, ROOM_CATEGORY_LABELS, effectiveSeatModel, type RoomPersona, type SeatModel } from "@/lib/rooms"
import { getCustomRoom, importCustomRoom } from "@/lib/custom-rooms"
import { roomFromLocationHash, buildInviteUrl } from "@/lib/room-share"
import { fetchPublishedRoom, bumpRoomEntries } from "@/lib/rooms-db"
import { findTopic, topicScenePrompt } from "@/lib/topics"
import { CATEGORY_META, isAdultRoom } from "@/lib/category-meta"
import { adultEnabled, memoryEnabled } from "@/lib/variant"
import { AdultGate } from "@/components/widgets/AdultGate"
import { hapticsSupported, pulseForSpeech, testBuzz, stopHaptics } from "@/lib/haptics"
import { isSubscribed, hasUnrestricted } from "@/lib/account"
import { passCoversVoice } from "@/lib/voice-credits"
import { hasActivePass } from "@/lib/pricing"
import { track } from "@/lib/track"
import { detectLanguage } from "@/lib/languages"
import { hydrateEntitlement } from "@/lib/auth"
import { PERSONALITY_PRESETS } from "@/components/persona-editor"
import { imageFor } from "@/lib/persona-utils"
import { TOOL_INPUTS, buildToolArgs, formatToolOutput, isToolError } from "@/lib/room-tool-args"
import { useRealtimeVoice, type Persona } from "@/hooks/use-realtime-voice"
import { VIBE_TAGS, resolveRoomVoices } from "@/lib/voices"
import { MessageRenderer } from "@/components/widgets/MessageRenderer"
import { GroupVoice } from "@/components/widgets/GroupVoice"
import { TopUpSlider } from "@/components/widgets/TopUpSlider"
import { UnrestrictedUpsell } from "@/components/widgets/UnrestrictedUpsell"
import { SolanaWalletProvider } from "@/components/solana-wallet-provider"
import { EXPERTS } from "@/lib/experts"
import {
  makeSessionId, resolveHandle, joinSession, colorFor,
  type Participant, type WireMessage,
} from "@/lib/room-session"
import "@solana/wallet-adapter-react-ui/styles.css"
import {
  Mic, MicOff, PhoneOff, Phone, Send, MessageSquare,
  Zap, Settings2, ChevronLeft, Loader2, Copy, Check,
  Volume2, VolumeX, UserPlus, Link2, Bot, X as XIcon,
} from "lucide-react"

// Keyed on SeatModel so every backend has a badge — a missing key is now a
// compile error instead of a runtime `.cls` crash.
const BACKEND_BADGE: Record<SeatModel, { label: string; cls: string }> = {
  claude:  { label: "Claude",  cls: "bg-orange-500/15 text-orange-300 border-orange-500/25" },
  gemini:  { label: "Gemini",  cls: "bg-sky-500/15 text-sky-300 border-sky-500/25" },
  mistral: { label: "Mistral", cls: "bg-rose-500/15 text-rose-300 border-rose-500/25" },
  dolphin: { label: "Dolphin", cls: "bg-violet-500/15 text-violet-300 border-violet-500/25" },
  local:   { label: "Kloom",   cls: "bg-amber-500/15 text-amber-300 border-amber-500/25" },
}

/** Avatar for any room persona — the identity-card system, app-wide. */
function personaAvatar(rp: RoomPersona): string {
  return imageFor({ name: rp.avatarSeed ?? rp.name, photoUrl: rp.photoUrl })
}

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  speaker?: string
  content: string
  ts: number
}

interface OptionValues {
  [key: string]: string | number | boolean
}

// ── Hooks ──────────────────────────────────────────────────────────────────

const CHAT_STORAGE = "kloom_room_chats_v1"

function loadRoomChats(roomId: string): ChatMessage[] {
  // .fun is memoryless by design — nothing is ever persisted or restored.
  if (!memoryEnabled()) return []
  try {
    const all = JSON.parse(localStorage.getItem(CHAT_STORAGE) ?? "{}")
    return all[roomId] ?? []
  } catch { return [] }
}

function saveRoomChats(roomId: string, msgs: ChatMessage[]) {
  if (!memoryEnabled()) return
  try {
    const all = JSON.parse(localStorage.getItem(CHAT_STORAGE) ?? "{}")
    all[roomId] = msgs.slice(-100)
    localStorage.setItem(CHAT_STORAGE, JSON.stringify(all))
  } catch {}
}

// ── Room Experience ─────────────────────────────────────────────────────────

function RoomContent() {
  const params      = useParams()
  const search      = useSearchParams()
  const router      = useRouter()
  const roomId      = params.id as string
  // Built-in rooms resolve synchronously; user-built rooms load from local store.
  const staticRoom  = getRoomById(roomId)
  const [room, setRoom]       = useState(staticRoom)
  const [roomChecked, setRoomChecked] = useState(!!staticRoom)
  useEffect(() => {
    if (staticRoom) return
    let r = getCustomRoom(roomId)
    // Portable room: a custom room arrives INSIDE its invite link (#r= payload).
    // Decode it, keep a local copy, and the invitee owns the room from now on.
    if (!r && roomId.startsWith("u-")) {
      const shared = roomFromLocationHash()
      if (shared && shared.id === roomId) {
        importCustomRoom(shared)
        r = shared
      }
    }
    if (r) { setRoom(r); setRoomChecked(true); return }
    // Final fallback: the community directory (published rooms resolve from
    // anywhere — plain /app/rooms/<id> links work with no payload).
    if (roomId.startsWith("u-")) {
      let cancelled = false
      fetchPublishedRoom(roomId).then((pub) => {
        if (cancelled) return
        if (pub) importCustomRoom(pub)
        setRoom(pub ?? undefined)
        setRoomChecked(true)
      })
      return () => { cancelled = true }
    }
    setRoom(undefined)
    setRoomChecked(true)
  }, [roomId, staticRoom])

  // Adult-room gate (checked on mount to avoid an SSR/hydration flash).
  const [unrestrictedStatus, setUnrestrictedStatus] = useState(true)
  const [unrestrictedChecked, setUnrestrictedChecked]   = useState(false)
  useEffect(() => { setUnrestrictedStatus(hasUnrestricted()); setUnrestrictedChecked(true) }, [])

  // Topic — the scene this room was entered with (?t=<slug>). Seeds the cast's
  // context so the conversation opens inside that scene.
  const topicSlug = search.get("t")
  const topic = room && topicSlug ? findTopic(roomId, room.category, topicSlug) : undefined
  const sceneRelationship = topic
    ? [room?.relationship, topicScenePrompt(topic)].filter(Boolean).join(" ")
    : room?.relationship
  const [topicBannerHidden, setTopicBannerHidden] = useState(false)

  // DM — a private 1:1 with one room member (opens by clicking their avatar).
  const [dmWith, setDmWith]   = useState<string | null>(null)
  const [dmMsgs, setDmMsgs]   = useState<{ role: "user" | "assistant"; content: string }[]>([])
  const [dmInput, setDmInput] = useState("")
  const [dmLoading, setDmLoading] = useState(false)
  const [dmStream, setDmStream]   = useState("")
  const openDM = (name: string) => { setDmWith(name); setDmMsgs([]); setDmStream("") }

  const [activePanel, setActivePanel] = useState<"chat" | "voice" | "tools">(
    search.get("mode") === "voice" ? "voice" : "chat"
  )
  const [chatMsgs, setChatMsgs]   = useState<ChatMessage[]>([])
  const [input, setInput]         = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [streamText, setStreamText]   = useState("")
  const [optionValues, setOptionValues] = useState<OptionValues>({})
  const optionValuesRef = useRef<OptionValues>({})
  optionValuesRef.current = optionValues
  const [toolLoading, setToolLoading]   = useState<string | null>(null)
  const [toolOutput, setToolOutput]     = useState<Record<string, string>>({})
  const [toolArgs, setToolArgs]         = useState<Record<string, string>>({})
  const [copied, setCopied]             = useState<string | null>(null)
  const [decisionPrompt, setDecisionPrompt] = useState<string | null>(null)
  const [activeTool, setActiveTool]     = useState<string | null>(null)
  const [roomNotice, setRoomNotice]     = useState<string | null>(null)
  const noticeTimeoutRef = useRef<number | null>(null)
  
  // Premium Features
  const [disabledAI, setDisabledAI]     = useState<Set<string>>(new Set())
  const [vibeEdits, setVibeEdits]       = useState<Record<string, string[]>>({})
  const [resettingAI, setResettingAI]   = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef  = useRef<AbortController | null>(null)

  // ── Group session (multi-human) ──
  const [sessionId, setSessionId]     = useState<string | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [inviteOpen, setInviteOpen]   = useState(false)
  const [linkCopied, setLinkCopied]   = useState(false)
  const myHandleRef = useRef<string>("")
  const broadcastRef = useRef<((m: WireMessage) => void) | null>(null)
  const seenMsgIds   = useRef<Set<string>>(new Set())

  // ── Invited AI characters (added on top of room.personas) ──
  const [extraAI, setExtraAI]   = useState<RoomPersona[]>([])
  const [addAIOpen, setAddAIOpen] = useState(false)

  // ── Speak AI replies aloud during a group voice call ──
  const aiVoiceOnRef = useRef(false)
  const aiAudioRef   = useRef<HTMLAudioElement | null>(null)
  const speakAi = useCallback((text: string, voice: string, personaName?: string, voiceId?: string, gender?: string, language?: string) => {
    if (!aiVoiceOnRef.current) return
    // Strip widget markers + markdown so TTS reads only spoken words
    const clean = text
      .replace(/```[\s\S]*?```/g, " (shared a code block) ")
      .replace(/\[(CHART|CALC|WALLET|TOKEN_WIZARD|PLAYBOOK|CANVA)[^\]]*\]/g, "")
      .replace(/[*_`#>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 600)
    if (!clean) return

    // ── Haptics — pulse the device in sync with the spoken line ──
    const ov = optionValuesRef.current
    const hapticOn = ov.haptic_sync === true || Number(ov.vibration ?? 0) > 0
    if (hapticOn) {
      pulseForSpeech({
        intensity: Number(ov.vibration ?? 0) || 5,
        pattern: String(ov.vibration_pattern ?? "Follow scene"),
        durationMs: Math.min(8000, 600 + clean.length * 55), // ~speech length
      })
    }

    fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: clean, voice, personaName, voiceId, gender, language }) })
      .then((r) => r.ok ? r.blob() : null)
      .then((blob) => {
        if (!blob) return
        if (!aiAudioRef.current) { aiAudioRef.current = document.createElement("audio"); aiAudioRef.current.autoplay = true }
        aiAudioRef.current.src = URL.createObjectURL(blob)
        aiAudioRef.current.play().catch(() => {})
      }).catch(() => {})
  }, [])

  useEffect(() => {
    if (room) setChatMsgs(loadRoomChats(roomId))
  }, [roomId, room])

  // Count this open as an "entry" — the strongest live signal for trending.
  // Once per mount, community/custom rooms only.
  const enteredRef = useRef(false)
  useEffect(() => {
    if (room && roomId.startsWith("u-") && !enteredRef.current) {
      enteredRef.current = true
      bumpRoomEntries(roomId)
    }
  }, [room, roomId])

  // Establish a session id (from URL or fresh) so there's always a shareable link
  useEffect(() => {
    if (!room) return
    let sid = search.get("session")
    if (!sid) {
      sid = makeSessionId()
      const url = new URL(window.location.href)
      url.searchParams.set("session", sid)
      window.history.replaceState({}, "", url.toString())
    }
    setSessionId(sid)
  }, [room, search])

  // Join the realtime channel once we have a session id
  useEffect(() => {
    if (!room || !sessionId) return
    const handle = resolveHandle(null)
    myHandleRef.current = handle
    const { broadcast, leave } = joinSession(roomId, sessionId, handle, {
      onMessage: (m) => {
        if (seenMsgIds.current.has(m.id)) return
        seenMsgIds.current.add(m.id)
        setChatMsgs((prev) => {
          const msg: ChatMessage = {
            id: m.id, role: m.kind === "human" ? "user" : "assistant",
            speaker: m.handle, content: m.content, ts: m.ts,
          }
          const next = [...prev, msg]
          saveRoomChats(roomId, next)
          return next
        })
        // Speak AI replies that arrived from another participant's turn
        if (m.kind === "ai") {
          const seat = [...(room?.personas ?? []), ...extraAI].find((p) => p.name === m.handle)
          speakAi(m.content, (seat as any)?.voice ?? "sage", m.handle, (seat as any)?.voiceId, (seat as any)?.gender, (seat as any)?.language)
        }
      },
      onPresence: setParticipants,
    })
    broadcastRef.current = broadcast
    return () => { broadcastRef.current = null; leave() }
  }, [room, sessionId, roomId])

  useEffect(() => {
    if (room) {
      const defaults: OptionValues = {}
      room.capabilities.options.forEach((opt) => { defaults[opt.id] = opt.defaultValue })
      setOptionValues(defaults)
    }
  }, [room])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMsgs, streamText])

  // All AI seats = the room's fixed personas + any the user invited.
  const allRoomPersonas: RoomPersona[] = [...(room?.personas ?? []), ...extraAI]

  // Build voice/chat personas — from PERSONALITY_PRESETS, OR from inline definition
  // (workshop seats like Claude/Gemini and invited experts aren't in the preset list).
  const voicePersonas: Persona[] = (() => {
    const built = allRoomPersonas.map((rp) => {
      const preset = PERSONALITY_PRESETS.find((p) => p.name === rp.name)
      const vp: Persona = {
        name:          rp.name,
        personality:   rp.personality   ?? preset?.personality   ?? "",
        speakingStyle: rp.speakingStyle  ?? preset?.speakingStyle ?? "",
        backstory:     preset?.backstory ?? "",
        voice:         rp.voice          ?? preset?.voice         ?? "echo",
        // Honor a character's explicit language; otherwise open in the visitor's
        // own language (browser locale) instead of forcing English — the biggest
        // conversion lever for non-English traffic. Presets omit language.
        language:      (rp as any).language ?? detectLanguage(),
        warmth:        preset?.defaultWarmth   ?? 60,
        talkStyle:     preset?.defaultTalkStyle ?? 55,
        category:      (rp as any).category ?? room?.category ?? preset?.category,
        model:         rp.model          ?? "local",
        gender:        rp.gender         ?? preset?.gender        ?? "female",
        adult:         optionValues.restriction_mode === true ? "yes" : ((rp as any).adult ?? (preset as any)?.adult),
        vibe_tags:     vibeEdits[rp.name] ?? [],
        ...( (rp as any).domain ? {
          // expert-style invited seat: pass expert fields through for kloom_expert
          domain: (rp as any).domain, expertise: (rp as any).expertise,
          outputFormat: (rp as any).outputFormat, forbidden: (rp as any).forbidden,
          tools: (rp as any).tools,
        } : {}),
      } as Persona
      // Honor an explicitly-picked catalog voice or a YouTube-cloned voice.
      const explicit = (rp as any).voiceId ?? (preset as any)?.voiceId
      if (explicit) (vp as any).voiceId = explicit
      return vp
    })
    // Distinct voice per seat: pins explicit/cloned voices, then assigns the rest
    // with in-gender collision avoidance so no two characters in the room share a
    // voice — and stamps the result so /api/tts gets an explicit voiceId per seat.
    const ids = resolveRoomVoices(built.map((p) => ({ name: p.name, gender: (p as any).gender, voiceId: (p as any).voiceId })))
    built.forEach((p, i) => { if (ids[i]) (p as any).voiceId = ids[i] })
    return built
  })()

  const primaryPersona  = voicePersonas[0]
  const partnerPersonas = voicePersonas.slice(1)

  // Send a message in a private 1:1 DM with one member (no partners in scope).
  const sendDM = useCallback(async (text: string) => {
    const member = voicePersonas.find((p) => p.name === dmWith)
    if (!text.trim() || dmLoading || !member) return
    const next = [...dmMsgs, { role: "user" as const, content: text }]
    setDmMsgs(next); setDmInput(""); setDmLoading(true); setDmStream("")
    try {
      const res = await fetch("/api/mcp-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat", persona: member, premium: isSubscribed(), unrestricted: hasUnrestricted(), messages: next }),
      })
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let full = ""
      while (true) { const { done, value } = await reader.read(); if (done) break; full += dec.decode(value, { stream: true }); setDmStream(full) }
      setDmMsgs([...next, { role: "assistant", content: full.trim() }])
    } catch {
      setDmMsgs([...next, { role: "assistant", content: "⚠️ couldn't reach them." }])
    } finally { setDmLoading(false); setDmStream("") }
  }, [dmWith, dmMsgs, dmLoading, voicePersonas])

  const notifyRoomEvent = useCallback((text: string) => {
    setRoomNotice(text)
    toast(text)
    if (noticeTimeoutRef.current) window.clearTimeout(noticeTimeoutRef.current)
    noticeTimeoutRef.current = window.setTimeout(() => setRoomNotice(null), 4500)
  }, [])

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) window.clearTimeout(noticeTimeoutRef.current)
      stopHaptics()
    }
  }, [])

  // Sync the account's voice-minute balance so the meter/gate start accurate.
  useEffect(() => { hydrateEntitlement() }, [])

  const { isConnected, isConnecting, isSpeaking, activeSpeaker, error,
          connect, disconnect, stopAI, submitText,
          outOfMinutes, minutesLeft, dismissOutOfMinutes } = useRealtimeVoice(
    primaryPersona
      ? {
          persona:      primaryPersona,
          partners:     partnerPersonas.length > 0 ? partnerPersonas : undefined,
          relationship: sceneRelationship,
          roomName:     room?.name,
          onTranscript: (text, speaker, partnerName) => {
            const msg: ChatMessage = {
              id:      `${Date.now()}-${Math.random()}`,
              role:    speaker === "user" ? "user" : "assistant",
              speaker: speaker === "user" ? (room?.category === "zero-memory" ? "Unknown" : "You") : (partnerName ?? primaryPersona.name),
              content: text,
              ts:      Date.now(),
            }
            setChatMsgs((prev) => {
              const next = [...prev, msg]
              if (room?.category !== "zero-memory") saveRoomChats(roomId, next)
              return next
            })
          },
          listenOnly: search.get("listen") === "1",
          disabledPartners: disabledAI,
        }
      : { persona: { name: "", personality: "", speakingStyle: "", backstory: "", voice: "echo", language: detectLanguage(), warmth: 50, talkStyle: 50 } }
  )

  // Text chat — EVERY persona in the room responds in turn, each on its own
  // backend (Claude / Gemini / local). They see each other's replies and build
  // on them, like a real group working session.
  const [activeResponder, setActiveResponder] = useState<string | null>(null)

  // Paid-traffic funnel events (page-level only — never conversation content):
  // they started the free voice, and they hit the pay wall.
  useEffect(() => { if (isConnected) track("start_voice", { room: room?.name || roomId }) }, [isConnected]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (outOfMinutes) track("paywall_view", { room: room?.name || roomId }) }, [outOfMinutes]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendChat = useCallback(async () => {
    const text = input.trim()
    if (!text || chatLoading || !room) return

    const me = room.category === "zero-memory" ? "Unknown" : (myHandleRef.current || "You")
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", speaker: me, content: text, ts: Date.now() }
    seenMsgIds.current.add(userMsg.id)
    let running = [...chatMsgs, userMsg]
    setChatMsgs(running)
    if (room.category !== "zero-memory") saveRoomChats(roomId, running)
    setInput("")
    setChatLoading(true)
    abortRef.current = new AbortController()

    // Broadcast my message to anyone else in the session
    broadcastRef.current?.({ id: userMsg.id, kind: "human", handle: me, content: text, ts: userMsg.ts })

    try {
      // Each persona responds in sequence. Others' turns become context.
      for (let i = 0; i < voicePersonas.length; i++) {
        const speaker  = voicePersonas[i]
        if (disabledAI.has(speaker.name)) continue // Premium: Skip disabled AI

        const others   = voicePersonas.filter((_, j) => j !== i && !disabledAI.has(_.name))
        setActiveResponder(speaker.name)
        setStreamText("")

        const res = await fetch("/api/mcp-chat", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          signal:  abortRef.current.signal,
          body:    JSON.stringify({
            mode:    "chat",
            persona: { 
              ...speaker, 
              category: room.category,
              adult: optionValues.restriction_mode === true ? "yes" : (speaker as any).adult,
              vibe_tags: vibeEdits[speaker.name] || []
            },
            premium: isSubscribed(),
            unrestricted: hasUnrestricted(),
            roomName: room.name,
            relationship: sceneRelationship,
            partners: others,
            messages: running.map((m) => ({
              role:    m.role,
              content: m.role === "assistant" && m.speaker ? `[${m.speaker}]: ${m.content}` : m.content,
            })),
          }),
        })
        if (!res.body) continue
        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let full = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          full += decoder.decode(value, { stream: true })
          setStreamText(full)
        }

        const aiMsg: ChatMessage = {
          id:      `a-${Date.now()}-${i}`,
          role:    "assistant",
          speaker: speaker.name,
          content: full.trim(),
          ts:      Date.now(),
        }
        seenMsgIds.current.add(aiMsg.id)
        running = [...running, aiMsg]
        setChatMsgs(running)
        if (room.category !== "zero-memory") saveRoomChats(roomId, running)
        setStreamText("")

        // Share this AI reply with everyone else in the session
        broadcastRef.current?.({ id: aiMsg.id, kind: "ai", handle: speaker.name, content: aiMsg.content, ts: aiMsg.ts })
        // Speak it aloud locally if group voice is active
        speakAi(aiMsg.content, speaker.voice ?? "sage", speaker.name, (speaker as any).voiceId, (speaker as any).gender, (speaker as any).language)

        // Single-persona rooms: only one turn. Multi-AI rooms: all respond.
        if (voicePersonas.length === 1) break
      }
    } catch (e: unknown) {
      if ((e as Error)?.name !== "AbortError") {
        setChatMsgs((prev) => [...prev, { id: `err-${Date.now()}`, role: "assistant", content: "⚠️ Error — check MCP server and LLM.", ts: Date.now() }])
      }
    } finally {
      setChatLoading(false)
      setActiveResponder(null)
      setStreamText("")
    }
  }, [input, chatLoading, room, chatMsgs, roomId, voicePersonas])

  const generateDecisionPrompt = () => {
    if (!room) return
    const transcript = chatMsgs.map(m => `${m.speaker}: ${m.content}`).join("\n")
    const prompt = `DECISION EXPORT — ${room.name}\nCATEGORY: ${ROOM_CATEGORY_LABELS[room.category]}\nTOPIC: ${room.tagline}\nPERSONAS: ${roomPersonas.map((p) => p.name).join(", ")}\nSTAKE: ${optionValues.stake ?? "Not specified"}\nUNRESTRICTED: ${optionValues.restriction_mode ? "Yes" : "No"}\n\nTRANSCRIPT:\n${transcript}\n\nTASK:\n- Synthesize the session into the top 3 action items the user should take next.\n- Identify the biggest risks or unknowns that could derail the decision.\n- Provide a ready-to-use continuation prompt for Gemini, Claude, or NotebookLM to keep refining the recommendation.\n\nOUTPUT FORMAT:\nAction 1:\nAction 2:\nAction 3:\nRisks / open questions:\nContinuation prompt:`
    setDecisionPrompt(prompt)
    toast.success("Decision prompt generated")
  }

  // Run a room tool via MCP. Each tool's real arguments come from the tool-arg
  // registry (a crypto price needs a `symbol`, multi-price an array, …) merged
  // with the one value the user typed; tools not in the registry fall back to
  // the room's option sliders. Output is always sanitized — a raw MCP/validation
  // error never reaches the user.
  const runTool = useCallback(async (toolId: string) => {
    if (!room || toolLoading) return
    const toolDef = room.capabilities.tools.find((tool) => tool.id === toolId)
    const spec    = TOOL_INPUTS[toolId]

    let args: Record<string, unknown>
    if (spec) {
      const built = buildToolArgs(toolId, toolArgs[toolId] ?? "")
      if (built.needsInput) {
        toast.error(`Add a ${spec.arg.replace(/_/g, " ")} first`)
        return
      }
      args = built.args
    } else {
      args = { ...optionValues }   // legacy option-driven tools (decision engine, etc.)
    }

    setToolLoading(toolId)
    try {
      const res = await fetch("/api/mcp-chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          mode:    "chat",
          persona: {
            name: "Assistant",
            role: room.category === "co-intelligence" ? "Decision support operator" : "Tool operator",
            category: room.category,
            model: "local",
          },
          premium: isSubscribed(),
          unrestricted: hasUnrestricted(),
          partners: room.category === "co-intelligence" ? room.personas : undefined,
          roomName: room.name,
          relationship: room.relationship,
          messages: [{
            role:    "user",
            content: `Use the ${toolId} tool with these settings: ${JSON.stringify(args)}. Return only the tool output and a concise summary.`,
          }],
        }),
      })
      if (!res.body) throw new Error("no body")
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
      }
      const clean = formatToolOutput(full, toolDef?.label)
      setToolOutput((prev) => ({ ...prev, [toolId]: clean }))
      if (isToolError(full)) toast.error(`${toolDef?.label ?? "Tool"} couldn't run`)
      else                   toast.success(`${toolDef?.label ?? "Tool"} completed`)
    } catch {
      setToolOutput((prev) => ({ ...prev, [toolId]: "Couldn't reach the tool. Try again in a moment." }))
      toast.error(`${toolDef?.label ?? "Tool"} failed`)
    } finally {
      setToolLoading(null)
    }
  }, [room, toolLoading, optionValues, toolArgs])
  // Adult rooms don't exist on the .io variant — they live on .fun.
  if (room && !adultEnabled() && isAdultRoom(room)) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-muted-foreground">This room lives on Kloom.fun.</p>
          <a href="https://kloom.fun" className="inline-block text-amber-400 text-sm hover:text-amber-300">Open Kloom.fun →</a>
          <div><button onClick={() => router.push("/app/rooms")} className="text-muted-foreground text-sm hover:text-foreground">← Back to rooms</button></div>
        </div>
      </div>
    )
  }
  if (!room) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">{roomChecked ? "Room not found" : "Loading room…"}</p>
          {roomChecked && (
            <button onClick={() => router.push("/app/rooms")} className="text-amber-400 text-sm hover:text-amber-300">
              ← Back to rooms
            </button>
          )}
        </div>
      </div>
    )
  }

  // Adult rooms are visible to everyone but LOCKED on entry — you see the room,
  // the topic and who's in it, then hit the restriction with a clear $10 unlock.
  if (room.category === "dark" && unrestrictedChecked && !unrestrictedStatus) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-5">
        <div className="max-w-md w-full">
          <button onClick={() => router.push("/app/rooms")} className="text-muted-foreground hover:text-foreground text-sm mb-5">← Rooms</button>
          <div className={`rounded-3xl border border-border/50 bg-gradient-to-br ${room.gradient} p-6`}>
            <div className="flex -space-x-3 mb-4">
              {room.personas.map((p) => (
                <img key={p.name} src={imageFor({ name: p.avatarSeed ?? p.name })}
                  alt={p.name} className="w-14 h-14 rounded-2xl object-cover ring-2 ring-stone-950 bg-stone-800" />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black">{room.name}</h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-rose-500/40 text-rose-300 bg-rose-500/10">18+ LOCKED</span>
            </div>
            <p className="text-sm text-foreground/55 mt-1">{room.tagline}</p>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{room.description}</p>
            <div className="mt-4 rounded-xl bg-black/30 border border-border/50 px-3 py-2 text-xs text-muted-foreground">
              This is an adult room. Free accounts can see it, but going in needs <span className="text-rose-300 font-semibold">Unrestricted</span> —
              one pass unlocks every adult room <span className="text-foreground">and</span> removes restrictions across the whole platform.
            </div>
          </div>
          <div className="mt-4"><UnrestrictedUpsell context={room.name} /></div>
        </div>
      </div>
    )
  }

  const roomPersonas = allRoomPersonas
  const invite      = roomInvite(room)
  const canInvite   = invite.mode !== "none"
  const inviteLocked = !!invite.requiresSub && !isSubscribed()
  // Portable invite: custom rooms travel inside the link (#r=), topics ride along.
  const shareUrl = sessionId
    ? buildInviteUrl({ room, sessionId, topic: topic?.slug })
    : ""

  return (
    <div className={`h-[100dvh] flex flex-col bg-background bg-gradient-to-br ${CATEGORY_META[room.category]?.gradient ?? ""} text-foreground overflow-hidden`}>

      {/* ── 18+ assurance — adult worlds only, once per device ── */}
      {CATEGORY_META[room.category]?.adult && (
        <AdultGate worldLabel={CATEGORY_META[room.category].label} />
      )}

      {/* ── Header ── */}
      <div className="shrink-0 h-16 bg-background/80 backdrop-blur-md border-b border-border/20 px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-3 sticky top-0 z-10 shadow-sm mt-[env(safe-area-inset-top)]">
        <Link href="/app/rooms" className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-foreground/5 transition-colors">
          <ChevronLeft size={20} />
        </Link>

        {/* Persona avatars — click to DM that member 1:1 (desktop; phones get the name) */}
        <div className="hidden sm:flex items-center">
          {roomPersonas.map((rp, i) => (
            <button
              key={rp.name}
              onClick={() => openDM(rp.name)}
              title={`Message ${rp.name}`}
              className="relative hover:z-10 transition-transform hover:scale-110"
              style={{ marginLeft: i > 0 ? "-8px" : 0 }}
            >
              <img
                src={personaAvatar(rp)}
                alt={rp.name}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-stone-950 bg-stone-800 hover:ring-amber-500"
              />
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{room.name}</div>
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-border/60 text-muted-foreground">
              {ROOM_CATEGORY_LABELS[room.category]}
            </span>
            {/* Backend badges — desktop only; on phones they overflow the header */}
            {roomPersonas.map((rp) => {
              const b = BACKEND_BADGE[effectiveSeatModel(rp.model)]
              return (
                <span key={rp.name} className={`hidden md:inline-flex shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${b.cls}`}>
                  {rp.name.split(" ")[0]} · {b.label}
                </span>
              )
            })}
          </div>
        </div>

        {/* Presence — humans in the room */}
        {participants.length > 0 && (
          <div className="hidden sm:flex items-center -space-x-1.5 mr-1">
            {participants.slice(0, 4).map((p) => (
              <div key={p.handle}
                title={p.handle + (p.isYou ? " (you)" : "")}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-stone-950"
                style={{ backgroundColor: p.color + "33", color: p.color, borderColor: p.color }}>
                {p.handle.replace("Guest-", "").slice(0, 2).toUpperCase()}
              </div>
            ))}
            {participants.length > 4 && <span className="text-[10px] text-muted-foreground pl-2">+{participants.length - 4}</span>}
          </div>
        )}

        {/* Add AI */}
        <button onClick={() => setAddAIOpen(true)} title="Invite an AI character"
          className="flex items-center gap-1 text-xs font-semibold bg-foreground/5 border border-border/50 hover:bg-foreground/10 px-2.5 py-1.5 rounded-xl transition-colors text-foreground/70">
          <Bot size={13} /> <span className="hidden md:inline">Add AI</span>
        </button>

        {/* Invite — only when the room's policy allows it */}
        {canInvite && (
          <button onClick={() => setInviteOpen(true)} title={invite.label ?? "Invite"}
            className="flex items-center gap-1 text-xs font-bold bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 px-2.5 py-1.5 rounded-xl transition-colors text-amber-300">
            <UserPlus size={13} /> <span className="hidden md:inline">{invite.mode === "one" ? "Invite partner" : "Invite"}</span>
          </button>
        )}

        {/* Panel tabs — icon-only on phones, labeled on desktop */}
        <div className="flex gap-1 bg-foreground/5 rounded-xl p-1 shadow-inner shrink-0">
          {(["chat", "voice", "tools"] as const).map((tab) => {
            const Icon = tab === "chat" ? MessageSquare : tab === "voice" ? Phone : Zap
            return (
              <button
                key={tab}
                onClick={() => setActivePanel(tab)}
                title={tab}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                  activePanel === tab ? "bg-amber-500 text-stone-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{tab}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Topic banner — the scene this room opened with ── */}
      {topic && !topicBannerHidden && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-500/[0.08] border-b border-amber-500/15 text-amber-200/90">
          <Zap size={12} className="text-amber-400 shrink-0" />
          <span className="text-xs font-semibold truncate">
            Tonight: {topic.title}
          </span>
          <button onClick={() => setTopicBannerHidden(true)}
            className="ml-auto text-amber-200/50 hover:text-amber-200 transition-colors shrink-0">
            <XIcon size={13} />
          </button>
        </div>
      )}

      {/* ── Invite modal ── */}
      {inviteOpen && sessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setInviteOpen(false)}>
          <div className="bg-stone-900 border border-border/50 rounded-3xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <UserPlus size={18} className="text-amber-400" />
                {invite.mode === "one" ? "Invite your partner" : "Invite to the room"}
              </h3>
              <button onClick={() => setInviteOpen(false)} className="text-muted-foreground hover:text-foreground"><XIcon size={18} /></button>
            </div>

            {inviteLocked ? (
              // Subscriber-only invite (e.g. couple rooms)
              <>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  Inviting a partner into this room is a <span className="text-foreground font-semibold">subscriber</span> feature.
                  Upgrade to bring someone in with you.
                </p>
                <Link href="/app/settings?tab=billing"
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-foreground font-bold py-3 rounded-xl transition-all">
                  Subscribe to invite
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  {invite.note ?? (
                    <>Share this link. Anyone who opens it joins <span className="text-foreground font-semibold">{room.name}</span> live.</>
                  )}
                  {invite.mode === "one" && <span className="block mt-1 text-muted-foreground">This room is for two — one invite.</span>}
                </p>
                <div className="flex items-center gap-2 bg-foreground/5 border border-border/50 rounded-xl px-3 py-2.5 mb-3">
                  <Link2 size={14} className="text-muted-foreground/60 shrink-0" />
                  <code className="text-xs text-foreground/70 flex-1 truncate">{shareUrl}</code>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(shareUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) }}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-foreground font-bold py-3 rounded-xl transition-all">
                  {linkCopied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy invite link</>}
                </button>
                {participants.length > 0 && (
                  <p className="text-[11px] text-muted-foreground/70 text-center mt-3">{participants.length} {participants.length === 1 ? "person" : "people"} in the room now</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Add AI modal ── */}
      {addAIOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setAddAIOpen(false)}>
          <div className="bg-stone-900 border border-border/50 rounded-3xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-lg flex items-center gap-2"><Bot size={18} className="text-amber-400" /> Invite an AI character</h3>
              <button onClick={() => setAddAIOpen(false)} className="text-muted-foreground hover:text-foreground"><XIcon size={18} /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">They join the conversation and respond in turn with everyone else.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EXPERTS.filter((e) => !allRoomPersonas.some((p) => p.name === e.name)).map((e) => (
                <button key={e.id}
                  onClick={() => {
                    setExtraAI((prev) => [...prev, {
                      name: e.name, role: e.tagline, voice: e.voice, model: "local",
                      personality: e.expertise, speakingStyle: "In-character expert",
                      // expert fields for kloom_expert routing
                      ...( { category: "expert", domain: e.domain, expertise: e.expertise, outputFormat: e.outputFormat, forbidden: e.forbidden, tools: e.tools } as any ),
                    } as RoomPersona])
                    setAddAIOpen(false)
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/[0.03] border border-border/30 hover:bg-white/[0.08] hover:border-white/15 transition-all text-center">
                  <span className="text-2xl">{e.emoji}</span>
                  <span className="text-xs font-bold leading-tight">{e.name}</span>
                  <span className="text-[10px] text-muted-foreground line-clamp-1">{e.tagline}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* CHAT PANEL */}
        <div className={`flex flex-col flex-1 min-w-0 ${activePanel !== "chat" ? "hidden lg:flex" : "flex"}`}>
          {room.category === "dark" && (
            <div className="shrink-0 px-4 lg:px-5 pt-3">
              <UnrestrictedUpsell context={room.name} />
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-4 lg:px-5 py-4 space-y-3">
            {chatMsgs.length === 0 && !chatLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-10">
                <div className="flex -space-x-3">
                  {roomPersonas.map((rp) => (
                    <img key={rp.name} src={personaAvatar(rp)} alt={rp.name}
                      className="w-14 h-14 rounded-2xl object-cover ring-2 ring-stone-950 bg-stone-800" />
                  ))}
                </div>
                <div>
                  <p className="font-bold">{room.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">{room.tagline}</p>
                </div>
                {roomPersonas.some((rp) => effectiveSeatModel(rp.model) !== "local") && (
                  <p className="text-[11px] text-orange-300/70 max-w-xs">
                    Multi-AI room — each reply comes from a different model working together.
                  </p>
                )}
                <p className="text-[11px] text-foreground/20">Start the conversation or join the voice call</p>
              </div>
            )}

            {chatMsgs.map((msg) => {
              const isHuman   = msg.role === "user"
              const isMe      = isHuman && msg.speaker === (myHandleRef.current || "You")
              const isOther   = isHuman && !isMe                 // another human in the room
              const rp        = roomPersonas.find((p) => p.name === msg.speaker)
              const otherColor = isOther ? colorFor(msg.speaker ?? "") : undefined
              return (
                <div key={msg.id} className={`flex gap-2.5 ${isMe ? "justify-end" : "justify-start"}`}>
                  {!isMe && (
                    isOther ? (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 shadow-sm"
                        style={{ backgroundColor: otherColor + "33", color: otherColor, border: `1px solid ${otherColor}55` }}>
                        {(msg.speaker ?? "?").replace("Guest-", "").slice(0, 2).toUpperCase()}
                      </div>
                    ) : (
                      <div className="relative shrink-0 mt-0.5">
                        <img src={rp ? personaAvatar(rp) : imageFor({ name: msg.speaker ?? "?" })} alt={msg.speaker ?? ""}
                          className="w-8 h-8 rounded-xl object-cover bg-stone-800 border border-border/50 shadow-sm" />
                      </div>
                    )
                  )}
                  <div className="max-w-[80%]">
                    {!isMe && msg.speaker && (
                      <div className="flex items-center gap-2 mb-1 ml-1">
                        <span className="text-[11px] font-bold tracking-wide" style={{ color: isOther ? otherColor : "rgba(255,255,255,0.6)" }}>{msg.speaker}</span>
                        {effectiveSeatModel(rp?.model) !== "local" && (
                          <span className={`text-[9px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-full border ${BACKEND_BADGE[effectiveSeatModel(rp?.model)].cls} shadow-inner`}>
                            {BACKEND_BADGE[effectiveSeatModel(rp?.model)].label}
                          </span>
                        )}
                      </div>
                    )}
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed backdrop-blur-sm ${
                      isMe
                        ? "bg-gradient-to-br from-amber-500 to-orange-500 text-stone-950 rounded-br-sm shadow-[0_2px_15px_rgba(245,158,11,0.2)] font-medium"
                        : isOther
                        ? "bg-foreground/10 border border-white/15 text-foreground/90 rounded-bl-sm"
                        : "bg-foreground/5 border border-border/30 text-foreground/90 rounded-bl-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                    }`}>
                      {isHuman ? msg.content : <MessageRenderer content={msg.content} />}
                    </div>
                  </div>
                </div>
              )
            })}

            {chatLoading && (
              <div className="flex gap-2.5">
                {(() => {
                  const rp = roomPersonas.find((p) => p.name === activeResponder) ?? roomPersonas[0]
                  return (
                    <img src={personaAvatar(rp)} alt=""
                      className="w-8 h-8 rounded-xl object-cover shrink-0 mt-0.5 bg-stone-800 border border-border/50 shadow-sm" />
                  )
                })()}
                <div className="max-w-[80%]">
                  {activeResponder && (
                    <div className="text-[11px] text-foreground/60 font-bold tracking-wide mb-1 ml-1">{activeResponder}</div>
                  )}
                  <div className="bg-foreground/5 border border-border/30 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-foreground/90 leading-relaxed shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm">
                    {streamText
                      ? <MessageRenderer content={streamText} />
                      : <span className="flex gap-1.5 py-1">{[0,1,2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-amber-500/50 animate-bounce inline-block" style={{animationDelay:`${i*0.15}s`}}/>)}</span>}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Chat input */}
          <div className="shrink-0 px-3 sm:px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border/20 bg-background/50 backdrop-blur-sm">
            <div className="flex gap-2 items-end max-w-4xl mx-auto">
              <div className="flex-1 bg-foreground/5 border border-border/50 rounded-2xl px-4 py-2.5 focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/30 transition-all shadow-inner">
                <textarea
                  rows={1}
                  placeholder={`Message ${room.personas[0].name}…`}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    e.target.style.height = "auto"
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                  className="w-full bg-transparent text-sm text-foreground placeholder-muted-foreground resize-none focus:outline-none leading-relaxed"
                  style={{ maxHeight: 120 }}
                />
              </div>
              <button
                onClick={sendChat}
                disabled={!input.trim() || chatLoading}
                className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0 mb-0.5 shadow-[0_4px_15px_rgba(245,158,11,0.25)]"
              >
                <Send size={16} className="text-stone-950 ml-0.5" />
              </button>
            </div>
          </div>
        </div>

        {/* VOICE PANEL */}
        <div className={`flex flex-col bg-background ${
          activePanel === "voice" ? "flex-1" : "hidden lg:flex lg:w-72 border-l border-border/30"
        }`}>
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
            {/* Persona speaking indicators */}
            <div className="flex gap-4 justify-center flex-wrap">
              {roomPersonas.map((rp, i) => {
                const isActiveSpeaker = i === 0
                  ? activeSpeaker === "self"
                  : activeSpeaker === "partner"
                const b = BACKEND_BADGE[effectiveSeatModel(rp.model)]
                return (
                  <div key={rp.name} className="flex flex-col items-center gap-2">
                    <div className={`relative transition-all duration-300 ${isActiveSpeaker ? "scale-110" : "scale-100"}`}>
                      <div className={`absolute inset-0 rounded-2xl bg-amber-500/20 blur-xl transition-opacity duration-300 ${isActiveSpeaker ? "opacity-100" : "opacity-0"}`} />
                      <img
                        src={personaAvatar(rp)}
                        alt={rp.name}
                        className={`relative w-24 h-24 rounded-2xl object-cover transition-all bg-background ${
                          isActiveSpeaker
                            ? "ring-4 ring-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)]"
                            : "ring-2 ring-border/50 shadow-sm"
                        }`}
                      />
                      {isActiveSpeaker && (
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                          <Volume2 size={12} className="text-stone-950" />
                        </div>
                      )}
                    </div>
                    <div className="text-center mt-1">
                      <div className="text-sm font-black tracking-wide text-foreground">{rp.name.split(" ")[0]}</div>
                      <div className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mt-0.5">{rp.role}</div>
                      {effectiveSeatModel(rp.model) !== "local" && (
                        <span className={`text-[9px] font-bold px-1 py-px rounded border mt-0.5 inline-block ${b.cls}`}>{b.label}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Status */}
            <div className="text-center space-y-1">
              {isConnecting && <p className="text-sm text-muted-foreground animate-pulse">Connecting…</p>}
              {isConnected && !isSpeaking && <p className="text-sm text-emerald-400">Listening</p>}
              {isConnected && isSpeaking && <p className="text-sm text-amber-400 animate-pulse">Speaking…</p>}
              {!isConnected && !isConnecting && <p className="text-sm text-muted-foreground/60">Voice disconnected</p>}
              {error && <p className="text-xs text-red-400 max-w-[180px] text-center">{error}</p>}
            </div>

            {/* Call controls */}
            <div className="flex items-center gap-3">
              {isConnected && isSpeaking && (
                <button
                  onClick={stopAI}
                  className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 flex items-center justify-center transition-colors"
                  title="Interrupt AI"
                >
                  <VolumeX size={16} className="text-amber-400" />
                </button>
              )}
              {isConnected ? (
                <button
                  onClick={disconnect}
                  className="w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] bg-red-500 hover:bg-red-400 hover:scale-105"
                >
                  <PhoneOff size={22} className="text-white" />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => connect()}
                    disabled={isConnecting}
                    title="Join with Mic"
                    className="w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] bg-amber-500 hover:bg-amber-400 hover:scale-105 disabled:opacity-50"
                  >
                    {isConnecting ? <Loader2 size={22} className="text-stone-950 animate-spin" /> : <Phone size={22} className="text-stone-950" />}
                  </button>
                  <button
                    onClick={() => connect({ listenOnly: true })}
                    disabled={isConnecting}
                    title="Listen In Only"
                    className="w-10 h-10 rounded-full bg-foreground/10 border border-border/20 flex items-center justify-center text-muted-foreground hover:bg-foreground/20 hover:text-foreground transition-all"
                  >
                    <Volume2 size={16} />
                  </button>
                </>
              )}
              {isConnected && (
                <button
                  onClick={() => submitText("...")}
                  className="w-10 h-10 rounded-full bg-foreground/10 border border-border/20 flex items-center justify-center text-muted-foreground hover:bg-foreground/20 transition-all"
                  title="Type instead"
                >
                  <MessageSquare size={15} />
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/50 -mt-3">Solo voice — just you and the AIs</p>

            {/* ── Group voice (multi-human, WebRTC) ── */}
            {sessionId && (
              <div className="w-full max-w-sm">
                <GroupVoice
                  roomId={roomId}
                  sessionId={sessionId}
                  selfId={myHandleRef.current || "You"}
                  onWantAiVoice={(on) => { aiVoiceOnRef.current = on }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Out of voice minutes → top up. A pass holder who's hit the daily
            fair-use cap gets distinct copy (it resets at midnight); everyone
            else gets the standard top-up. The call was ended by the meter. */}
        {outOfMinutes && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5" onClick={dismissOutOfMinutes}>
            <div className="w-full max-w-md rounded-3xl border border-border/60 bg-background p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-black text-lg">{hasActivePass() && !passCoversVoice() ? "Daily voice limit reached" : "Out of voice minutes"}</h3>
                <button onClick={dismissOutOfMinutes} className="text-muted-foreground hover:text-foreground"><XIcon size={18} /></button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{hasActivePass() && !passCoversVoice()
                ? "You've used today's voice on your pass — it resets at midnight. Top up to keep going now."
                : "Top up to keep the call going — text chat stays free."}</p>
              <TopUpSlider onDone={dismissOutOfMinutes} />
            </div>
          </div>
        )}

        {/* TOOLS PANEL */}
        <div className={`flex flex-col bg-background/50 ${
          activePanel === "tools" ? "flex-1" : "hidden xl:flex xl:w-72 border-l border-border/30"
        }`}>
          <div className="px-4 py-4 border-b border-border/20">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              <span className="text-sm font-bold">Room capabilities</span>
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">Unlocked by who's in this room</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Options */}
            {room.capabilities.options.length > 0 && (
              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold">Room settings</div>
                {room.capabilities.options.map((opt) => (
                  <div key={opt.id}>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">{opt.label}</label>
                    {opt.type === "select" && (
                      <select
                        value={String(optionValues[opt.id] ?? opt.defaultValue)}
                        onChange={(e) => setOptionValues((prev) => ({ ...prev, [opt.id]: e.target.value }))}
                        className="w-full bg-foreground/5 border border-border/50 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-amber-500/40"
                      >
                        {opt.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                    {opt.type === "slider" && (
                      <>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={opt.min} max={opt.max}
                            value={Number(optionValues[opt.id] ?? opt.defaultValue)}
                            onChange={(e) => setOptionValues((prev) => ({ ...prev, [opt.id]: Number(e.target.value) }))}
                            className="flex-1 accent-amber-500"
                          />
                          <span className="text-xs text-foreground/60 w-6 text-right">{optionValues[opt.id] ?? opt.defaultValue}</span>
                        </div>
                        {opt.id === "vibration" && (
                          hapticsSupported() ? (
                            <button
                              onClick={() => testBuzz(Number(optionValues[opt.id] ?? opt.defaultValue) || 6)}
                              className="mt-1.5 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors">
                              Test vibration
                            </button>
                          ) : (
                            <p className="mt-1.5 text-[10px] text-muted-foreground/60">Vibration isn&apos;t supported on this browser (works on Android Chrome).</p>
                          )
                        )}
                      </>
                    )}
                    {opt.type === "text" && (
                      <input
                        type="text"
                        value={String(optionValues[opt.id] ?? opt.defaultValue)}
                        onChange={(e) => setOptionValues((prev) => ({ ...prev, [opt.id]: e.target.value }))}
                        className="w-full bg-foreground/5 border border-border/50 rounded-xl px-3 py-2 text-xs text-foreground placeholder-white/25 focus:outline-none focus:border-amber-500/40"
                      />
                    )}
                    {opt.type === "toggle" && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground/60">{(opt.id === 'restriction_mode' || opt.id === 'export_decision') && !unrestrictedStatus ? '(Paid feature)' : ''}</span>
                          <button
                            onClick={() => {
                              if ((opt.id === 'restriction_mode' || opt.id === 'export_decision') && !unrestrictedStatus) {
                                // Show upsell? For now just don't toggle
                                return
                              }
                              setOptionValues((prev) => ({ ...prev, [opt.id]: !(optionValues[opt.id] ?? opt.defaultValue) }))
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${
                              (optionValues[opt.id] ?? opt.defaultValue) ? "bg-amber-500" : "bg-foreground/10"
                            } ${(opt.id === 'restriction_mode' || opt.id === 'export_decision') && !unrestrictedStatus ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                          >
                            <span
                              className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                                (optionValues[opt.id] ?? opt.defaultValue) ? "translate-x-4" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                        {opt.id === 'export_decision' && (optionValues.export_decision || (optionValues[opt.id] ?? opt.defaultValue)) && (
                          <button 
                            onClick={generateDecisionPrompt}
                            className="w-full py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold rounded-lg hover:bg-emerald-500/30 transition-all"
                          >
                            Generate Decision Prompt
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {decisionPrompt && (
              <div className="space-y-2 pb-4 border-b border-border/20">
                <div className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold flex items-center gap-2">
                  <Check size={10} /> Session Synthesis
                </div>
                <div className="relative bg-background border border-emerald-500/30 rounded-xl p-3 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                  <pre className="text-[10px] text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto scrollbar-hide">
                    {decisionPrompt}
                  </pre>
                  <button onClick={() => { navigator.clipboard.writeText(decisionPrompt); setDecisionPrompt(null) }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-emerald-500 text-stone-950 hover:bg-emerald-400 transition-all shadow-lg">
                    <Copy size={12} />
                  </button>
                </div>
                <p className="text-[9px] text-muted-foreground italic">Take this to Gemini, Claude, or NotebookLM to continue.</p>
              </div>
            )}

            {/* Tools */}
            {room.capabilities.tools.length > 0 && (
              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold">Live tools</div>
                {room.capabilities.tools.map((tool) => {
                  const spec = TOOL_INPUTS[tool.id]
                  return (
                  <div key={tool.id} className="space-y-2">
                    {spec && (
                      <input
                        value={toolArgs[tool.id] ?? ""}
                        onChange={(e) => setToolArgs((p) => ({ ...p, [tool.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") runTool(tool.id) }}
                        placeholder={spec.placeholder}
                        className="w-full bg-background/40 border border-border/50 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-foreground/30 transition-colors"
                      />
                    )}
                    <button
                      onClick={() => runTool(tool.id)}
                      disabled={toolLoading === tool.id}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-foreground/5 border border-border/50 hover:bg-foreground/5 transition-colors text-left disabled:opacity-50"
                    >
                      <span className="text-xs font-semibold text-foreground/80 flex-1">{tool.label}</span>
                      {toolLoading === tool.id
                        ? <Loader2 size={13} className="animate-spin text-muted-foreground" />
                        : <Zap size={13} className="text-amber-400 opacity-0 group-hover:opacity-100" />
                      }
                    </button>

                    {toolOutput[tool.id] && (
                      <div className="relative bg-stone-900 border border-border/30 rounded-xl p-3">
                        <pre className="text-[11px] text-foreground/70 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">
                          {toolOutput[tool.id]}
                        </pre>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(toolOutput[tool.id])
                            setCopied(tool.id)
                            setTimeout(() => setCopied(null), 2000)
                          }}
                          className="absolute top-2 right-2 text-[10px] bg-foreground/5 hover:bg-white/15 border border-border/50 px-2 py-1 rounded-lg flex items-center gap-1 text-muted-foreground"
                        >
                          {copied === tool.id ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                          {copied === tool.id ? "Copied" : "Copy"}
                        </button>
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            )}

            {/* Skills */}
            {room.capabilities.skills.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold">Room skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {room.capabilities.skills.map((s) => (
                    <span key={s} className="text-[10px] font-medium bg-foreground/5 border border-border/50 px-2 py-1 rounded-full text-foreground/45">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Premium Character Controls */}
            <div className="space-y-4 pt-4 border-t border-border/20">
              <div className="text-[10px] uppercase tracking-widest text-amber-500 font-bold flex items-center gap-2">
                <Zap size={10} /> Character Tuning
              </div>
              
              {roomPersonas.map((rp) => (
                <div key={rp.name} className="space-y-3 bg-foreground/5 border border-border/30 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src={personaAvatar(rp)} alt="" className="w-6 h-6 rounded-full border border-border/50" />
                      <span className="text-xs font-bold truncate max-w-[100px]">{rp.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Selective Mic Removal */}
                      <button 
                        onClick={() => {
                          if (!unrestrictedStatus) return
                          setDisabledAI(prev => {
                            const next = new Set(prev)
                            if (next.has(rp.name)) next.delete(rp.name); else next.add(rp.name)
                            return next
                          })
                        }}
                        title={disabledAI.has(rp.name) ? "Enable in turns" : "Disable in turns"}
                        className={`p-1.5 rounded-lg border transition-all ${
                          !unrestrictedStatus ? "opacity-30 grayscale cursor-not-allowed" :
                          disabledAI.has(rp.name) ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-foreground/5 border-border/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {disabledAI.has(rp.name) ? <MicOff size={12} /> : <Mic size={12} />}
                      </button>

                      {/* Reset Character */}
                      <button 
                        onClick={() => {
                          setResettingAI(rp.name)
                          setChatMsgs(prev => prev.filter(m => m.speaker !== rp.name))
                          setTimeout(() => setResettingAI(null), 1000)
                        }}
                        title="Recognized any problem? Reset character"
                        className="p-1.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                      >
                        {resettingAI === rp.name ? <Loader2 size={12} className="animate-spin" /> : <XIcon size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* Vibe Tags (Premium) */}
                  <div className="space-y-2">
                    <div className="text-[9px] text-muted-foreground/70 uppercase font-semibold">Active Vibes</div>
                    <div className="flex flex-wrap gap-1">
                      {(vibeEdits[rp.name] || []).map(tag => (
                        <span key={tag} className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-md">
                          {tag}
                          <button onClick={() => setVibeEdits(prev => ({...prev, [rp.name]: prev[rp.name].filter(t => t !== tag)}))}>
                            <XIcon size={8} />
                          </button>
                        </span>
                      ))}
                      {!unrestrictedStatus ? (
                        <span className="text-[9px] text-muted-foreground/40">(Premium only)</span>
                      ) : (
                        <select 
                          onChange={(e) => {
                            const val = e.target.value; if (!val) return
                            setVibeEdits(prev => ({...prev, [rp.name]: Array.from(new Set([...(prev[rp.name] || []), val]))}))
                            e.target.value = ""
                          }}
                          className="bg-transparent border-none text-[10px] text-amber-500/60 focus:ring-0 cursor-pointer"
                        >
                          <option value="">+ Add Vibe</option>
                          {VIBE_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                <div className="text-[10px] text-amber-500/70 font-semibold mb-1 italic">Recognized any problem?</div>
                <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                  Reset characters to fix language, volume, or voice drift. Premium vibes override base behaviors.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── DM drawer — private 1:1 with a clicked member ── */}
      {dmWith && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDmWith(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full sm:w-[26rem] h-full bg-background border-l border-border/50 flex flex-col">
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border/50">
              {(() => { const rp = roomPersonas.find((p) => p.name === dmWith); return rp ? <img src={personaAvatar(rp)} alt={dmWith} className="w-9 h-9 rounded-full object-cover bg-stone-800" /> : null })()}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{dmWith}</div>
                <div className="text-[10px] text-muted-foreground">Private chat · just you two</div>
              </div>
              <button onClick={() => setDmWith(null)} className="text-muted-foreground hover:text-foreground"><XIcon size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {dmMsgs.length === 0 && !dmLoading && (
                <p className="text-center text-muted-foreground/60 text-sm mt-8">Say something to {dmWith} — just the two of you.</p>
              )}
              {dmMsgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "bg-amber-500 text-foreground rounded-br-sm" : "bg-foreground/5 border border-border/50 text-foreground/90 rounded-bl-sm"}`}>
                    {m.role === "user" ? m.content : <MessageRenderer content={m.content} />}
                  </div>
                </div>
              ))}
              {dmLoading && (
                <div className="flex justify-start"><div className="bg-foreground/5 border border-border/50 rounded-2xl rounded-bl-sm px-3.5 py-2 max-w-[80%] text-sm text-foreground/90">{dmStream ? <MessageRenderer content={dmStream} /> : "…"}</div></div>
              )}
            </div>
            <div className="shrink-0 p-3 border-t border-border/50 flex gap-2 items-end">
              <textarea rows={1} value={dmInput} placeholder={`Message ${dmWith}…`}
                onChange={(e) => setDmInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDM(dmInput) } }}
                className="flex-1 bg-foreground/5 border border-border/50 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-amber-500/40" />
              <button onClick={() => sendDM(dmInput)} disabled={!dmInput.trim() || dmLoading}
                className="w-9 h-9 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-30 flex items-center justify-center shrink-0"><Send size={15} className="text-foreground" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RoomPage() {
  return (
    <SolanaWalletProvider>
      <Suspense>
        <RoomContent />
      </Suspense>
    </SolanaWalletProvider>
  )
}
