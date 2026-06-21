import type { Metadata } from "next"

export const metadata: Metadata = { title: "Privacy — AIRRAW", alternates: { canonical: "https://airraw.com/airraw/privacy" } }

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#06070e", color: "#cdd9e3", padding: "48px 22px 80px", maxWidth: 680, margin: "0 auto", lineHeight: 1.65, fontSize: 15 }
const h1: React.CSSProperties = { fontSize: 26, fontWeight: 600, color: "#eef4f8", letterSpacing: 1 }
const h2: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: "#eef4f8", marginTop: 26 }

export default function Privacy() {
  return (
    <div style={wrap}>
      <a href="/airraw" style={{ fontSize: 13, color: "#7fd6c0", textDecoration: "none" }}>← airraw</a>
      <h1 style={{ ...h1, marginTop: 14 }}>Privacy</h1>
      <p style={{ color: "#7f93a5", fontSize: 13 }}>Last updated June 2026</p>

      <h2 style={h2}>What we collect</h2>
      <p>If you ask for founding access, we store your <b>email</b> so we can tell you when the floor opens. To run the live room we keep an anonymous session id (so we can show who&apos;s present) — it isn&apos;t tied to your identity.</p>

      <h2 style={h2}>Your conversations</h2>
      <p>When you talk, what you type or say is sent in real time to our AI and text-to-speech providers to generate a reply. Voice is transcribed in your browser; we don&apos;t store recordings of you, and we don&apos;t use your conversations to train models.</p>

      <h2 style={h2}>AI &amp; real people</h2>
      <p>The characters here are AI. Real people may also be present in shared rooms. You won&apos;t always be able to tell which is which — that&apos;s intentional, and nothing said should be treated as advice from a real person.</p>

      <h2 style={h2}>What we don&apos;t do</h2>
      <p>We don&apos;t sell your data. We don&apos;t share your email except with the tools we use to send you mail.</p>

      <h2 style={h2}>Your rights</h2>
      <p>Wherever you live, you can ask us what we hold about you, correct it, or delete it — email us and we&apos;ll handle it. If we run ad pixels (Meta, TikTok, Google), they may set cookies to measure ads; you can opt out via your browser settings or each platform&apos;s ad-preferences page. We don&apos;t knowingly collect anything from anyone under 18.</p>

      <h2 style={h2}>Contact</h2>
      <p>Questions or deletion requests: <a href="mailto:hello@airraw.com" style={{ color: "#7fd6c0" }}>hello@airraw.com</a>.</p>
    </div>
  )
}
