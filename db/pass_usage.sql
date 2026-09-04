-- AIRRAW pass metering. Run ONCE in the Supabase SQL editor (Dashboard → SQL).
--
-- Counts the premium characters each pass has spoken, keyed on a hash of the
-- signed pass token, so the allowance can't be reset by clearing a browser.
-- Called only by the server (service role) through lib/airraw/pass-meter.ts.
-- Until this exists the server logs a warning and lets pass holders through
-- unmetered — free visitors are on the cheap engine regardless.

create table if not exists public.pass_usage (
  key        text primary key,            -- sha256 of the signed pass token (32 hex)
  chars      bigint not null default 0,   -- premium characters spoken, lifetime
  day        text   not null default '',  -- UTC day the daily counter belongs to
  day_chars  bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No policies on purpose: anon and authenticated can neither read nor write.
-- The service role (server only) bypasses RLS.
alter table public.pass_usage enable row level security;

-- One atomic spend: lock the row, roll the day if needed, refuse past either
-- cap, otherwise add. Returns {ok, reason?, used}.
create or replace function public.pass_spend(p_key text, p_chars bigint, p_cap bigint, p_day_cap bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r     public.pass_usage%rowtype;
  today text := to_char(now() at time zone 'utc', 'YYYY-MM-DD');
begin
  insert into public.pass_usage (key) values (p_key) on conflict (key) do nothing;
  select * into r from public.pass_usage where key = p_key for update;
  if r.day <> today then
    r.day := today;
    r.day_chars := 0;
  end if;
  if r.chars + p_chars > p_cap then
    update public.pass_usage set day = r.day, day_chars = r.day_chars, updated_at = now() where key = p_key;
    return jsonb_build_object('ok', false, 'reason', 'exhausted', 'used', r.chars);
  end if;
  if r.day_chars + p_chars > p_day_cap then
    update public.pass_usage set day = r.day, day_chars = r.day_chars, updated_at = now() where key = p_key;
    return jsonb_build_object('ok', false, 'reason', 'daily-cap', 'used', r.chars);
  end if;
  update public.pass_usage
     set chars = r.chars + p_chars,
         day = r.day,
         day_chars = r.day_chars + p_chars,
         updated_at = now()
   where key = p_key;
  return jsonb_build_object('ok', true, 'used', r.chars + p_chars);
end
$$;

revoke all on function public.pass_spend(text, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.pass_spend(text, bigint, bigint, bigint) to service_role;
