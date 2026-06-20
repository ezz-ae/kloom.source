-- AIRRAW lead capture — run once against the app's Supabase project.
-- Anon visitors can RECORD a lead (via the writer function) but can never READ
-- the list (no SELECT policy). Reads happen from the dashboard / service role.

create table if not exists public.airraw_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  created_at timestamptz not null default now()
);

alter table public.airraw_leads enable row level security;
-- No SELECT/INSERT policy for anon on the table itself: all writes go through the
-- SECURITY DEFINER function below, all reads require the service role.

-- Writer: SECURITY DEFINER so it bypasses RLS for just this insert. This avoids
-- the RETURNING/RLS trap (supabase-js requesting the row back needs SELECT) and
-- keeps the table unreadable by anon.
create or replace function public.add_airraw_lead(p_email text, p_source text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.airraw_leads (email, source)
  values (lower(trim(p_email)), nullif(trim(p_source), ''))
  on conflict (email) do nothing;
$$;

revoke all on function public.add_airraw_lead(text, text) from public;
grant execute on function public.add_airraw_lead(text, text) to anon, authenticated;

-- PostgREST picks up new functions only after a schema reload:
notify pgrst, 'reload schema';
