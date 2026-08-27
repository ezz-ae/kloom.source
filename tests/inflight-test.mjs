// Reproduce the barge-in cancellation race and prove the fix.
function makeSim(guardDecrement) {
  let token = 0, inflight = 0, queue = [], seq = 0, playSeq = 0, speaking = false
  const stopSpeaking = () => { token++; queue = []; seq = 0; playSeq = 0; inflight = 0; speaking = false }
  const pump = () => {
    const i = queue.findIndex(q => q.seq === playSeq)
    if (i === -1) { if (!queue.length && !inflight) speaking = false; return }
    queue.splice(i, 1); playSeq++; speaking = true; pump()
  }
  const start = (tok) => { if (tok !== token) return null; const s = seq++; inflight++; return s }
  const finish = (tok, s) => {
    if (tok === token) queue.push({ seq: s })
    if (guardDecrement) { if (tok === token) { inflight--; pump() } }
    else { inflight--; if (tok === token) pump() }
  }
  return { start, finish, stopSpeaking, state: () => ({ inflight, speaking, token }) }
}

for (const guard of [false, true]) {
  const sim = makeSim(guard)
  const tok = 0
  const a = sim.start(tok)          // chunk 0 requested
  const b = sim.start(tok)          // chunk 1 requested
  sim.stopSpeaking()                // user barges in — both chunks now stale
  sim.finish(tok, a)                // stale chunk 0 resolves
  sim.finish(tok, b)                // stale chunk 1 resolves
  const s = sim.state()
  const ok = s.inflight === 0 && s.speaking === false
  console.log(`${guard ? "fixed  " : "broken "} inflight=${String(s.inflight).padStart(2)} speaking=${s.speaking}  ${ok ? "ok" : "<-- stuck: mic never returns"}`)
}
