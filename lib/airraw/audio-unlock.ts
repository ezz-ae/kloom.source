// UNLOCKING THE SPEAKER ON THE GESTURE THAT ASKED FOR SOUND.
//
// Every sound this product makes is played from a fetch callback: a reply
// streams, a chunk goes to TTS, audio comes back, and only then is play()
// called. By that point iOS no longer counts it as a user gesture, so Safari
// refuses — and the refusal was logged to a console nobody has open. The result
// is a call with text, no voice, and no error, on an engine that has already
// been paid for.
//
// The fix has to happen INSIDE the tap, on the SAME element that will play the
// audio later: play a moment of silence, and the element is marked
// user-activated for the rest of its life.
//
// Kept here rather than in one component because five surfaces have this exact
// problem — the room, the group room, a room card, a scene and the chess board
// all play through their own <audio> and all of them start it from a callback.

/** 44 bytes of silence. Not an empty src: play() with no source rejects, and a
 *  rejected unlock is no unlock at all. */
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA="

const unlocked = new WeakSet<HTMLAudioElement>()

/**
 * Call this synchronously from a click/tap handler, before any await.
 *
 * Safe to call repeatedly: it does nothing after the first success, and it never
 * throws — a browser that does not need unlocking is not a browser to break.
 */
export function unlockAudio(el: HTMLAudioElement | null | undefined): void {
  if (!el || unlocked.has(el)) return
  try {
    const wasSrc = el.src
    el.src = SILENCE
    const done = () => {
      try { el.pause(); el.currentTime = 0; if (wasSrc) el.src = wasSrc } catch { /* */ }
      unlocked.add(el)
    }
    const p = el.play()
    if (p && typeof p.then === "function") p.then(done).catch(() => { try { if (wasSrc) el.src = wasSrc } catch { /* */ } })
    else done()
  } catch { /* the play path logs the block if one still comes */ }
}

// ── AND THE SAME PROBLEM ON EVERY OTHER SURFACE ──────────────────────────────
//
// The room, the group room, a scene and the chess board each own an <audio> and
// each start it from a callback, exactly like the call did. Wiring an unlock
// into every tap that might eventually lead to sound is a list nobody will keep
// correct — the first person to add a surface will forget.
//
// So instead: a surface REGISTERS its element, and the first touch anywhere on
// the page unlocks everything registered. One listener, once, and a component
// only has to say "this is my speaker".
const pending = new Set<HTMLAudioElement>()
let armed = false

function unlockAll() {
  for (const el of pending) unlockAudio(el)
  pending.clear()
}

/**
 * Say "this is my speaker". Call it from an effect once the ref is attached.
 * Returns a cleanup that forgets the element, so an unmounted surface does not
 * keep one alive.
 */
export function registerAudio(el: HTMLAudioElement | null | undefined): () => void {
  if (!el || typeof document === "undefined") return () => {}
  if (unlocked.has(el)) return () => {}
  pending.add(el)
  if (!armed) {
    armed = true
    // Capture phase, so a stopPropagation() somewhere in the tree cannot cost
    // the whole page its sound. pointerdown fires before click and before any
    // async work the handler starts, which is what iOS wants.
    document.addEventListener("pointerdown", unlockAll, { capture: true })
    document.addEventListener("touchstart", unlockAll, { capture: true, passive: true })
  }
  return () => { pending.delete(el) }
}
