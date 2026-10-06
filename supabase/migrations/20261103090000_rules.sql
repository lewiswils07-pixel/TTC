-- One source of truth for the club's rules (Lewis, 6 Oct).
-- The numbers in app/rules.json (interests to pick, weekly requests, group
-- sizes, how far ahead trips can be...) now live in private.rules, and the
-- database functions read them from there instead of having them typed in.
-- `npm run rules` writes any later change; supabase/tests/rules.test.sql
-- fails if the database and rules.json ever differ.
-- Members now pick exactly the number of interests the app asks for.

create table private.rules (
  key   text primary key,
  value integer not null
);
alter table private.rules enable row level security;
revoke all on private.rules from public, anon, authenticated;

grant usage on schema private to service_role;

-- One rule's value. Fails loudly if the rule is missing, rather than guessing.
create function private.rule(p_key text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  found integer;
begin
  select r.value into found from private.rules r where r.key = p_key;
  if found is null then
    raise exception 'Unknown rule %', p_key;
  end if;
  return found;
end;
$$;
revoke all on function private.rule(text) from public, anon;
grant execute on function private.rule(text) to authenticated, service_role;

insert into private.rules (key, value) values
  ('signIn.codeLength', 6),
  ('signIn.passwordMin', 8),
  ('signIn.passwordMax', 72),
  ('interests.pick', 8),
  ('requests.perWeekFree', 5),
  ('requests.plusSafetyCap', 50),
  ('requests.plusShowLeftBelow', 5),
  ('groups.maxOwnedFree', 1),
  ('groups.maxOwnedPlus', 3),
  ('groups.maxPeople', 6),
  ('groups.nameMax', 60),
  ('trips.maxNights', 90),
  ('trips.maxDaysAhead', 730),
  ('trips.maxUpcoming', 20),
  ('trips.maxFlexDays', 7),
  ('trips.noteMax', 280),
  ('wishlist.max', 10),
  ('age.min', 18),
  ('age.maxPreferred', 99),
  ('card.answers', 3),
  ('card.maxWords', 30),
  ('card.maxChars', 200),
  ('profile.nameMax', 40),
  ('profile.bioMax', 500),
  ('profile.mobilityNoteMax', 200),
  ('profile.travellingWithMax', 80),
  ('profile.languagesMax', 10),
  ('connections.noteMax', 280),
  ('connections.notNowDays', 30),
  ('chat.messageMax', 2000),
  ('planBoard.ideaMax', 120),
  ('planBoard.linkMax', 500),
  ('planBoard.maxIdeas', 100),
  ('planBoard.maxDay', 91),
  ('safety.reportDetailsMax', 1000),
  ('safety.adminNoteMax', 1000),
  ('meetups.placeMax', 120),
  ('meetups.noteMax', 300),
  ('meetups.maxOpen', 10),
  ('meetups.maxDaysAhead', 90),
  ('meetups.linkDays', 2),
  ('survey.commentMax', 500),
  ('founding.plusMonths', 3)
on conflict (key) do update set value = excluded.value;
delete from private.rules where key not in ('signIn.codeLength', 'signIn.passwordMin', 'signIn.passwordMax', 'interests.pick', 'requests.perWeekFree', 'requests.plusSafetyCap', 'requests.plusShowLeftBelow', 'groups.maxOwnedFree', 'groups.maxOwnedPlus', 'groups.maxPeople', 'groups.nameMax', 'trips.maxNights', 'trips.maxDaysAhead', 'trips.maxUpcoming', 'trips.maxFlexDays', 'trips.noteMax', 'wishlist.max', 'age.min', 'age.maxPreferred', 'card.answers', 'card.maxWords', 'card.maxChars', 'profile.nameMax', 'profile.bioMax', 'profile.mobilityNoteMax', 'profile.travellingWithMax', 'profile.languagesMax', 'connections.noteMax', 'connections.notNowDays', 'chat.messageMax', 'planBoard.ideaMax', 'planBoard.linkMax', 'planBoard.maxIdeas', 'planBoard.maxDay', 'safety.reportDetailsMax', 'safety.adminNoteMax', 'meetups.placeMax', 'meetups.noteMax', 'meetups.maxOpen', 'meetups.maxDaysAhead', 'meetups.linkDays', 'survey.commentMax', 'founding.plusMonths');

create or replace function public.set_my_interests(interest_ids smallint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  wanted smallint[] := array(select distinct unnest(interest_ids));
  pick integer := private.rule('interests.pick');
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if cardinality(wanted) <> pick
     or (select count(*) from public.interests where id = any (wanted)) <> cardinality(wanted) then
    raise exception 'Pick % interests', pick using errcode = 'check_violation';
  end if;
  delete from public.profile_interests where profile_id = me and interest_id <> all (wanted);
  insert into public.profile_interests (profile_id, interest_id)
    select me, unnest(wanted)
    on conflict do nothing;
end;
$$;

create or replace function public.finish_onboarding()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  done_at timestamptz;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  update public.profiles p
     set onboarded_at = coalesce(p.onboarded_at, now())
   where p.id = me
     and p.display_name is not null
     and p.birth_date is not null
     and p.gender is not null
     and p.home_city_id is not null
     and (select count(*) from public.profile_interests i where i.profile_id = me) >= private.rule('interests.pick')
  returning p.onboarded_at into done_at;
  if done_at is null then
    raise exception 'Profile is not finished' using errcode = 'check_violation';
  end if;
  return done_at;
end;
$$;

create or replace function public.weekly_request_limit(member uuid)
returns integer
language sql
stable
set search_path = ''
as $$ select case when public.has_plus(member) then private.rule('requests.plusSafetyCap') else private.rule('requests.perWeekFree') end $$;

create or replace function public.group_limit(member uuid)
returns integer
language sql
stable
set search_path = ''
as $$ select case when public.has_plus(member) then private.rule('groups.maxOwnedPlus') else private.rule('groups.maxOwnedFree') end $$;

create or replace function public.add_group_invites(p_group bigint, p_ids uuid[])
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
        where not exists (select 1 from public.group_members where group_id = p_group and profile_id = x)) > private.rule('groups.maxPeople') then
    raise exception 'Groups can have up to % people', private.rule('groups.maxPeople') using errcode = 'check_violation';
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

create or replace function public.trips_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.start_date <> old.start_date or new.end_date <> old.end_date then
    if new.end_date < current_date then
      raise exception 'This trip has already ended' using errcode = 'check_violation';
    end if;
    if new.start_date > current_date + private.rule('trips.maxDaysAhead') then
      raise exception 'Trips can be up to % days ahead', private.rule('trips.maxDaysAhead') using errcode = 'check_violation';
    end if;
  end if;
  if tg_op = 'INSERT' and (
    select count(*) from public.trips where owner_id = new.owner_id and end_date >= current_date
  ) >= private.rule('trips.maxUpcoming') then
    raise exception 'You can have up to % upcoming trips', private.rule('trips.maxUpcoming') using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.wishlist_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.wishlist where profile_id = new.profile_id) >= private.rule('wishlist.max') then
    raise exception 'You can save up to % places', private.rule('wishlist.max') using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.profiles_birth_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_date is not null then
    if new.birth_date > (current_date - make_interval(years => private.rule('age.min')))::date then
      raise exception 'Members must be % or over', private.rule('age.min') using errcode = 'check_violation';
    end if;
    if new.birth_date < date '1900-01-01' then
      raise exception 'Please check your date of birth' using errcode = 'check_violation';
    end if;
    new.birth_year := extract(year from new.birth_date)::smallint;
  end if;
  return new;
