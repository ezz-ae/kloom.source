"use client"
// AIRRAW funnel events (airraw_land / airraw_talk / airraw_lead) go through the
// shared generic tracker. Kept as a re-export so existing imports keep working.
export { track } from "@/lib/track"
