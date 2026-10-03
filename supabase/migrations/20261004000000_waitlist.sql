-- Founding-member waitlist for the sign-up form on the marketing site,
-- plus a tiny keepalive() function the scheduled GitHub Action calls so the
-- free Supabase project isn't paused for inactivity.
--
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again.

create table if not exists public.waitlist (
  id          bigint generated always as identity primary key,
  first_name  text not null check (char_length(first_name) between 1 and 80),
  email       text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  home        text check (char_length(home) <= 120),
  source      text not null default 'website' check (char_length(source) <= 40),
  created_at  timestamptz not null default now()
);

create unique index if not exists waitlist_email_key on public.waitlist (lower(email));

-- Row-level security: the public (anon) key may add a row and nothing else.
-- With no select/update/delete policy, nobody can read the list through the
-- API; you see it in the dashboard's Table Editor.
alter table public.waitlist enable row level security;

drop policy if exists "Anyone can join the waitlist" on public.waitlist;
create policy "Anyone can join the waitlist"
  on public.waitlist for insert
  to anon, authenticated
  with check (true);

revoke all on public.waitlist from anon, authenticated;
grant insert (first_name, email, home, source) on public.waitlist to anon, authenticated;

-- Keep-awake ping: touches the database without revealing anything.
create or replace function public.keepalive()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.waitlist limit 1;
  return 'ok';
end;
$$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon;