end;
$$;

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
  if p_end < current_date then
    raise exception 'This trip has already ended' using errcode = 'check_violation';
  end if;
  if p_start > current_date + private.rule('trips.maxDaysAhead') then
    raise exception 'Trips can be up to % days ahead', private.rule('trips.maxDaysAhead') using errcode = 'check_violation';
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

create or replace function public.add_plan_item(p_conversation_id bigint, p_title text, p_day smallint default null, p_url text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if not public.in_conversation(p_conversation_id) then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
  if not public.can_message(p_conversation_id) then
    raise exception 'This conversation has ended' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and status <> 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  if (select count(*) from public.plan_items where conversation_id = p_conversation_id) >= private.rule('planBoard.maxIdeas') then
    raise exception 'The plan board is full' using errcode = 'check_violation';
  end if;
  insert into public.plan_items (conversation_id, title, day, source_url, added_by)
  values (p_conversation_id, btrim(p_title), p_day, nullif(btrim(p_url), ''), auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.create_meetup_share(p_conversation_id bigint, p_place text, p_meet_at timestamptz, p_note text default null)
returns public.meetup_shares
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  who jsonb;
  made public.meetup_shares;
begin
  if me is null then
    raise exception 'Please sign in again' using errcode = '42501';
  end if;
  -- The chat must still be open (not ended or blocked), and the member active.
  if not public.in_conversation(p_conversation_id) or not public.can_message(p_conversation_id) then
    raise exception 'You can only share a meet-up from one of your chats' using errcode = '42501';
  end if;
  if p_meet_at is null or p_meet_at < now() - interval '12 hours' or p_meet_at > now() + make_interval(days => private.rule('meetups.maxDaysAhead')) then
    raise exception 'Please pick when you’re meeting' using errcode = 'check_violation';
  end if;
  if char_length(btrim(coalesce(p_place, ''))) < 2 then
    raise exception 'Please say where you’re meeting' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.meetup_shares s
      where s.owner_id = me and s.stopped_at is null and public.meetup_share_ends(s) > now()) >= private.rule('meetups.maxOpen') then
    raise exception 'You have % links open. Stop one you no longer need first.', private.rule('meetups.maxOpen') using errcode = 'check_violation';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', p.display_name,
           'age', public.member_age(p),
           'home', c.name,
           'member_number', p.member_number) order by p.display_name), '[]')
    into who
  from public.conversation_members cm
  join public.profiles p on p.id = cm.profile_id
  left join public.cities c on c.id = p.home_city_id
  where cm.conversation_id = p_conversation_id and cm.profile_id <> me
    and p.status = 'active'
    and not (p.id = any ('{}'::uuid[] || public.blocked_with(me)));

  insert into public.meetup_shares (owner_id, conversation_id, meeting_with, place, meet_at, note)
  values (me, p_conversation_id, who, btrim(p_place), p_meet_at, nullif(btrim(coalesce(p_note, '')), ''))
  returning * into made;
  return made;
end;
$$;

create or replace function public.profiles_welcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.onboarded_at is null and new.onboarded_at is not null then
    if new.member_number is null then
      new.member_number := nextval('public.member_number_seq');
    end if;
    insert into public.entitlements (profile_id, plan, source, expires_at)
    values (new.id, 'plus', 'founding', now() + make_interval(months => private.rule('founding.plusMonths')))
    on conflict (profile_id) do nothing;
  end if;
  return new;
end;
$$;
