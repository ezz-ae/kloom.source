import { notFound } from "next/navigation"
import { ChipClaim } from "@/components/airroom/ChipClaim"

// /airraw is the AIRRAW planet — the adult-styled voice lounge. It is the home
// surface on airraw.com (AIRRAW_HOME=1) but must NEVER be reachable on the Kloom
// deployments (kloom.io / .fun / .me): on the SFW Meta-ads domain a publicly
// reachable "late-night voice floor" page is an ad-review brand-safety hazard
// even though chat itself is server-gated. Same guard the /floor route uses.
const IS_AIRRAW = process.env.AIRRAW_HOME === "1"

export default function AirrawLayout({ children }: { children: React.ReactNode }) {
  if (!IS_AIRRAW) notFound()   // 404 on every Kloom deployment — AIRRAW-only surface
  // The chip-purchase claim lives here rather than in the root layout so it is
  // structurally unreachable on Kloom — this component is behind the notFound()
  // above, not merely unused there.
  return <>{children}<ChipClaim /></>
}
