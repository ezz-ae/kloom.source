export const metadata = { title: "Payments & Refunds — Kloom" }

export default function PaymentsPage() {
  return (
    <>
      <h1>Payments &amp; Refunds</h1>
      <p className="text-muted-foreground text-sm">Last updated: June 12, 2026</p>

      <h2>1. What&apos;s free and what&apos;s paid</h2>
      <ul>
        <li><strong>Free, forever:</strong> text chat in any room, creating rooms and characters, inviting friends.</li>
        <li><strong>Paid:</strong> voice-call minutes (credits), the Unrestricted tier, and premium features marked in the app.</li>
        <li>During launch periods we may unlock paid features for free; this is promotional and can end at any time.</li>
      </ul>

      <h2>2. How payment works</h2>
      <ul>
        <li>Payments are processed by <strong>PayPal</strong> (cards accepted — no PayPal account required where inline card fields are available). We never see or store your card number.</li>
        <li>Prices are shown in USD at checkout. Your bank may apply currency conversion.</li>
        <li>Credits are added to your account immediately after the payment is confirmed.</li>
      </ul>

      <h2>3. Refunds</h2>
      <ul>
        <li><strong>Unused credits:</strong> refundable on request within <strong>14 days</strong> of purchase.</li>
        <li><strong>Used credits:</strong> voice minutes already consumed are not refundable.</li>
        <li><strong>Subscriptions:</strong> cancel anytime; access runs to the end of the paid period. The current period is not refunded once it begins, except where required by law.</li>
        <li><strong>Something broke?</strong> If a technical failure on our side ate your credits (a call that never connected, a double charge), tell us — we restore credits or refund, no friction.</li>
      </ul>
      <p>Refund requests: <a className="underline" href="mailto:m@ezz.ae">m@ezz.ae</a> with your transaction reference. We respond within 3 business days.</p>

      <h2>4. Chargebacks</h2>
      <p>
        Please contact us before opening a dispute with your bank — almost everything is solvable
        faster directly. Accounts with fraudulent chargebacks are suspended.
      </p>

      <h2>5. Adult content and billing</h2>
      <p>
        Paid features apply platform-wide. Purchasing the Unrestricted tier requires the same 18+
        confirmation as entering adult worlds; see the <a className="underline" href="/legal/terms">Terms</a>.
      </p>
    </>
  )
}
