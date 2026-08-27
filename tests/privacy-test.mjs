// Mirror of SpeechSegmenter's visibility handling.
function makeSeg() {
  const s = {
    running: false, paused: true, destroyed: false, hiddenPause: false,
    recording: false, discarded: 0, events: [],
    start() { if (s.destroyed) return; s.running = true; s.paused = false },
    abort() { s.paused = true; if (s.recording) { s.recording = false; s.discarded++ } },
    destroy() { s.destroyed = true; s.running = false; s.paused = true },
    beginUtterance() { if (!s.paused && s.running) s.recording = true },
    onVisible(vis) {
      if (s.destroyed) return
      if (vis !== "visible") {
        if (s.running && !s.paused) { s.hiddenPause = true; s.abort(); s.events.push("pause") }
        return
      }
      if (s.hiddenPause) {
        s.hiddenPause = false
        if (s.running) { s.paused = false; s.events.push("resume") }
      }
    },
    capturing() { return s.running && !s.paused },
  }
  return s
}

let fail = 0
const check = (c, label) => { console.log(`${c ? "ok  " : "FAIL"} ${label}`); if (!c) fail++ }

// 1. Leaving the screen cuts the mic.
let s = makeSeg(); s.start()
check(s.capturing(), "capturing while on screen")
s.onVisible("hidden")
check(!s.capturing(), "mic OFF once the call leaves the screen")

// 2. A half-recorded utterance is discarded, never transcribed.
s = makeSeg(); s.start(); s.beginUtterance()
s.onVisible("hidden")
check(s.discarded === 1 && !s.recording, "in-progress recording is discarded, not sent")

// 3. Coming back restores it.
s.onVisible("visible")
check(s.capturing(), "mic back on when the user returns")

// 4. A call the user MUTED before leaving must not come back live.
s = makeSeg(); s.start()
s.abort()                       // user muted / stopped hands-free
s.onVisible("hidden")           // then left
s.onVisible("visible")          // and came back
check(!s.capturing(), "a mic the USER turned off stays off after returning")

// 5. Hung up while away -> returning must not resurrect it.
s = makeSeg(); s.start()
s.onVisible("hidden")
s.destroy()
s.onVisible("visible")
check(!s.capturing(), "a destroyed call is not revived by returning to the tab")

// 6. Repeated tab flapping doesn't leave it stuck off or double-resume.
s = makeSeg(); s.start()
for (let i = 0; i < 5; i++) { s.onVisible("hidden"); s.onVisible("visible") }
check(s.capturing(), "survives repeated tab switching")
check(s.events.filter(e => e === "resume").length === 5, "one resume per return, no duplicates")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
