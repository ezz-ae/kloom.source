import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArabicDoor } from "./ArabicDoor"

// /ar — the Arabic front door, for the Gulf ad to point at.
//
// AIRRAW-ONLY, same guard as /airraw and /floor: on the Kloom deployments this
// must 404. A publicly reachable Arabic landing for a late-night voice floor on
// the SFW Meta-ads domain is the brand-safety hazard that whole rule exists to
// prevent, and being in Arabic does not make it less reachable by a reviewer.
const IS_AIRRAW = process.env.AIRRAW_HOME === "1"

export const metadata: Metadata = {
  title: "AIRRAW — اضغط على أي وجه وتكلّم الحين",
  description:
    "صالة أصوات مباشرة بالعربي. اختر وجه وتكلّم معه بصوت حقيقي، الحين — بلا تسجيل وبلا إيميل.",
  // The ad's destination is not a page anyone should reach from search: it is a
  // paid entrance with its own copy, and letting it compete with the real home
  // page for the same queries splits whatever ranking either one earns.
  robots: { index: false, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: "AIRRAW — اضغط على أي وجه وتكلّم الحين",
    description: "صالة أصوات مباشرة بالعربي. اختر وجه وتكلّم معه بصوت حقيقي، الحين.",
    locale: "ar_SA",
  },
}

export default function ArabicEntry() {
  if (!IS_AIRRAW) notFound()
  return <ArabicDoor />
}
