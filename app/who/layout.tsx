// The public character pages are an AIRRAW surface and must 404 everywhere else.
//
// Kloom is the SFW brand and the domain the Meta credit points at. A route that
// leaked adult profile pages onto it would put that ad account at risk, so the
// gate is a layout rather than a check inside each page: a new page added under
// /who inherits the 404 instead of having to remember it.
import { notFound } from "next/navigation"

const IS_AIRRAW = process.env.AIRRAW_HOME === "1"

export default function WhoLayout({ children }: { children: React.ReactNode }) {
  if (!IS_AIRRAW) notFound()
  return <>{children}</>
}
