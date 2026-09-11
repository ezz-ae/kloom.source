// THE CAST OVER MCP IS THE CAST THE FLOOR SPEAKS FROM.
//
// The user asked for the character to be "the home for each character", MCP
// rather than a prompt, so a new one is easy to make and every surface reads
// the same person. The registry (persona.ts) is that home, in-process. These
// tools are its out-of-band face: list, read, preview, voice, draft — each one
// calling the same functions the call and the room call, so what a tool shows
// is what the floor does. This runs the REAL tools through a real MCP client.
import { readFileSync } from "node:fs"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { registerCastTools, CAST_TOOLS } from "../lib/airraw/cast-tools.ts"
import { CAST_COUNT, byId, clusterFor, identityFor, soulPrompt } from "../lib/airraw/cast50.ts"
import { renderPersona } from "../lib/airraw/persona.ts"
import { profileFor } from "../lib/airraw/profile.ts"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

const server = new McpServer({ name: "t", version: "0" })
registerCastTools(server)
const client = new Client({ name: "t", version: "0" })
const [ct, st] = InMemoryTransport.createLinkedPair()
await Promise.all([server.connect(st), client.connect(ct)])
const call = async (name, args) => { const r = await client.callTool({ name, arguments: args }); return { err: !!r.isError, body: r.content?.[0]?.text ?? "", json: r.isError ? null : JSON.parse(r.content[0].text) } }

console.log("— the five tools, over a real client —")
{
  const listed = (await client.listTools()).tools.map((t) => t.name).sort()
  check(JSON.stringify(listed) === JSON.stringify([...CAST_TOOLS].sort()), `tools/list names exactly ${CAST_TOOLS.join(", ")}`)
}
const list = await call("cast_list", { lang: "ar" })
check(!list.err && list.json.length === CAST_COUNT, `cast_list returns all ${CAST_COUNT} written characters`)
const first = list.json[0]
check(typeof first.id === "string" && typeof first.name === "string" && ["female", "male"].includes(first.gender), "each with id, name and gender")

console.log("— and they say what the floor says —")
{
  const m = byId(first.id)
  const got = await call("cast_get", { id: first.id, lang: "ar" })
  check(!got.err, "cast_get answers")
  check(got.json.identity.name === identityFor(m, "ar").name, "the Arabic name is the Arabic name the floor uses")
  check(JSON.stringify(got.json.profile) === JSON.stringify(profileFor(clusterFor(m, "ar"))), "the profile IS profileFor() — not a second copy")
  check(typeof got.json.voice.accent.key === "string", "and the voice carries the accent derived from the same seed as the face")

  const pv = await call("cast_preview", { id: first.id, surface: "call", lang: "en" })
  const c = clusterFor(m, "en")
  const real = renderPersona(c, "call", { soul: soulPrompt(identityFor(m, "en")), language: "English" })
  check(!pv.err && pv.json.personality === real.personality && pv.json.seedKey === real.seedKey, "cast_preview on the call is byte-for-byte renderPersona(call)")
  const room = await call("cast_preview", { id: first.id, surface: "room", lang: "en" })
  check(!room.err && room.json.personality !== pv.json.personality, "and the room reads differently from the call — the surface is the thing that changes")

  const v = await call("cast_voice", { id: first.id, lang: "en" })
  check(!v.err && v.json.seedKey === real.seedKey, "cast_voice's seed is the persona's seedKey — face, accent and voice from one place")

  const miss = await call("cast_get", { id: "nobody-here", lang: "en" })
  check(miss.err && /cast_list/.test(miss.body), "an unknown id is an error that points at cast_list")
}

console.log("— a new character is three facts —")
{
  const d = await call("cast_draft", { host: "Noor", archetype: "night-nurse", gender: "female", surface: "game", lang: "en" })
  check(!d.err && d.json.key === "night-nurse:Noor" && d.json.seedKey === "night-nurse:Noor", "cast_draft derives a stable key and seed from the archetype and name")
  check(/You are Noor/.test(d.json.persona.personality), "and renders them on the surface asked for")
  check(d.json.profile.gender === "female" && typeof d.json.lookLine === "string" && d.json.lookLine.length > 10, "with a body and a card, like everyone else")
}

console.log("— only the adult build carries them —")
{
  const route = readFileSync("app/api/mcp/route.ts", "utf8")
  check(/if \(adultEnabled\(\)\) registerCastTools\(server\)/.test(route), "the app route registers them only when adultEnabled()")
  check(/ADULT_TOOLS = new Set\(\["kloom_onlyfans_dm", \.\.\.CAST_TOOLS\]\)/.test(route), "and refuses them by name on Kloom as well")
  const standalone = readFileSync("mcp-server/src/index.ts", "utf8")
  check(!/cast-tools|registerCastTools/.test(standalone), "the standalone Kloom server does not know they exist")
}

await client.close(); await server.close()
console.log(fail ? `\n${fail} FAILED` : "\nPASS")
process.exit(fail ? 1 : 0)
