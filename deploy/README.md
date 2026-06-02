# Deploying Ora

Three processes: **web** (Next.js), **mcp** (tools/prompts server), and the **LLM**
(Ollama, or a hosted endpoint). The MCP server and Ollama are never exposed
publicly — only nginx is. Pick **Option A** (Docker, simplest) or **B** (bare VPS).

---

## 0. Before anything — close the credit exploit

✅ **Already applied** to the live Supabase project (migration `lock_down_credit_wallet_v2`).
`credit_wallet` execute is now revoked from `anon`/`authenticated`/`public` (only
`service_role` + `postgres` can run it), and the `bloom_credits`/`bloom_transactions`
RLS write policies require `service_role`. The browser can read balances but cannot
mint or write credits. Crediting/spending go through `/api/verify-payment` and
`/api/spend` (server-side, service-role only).

If you ever recreate the function or move to a new project, re-run:

```sql
revoke execute on function credit_wallet(text,integer,text,numeric,text) from anon, authenticated, public;
grant  execute on function credit_wallet(text,integer,text,numeric,text) to service_role;
```

**You must still set** `SUPABASE_SERVICE_ROLE_KEY` in your env (Settings → API →
service_role). Until it's set, `/api/spend` and `/api/verify-payment` return 503
(`admin_unconfigured`) — credits won't persist, but nothing is exploitable.

---

## Option A — Docker (recommended)

Requirements: a VPS with Docker + Docker Compose. A GPU (24GB VRAM) if you want
local 8B models; otherwise leave Ollama on CPU (slow) or use Claude/Gemini/hosted.

```bash
git clone <repo> /opt/ora && cd /opt/ora/deploy
cp .env.production.example .env.production    # fill in secrets
mkdir certs                                   # drop fullchain.pem + privkey.pem here
#   (get certs: certbot certonly --standalone -d your-domain.com)

docker compose --env-file .env.production up -d --build

# pull the model into the ollama volume (once):
docker compose exec ollama ollama pull hf.co/bartowski/L3-8B-Stheno-v3.2-GGUF:Q4_K_M
```

App is live at `https://your-domain`. To enable GPU, uncomment the `deploy:`
block under `ollama` in docker-compose.yml (needs the NVIDIA container toolkit).

Logs: `docker compose logs -f web mcp`  · Update: `git pull && docker compose up -d --build`

---

## Option B — bare VPS (pm2 or systemd)

```bash
# Node 22 + pnpm + Ollama installed; clone to /opt/ora
cd /opt/ora
cp deploy/.env.production.example .env.local   # fill secrets
pnpm install && pnpm build      # builds web + mcp + copies static into standalone
ollama pull <your model>                        # systemctl enable --now ollama

# IMPORTANT: this app uses Next `output: "standalone"`, so the web server is
# `.next/standalone/server.js` (NOT `next start`). The pm2/systemd configs and
# `pnpm start` already launch it via deploy/start-web.js, which loads .env.local.

# pm2:
pm2 start deploy/ecosystem.config.js && pm2 save && pm2 startup

# OR systemd:
sudo cp deploy/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ora-mcp ora-web
```

Put nginx (deploy/nginx.conf) in front for TLS, proxying `:3000`.
In `.env.local` set `MCP_SERVER_URL=http://127.0.0.1:3001/mcp` and
`LLM_BASE_URL=http://127.0.0.1:11434/v1`.

---

## Option C — Next on Vercel + GPU VPS for models

Deploy the repo to Vercel (it builds standalone fine). Run **only** Ollama + the
MCP server on a GPU VPS behind TLS. In Vercel env set:
`LLM_BASE_URL=https://your-vps/v1`, `MCP_SERVER_URL=https://your-vps/mcp`, and all
secrets. Cheapest path if you'd rather not self-host the web tier.

---

## PayPal (primary card method — embedded, no buyer login)

Cards are taken **inside the app UI** via PayPal Advanced Card Fields (ACDC) using
**your** PayPal business account — the buyer never logs into PayPal.

