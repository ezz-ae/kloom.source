-- AIRRAW chips — the wallet behind the one unit the product is priced in.
-- Run ONCE in the Supabase SQL editor (Dashboard → SQL). Server-only, like
-- pass_usage.sql: no policies, service role bypasses RLS.
--
-- WHY A LEDGER AND NOT A COUNTER. Chips are bought with real money, so every
-- movement has to survive the two things that actually happen in production: a
-- payment webhook delivered twice, and a client retrying a spend it never saw the
-- answer to. Both are the same bug — applying one event more than once — and a
-- bare counter cannot tell a duplicate from a genuine second event. So every move
-- carries a caller-chosen event id, the ledger holds it as a primary key, and a
-- replay is detected rather than applied. The wallet row is the running total; the
-- ledger is the truth that total can be rebuilt from.

create table if not exists public.chip_wallet (
  purse        text primary key,            -- sha256 of the signed purse token (32 hex)
  balance      bigint not null default 0,   -- spendable now
  lifetime_in  bigint not null default 0,   -- everything ever granted (bought + earned)
  lifetime_out bigint not null default 0,   -- everything ever spent
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.chip_ledger (
  event   text primary key,                 -- caller's idempotency key, e.g. 'buy:<intent>'
  purse   text not null,
  delta   bigint not null,                  -- + granted, − spent
  reason  text not null,                    -- 'buy' | 'pass' | 'daily' | 'referral' | 'voice' | 'photo' | …
  balance bigint not null,                  -- balance AFTER this move, so history is auditable
  at      timestamptz not null default now()
);

create index if not exists chip_ledger_purse_at on public.chip_ledger (purse, at desc);

alter table public.chip_wallet enable row level security;
alter table public.chip_ledger enable row level security;

-- One atomic move. Locks the wallet, refuses an overdraft, records the ledger row
-- and the resulting balance together. Returns {ok, balance, replay, reason?}.
--
-- `replay` is not an error: it means this exact event was already applied, and the
-- balance returned is the one it produced. A webhook that fires three times and a
-- client that retries a spend both land here and both get the same answer, which
-- is the whole point.
create or replace function public.chips_move(
  p_purse  text,
  p_delta  bigint,
  p_reason text,
  p_event  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  w    public.chip_wallet%rowtype;
  prev public.chip_ledger%rowtype;
  next_balance bigint;
begin
  if p_purse is null or length(p_purse) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no-purse', 'balance', 0);
  end if;
  if p_event is null or length(p_event) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no-event', 'balance', 0);
  end if;

  -- Already applied? Hand back what it produced, untouched.
  select * into prev from public.chip_ledger where event = p_event;
  if found then
    return jsonb_build_object('ok', true, 'replay', true, 'balance', prev.balance, 'delta', 0);
  end if;

  insert into public.chip_wallet (purse) values (p_purse) on conflict (purse) do nothing;
  select * into w from public.chip_wallet where purse = p_purse for update;

  next_balance := w.balance + p_delta;
  if next_balance < 0 then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', w.balance);
  end if;

  update public.chip_wallet
     set balance      = next_balance,
         lifetime_in  = w.lifetime_in  + greatest(p_delta, 0),
         lifetime_out = w.lifetime_out + greatest(-p_delta, 0),
         updated_at   = now()
   where purse = p_purse;

  -- Inside the same transaction as the balance change, and the PK is the guard:
  -- two concurrent callers with one event id cannot both get past this line.
  insert into public.chip_ledger (event, purse, delta, reason, balance)
  values (p_event, p_purse, p_delta, p_reason, next_balance);

  return jsonb_build_object('ok', true, 'replay', false, 'balance', next_balance, 'delta', p_delta);
exception
  when unique_violation then
    -- Lost a race on the same event id. The winner applied it; report their result.
    select * into prev from public.chip_ledger where event = p_event;
    return jsonb_build_object('ok', true, 'replay', true, 'balance', coalesce(prev.balance, 0), 'delta', 0);
end
$$;

-- Read-only: balance plus enough history to show someone where their chips went.
create or replace function public.chips_state(p_purse text, p_limit int default 12)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  w       public.chip_wallet%rowtype;
  history jsonb;
begin
  select * into w from public.chip_wallet where purse = p_purse;
  if not found then
    return jsonb_build_object('balance', 0, 'lifetime_in', 0, 'lifetime_out', 0, 'history', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(x order by x.at desc), '[]'::jsonb) into history
    from (
      select delta, reason, at from public.chip_ledger
       where purse = p_purse order by at desc limit greatest(1, least(p_limit, 50))
    ) x;
  return jsonb_build_object(
    'balance', w.balance, 'lifetime_in', w.lifetime_in,
    'lifetime_out', w.lifetime_out, 'history', history
  );
end
$$;

revoke all on function public.chips_move(text, bigint, text, text) from public, anon, authenticated;
revoke all on function public.chips_state(text, int)              from public, anon, authenticated;
grant execute on function public.chips_move(text, bigint, text, text) to service_role;
grant execute on function public.chips_state(text, int)               to service_role;
