-- safety: the /admin review page (spec §6.11). Admins (profiles.role =
-- 'admin') see open reports and flagged messages with their context, and
-- can dismiss, warn, suspend or remove a member. Every action is logged.
-- Members hear about a warning, suspension or removal through a notice on
-- their dashboard (email arrives with T18).
--
-- "Remove" closes the account here: the member is hidden everywhere and
-- can't send anything. Deleting the sign-in itself comes with T19.

create function public.is_admin(member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.profiles where id = member and role = 'admin') $$;

-- For the app: show the review page link?
create function public.i_am_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select public.is_admin(auth.uid()) $$;

create table public.moderation_actions (
  id                  bigint generated always as identity primary key,
  admin_id            uuid references public.profiles (id) on delete set null,
  subject_profile_id  uuid references public.profiles (id) on delete set null,
  action              text not null check (action in ('dismiss', 'warn', 'suspend', 'remove', 'reinstate')),
  report_id           bigint references public.reports (id) on delete set null,
  flag_id             bigint references public.message_flags (id) on delete set null,
  note                text check (char_length(note) <= 1000),
  created_at          timestamptz not null default now()
);
alter table public.moderation_actions enable row level security;
revoke all on public.moderation_actions from anon, authenticated;

-- Notices from the team, shown on the member's dashboard. Warnings and
-- "you're back" notices can be closed; a suspension shows while it lasts.
create table public.member_notices (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('warning', 'suspended', 'removed', 'reinstated')),
  body        text check (char_length(body) <= 1000),
  created_at  timestamptz not null default now(),
  seen_at     timestamptz
);
create index member_notices_profile_idx on public.member_notices (profile_id, created_at desc);
alter table public.member_notices enable row level security;
create policy "Members read their own notices" on public.member_notices
  for select to authenticated using (profile_id = (select auth.uid()));
revoke all on public.member_notices from anon, authenticated;
grant select on public.member_notices to authenticated;