**1. Credentials** → developer.paypal.com → Apps & Credentials → your Live app:
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (client id) · `PAYPAL_CLIENT_SECRET` (secret) · `PAYPAL_ENV=live`
- Enable **"Advanced Credit and Debit Card Payments"** on the account for inline card
  fields. If it isn't enabled/eligible, the component automatically falls back to the
  PayPal button (still card-capable, no extra setup).

**2. No products, no webhook required.** `/api/paypal/create-order` makes a one-time
USD order with the buyer's wallet packed into `custom_id`; the client collects the
card inline; `/api/paypal/capture-order` captures **server-side with your credentials
(authoritative)** and credits the wallet via the server-only `credit_wallet` path.
Idempotent (`tx_sig = paypal_<captureId>`). Premium plans + the $60 pass become
30-day rows in `bloom_subscriptions`. The client reads real status from
`/api/account-status?wallet=…`.

> PayPal orders are one-time; "subscriptions" are 30-day passes (same as Ziina).

---

## Ziina (UAE card gateway — dormant fallback)

Ziina (https://docs.ziina.com) hosts the card / Apple Pay checkout. No products to
create — we generate a payment intent per purchase and pass the amount.

**1. API token**
- Get a token at https://ziina.com/business/connect → set `ZIINA_API_KEY`
- Currency: Ziina charges **AED**. The app prices in USD and converts at the peg
  (`ZIINA_USD_RATE=3.6725`). If your account is USD, set `ZIINA_CURRENCY=USD` +
  `ZIINA_USD_RATE=1`. Use `ZIINA_TEST=1` to create non-charging test payments first.

**2. Webhook** → register once (Ziina `POST /webhook`) or via dashboard:
- URL: `https://your-domain/api/ziina-webhook`
- Secret: any random string → also set `ZIINA_WEBHOOK_SECRET`
- Event: `payment_intent.status.updated`

You can register it with curl:
```bash
curl -X POST https://api-v2.ziina.com/api/webhook \
  -H "Authorization: Bearer $ZIINA_API_KEY" -H "Content-Type: application/json" \
  -d '{"url":"https://your-domain/api/ziina-webhook","secret":"'$ZIINA_WEBHOOK_SECRET'"}'
```

**How it works:** Ziina has no metadata field, so `/api/ziina-checkout` saves the
intent→wallet mapping in `ziina_payments` (migration `create_ziina_payments`) and
returns the hosted-checkout URL. On `payment_intent.status.updated`, the webhook
**re-fetches the intent from Ziina** (authoritative — it never trusts the POST body),
and on `completed` credits packs via the server-only `credit_wallet` path and upserts
premium into `bloom_subscriptions`. Crediting is idempotent (`tx_sig = ziina_<id>`).
The client reads real premium status from `/api/account-status?wallet=…` on connect.

> Ziina payment intents are **one-time** (no native recurring). Credit packs and the
> $60 unlimited pass work natively; "subscriptions" are sold as one-time **30-day
> passes** (`renews_at = now + 30d`).

> **Until billing is live, `NEXT_PUBLIC_FREE_UNLIMITED=1`** keeps all voice
> unlimited and premium unlocked for everyone. Set it to `0` to switch billing on.

---

## Post-deploy checklist
- [x] `revoke` applied (migration `lock_down_credit_wallet_v2`) — verified
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` (required for credits to persist)
- [ ] Set `LLM_MODEL_UNCENSORED` (companions/adult personas use it; falls back to `LLM_MODEL`)
- [ ] Funded the treasury wallet (≥0.05 SOL) if minting $BLOOM
- [ ] Set `NEXT_PUBLIC_PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` (+ enable ACDC on the account)
- [ ] (optional) Ziina fallback: `ZIINA_API_KEY` + webhook → `https://your-domain/api/ziina-webhook`
- [ ] TURN creds set (Twilio) for reliable group voice on strict networks
- [ ] `FISH_API_KEY`, `ANTHROPIC_API_KEY`/`GEMINI_API_KEY`/`OPENAI_API_KEY` set
- [ ] Model pulled into Ollama
