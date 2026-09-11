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
- [ ] Run `db/pass_usage.sql` once (Dashboard → SQL editor). This is the
      server-side meter for pass minutes. Until it exists, pass holders' premium
      voice is unmetered (logged as `[pass-meter] unavailable`); free visitors are
      on the cheap engine regardless.

## 6. Content / ad-policy
- [ ] Ads point at the **SFW lobby**. The universe (`/universe`) is SFW-capped
      (no fire/18+ worlds); `/floor` is NOT linked from the ad path.
- [ ] Privacy (`/airraw/privacy`) + Terms (`/airraw/terms`) load and are linked
      from the landing footer.
- [ ] The adult/fire tier and the localStorage age gate are **not** reachable from
      ad traffic. Do not re-enable them for the public campaign without real age
      verification.

## Changing the portrait prompt — the order that is safe

A face's storage path contains `PROMPT_FINGERPRINT`, a hash of the assembled
prompt. Edit the prompt and every cached face becomes a miss, to be redrawn on
demand by whichever image provider is up, while people are looking at the
screen. That has happened: the fingerprint moved, Together answered 402 and fal
answered 403, and airraw.com served `image generation disabled` for its entire
floor — blank monograms, with ads running.

So never ship a prompt change straight to production. Instead:

```
git push origin <branch>                     # Vercel builds a preview
node --import ./tests/alias.mjs db/warm-faces.mjs --base https://<preview>.vercel.app
```

Preview shares production's storage bucket, so every face it draws lands under
the NEW fingerprint next to the old ones, while production keeps serving the old
ones untouched. Promote only when it reports FULL COVERAGE; every face is then a
cache hit on the first request, and reverting is instant because the old files
were never removed.

It is resumable — an existing face returns `cached` in milliseconds and costs
nothing — and it stops itself after a run of failures rather than making
hundreds of doomed calls at a dead provider.

**One env var has to match, and it is easy to miss.** A face lives at
`{slug}-{seed}-{realismVersion}-{fingerprint}.jpg`. The fingerprint is meant to
differ — that is the change being warmed. `REALISM_VERSION` is not, and it is an
env var: production is pinned to `r3`, while a preview that does not inherit the
pin builds `r5`. Warm into that and every face still misses on promote. So set
`REALISM_VERSION` on the Preview environment to whatever Production has, and
never clear the Production pin while faces are cached under it — that alone
would blank the floor. The warmer refuses to run on a mismatch and prints both
paths.

**It cannot finish, and is not supposed to.** The room draws a new cast every
hour, so the face population is unbounded; `--hours 24` warms a day ahead of the
clock. Ongoing cost is roughly 14 faces an hour, about 340 a day if every hour
is visited.

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
2. **`AIRRAW_PRO_SECRET`** — set on 2026-09-04 (sensitive, so its value can't be
   read back). Make sure it is a long random value (`openssl rand -hex 32`), not a
   word: every pass is an HMAC over it, and a guessable secret is a free pass for
   anyone who reads the code.

   **Rotating it no longer voids the passes already sold** — but only if you say
   what the old value was. `AIRRAW_PRO_SECRET_PREV` is accepted for VERIFYING a
   pass and never for minting one, so:

   ```
   vercel env add AIRRAW_PRO_SECRET_PREV production   # the value being replaced
   vercel env add AIRRAW_PRO_SECRET production        # the new one
   ```

   Passes signed with either keep working; new ones are signed with the current
   secret only. Drop `_PREV` once every pass signed with it has expired (90 days).

   This matters more than it looks, because `AIRRAW_PRO_SECRET` falls back to
   `SUPABASE_SERVICE_ROLE_KEY` when unset — so the secret ALSO moves on any
   Supabase key rotation or project switch. When it moves, a paying customer is
   not shown an error: they are metered as a free visitor, get one minute, and
   are then asked to buy the pass they already own.

   **To tell whether that is happening in production**, make one call and read the
   response headers — `X-TTS-Tier` and `X-Pass` on the 402:

   | `X-TTS-Tier` | `X-Pass`     | what it means                                  |
   |--------------|--------------|------------------------------------------------|
   | `pass`       | —            | the pass is being honoured; look elsewhere      |
   | `free`       | *(absent)*   | no pass was sent — the browser has no token     |
   | `free`       | `rejected`   | a pass was sent and the signature did not verify — the secret moved; set `AIRRAW_PRO_SECRET_PREV` |
   | `free`       | `expired`    | the pass is past its `until` — it needs renewing |
   | `free`       | `exhausted`  | the pass verified but its allowance is spent    |
   | `free`       | `daily-cap`  | fair-use cap for today (`PASS_DAILY_CAP_MIN`)   |

   **If the old secret is genuinely gone**, those passes can never verify again —
   and neither can the wallets their chips live in, since a wallet is a hash of
   the whole token. `db/reissue-pass.mjs` mints replacements from the payments
   themselves:

   ```
   vercel env pull .env.production.local
   node db/reissue-pass.mjs --list              # what we know was paid
   node db/reissue-pass.mjs --all --dry-run     # check everyone, mint nothing
   node db/reissue-pass.mjs --all --yes --out codes.csv
   ```

   It is not a way to hand out passes and has no override flag. Ziina must report
   the intent `completed`, the amount must cover the price, the replacement is
   anchored to the ORIGINAL purchase (so reissuing cannot extend a window or make
   a $9 sale a lifetime pass), a lapsed pass is refused rather than resurrected,
   and the chips it re-grants are keyed per intent so running it twice cannot pay
   twice. Send each customer their own code; they paste it into the pass sheet
   under "restore".
