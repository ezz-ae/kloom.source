// Mirror of lib/airraw/memory.ts against a fake localStorage.
const store = new Map()
const localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => { if (v.length > 5000) { const e = new Error("QuotaExceededError"); throw e } store.set(k, v) },
  removeItem: k => store.delete(k),
}
let PRO = true
const KEY = "airraw_talks", OFF_KEY = "airraw_talks_off"
const MAX_TALKS = 12, MAX_MSGS = 30
const memoryOff = () => localStorage.getItem(OFF_KEY) === "1"
const memoryEnabled = () => PRO && !memoryOff()
const readAll = () => { try { const r = localStorage.getItem(KEY); if (!r) return []
    const p = JSON.parse(r); if (!Array.isArray(p)) return []
    return p.filter(t => t && typeof t.key === "string" && t.cluster && Array.isArray(t.msgs)) } catch { return [] } }
const writeAll = l => { try { localStorage.setItem(KEY, JSON.stringify(l.slice(0, MAX_TALKS))) }
  catch { try { localStorage.setItem(KEY, JSON.stringify(l.slice(0, Math.floor(MAX_TALKS/2)))) } catch {} } }
const saveTalk = (cluster, msgs) => {
  if (!memoryEnabled()) return
  const key = cluster.key; if (!key) return
  if (!msgs.some(m => m.who === "you")) return
  const rest = readAll().filter(t => t.key !== key)
  writeAll([{ key, cluster, msgs: msgs.slice(-MAX_MSGS), at: Date.now() }, ...rest].slice(0, MAX_TALKS))
}
const listTalks = () => memoryEnabled() ? readAll().sort((a,b)=>(b.at||0)-(a.at||0)) : []
const loadTalk = k => memoryEnabled() ? (readAll().find(t=>t.key===k) || null) : null
const forgetTalk = k => writeAll(readAll().filter(t=>t.key!==k))
const forgetAll = () => localStorage.removeItem(KEY)
const setMemoryOff = off => { if (off) { localStorage.setItem(OFF_KEY,"1"); forgetAll() } else localStorage.removeItem(OFF_KEY) }

const cl = n => ({ key: `K:${n}`, host: `H${n}`, gender: "female", lines: ["a","b","c"], vibe: "v", name: "r", f: .5, n: 1, h: "m", archetype: "GFE" })
const conv = n => [{ who: "host", text: "hi" }, ...Array.from({length:n},(_,i)=>({ who: i%2?"host":"you", text: `m${i}` }))]

let fail = 0
const check = (c, l) => { console.log(`${c?"ok  ":"FAIL"} ${l}`); if(!c) fail++ }

// free session writes nothing
PRO = false; store.clear()
saveTalk(cl(1), conv(4))
check(store.size === 0, "free session writes NOTHING to storage")
check(listTalks().length === 0 && loadTalk("K:1") === null, "free session can't read a thread")

// pro saves and restores
PRO = true; store.clear()
saveTalk(cl(1), conv(4))
check(loadTalk("K:1")?.msgs.length > 0, "pro session saves and restores the thread")

// a room opened but never spoken in is not saved
store.clear()
saveTalk(cl(2), [{ who: "host", text: "greeting only" }])
check(listTalks().length === 0, "a room you never spoke in is not offered back")

// only the tail is kept
store.clear()
saveTalk(cl(3), conv(200))
check(loadTalk("K:3").msgs.length === MAX_MSGS, `only the last ${MAX_MSGS} messages are kept`)

// thread count capped
store.clear()
for (let i = 0; i < 40; i++) saveTalk(cl(i), conv(4))
check(listTalks().length <= MAX_TALKS, `no more than ${MAX_TALKS} threads stored`)

// forget one / forget all
store.clear(); saveTalk(cl(1), conv(4)); saveTalk(cl(2), conv(4))
forgetTalk("K:1")
check(loadTalk("K:1") === null && loadTalk("K:2") !== null, "forget one leaves the others")
forgetAll(); check(listTalks().length === 0, "forget all wipes everything")

// switching memory off erases what was already stored
store.clear(); saveTalk(cl(1), conv(4))
setMemoryOff(true)
check(store.get(KEY) === undefined, "turning memory off ERASES existing threads, not just future ones")
check(!memoryEnabled(), "memory stays off for a Pro user who opted out")
setMemoryOff(false)

// losing Pro hides the data
store.clear(); PRO = true; saveTalk(cl(1), conv(4))
PRO = false
check(listTalks().length === 0 && loadTalk("K:1") === null, "threads become unreadable if the pass lapses")

// corrupt storage doesn't crash
PRO = true; store.set(KEY, "{{{not json")
check(listTalks().length === 0, "corrupt storage degrades to empty, no throw")
store.set(KEY, JSON.stringify([{ nope: 1 }, null, "x"]))
check(listTalks().length === 0, "malformed entries are filtered out")

// quota failure doesn't lose everything
store.clear()
for (let i = 0; i < 12; i++) saveTalk(cl(i), conv(30))
check(listTalks().length > 0, "quota pressure keeps some threads rather than losing all")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
