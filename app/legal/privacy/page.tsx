export const metadata = { title: "Privacy Policy — Kloom" }

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground text-sm">Last updated: June 12, 2026</p>

      <p>
        Kloom is built to know as little about you as possible. There is no signup form, no email
        requirement, and no account database of your conversations.
      </p>

      <h2>1. What stays on your device</h2>
      <ul>
        <li><strong>Your conversations.</strong> Room chat history is stored in your browser&apos;s local storage — not on our servers. Clear your browser data and it&apos;s gone.</li>
        <li><strong>Your custom rooms and characters.</strong> Also local storage, unless you explicitly publish a room or share an invite link (the room definition travels inside the link itself).</li>
        <li><strong>Zero-memory rooms</strong> store nothing at all — no history is written even locally.</li>
      </ul>

      <h2>2. What we process on servers</h2>
      <ul>
        <li><strong>Messages in transit.</strong> To generate replies, your messages are sent to AI models running on infrastructure we rent (RunPod GPU servers). They are processed in memory and not retained as conversation logs by us.</li>
        <li><strong>Voice.</strong> Speech you send is transcribed in your browser; character replies are synthesized by our text-to-speech providers (Fish Audio). The text of a reply is sent to the provider to generate audio.</li>
        <li><strong>Published rooms.</strong> If you publish a room to a world directory, its definition (name, characters, description — not your chats) is stored in our database (Supabase) so others can find it.</li>
        <li><strong>Payments.</strong> Handled by PayPal. We never see or store card numbers. We store only what is needed to credit your account (transaction reference, amount, your wallet/session identifier).</li>
      </ul>

      <h2>3. What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t sell or share your data with advertisers.</li>
        <li>We don&apos;t use your conversations to train AI models.</li>
        <li>We don&apos;t require — or want — your real identity.</li>
      </ul>

      <h2>4. Third parties</h2>
      <p>
        Infrastructure providers that process data to make Kloom work: Vercel (hosting),
        RunPod (AI compute), Fish Audio (voice synthesis), Supabase (published rooms, realtime
        sessions, payment crediting), PayPal (payments), and optionally Twilio (voice-call relay).
        Each receives only what is technically necessary for its function.
      </p>

      <h2>5. Your controls</h2>
      <ul>
        <li>Delete any custom room or conversation from the app — it deletes locally and (for published rooms) you can ask us to remove the published copy.</li>
        <li>Use zero-memory rooms for conversations that should never persist.</li>
        <li>Clearing browser storage removes everything Kloom knows about you on that device.</li>
      </ul>

      <h2>6. Contact</h2>
      <p>Privacy questions or deletion requests: <a className="underline" href="mailto:m@ezz.ae">m@ezz.ae</a>.</p>
    </>
  )
}
