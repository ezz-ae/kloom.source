// Mirror of AirBubble's flush() + pump() to prove: (a) Arabic sentences chunk at
// all, (b) audio plays in the order it was generated even when TTS responses come
// back out of order, (c) a failed chunk doesn't stall the queue.

const SENT_END = /[.!?…؟](?:\s|$)|\n/

function chunkStream(pieces) {
  let accumulated = "", spokenUpTo = 0
  const out = []
  const flush = (final) => {
    for (;;) {
      const rest = accumulated.slice(spokenUpTo)
      const m = SENT_END.exec(rest)
      if (!m) break
      const end = m.index + m[0].length
      const piece = rest.slice(0, end).trim()
      if (piece.length < 12 && !final) break
      spokenUpTo += end
      if (piece) out.push(piece)
    }
    if (final) {
      const tail = accumulated.slice(spokenUpTo).trim()
      spokenUpTo = accumulated.length
      if (tail) out.push(tail)
    }
  }
  for (const p of pieces) { accumulated += p; flush(false) }
  flush(true)
  return { chunks: out, joined: out.join(" "), full: accumulated.trim() }
}

// ── ordered playback under out-of-order arrival ──────────────────────────────
function simulate(nChunks, arrivalOrder, failures = new Set()) {
  const queue = []; let playSeq = 0, playing = false, inflight = nChunks
  const played = []
  const pump = () => {
    if (playing) return
    const i = queue.findIndex(q => q.seq === playSeq)
    if (i === -1) return
    const [next] = queue.splice(i, 1); playSeq++
    if (next.url === null) { pump(); return }
    playing = true
    played.push(next.url)
    playing = false          // synchronous "playback" for the test
    pump()
  }
  for (const seq of arrivalOrder) {
    queue.push({ url: failures.has(seq) ? null : `audio${seq}`, seq })
    inflight--
    pump()
  }
  return played
}

let fail = 0
const eq = (a, b, label) => {
  const ok = JSON.stringify(a) === JSON.stringify(b)
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`)
  if (!ok) { console.log(`      got      ${JSON.stringify(a)}`); console.log(`      expected ${JSON.stringify(b)}`); fail++ }
}

console.log("— Arabic chunking (the regex that previously matched nothing) —")
const ar = chunkStream(["شو عم تعمل هلق؟ ", "ما نمت من امبارح. ", "وانت شو قصتك؟"])
console.log("  chunks:", ar.chunks)
eq(ar.chunks.length >= 2, true, "Arabic reply splits into multiple spoken chunks")
eq(ar.joined, ar.full, "Arabic: nothing dropped, nothing duplicated")

const old = /[.!?…](?:\s|$)/.exec("شو عم تعمل هلق؟ ما نمت من امبارح.")
console.log(`  old Latin-only regex on Arabic: ${old ? "matched at " + old.index : "NO MATCH (this was the bug)"}`)

console.log("\n— English chunking —")
const en = chunkStream(["no you didn't. ", "you avoided it and called that handling it. ", "ok?"])
console.log("  chunks:", en.chunks)
eq(en.joined, en.full, "English: nothing dropped, nothing duplicated")

console.log("\n— short-fragment guard —")
const sh = chunkStream(["ok. ", "but here's the actual problem with that."])
console.log("  chunks:", sh.chunks)
eq(sh.joined, sh.full, "short leading fragment still delivered exactly once")

console.log("\n— ordered playback —")
eq(simulate(4, [0,1,2,3]), ["audio0","audio1","audio2","audio3"], "in-order arrival")
eq(simulate(4, [2,0,3,1]), ["audio0","audio1","audio2","audio3"], "out-of-order arrival still plays in order")
eq(simulate(4, [3,2,1,0]), ["audio0","audio1","audio2","audio3"], "fully reversed arrival")
eq(simulate(4, [0,1,2,3], new Set([1])), ["audio0","audio2","audio3"], "failed chunk skipped, queue not stalled")
eq(simulate(4, [3,1,2,0], new Set([2])), ["audio0","audio1","audio3"], "failure + out-of-order")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