create function public.dismiss_notice(p_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$ update public.member_notices set seen_at = now() where id = p_id and profile_id = auth.uid() and kind in ('warning', 'reinstated') $$;

-- A suspended or removed member can't send requests, accept them or send
-- messages. (They are already hidden from everyone else.)
create function public.require_active_sender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender uuid;
begin
  if tg_table_name = 'messages' then
    sender := new.sender_id;
  elsif tg_op = 'INSERT' then
    sender := new.requester_id;
  elsif new.status = 'accepted' then
    sender := new.addressee_id;
  else
    return new;
  end if;
  if exists (select 1 from public.profiles where id = sender and status <> 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.require_active_sender() from public, anon, authenticated;

create trigger messages_require_active before insert on public.messages
  for each row execute function public.require_active_sender();
create trigger connections_require_active before insert or update of status on public.connections
  for each row execute function public.require_active_sender();

-- Open reports and flagged messages, oldest first, with what's needed to decide.
create function public.admin_queue()
returns table (
  kind             text,
  id               bigint,
  created_at       timestamptz,
  subject_id       uuid,
  subject_name     text,
  subject_status   text,
  subject_joined   timestamptz,
  reporter_name    text,
  reasons          text[],
  details          text,
  message_body     text,
  open_reports     integer,
  past_actions     integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  with items as (
    select 'report'::text as kind, r.id, r.created_at, r.subject_profile_id as subject_id,
           rp.display_name as reporter_name, array[r.reason] as reasons, r.details, r.message_body
    from public.reports r
    left join public.profiles rp on rp.id = r.reporter_id
    where r.status = 'open'
    union all
    select 'flag', f.id, f.created_at, f.sender_id, null, f.reasons, null, f.body
    from public.message_flags f
    where f.status = 'open'
  )
  select i.kind, i.id, i.created_at, i.subject_id, s.display_name, s.status, s.created_at,
         i.reporter_name, i.reasons, i.details, i.message_body,
         (select count(*)::int from public.reports r where r.subject_profile_id = i.subject_id and r.status = 'open'),
         (select count(*)::int from public.moderation_actions a where a.subject_profile_id = i.subject_id and a.action <> 'dismiss')
  from items i
  left join public.profiles s on s.id = i.subject_id
  order by i.created_at, i.kind, i.id;
end;
$$;

-- Members who are suspended or removed, so they can be reinstated.
create function public.admin_paused_members()
returns table (profile_id uuid, display_name text, status text, since timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select p.id, p.display_name, p.status,
         (select max(a.created_at) from public.moderation_actions a where a.subject_profile_id = p.id)
  from public.profiles p
  where p.status in ('suspended', 'deleted')
  order by 4 desc nulls last;
end;
$$;

-- The latest 100 actions.
create function public.admin_log()
returns table (id bigint, created_at timestamptz, admin_name text, subject_name text, action text, note text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select a.id, a.created_at, ad.display_name, s.display_name, a.action, a.note
  from public.moderation_actions a
  left join public.profiles ad on ad.id = a.admin_id
  left join public.profiles s on s.id = a.subject_profile_id
  order by a.id desc
  limit 100;
end;
$$;

-- Act on a report ('report'), a flagged message ('flag') or a member
-- ('member', for reinstating). Dismiss closes that one item. Warn, suspend
-- and remove close every open report and flag about the member, which also
-- lifts the automatic pause on requests.
create function public.admin_act(p_kind text, p_id text, p_action text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := auth.uid();
  subject  uuid;
  report   bigint;
  flag     bigint;
  note     text := nullif(btrim(p_note), '');
begin
  if not public.is_admin(me) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_kind = 'report' then
    select r.subject_profile_id, r.id into subject, report from public.reports r where r.id = p_id::bigint;
  elsif p_kind = 'flag' then
    select f.sender_id, f.id into subject, flag from public.message_flags f where f.id = p_id::bigint;
  elsif p_kind = 'member' then
    select p.id into subject from public.profiles p where p.id = p_id::uuid;
  end if;
  if subject is null and p_kind <> 'flag' or (p_kind = 'flag' and flag is null) then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;
  if p_action not in ('dismiss', 'warn', 'suspend', 'remove', 'reinstate')
     or (p_action = 'reinstate') <> (p_kind = 'member')
     or (p_action <> 'dismiss' and subject is null) then
    raise exception 'That action isn''t possible here' using errcode = 'check_violation';
  end if;
  if subject = me and p_action <> 'dismiss' then
    raise exception 'That action isn''t possible here' using errcode = 'check_violation';
  end if;

  if p_action = 'dismiss' then
    update public.reports set status = 'dismissed', reviewed_at = now() where id = report;
    update public.message_flags set status = 'dismissed', reviewed_at = now() where id = flag;
  else
    update public.reports set status = 'actioned', reviewed_at = now()
     where subject_profile_id = subject and status = 'open';
    update public.message_flags set status = 'actioned', reviewed_at = now()
     where sender_id = subject and status = 'open';
  end if;

  if p_action = 'warn' then
    insert into public.member_notices (profile_id, kind, body) values (subject, 'warning', note);
  elsif p_action in ('suspend', 'remove') then
    update public.profiles set status = case when p_action = 'suspend' then 'suspended' else 'deleted' end where id = subject;
    -- Anything open with them ends, as with a block.
    update public.connections set status = 'ended', responded_at = now()
     where status in ('pending', 'accepted') and subject in (requester_id, addressee_id);
    insert into public.member_notices (profile_id, kind, body)
    values (subject, case when p_action = 'suspend' then 'suspended' else 'removed' end, note);
  elsif p_action = 'reinstate' then
    update public.profiles set status = 'active' where id = subject;
    update public.member_notices set seen_at = now() where profile_id = subject and seen_at is null;
    insert into public.member_notices (profile_id, kind, body) values (subject, 'reinstated', note);
  end if;

  insert into public.moderation_actions (admin_id, subject_profile_id, action, report_id, flag_id, note)
  values (me, subject, p_action, report, flag, note);
end;
$$;

revoke all on function public.is_admin(uuid) from public, anon, authenticated;
revoke all on function public.i_am_admin() from public, anon;
revoke all on function public.dismiss_notice(bigint) from public, anon;
revoke all on function public.admin_queue() from public, anon;
revoke all on function public.admin_paused_members() from public, anon;
revoke all on function public.admin_log() from public, anon;
revoke all on function public.admin_act(text, text, text, text) from public, anon;
grant execute on function public.i_am_admin() to authenticated;
grant execute on function public.dismiss_notice(bigint) to authenticated;
grant execute on function public.admin_queue() to authenticated;
grant execute on function public.admin_paused_members() to authenticated;
grant execute on function public.admin_log() to authenticated;
grant execute on function public.admin_act(text, text, text, text) to authenticated;
