# AIRRAW — launch pre-flight

The airraw.com ad-launch build. Run this checklist on the **airraw Vercel project**
before turning ads on. Each item maps to a failure mode that paid traffic punishes.

## 1. Brand / routing
- [ ] `AIRRAW_HOME=1` — serves the Lobby at `/`, brands robots/sitemap as airraw.
- [ ] `NEXT_PUBLIC_APP_URL=https://airraw.com` — canonicals, OG, robots/sitemap host.
- [ ] `airraw.com` + `www.airraw.com` added as Vercel domains with **valid TLS**
      (open the apex in a real browser; the landing must load over https).

## 2. The aha moment (LLM + voice) — without these the product is dead
- [ ] `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` — a PUBLICLY reachable
      OpenAI-compatible endpoint (not localhost). `/api/chat` 502s without it.
- [ ] `FISH_API_KEY` (+ optional `COSYVOICE_ENDPOINT_ID` / `RUNPOD_API_KEY`) —
      `/api/tts` returns 500 ("No TTS configured") without it and faces stay mute.
- [ ] Optional `FISH_VOICE_*` for voice variety / non-English.

## 3. Spend protection — REQUIRED before paid traffic
- [ ] `AIRRAW_DAILY_CALL_CAP` — max billable AI calls per instance/day. Unset
      defaults to **5000** (fail-safe). Size from budget (~$0.005–0.02/call):
      e.g. $50/day → 2,500–10,000. Note: this is **per serverless instance**, so
      the real ceiling is ~(instances × cap).
- [ ] **Hard provider-side caps** (the real backstop, since the app cap is
      per-instance): set a spend limit on Fish, on RunPod, and Vercel Spend
      Management. Do not skip this.
- [ ] `AIRRAW_KILL` — leave unset to run; set `=1` to emergency-stop all AI calls
      (takes effect on redeploy).
- [ ] Greeting voice fires one `/api/tts` per face-open (it's the ad's promise —
      "it talks back, right now"). That cost is bounded by the caps above. If you'd
      rather not pay per tap, we can defer the greeting to first message or cache
      the 28 deterministic greeting clips — say the word.

## 4. Measurement — or you're flying blind on CAC
- [ ] Set the pixel(s) you're running: `NEXT_PUBLIC_FB_PIXEL_ID` /
      `NEXT_PUBLIC_TIKTOK_PIXEL_ID` / `NEXT_PUBLIC_GA_ID`. These are **build-time
      inlined** — set them, then redeploy, then confirm in the platform's pixel
      helper that `airraw_land` / `airraw_talk` / `airraw_lead` arrive.
- [ ] Funnel events fire on both `/` (lobby) and `/universe`.

## 5. Lead capture
- [ ] `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` set.
- [ ] Run `db/airraw_leads.sql` once against that project (table + writer fn +
      policy). Verify: submit a test email on the live site, confirm a row appears,
      confirm anon **cannot** read `airraw_leads`.

## 6. Content / ad-policy
- [ ] Ads point at the **SFW lobby**. The universe (`/universe`) is SFW-capped
      (no fire/18+ worlds); `/floor` is NOT linked from the ad path.
- [ ] Privacy (`/airraw/privacy`) + Terms (`/airraw/terms`) load and are linked
      from the landing footer.
- [ ] The adult/fire tier and the localStorage age gate are **not** reachable from
      ad traffic. Do not re-enable them for the public campaign without real age
      verification.

## Known follow-ups (safe to launch without, fix soon)
- KV-backed global cap + instant kill (current cap is per-instance in-memory).
- Real age verification before any adult tier goes public.
- Consent banner for pixels if targeting EU/UK (GDPR).
- Moderation on the human+AI group rooms before promoting `/universe` group chat.
