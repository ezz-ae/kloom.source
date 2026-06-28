import Link from "next/link"

export const metadata = { title: "Legal — Abuseday" }

const PAGES = [
  { href: "/legal/terms",    label: "Terms of Service" },
  { href: "/legal/privacy",  label: "Privacy" },
  { href: "/legal/cookies",  label: "Cookies" },
  { href: "/legal/payments", label: "Payments & Refunds" },
]

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 mb-10 group">
          <div className="w-7 h-7 rounded-lg brand-gradient" />
          <span className="font-black tracking-widest uppercase text-sm">Abuseday</span>
        </Link>

        <nav className="flex flex-wrap gap-2 mb-10">
          {PAGES.map((p) => (
            <Link key={p.href} href={p.href}
              className="text-xs font-semibold px-3.5 py-2 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
              {p.label}
            </Link>
          ))}
        </nav>

        <article className="legal-prose space-y-6 text-[15px] leading-relaxed text-foreground/85
          [&_h1]:text-3xl [&_h1]:font-black [&_h1]:tracking-tight [&_h1]:text-foreground
          [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:text-foreground
          [&_p]:text-foreground/75 [&_li]:text-foreground/75 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5
          [&_strong]:text-foreground">
          {children}
        </article>

        <p className="mt-16 text-xs text-muted-foreground/60">
          Questions about any of this: <a className="underline hover:text-foreground" href="mailto:m@ezz.ae">m@ezz.ae</a>
        </p>
      </div>
    </div>
  )
}
