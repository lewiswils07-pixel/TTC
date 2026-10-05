-- groups (spec §2 "Groups", §3, §5): a member makes a small group (up to 6
-- people) from their connections, tied to a destination and dates. Invited
-- connections choose to join. The group has its own chat. Anyone can leave;
-- the creator can remove people. Free members can have 1 active group of
-- their own, Sodalis+ members 3. Blocks still apply: blocked members can't
-- be invited or join, and inside a group they don't see each other's
-- messages.

create table public.groups (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  city_id     integer not null references public.cities (id),
  start_date  date not null,
  end_date    date not null,
  created_at  timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_date - start_date <= 90)
);
create index groups_owner_idx on public.groups (owner_id, end_date);

create table public.group_members (
  group_id    bigint not null references public.groups (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'member')),
  status      text not null default 'invited' check (status in ('invited', 'joined')),
  invited_by  uuid references public.profiles (id) on delete set null,
  joined_at   timestamptz,
  created_at  timestamptz not null default now(),
  primary key (group_id, profile_id)
);
create index group_members_profile_idx on public.group_members (profile_id);

-- Group chats are conversations too.
alter table public.conversations
  add column group_id bigint unique references public.groups (id) on delete cascade,
  drop constraint conversations_check,
  add constraint conversations_kind_link check (
    (kind = 'direct' and connection_id is not null and group_id is null)
    or (kind = 'group' and group_id is not null and connection_id is null));

-- Members read groups only through the functions below.
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
revoke all on public.groups, public.group_members from anon, authenticated;

-- In a group chat, a member doesn't see messages from someone they blocked
-- or who blocked them. (In a one-to-one chat a block ends the chat anyway.)
create function public.hidden_senders()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$ select public.blocked_with(auth.uid()) $$;
revoke all on function public.hidden_senders() from public, anon;
grant execute on function public.hidden_senders() to authenticated;

drop policy "Members read messages in their conversations" on public.messages;
create policy "Members read messages in their conversations" on public.messages
  for select to authenticated
  using (public.in_conversation(conversation_id)
         -- worked out once per query, not once per message
         and not (sender_id = any ('{}'::uuid[] || (select public.hidden_senders()))));

create function public.group_limit(member uuid)
returns integer
language sql
stable
set search_path = ''
as $$ select case when public.has_plus(member) then 3 else 1 end $$;

create function public.is_group_member(p_group bigint, member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.group_members
                 where group_id = p_group and profile_id = member and status = 'joined')
$$;

-- Checks shared by creating a group and inviting more people: each person
-- must be an accepted connection of mine, not blocked with anyone already
-- in the group, and the group stays at 6 people or fewer.
create function public.add_group_invites(p_group bigint, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := auth.uid();
  person uuid;
begin
  if (select count(*) from public.group_members where group_id = p_group)
     + (select count(distinct x) from unnest(p_ids) x
        where not exists (select 1 from public.group_members where group_id = p_group and profile_id = x)) > 6 then
    raise exception 'Groups can have up to 6 people' using errcode = 'check_violation';
  end if;
  foreach person in array coalesce(p_ids, '{}') loop
    if exists (select 1 from public.group_members where group_id = p_group and profile_id = person) then
      continue;
    end if;
    if not exists (
      select 1 from public.connections k
      where k.status = 'accepted'
        and ((k.requester_id = me and k.addressee_id = person) or (k.addressee_id = me and k.requester_id = person))
    ) or exists (
      select 1 from public.group_members gm
      where gm.group_id = p_group and public.is_blocked(person, gm.profile_id)
    ) or not exists (select 1 from public.profiles where id = person and status = 'active') then
      raise exception 'You can only invite people you''re connected with' using errcode = 'check_violation';
    end if;
    insert into public.group_members (group_id, profile_id, role, status, invited_by)
    values (p_group, person, 'member', 'invited', me);
  end loop;
end;
$$;
revoke all on function public.add_group_invites(bigint, uuid[]) from public, anon, authenticated;

create function public.create_group(p_name text, p_city_id integer, p_start date, p_end date, p_invite uuid[] default '{}')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := auth.uid();
  new_id bigint;
  conv   bigint;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = me and status <> 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  if p_end < current_date then
    raise exception 'This trip has already ended' using errcode = 'check_violation';
  end if;
  if p_start > current_date + interval '2 years' then
    raise exception 'Trips can be up to 2 years ahead' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.groups where owner_id = me and end_date >= current_date) >= public.group_limit(me) then
    raise exception 'Group limit reached' using errcode = 'check_violation';
  end if;
  insert into public.groups (name, owner_id, city_id, start_date, end_date)
  values (btrim(p_name), me, p_city_id, p_start, p_end)
  returning id into new_id;
  insert into public.group_members (group_id, profile_id, role, status, joined_at)
  values (new_id, me, 'owner', 'joined', now());
  insert into public.conversations (kind, group_id) values ('group', new_id) returning id into conv;
  insert into public.conversation_members (conversation_id, profile_id) values (conv, me);
  perform public.add_group_invites(new_id, p_invite);
  return new_id;
