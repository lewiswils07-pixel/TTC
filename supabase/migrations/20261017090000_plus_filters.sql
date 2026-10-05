-- Sodalis+ filters and limits (spec §3, §4.1, §5). Members on Sodalis+
-- can narrow suggestions to verified members, or by travel style, pace and
-- budget, and get up to 50 requests a week (fair use). The check is made
-- here, on the server: a free member's saved Sodalis+ filters are simply
-- ignored, so nothing breaks if a plan lapses.
--
-- entitlements is written only by server-side code (the payment webhooks
-- in T26 and T27, or by hand in the table editor for testers).

create table public.entitlements (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  plan        text not null default 'free' check (plan in ('free', 'plus')),
  source      text check (source in ('stripe', 'apple', 'google', 'founding', 'manual')),
  expires_at  timestamptz,
  updated_at  timestamptz not null default now()
);

alter table public.entitlements enable row level security;
create policy "Members read their own plan" on public.entitlements
  for select to authenticated
  using (profile_id = (select auth.uid()));
revoke all on public.entitlements from anon, authenticated;
grant select on public.entitlements to authenticated;

create or replace function public.has_plus(member uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.entitlements e
    where e.profile_id = member and e.plan = 'plus' and (e.expires_at is null or e.expires_at > now())
  )
$$;

-- For the app: is the signed-in member on Sodalis+ right now?
create function public.i_have_plus()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select public.has_plus(auth.uid()) $$;

create or replace function public.weekly_request_limit(member uuid)
returns integer
language sql
stable
set search_path = ''
as $$ select case when public.has_plus(member) then 50 else 5 end $$;

-- Empty lists mean "any". Members who haven't set a style, pace or budget
-- are left out once the viewer filters on it.
create or replace function public.passes_viewer_filters(prefs public.preferences, plus boolean, p public.profiles)
returns boolean
language sql
stable
set search_path = ''
as $$
  select not plus
      or ((not prefs.verified_only or p.id_verified_at is not null)
          and (cardinality(prefs.styles) = 0 or p.travel_style = any (prefs.styles))
          and (cardinality(prefs.paces) = 0 or p.pace = any (prefs.paces))
          and (cardinality(prefs.budgets) = 0 or p.budget = any (prefs.budgets)))
$$;

revoke all on function public.i_have_plus() from public, anon;
grant execute on function public.i_have_plus() to authenticated;
