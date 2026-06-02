-- ════════════════════════════════════════════════════════════════════════════
--  KLOOM / ORA — full Supabase setup (run once on a fresh project)
--  Paste this whole file into:  Supabase Dashboard → SQL Editor → New query → Run
--  Safe to re-run (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Credit balances (one row per wallet) ─────────────────────────────────
create table if not exists public.bloom_credits (
  wallet_address text primary key,
  balance        integer not null default 0,
  updated_at     timestamptz not null default now()
);

-- ── 2. Transaction ledger (idempotency by tx_sig) ───────────────────────────
create table if not exists public.bloom_transactions (
  id             bigint generated always as identity primary key,
  tx_sig         text unique not null,
  wallet_address text not null,
  credits        integer not null default 0,
  amount_sol     numeric not null default 0,
  kind           text not null default 'purchase',
  created_at     timestamptz not null default now()
);
create index if not exists bloom_tx_wallet_idx on public.bloom_transactions (wallet_address);

-- ── 3. credit_wallet() — the ONLY way credits move. SECURITY DEFINER so it can
--       be locked to the server (service_role) and never minted from a browser. ──
create or replace function public.credit_wallet(
  p_wallet     text,
  p_credits    integer,
  p_tx_sig     text,
  p_amount_sol numeric,
  p_kind       text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  -- Same transaction signature twice = no-op (idempotent webhooks/captures).
  if exists (select 1 from public.bloom_transactions where tx_sig = p_tx_sig) then
    return jsonb_build_object('error', 'duplicate_tx');
  end if;

  insert into public.bloom_transactions (tx_sig, wallet_address, credits, amount_sol, kind)
  values (p_tx_sig, p_wallet, coalesce(p_credits, 0), coalesce(p_amount_sol, 0), coalesce(p_kind, 'purchase'));

  insert into public.bloom_credits (wallet_address, balance, updated_at)
  values (p_wallet, greatest(0, coalesce(p_credits, 0)), now())
  on conflict (wallet_address) do update
    set balance    = greatest(0, public.bloom_credits.balance + coalesce(p_credits, 0)),
        updated_at = now()
  returning balance into v_balance;

  return jsonb_build_object('ok', true, 'balance', v_balance);
end;
$$;

-- ── 4. Subscriptions / premium tiers (Unrestricted $10, Creator, unlimited) ──
create table if not exists public.bloom_subscriptions (
  wallet              text primary key,
  plan                text not null,
  status              text not null default 'active',   -- active | cancelled | expired | paused
  ls_subscription_id  text,
  ls_customer_id      text,
  renews_at           timestamptz,
  updated_at          timestamptz not null default now()
);
create index if not exists bloom_subscriptions_ls_id_idx on public.bloom_subscriptions (ls_subscription_id);

-- ── 5. Ziina payment intent → wallet mapping (Ziina has no metadata field) ──
create table if not exists public.ziina_payments (
  id          text primary key,
  wallet      text not null,
  credits     integer not null default 0,
  kind        text not null default 'purchase',
  amount      numeric,
  currency    text,
  status      text not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── 6. Row Level Security ───────────────────────────────────────────────────
alter table public.bloom_credits        enable row level security;
alter table public.bloom_transactions   enable row level security;
alter table public.bloom_subscriptions  enable row level security;
alter table public.ziina_payments       enable row level security;

-- Public can READ balances + subscriptions (needed by /api/account-status). All
-- WRITES go only through credit_wallet() (definer) or the service_role key.
drop policy if exists "public read credits" on public.bloom_credits;
create policy "public read credits" on public.bloom_credits for select using (true);

drop policy if exists "public read subscriptions" on public.bloom_subscriptions;
create policy "public read subscriptions" on public.bloom_subscriptions for select using (true);

drop policy if exists "service role all subscriptions" on public.bloom_subscriptions;
create policy "service role all subscriptions" on public.bloom_subscriptions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role all ziina" on public.ziina_payments;
create policy "service role all ziina" on public.ziina_payments
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
-- (bloom_transactions has RLS on with no policies → no anon access at all. Good.)

-- ── 7. SECURITY LOCKDOWN — credits can only be minted server-side ───────────
revoke execute on function public.credit_wallet(text, integer, text, numeric, text) from anon, authenticated, public;
grant  execute on function public.credit_wallet(text, integer, text, numeric, text) to   service_role;

-- ✅ Done. Verify:
--   select coalesce(string_agg(grantee::text, ', ' order by grantee), '(none)')
--   from information_schema.routine_privileges
--   where routine_name='credit_wallet' and privilege_type='EXECUTE';
--   → should be exactly: postgres, service_role