end;
$$;

create function public.invite_to_group(p_group bigint, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.groups where id = p_group and owner_id = auth.uid()) then
    raise exception 'Group not found' using errcode = 'P0002';
  end if;
  perform public.add_group_invites(p_group, p_ids);
end;
$$;

create function public.respond_to_group_invite(p_group bigint, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if not exists (select 1 from public.group_members where group_id = p_group and profile_id = me and status = 'invited') then
    raise exception 'Invite not found' using errcode = 'P0002';
  end if;
  if not p_accept then
    delete from public.group_members where group_id = p_group and profile_id = me;
    return;
  end if;
  if exists (select 1 from public.profiles where id = me and status <> 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  -- Someone joined since the invite who is blocked with me: the invite lapses.
  if exists (select 1 from public.group_members gm
             where gm.group_id = p_group and gm.status = 'joined' and public.is_blocked(me, gm.profile_id)) then
    delete from public.group_members where group_id = p_group and profile_id = me;
    raise exception 'This group isn''t available' using errcode = 'check_violation';
  end if;
  update public.group_members set status = 'joined', joined_at = now()
   where group_id = p_group and profile_id = me;
  insert into public.conversation_members (conversation_id, profile_id)
  select c.id, me from public.conversations c where c.group_id = p_group
  on conflict do nothing;
end;
$$;

-- Leave a group, or (as its creator) remove someone. When the creator
-- leaves, the longest-standing member takes over; an empty group closes.
create function public.leave_group(p_group bigint, p_member uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := auth.uid();
  target uuid := coalesce(p_member, auth.uid());
  owner  uuid;
  heir   uuid;
begin
  select g.owner_id into owner from public.groups g where g.id = p_group;
  if owner is null or not exists (select 1 from public.group_members where group_id = p_group and profile_id = target)
     or (target <> me and owner <> me) then
    raise exception 'Group not found' using errcode = 'P0002';
  end if;
  delete from public.group_members where group_id = p_group and profile_id = target;
  delete from public.conversation_members
   where profile_id = target and conversation_id = (select id from public.conversations where group_id = p_group);
  if target = owner then
    select gm.profile_id into heir from public.group_members gm
    where gm.group_id = p_group and gm.status = 'joined'
    order by gm.joined_at, gm.created_at limit 1;
    if heir is null then
      delete from public.groups where id = p_group;
    else
      update public.groups set owner_id = heir where id = p_group;
      update public.group_members set role = 'owner' where group_id = p_group and profile_id = heir;
    end if;
  end if;
end;
$$;

-- My groups and invites, soonest trip first. Groups whose trip ended over
-- 30 days ago drop off the list.
create function public.my_groups()
returns table (
  id              bigint,
  name            text,
  city            text,
  country_code    text,
  start_date      date,
  end_date        date,
  my_status       text,
  i_own           boolean,
  owner_name      text,
  members         integer,
  conversation_id bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, ci.name, ci.country_code::text, g.start_date, g.end_date, me.status, g.owner_id = auth.uid(),
         o.display_name,
         (select count(*)::int from public.group_members m where m.group_id = g.id and m.status = 'joined'),
         case when me.status = 'joined' then c.id end
  from public.group_members me
  join public.groups g on g.id = me.group_id
  join public.cities ci on ci.id = g.city_id
  join public.profiles o on o.id = g.owner_id
  left join public.conversations c on c.group_id = g.id
  where me.profile_id = auth.uid()
    and g.end_date >= current_date - 30
  order by me.status desc, g.start_date
$$;

-- How many more groups I can start right now.
create function public.groups_i_can_start()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(public.group_limit(auth.uid())
                  - (select count(*)::int from public.groups where owner_id = auth.uid() and end_date >= current_date), 0)
$$;

-- Everyone in a group (joined or invited), for its members and invitees,
-- leaving out anyone blocked with me.
create function public.group_people(p_group bigint)
returns table (profile_id uuid, display_name text, birth_year smallint, photo_path text, role text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.birth_year, p.photo_path, gm.role, gm.status
  from public.group_members gm
  join public.profiles p on p.id = gm.profile_id
  where gm.group_id = p_group
    and exists (select 1 from public.group_members me where me.group_id = p_group and me.profile_id = auth.uid())
    and (p.id = auth.uid() or not public.is_blocked(auth.uid(), p.id))
    and p.status = 'active'
  order by gm.role desc, gm.status desc, gm.joined_at, p.display_name
$$;

-- Can I send in this conversation? One-to-one: while the connection stands.
-- Group: while I'm a member.
create or replace function public.can_message(conv bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.in_conversation(conv) and exists (
    select 1 from public.conversations c
    left join public.connections k on k.id = c.connection_id
    where c.id = conv
      and ((c.kind = 'direct' and k.status = 'accepted')
           or (c.kind = 'group' and public.is_group_member(c.group_id, auth.uid())))
  )
$$;

-- My conversations now include groups. For a group, profile_id is empty,
-- display_name is the group's name, and last_sender is who wrote last.
drop function public.my_conversations();
create function public.my_conversations()
returns table (
  id            bigint,
  kind          text,
  group_id      bigint,
  profile_id    uuid,
  display_name  text,
  birth_year    smallint,
  photo_path    text,
  last_body     text,
  last_at       timestamptz,
  last_mine     boolean,
  last_sender   text,
  unread        integer,
  can_message   boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select me.conversation_id, me.last_read_at, public.blocked_with(auth.uid()) as hidden
    from public.conversation_members me
    where me.profile_id = auth.uid()
  )
  select c.id, c.kind, c.group_id, p.id, coalesce(g.name, p.display_name), p.birth_year, p.photo_path,
         last.body, coalesce(last.created_at, c.created_at), last.sender_id = auth.uid(), ls.display_name,
         (select count(*)::int from public.messages m
           where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.created_at > mine.last_read_at
             and not (m.sender_id = any (mine.hidden))),
         case when c.kind = 'direct' then k.status = 'accepted' else true end
  from mine
  join public.conversations c on c.id = mine.conversation_id
  left join public.connections k on k.id = c.connection_id
  left join public.groups g on g.id = c.group_id
  left join public.conversation_members them
    on c.kind = 'direct' and them.conversation_id = c.id and them.profile_id <> auth.uid()
  left join public.profiles p on p.id = them.profile_id
  left join lateral (
    select m.body, m.created_at, m.sender_id from public.messages m
    where m.conversation_id = c.id and not (m.sender_id = any (mine.hidden))
    order by m.id desc limit 1
  ) last on true
  left join public.profiles ls on ls.id = last.sender_id
  where (c.kind = 'group' and g.end_date >= current_date - 30)
     or (c.kind = 'direct' and p.status = 'active' and not (p.id = any (mine.hidden)))
  order by coalesce(last.created_at, c.created_at) desc
$$;

-- Names of everyone who has written in a conversation, so a group chat can
-- show who said what, even after someone leaves.
create function public.conversation_senders(p_conversation_id bigint)
returns table (profile_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p.id, p.display_name
  from public.messages m
  join public.profiles p on p.id = m.sender_id
  where m.conversation_id = p_conversation_id
    and public.in_conversation(p_conversation_id)
$$;

-- A block also takes the pair out of each other's pending group invites
-- (joined members simply stop seeing each other's messages).
create function public.block_clears_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.group_members gm
   where gm.status = 'invited'
     and ((gm.profile_id = new.blocked_id and gm.invited_by = new.blocker_id)
          or (gm.profile_id = new.blocker_id and gm.invited_by = new.blocked_id));
  return new;
end;
$$;
revoke all on function public.block_clears_invites() from public, anon, authenticated;
create trigger blocks_clear_invites after insert on public.blocks
  for each row execute function public.block_clears_invites();

revoke all on function public.group_limit(uuid) from public, anon, authenticated;
revoke all on function public.is_group_member(bigint, uuid) from public, anon, authenticated;
revoke all on function public.create_group(text, integer, date, date, uuid[]) from public, anon;
revoke all on function public.invite_to_group(bigint, uuid[]) from public, anon;
revoke all on function public.respond_to_group_invite(bigint, boolean) from public, anon;
revoke all on function public.leave_group(bigint, uuid) from public, anon;
revoke all on function public.my_groups() from public, anon;
revoke all on function public.groups_i_can_start() from public, anon;
revoke all on function public.group_people(bigint) from public, anon;
revoke all on function public.my_conversations() from public, anon;
revoke all on function public.conversation_senders(bigint) from public, anon;
grant execute on function public.create_group(text, integer, date, date, uuid[]) to authenticated;
grant execute on function public.invite_to_group(bigint, uuid[]) to authenticated;
grant execute on function public.respond_to_group_invite(bigint, boolean) to authenticated;
grant execute on function public.leave_group(bigint, uuid) to authenticated;
grant execute on function public.my_groups() to authenticated;
grant execute on function public.groups_i_can_start() to authenticated;
grant execute on function public.group_people(bigint) to authenticated;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.conversation_senders(bigint) to authenticated;
