import { redirect } from "next/navigation"
// Retired in the rooms-only architecture — everything is a room now.
export default function Page() { redirect("/app/rooms") }