3. **The Fish key has EXPIRED** (`FISH_API_KEY` → "Token expired"). Fish is the
   fallback when ElevenLabs can't answer — with it dead, an ElevenLabs outage
   means silence (logged as `[tts] fish rejected the key`). Log in at fish.audio → API keys → new key →
   `vercel env add FISH_API_KEY production` → redeploy. The savings start the
   moment it lands; nothing else needs to change.
   Also: `XAI_API_KEY` is dead per the chat logs ("Incorrect API key"). `FAL_KEY`,
   `GROQ_API_KEY` and the LLM vars are *sensitive* in Vercel, so `vercel env pull`
   returns a placeholder for them — they can't be verified from a laptop, only from
   the logs (Groq answers speech recognition in production, so it is fine).
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

Voice tiers (2026-09-04): EVERYONE hears the same premium engine (ElevenLabs);
free is not a downgrade. What differs is the meter. A free caller gets ONE minute
of a call (`FREE_VOICE_CHARS`, default 400 characters of speech), counted on the
server by browser id (for life) and by IP (`FREE_IP_DAILY_CHARS`, ~10 minutes a
day) — so clearing the browser doesn't refill it. A pass is verified by its
signed token on every chunk and metered in `pass_usage` (700 characters per pass
minute, `PASS_CHARS_PER_MINUTE`), with the 240 min/day cap enforced server-side.
Past the allowance the route answers 402 and the call screen opens the pass sheet
with the reason (`X-Free` / `X-Pass`). Every voice response carries `X-TTS-Tier`.
Fish is the fallback only, for when ElevenLabs can't answer. Kloom is untouched.

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

## A pass for your own phone (no payment)

    AIRRAW_PRO_SECRET=… node db/owner-pass.mjs --days 7

Prints a restore code signed with the live secret. Paste it into "already
paid? restore it" on the pass sheet. Restore now checks with the server
first, so a code signed with any other secret is refused at the box.

## The room's hour loops — warm once, not daily

TheRoom seeds its cast with roomSeed() (lib/airroom/roster.ts): the hour maps
onto one of 24 slots counted from CAST_EPOCH_HOUR, so the set of faces the
room can ask for is finite and already in storage. `db/warm-faces.mjs
--dry-run` should report every face already there. Re-warm only after a
prompt change (the fingerprint moves), and never move the epoch without
re-warming: the 24 hours from it ARE the loop.

## In-app browsers

Most ad visitors arrive inside the Facebook / Instagram webview, which
mostly cannot open a mic. The lobby shows a one-line bar there (Android: a
link that opens Chrome; iOS: the ⋯ → open in browser instruction). Events:
`inapp_shown`, `inapp_open_tap` — in Vercel Web Analytics alongside the rest
of the funnel, which track() now also sends there.
