"use client"

/**
 * AIRROOM — the arena · chess.
 *
 * A real, playable board (chess.js for the rules) against an AI character. You're
 * white; the house plays black with a small negamax + alpha-beta search (material +
 * centre control) — a casual-but-real opponent. The character is alive: it greets,
 * reacts to captures/checks/mate and talks trash through the live LLM (/api/chat),
 * and can speak it aloud (/api/tts). Stockfish would make it a "1%" opponent — the
 * search is swappable for it later.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Chess, type Square } from "chess.js"

const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
const VAL: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 }

// ── the opponent: negamax + alpha-beta, material + centre control ──
function evalWhite(g: Chess): number {
  if (g.isCheckmate()) return g.turn() === "w" ? -1e6 : 1e6
  if (g.isDraw() || g.isStalemate()) return 0
  let s = 0
  const b = g.board()
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const sq = b[r][f]; if (!sq) continue
    const centre = (3.5 - Math.abs(f - 3.5)) + (3.5 - Math.abs((7 - r) - 3.5))
    const cb = (sq.type === "n" || sq.type === "b" || sq.type === "p") ? centre * 3 : centre
    s += sq.color === "w" ? VAL[sq.type] + cb : -(VAL[sq.type] + cb)
  }
  return s
}
function negamax(g: Chess, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || g.isGameOver()) return (g.turn() === "w" ? 1 : -1) * evalWhite(g)
  let best = -Infinity
  const moves = g.moves({ verbose: true }).sort((a, b) => (b.captured ? VAL[b.captured] : 0) - (a.captured ? VAL[a.captured] : 0))
  for (const m of moves) {
    g.move(m)
    const sc = -negamax(g, depth - 1, -beta, -alpha)
    g.undo()
    if (sc > best) best = sc
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}
function bestMove(g: Chess, depth = 3) {
  let best = null, bs = -Infinity
  const moves = g.moves({ verbose: true }).sort((a, b) => (b.captured ? VAL[b.captured] : 0) - (a.captured ? VAL[a.captured] : 0))
  for (const m of moves) {
    g.move(m)
    const sc = -negamax(g, depth - 1, -Infinity, Infinity)
    g.undo()
    if (sc > bs) { bs = sc; best = m }
  }
  return best
}

export function ChessRoom({ name = "Kai", onClose }: { name?: string; onClose?: () => void }) {
  const gameRef = useRef(new Chess())
  const [fen, setFen] = useState(gameRef.current.fen())
  const [sel, setSel] = useState<Square | null>(null)
  const [targets, setTargets] = useState<Square[]>([])
  const [status, setStatus] = useState("your move — you're white")
  const [thinking, setThinking] = useState(false)
  const [banter, setBanter] = useState<string>(`${name.toLowerCase()} racks the pieces… "sit. let's see what you've got."`)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const banterTok = useRef(0)

  const speak = useCallback(async (text: string) => {
    const tok = ++banterTok.current
    try {
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, personaName: name, gender: "male", language: "English" }) })
      if (!res.ok || banterTok.current !== tok) return
      const url = URL.createObjectURL(await res.blob()); const a = audioRef.current
      if (a) { a.src = url; a.onended = () => URL.revokeObjectURL(url); await a.play().catch(() => {}) }
    } catch { /* */ }
  }, [name])

  const quip = useCallback(async (event: string) => {
    try {
      const persona = {
        name, personality: `You are ${name}, a sharp, cocky, playful chess hustler in a late-night arena. You're mid-game against the person across the board. React to what just happened in ONE short spoken line — trash talk, a dare, a smirk. Never explain chess, never list moves.`,
        speakingStyle: "spoken, cocky, casual, a little dangerous", backstory: "", language: "English",
      }
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona, messages: [{ role: "user", content: event }] }) })
      if (!res.ok || !res.body) return
      const rd = res.body.getReader(); const dec = new TextDecoder(); let full = ""
      for (;;) { const { done, value } = await rd.read(); if (done) break; full += dec.decode(value) }
      full = full.trim()
      if (full) { setBanter(full); speak(full) }
    } catch { /* */ }
  }, [name, speak])

  useEffect(() => { quip("You just sat down across from me to play. Greet me — set the tone."); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  const sync = () => setFen(gameRef.current.fen())
  const afterMove = useCallback((captured?: string, check?: boolean) => {
    const g = gameRef.current
    if (g.isCheckmate()) { setStatus(g.turn() === "w" ? "checkmate — the house wins" : "checkmate — you win"); quip(g.turn() === "w" ? "You just checkmated them. Gloat." : "You just got checkmated by them. React — stunned, then respect."); return true }
    if (g.isDraw() || g.isStalemate()) { setStatus("a draw — even tonight"); quip("The game just drew. Shrug it off with a line."); return true }
    if (check) { setStatus(g.turn() === "w" ? "you're in check" : "check — careful"); quip("You just put them in check. One playful, threatening line."); return false }
    if (captured) { quip(`You just took a ${({ p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" } as Record<string, string>)[captured] || "piece"}. One short line of trash talk.`) }
    return false
  }, [quip])

  const aiMove = useCallback(() => {
    const g = gameRef.current
    if (g.isGameOver()) return
    setThinking(true)
    setTimeout(() => {
      const m = bestMove(g, 3)
      if (m) { const res = g.move(m); sync(); setThinking(false); if (!afterMove(res.captured, g.isCheck())) setStatus("your move") }
      else setThinking(false)
    }, 220)
  }, [afterMove])

  const onSquare = (sq: Square) => {
    const g = gameRef.current
    if (g.turn() !== "w" || thinking || g.isGameOver()) return
    if (sel) {
      if (targets.includes(sq)) {
        const res = g.move({ from: sel, to: sq, promotion: "q" })
        setSel(null); setTargets([]); sync()
        if (res && !afterMove(res.captured, g.isCheck())) { setStatus(`${name.toLowerCase()} is thinking…`); aiMove() }
        return
      }
      setSel(null); setTargets([])
    }
    const piece = g.get(sq)
    if (piece && piece.color === "w") {
      setSel(sq)
      setTargets(g.moves({ square: sq, verbose: true }).map((m) => m.to as Square))
    }
  }

  const reset = () => { gameRef.current = new Chess(); setSel(null); setTargets([]); setThinking(false); setStatus("your move — you're white"); sync(); quip("You just reset the board for a rematch. One cocky line.") }

  const board = gameRef.current.board()
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"]

  return (
    <div style={{ position: "fixed", inset: 0, background: "#06070e", color: "#eef4f8", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 560, padding: "16px 18px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, color: "#9fb2c4", letterSpacing: 1 }}>the arena · chess</div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{name} · the house</div>
        </div>
        <button onClick={() => onClose ? onClose() : (window.location.href = "/airraw")} style={{ fontSize: 13, color: "#cdd9e3", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", padding: "7px 12px", borderRadius: 12, cursor: "pointer" }}>← leave</button>
      </div>

      <div style={{ fontSize: 13, color: "#cfe0ee", minHeight: 38, maxWidth: 520, textAlign: "center", padding: "4px 18px", fontStyle: "italic" }}>&ldquo;{banter}&rdquo;</div>

      <div style={{ width: "min(94vw, 520px)", aspectRatio: "1", display: "grid", gridTemplateColumns: "repeat(8,1fr)", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,.12)", margin: "6px 0" }}>
        {board.map((row, r) => row.map((sq, f) => {
          const square = (files[f] + (8 - r)) as Square
          const dark = (r + f) % 2 === 1
          const isSel = sel === square
          const isTarget = targets.includes(square)
          return (
            <button key={square} onClick={() => onSquare(square)} style={{ position: "relative", border: "none", cursor: "pointer", background: isSel ? "#3f7d6e" : dark ? "#33424d" : "#6c7e8c", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
              {sq && <span style={{ fontSize: "min(7vw,40px)", lineHeight: 1, color: sq.color === "w" ? "#f4f5f2" : "#10151a", textShadow: sq.color === "w" ? "0 1px 2px rgba(0,0,0,.5)" : "0 1px 1px rgba(255,255,255,.25)" }}>{GLYPH[sq.type]}</span>}
              {isTarget && <span style={{ position: "absolute", width: sq ? "100%" : "32%", height: sq ? "100%" : "32%", borderRadius: sq ? 0 : "50%", background: sq ? "transparent" : "rgba(127,214,160,.6)", boxShadow: sq ? "inset 0 0 0 3px rgba(127,214,160,.7)" : "none", pointerEvents: "none" }} />}
            </button>
          )
        }))}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6, fontSize: 13 }}>
        <span style={{ color: thinking ? "#7fd6c0" : "#9fb2c4" }}>{thinking ? `${name.toLowerCase()} is thinking…` : status}</span>
        <button onClick={reset} style={{ fontSize: 13, color: "#1a0d08", background: "#ef7a4d", border: "none", borderRadius: 12, padding: "8px 16px", cursor: "pointer" }}>new game</button>
      </div>
      <div style={{ fontSize: 11, color: "#5f7283", marginTop: 8 }}>{void fen}you&apos;re white · tap a piece, then a square</div>
      <audio ref={audioRef} style={{ display: "none" }} />
    </div>
  )
}
