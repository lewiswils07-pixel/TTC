-- Two kinds of group (Lewis, 9 Oct):
--   * a general group: just a chat, with no place or dates
--   * a trip group: a place and dates, with the plan board and everyone's dates
-- A general group can be turned into a trip group later. Groups can also be
-- bigger now (groups.maxPeople in app/rules.json).

alter table public.groups
  alter column city_id drop not null,
  alter column start_date drop not null,
  alter column end_date drop not null,
  add constraint groups_trip_all_or_nothing check (
    (city_id is null and start_date is null and end_date is null)
    or (city_id is not null and start_date is not null and end_date is not null));

-- A general group stays active until it's left; a trip group until its trip ends.
create or replace function public.groups_i_can_start()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(public.group_limit(auth.uid())
                  - (select count(*)::int from public.groups
                      where owner_id = auth.uid() and coalesce(end_date, current_date) >= current_date and not is_pair), 0)
$$;

-- Checks a trip's place and dates for a group.
create function private.check_group_trip(p_city_id integer, p_start date, p_end date)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_city_id is null or p_start is null or p_end is null or p_end < p_start then
    raise exception 'Please pick a place and dates' using errcode = 'check_violation';
  end if;
  if p_end < current_date then
    raise exception 'This trip has already ended' using errcode = 'check_violation';
  end if;
  if p_start > current_date + private.rule('trips.maxDaysAhead') then
    raise exception 'Trips can be up to % days ahead', private.rule('trips.maxDaysAhead') using errcode = 'check_violation';
  end if;
  if p_end - p_start > private.rule('trips.maxNights') then
    raise exception 'Trips can be up to % nights', private.rule('trips.maxNights') using errcode = 'check_violation';
  end if;
end;
$$;
revoke all on function private.check_group_trip(integer, date, date) from public, anon, authenticated;

-- No place and dates makes a general group.
create or replace function public.create_group(p_name text, p_city_id integer, p_start date, p_end date, p_invite uuid[] default '{}')
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
  if p_city_id is not null or p_start is not null or p_end is not null then
    perform private.check_group_trip(p_city_id, p_start, p_end);
  end if;
  if (select count(*) from public.groups
       where owner_id = me and coalesce(end_date, current_date) >= current_date and not is_pair) >= public.group_limit(me) then
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

-- The person who started a group turns it into a trip group (or changes its
-- trip). Everyone in it gets the trip added to their trips, as on joining.
create function public.set_group_trip(p_group bigint, p_city_id integer, p_start date, p_end date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  person uuid;
begin
  if not exists (select 1 from public.groups where id = p_group and owner_id = auth.uid()) then
    raise exception 'Only the person who started the group can do this' using errcode = '42501';
  end if;
  perform private.check_group_trip(p_city_id, p_start, p_end);
  update public.groups set city_id = p_city_id, start_date = p_start, end_date = p_end where id = p_group;
  for person in select profile_id from public.group_members where group_id = p_group and status = 'joined' loop
    perform private.add_group_trip(p_group, person);
  end loop;
end;
$$;
revoke all on function public.set_group_trip(bigint, integer, date, date) from public, anon;
grant execute on function public.set_group_trip(bigint, integer, date, date) to authenticated;

-- Everyone's dates for a trip group: each joined member's own trip there
-- that overlaps the group's dates. For the group's members only, leaving out
-- anyone blocked with me.
create function public.group_dates(p_group bigint)
returns table (profile_id uuid, display_name text, start_date date, end_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (gm.profile_id) gm.profile_id, p.display_name, t.start_date, t.end_date
  from public.groups g
  join public.group_members gm on gm.group_id = g.id and gm.status = 'joined'
  join public.profiles p on p.id = gm.profile_id and p.status = 'active'
  join public.trips t on t.owner_id = gm.profile_id
  where g.id = p_group
    and g.city_id is not null
    and public.is_group_member(p_group, auth.uid())
    and not (gm.profile_id = any (public.blocked_with(auth.uid())))
    and t.city_id = any (private.nearby_cities(g.city_id))
    and t.start_date <= g.end_date and t.end_date >= g.start_date
  order by gm.profile_id, t.start_date
$$;
revoke all on function public.group_dates(bigint) from public, anon;
grant execute on function public.group_dates(bigint) to authenticated;

-- my_groups: general groups have no place or dates.
create or replace function public.my_groups()
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
  conversation_id bigint,
  is_pair         boolean,
  city_id         integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, ci.name, ci.country_code::text, g.start_date, g.end_date, me.status, g.owner_id = auth.uid(),
         o.display_name,
         (select count(*)::int from public.group_members m where m.group_id = g.id and m.status = 'joined'),
         case when me.status = 'joined' then c.id end,
         g.is_pair, g.city_id
  from public.group_members me
  join public.groups g on g.id = me.group_id
  left join public.cities ci on ci.id = g.city_id
  join public.profiles o on o.id = g.owner_id
  left join public.conversations c on c.group_id = g.id
  where me.profile_id = auth.uid()
    and (g.end_date is null or g.end_date >= current_date - 30)
  order by me.status desc, g.start_date nulls first, g.id
$$;

-- my_conversations: general group chats don't expire.
create or replace function public.my_conversations()
returns table(id bigint, kind text, group_id bigint, profile_id uuid, display_name text, birth_year smallint, photo_path text, last_body text, last_at timestamp with time zone, last_mine boolean, last_sender text, unread integer, can_message boolean)
language sql
stable security definer
set search_path to ''
as $$
  with mine as (
    select me.conversation_id, me.last_read_at, public.blocked_with(auth.uid()) as hidden
    from public.conversation_members me
    where me.profile_id = auth.uid()
  )
  select c.id, c.kind, c.group_id, p.id, coalesce(g.name, p.display_name), public.age_year(p), p.photo_path,
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
  where (c.kind = 'group' and (g.end_date is null or g.end_date >= current_date - 30))
     or (c.kind = 'direct' and p.status = 'active' and not (p.id = any (mine.hidden)))
  order by coalesce(last.created_at, c.created_at) desc
$$;
