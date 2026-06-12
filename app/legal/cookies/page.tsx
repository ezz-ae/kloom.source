export const metadata = { title: "Cookie Policy — Kloom" }

export default function CookiesPage() {
  return (
    <>
      <h1>Cookie Policy</h1>
      <p className="text-muted-foreground text-sm">Last updated: June 12, 2026</p>

      <p>
        Short version: <strong>Kloom does not use tracking cookies.</strong> No analytics cookies, no
        advertising pixels, no cross-site tracking.
      </p>

      <h2>1. What we use instead</h2>
      <p>
        Kloom uses your browser&apos;s <strong>local storage</strong> — a standard browser feature that keeps
        data on your device, readable only by Kloom. It stores:
      </p>
      <ul>
        <li>Your room chat history (so conversations survive a page reload)</li>
        <li>Custom rooms and characters you&apos;ve built</li>
        <li>Preferences: your display name, age confirmation for 18+ worlds, account status flags</li>
        <li>Voice credits balance cache</li>
      </ul>
      <p>None of this leaves your device through local storage — see the <a className="underline" href="/legal/privacy">Privacy Policy</a> for what is sent to servers and why.</p>

      <h2>2. Strictly necessary cookies</h2>
      <p>
        Our hosting and payment providers may set strictly necessary cookies for security and
        fraud prevention (for example, during checkout). These are required for the service to
        function and are controlled by those providers.
      </p>

      <h2>3. Managing it</h2>
      <p>
        Clearing your browser&apos;s site data for Kloom removes all locally stored information —
        including your rooms and chat history. There is no server-side copy to worry about (except
        rooms you explicitly published).
      </p>
    </>
  )
}
