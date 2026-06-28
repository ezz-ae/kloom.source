export const metadata = { title: "Terms of Service — Abuseday" }

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-muted-foreground text-sm">Last updated: June 12, 2026</p>

      <p>
        Abuseday (&quot;Abuseday&quot;, &quot;we&quot;, &quot;us&quot;) is a platform for voice and text conversations
        with AI characters in shared rooms. By creating a room, joining a room, or otherwise using
        Abuseday, you agree to these terms.
      </p>

      <h2>1. What Abuseday is</h2>
      <p>
        Every conversation on Abuseday is with <strong>artificial intelligence</strong>. The characters are
        fictional, their voices are synthesized, and nothing they say is written, reviewed, or endorsed
        by a human. Conversations are entertainment — they are <strong>not</strong> medical, legal,
        financial, or psychological advice, and no character is a licensed professional. Tools inside
        rooms (market prices, calculations, search) are provided as-is with no guarantee of accuracy;
        do not make financial decisions based on them.
      </p>

      <h2>2. Who can use Abuseday</h2>
      <ul>
        <li>You must be at least <strong>18 years old</strong> to use Abuseday. Period — not just for adult worlds.</li>
        <li>Worlds and rooms marked 18+ contain adult themes and explicit content. You must additionally confirm your age before entering them.</li>
        <li>You are responsible for anyone you invite into your rooms being 18 or older.</li>
      </ul>

      <h2>3. Zero-restriction policy — and its hard limits</h2>
      <p>
        Abuseday runs open AI models with minimal content filtering. Adult, dark, and taboo fiction
        between consenting adults and AI characters is allowed. Two things are absolutely prohibited,
        enforced in software, and will result in immediate termination:
      </p>
      <ul>
        <li>Any sexual content involving minors — real, fictional, implied, or role-played. No exceptions, no appeals.</li>
        <li>Using Abuseday to plan, enable, or facilitate real-world harm — violence, exploitation, fraud, or other crimes.</li>
      </ul>

      <h2>4. Your content and rooms</h2>
      <ul>
        <li>Rooms and characters you create remain yours. By publishing a room to a world&apos;s public directory you grant other users the right to join and use a copy of it.</li>
        <li>Voice cloning (e.g. from a video link) must only use voices you have the right to use — your own voice or voices you have permission for. Cloning a real person&apos;s voice to impersonate, harass, or defraud is prohibited.</li>
        <li>We may remove published rooms that break these terms.</li>
      </ul>

      <h2>5. Payments</h2>
      <p>
        Text chat is free. Voice calls and premium tiers are paid — see the{" "}
        <a className="underline" href="/legal/payments">Payments &amp; Refunds policy</a> for details.
      </p>

      <h2>6. No warranty; limitation of liability</h2>
      <p>
        Abuseday is provided &quot;as is&quot;. AI output can be wrong, weird, or upsetting; synthesized
        voices and generated content may fail or be unavailable. To the maximum extent permitted by
        law, our total liability for any claim is limited to the amount you paid us in the three
        months before the claim arose.
      </p>

      <h2>7. Changes</h2>
      <p>
        We may update these terms as the product evolves. Material changes will be announced in the
        app. Continuing to use Abuseday after a change means you accept it.
      </p>
    </>
  )
}
