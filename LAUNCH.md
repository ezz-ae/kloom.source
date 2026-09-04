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

## Money readiness — audit of 2026-09-04 (what actually blocks revenue)

Checked live against airraw.com, the Vercel project, Supabase and every provider key
in production. Card checkout is LIVE (Ziina `test:false`), the pass mints a signed
token, chat and speech recognition answer. These are the open items, in order:

1. **ElevenLabs is the single point of failure for the product, and it is sick.**
   The account has an OPEN, UNPAID $20 invoice, the monthly character reset date is
   in the past (24 Aug), and ~100k of 502k characters remain. Production already hit
   `quota_exceeded` on 3 Sep. At ~800 TTS calls/day that is one to two days of voice.
   When it hits zero every face falls back to Fish in a DIFFERENT voice, and Arabic
   speech recognition (Scribe) stops. Pay the invoice, fix the card, and either move
   to a plan with usage-based overage or upgrade the tier before spending on ads.
2. **`AIRRAW_PRO_SECRET` is not set in Vercel.** Passes are signed with the Supabase
   service-role key instead. Set a dedicated secret BEFORE the first sale (there are
   none yet, so nothing is voided):
   `openssl rand -hex 32 | vercel env add AIRRAW_PRO_SECRET production` then redeploy.
3. **Dead keys in production env:** `FAL_KEY` (401 — an 11-char placeholder) and
   `XAI_API_KEY` (400). Remove or replace; the code now latches a dead FAL key off
   per instance, but a real key would give portraits a second engine.
4. **The pass is priced under its own cost for a heavy user.** 6,000 voice minutes for
   $9 (capped 240 min/day). One minute of spoken reply ≈ 750 characters; on the
   Creator tier that is ≈ $0.16/min, so a single user who talks an hour a day for the
   90 days costs ≈ $430 in TTS against $9 of revenue — before LLM, STT and images.
   Either cut `AIRRAW_PASS_MINUTES` (300–600 is defensible at $9), raise the price,
   or serve pass voice from the cheaper engine. Decide before ads, not after.
5. **Every prompt change re-renders the entire cast.** Faces are cached by a prompt
   fingerprint; the last two commits changed it twice in a day, so every returning
   visitor got a NEW face for the same person and the floor re-generated ~1,000
   portraits through Together's rate limits (429 storms, 120s timeouts). Freeze the
   portrait prompt now — a face that changes is worse than a face that is imperfect.
6. **Branding is split.** The tab title and OG say AIRRAW, the shell says FAITALK, the
   pass sheet says "airraw pro", the Ziina statement says "The Pass". Pick one before
   people see a card charge they don't recognise.

Fixed in code on 2026-09-04: voice pinning (one voice per person across greeting,
call and every chunk — `lib/airraw/voice-pin.ts`), 429 retry on the voice engine
before any fallback, face/voice/dialect/language-filter all keyed on the SAME seed,
the pending-pass row that never inserted (NOT NULL wallet), Together 429 backoff
instead of a 20-model walk, and a dead FAL key no longer retried per face.

## Known follow-ups (safe to launch without, fix soon)
- KV-backed global cap + instant kill (current cap is per-instance in-memory).
- Real age verification before any adult tier goes public.
- Consent banner for pixels if targeting EU/UK (GDPR).
- Moderation on the human+AI group rooms before promoting `/universe` group chat.
