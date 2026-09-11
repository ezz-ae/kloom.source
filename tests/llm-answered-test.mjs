// THE REPLY SAYS WHICH MODEL SPOKE.
//
// Grok is the voice model; when its key had no credit the seat parked itself
// and every turn ran on the house model for hours. The floor kept answering,
// which is the point of the fallback chain — and also why nobody could tell.
// X-TTS-Provider and X-STT-Provider made the ear and the voice debuggable from
// a curl; X-LLM-Seat is the same for the mind. The first token is pulled
// before the headers go out, so the header names the seat that ANSWERED, not
// the one that was asked.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const llm = strip(readFileSync("lib/llm-backends.ts", "utf8"))
const chat = strip(readFileSync("app/api/chat/route.ts", "utf8"))

console.log("— every seat announces itself before it streams —")
check(/onSeat\?: \(seat: Backend\) => void/.test(readFileSync("lib/llm-backends.ts", "utf8")), "LLMOptions carries onSeat")
const calls = (llm.match(/opts\.onSeat\?\.\(/g) || []).length
check(calls >= 5, `it is called on the primary, the fallback candidates, and both local paths (${calls} sites)`)
{
  const i = llm.indexOf("const primary = backend ===")
  const primaryBlock = llm.slice(i, llm.indexOf("catch (err)", i))
  check(/opts\.onSeat\?\.\(backend\)[\s\S]*for await \(const chunk of primary/.test(primaryBlock), "the primary announces BEFORE its first chunk")
  const j = llm.indexOf("async function* houseFallback")
  const fb = llm.slice(j)
  check(/opts\.onSeat\?\.\(name\)[\s\S]*for await \(const chunk of fn\(messages, opts\)\)/.test(fb), "and so does each fallback, so the last call is the seat that answered")
}

console.log("— the chat route names it on the response —")
check(/"X-LLM-Seat": seat/.test(chat), "X-LLM-Seat is on every chat response")
{
  const pull = chat.indexOf("first = await llm.next()")
  const stream = chat.indexOf("new ReadableStream<Uint8Array>")
  check(pull > 0 && stream > pull, "the first token is pulled BEFORE the stream (and its headers) is built")
  check((chat.match(/streamLLM\(/g) || []).length === 1, "streamLLM is called exactly once per turn")
  check(/if \(!first\.done\) \{\s*feed\(first\.value\)\s*for await \(const delta of llm\) feed\(delta\)/.test(chat), "the pulled token is fed first, then the rest of the same generator")
  check(/console\.error\("\[chat\] all LLM backends failed:"/.test(chat), "a total failure is still logged with the line the runbook greps for")
  check(/console\.error\("\[chat\] LLM stream broke mid-reply:"/.test(chat), "and a mid-reply break is logged separately — the words already streamed stay")
}

console.log(fail ? `\n${fail} FAILED` : "\nPASS")
process.exit(fail ? 1 : 0)
