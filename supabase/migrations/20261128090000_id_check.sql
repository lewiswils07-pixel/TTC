-- Part 28 (Lewis, 18 Oct): ID check. Members prove they are who they say
-- with a photo ID and a selfie, through Didit (didit.me). Didit holds the
-- pictures; we only keep each check's status and the date a member passed.
-- The app's server (app/functions/api/id-check) is the only thing that can
-- record a check: it signs in with the service_role key, which never
-- reaches a phone.

-- 1 ----------------------------------------------------------------------
-- One row per check a member starts.
create table private.id_checks (
  session_id  text primary key check (char_length(session_id) <= 100),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'Not Started' check (char_length(status) <= 40),
  created_at  timestamptz not null default clock_timestamp(),
  updated_at  timestamptz not null default now()
);
create index id_checks_profile on private.id_checks (profile_id, created_at desc);
alter table private.id_checks enable row level security;

-- 2 ----------------------------------------------------------------------
-- Tries: 3 checks in 30 days, so a stuck member can retry but nobody can
-- run up the bill. This is the only place the number lives.
create function private.id_check_tries_left(member uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select greatest(0, 3 - count(*)::int)
  from private.id_checks
  where profile_id = member and created_at > now() - interval '30 days'
$$;

-- 'ok', 'verified' (already passed) or 'limit' (no tries left).
create function public.id_check_allowed(member uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select id_verified_at from public.profiles where id = member and status = 'active') is not null then 'verified'
    when not exists (select 1 from public.profiles where id = member and status = 'active') then 'limit'
    when private.id_check_tries_left(member) = 0 then 'limit'
    else 'ok'
  end
$$;

create function public.id_check_start(member uuid, session text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.id_checks (session_id, profile_id) values (session, member)
  on conflict (session_id) do nothing
$$;

create function public.id_check_owner(session text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select profile_id from private.id_checks where session_id = session $$;

-- Saves Didit's answer. 'Approved' marks the member as ID checked.
create function public.id_check_result(session text, new_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member uuid;
begin
  update private.id_checks set status = left(new_status, 40), updated_at = now()
  where session_id = session
  returning profile_id into member;
  if member is not null and new_status = 'Approved' then
    update public.profiles set id_verified_at = coalesce(id_verified_at, now()) where id = member;
  end if;
end
$$;

revoke all on function private.id_check_tries_left(uuid) from public, anon, authenticated;
revoke all on function public.id_check_allowed(uuid) from public, anon, authenticated;
revoke all on function public.id_check_start(uuid, text) from public, anon, authenticated;
revoke all on function public.id_check_owner(text) from public, anon, authenticated;
revoke all on function public.id_check_result(text, text) from public, anon, authenticated;
grant execute on function public.id_check_allowed(uuid) to service_role;
grant execute on function public.id_check_start(uuid, text) to service_role;
grant execute on function public.id_check_owner(text) to service_role;
grant execute on function public.id_check_result(text, text) to service_role;

-- 3 ----------------------------------------------------------------------
-- For the member's own Profile: passed when, the latest check, tries left.
create function public.my_id_check()
returns table (verified_at timestamptz, status text, tries_left integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id_verified_at,
         (select c.status from private.id_checks c where c.profile_id = p.id order by c.created_at desc limit 1),
         private.id_check_tries_left(p.id)
  from public.profiles p
  where p.id = auth.uid()
$$;

-- Which of these members have passed, for the "ID checked" tick on cards.
create function public.id_checked(ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p
  where p.id = any (ids[1:200]) and p.id_verified_at is not null and p.status = 'active'
$$;

revoke all on function public.my_id_check() from public, anon;
revoke all on function public.id_checked(uuid[]) from public, anon;
grant execute on function public.my_id_check() to authenticated;
grant execute on function public.id_checked(uuid[]) to authenticated;
