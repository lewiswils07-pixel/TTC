-- safety: block and report (spec §3, §6.3, §6.4). A block hides two
-- members from each other everywhere, straight away, and ends anything
-- open between them. Reports go to Lewis; 3 open reports from different
-- members pause the reported member's requests until he reviews them.
--
-- Not yet here: reporting a message or a group (they arrive with chat
-- and groups) and the /admin review page. Until then Lewis reviews
-- reports in the Supabase table editor.

create table public.blocks (
  blocker_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;
-- Members see who they blocked, never who blocked them.
create policy "Members read their own blocks" on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));
revoke all on public.blocks from anon, authenticated;
grant select on public.blocks to authenticated;

create table public.reports (
  id                  bigint generated always as identity primary key,
  reporter_id         uuid not null references public.profiles (id) on delete cascade,
  subject_profile_id  uuid not null references public.profiles (id) on delete cascade,
  reason              text not null check (reason in ('fake_profile', 'asking_for_money', 'harassment', 'inappropriate', 'feels_unsafe', 'other')),
  details             text check (char_length(details) <= 1000),
  status              text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at          timestamptz not null default now(),
  reviewed_at         timestamptz,
  check (reporter_id <> subject_profile_id)
);
-- One open report per member about the same person.
create unique index reports_one_open_idx on public.reports (reporter_id, subject_profile_id) where status = 'open';
create index reports_subject_idx on public.reports (subject_profile_id, status);

-- Reports are for Lewis only: members can't read them back, even their own.
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

create or replace function public.blocked_with(member uuid)
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select array(
    select blocked_id from public.blocks where blocker_id = member
    union
    select blocker_id from public.blocks where blocked_id = member
  )
$$;

-- Counting different reporters, so one person can't pause someone alone.
create or replace function public.requests_paused(member uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select count(distinct reporter_id) >= 3 from public.reports
  where subject_profile_id = member and status = 'open'
$$;

-- Block someone. They aren't told. Any request or connection between
-- the two ends, and neither appears in the other's suggestions again.
create function public.block_member(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_id = me or not exists (select 1 from public.profiles where id = p_id) then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (me, p_id) on conflict do nothing;
  update public.connections
     set status = 'ended', responded_at = now()
   where status in ('pending', 'accepted')
     and least(requester_id, addressee_id) = least(me, p_id)
     and greatest(requester_id, addressee_id) = greatest(me, p_id);
end;
$$;

-- Unblocking makes both visible again; it doesn't bring back what ended.
create function public.unblock_member(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_id $$;

-- The members I've blocked, so I can unblock them.
create function public.my_blocks()
returns table (profile_id uuid, display_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
$$;

-- Report someone. A second report about the same person, while the first
-- is still open, updates it rather than adding another.
create function public.report_member(p_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_id = me or not exists (select 1 from public.profiles where id = p_id) then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  insert into public.reports (reporter_id, subject_profile_id, reason, details)
  values (me, p_id, p_reason, nullif(btrim(p_details), ''))
  on conflict (reporter_id, subject_profile_id) where status = 'open'
  do update set reason = excluded.reason,
                details = coalesce(excluded.details, public.reports.details),
                created_at = now();
end;
$$;

revoke all on function public.block_member(uuid) from public, anon;
revoke all on function public.unblock_member(uuid) from public, anon;
revoke all on function public.my_blocks() from public, anon;
revoke all on function public.report_member(uuid, text, text) from public, anon;
grant execute on function public.block_member(uuid) to authenticated;
grant execute on function public.unblock_member(uuid) to authenticated;
grant execute on function public.my_blocks() to authenticated;
grant execute on function public.report_member(uuid, text, text) to authenticated;
