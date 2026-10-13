-- Part 24 (Lewis, 13 Oct): open travel groups anyone suitable can join,
-- women-only groups and an age range for a group, twin-room sharing on
-- member cards, Nice to know tips in Download my data, and a distance limit
-- that no longer hides people going on the same trip.

-- 1 ----------------------------------------------------------------------
-- Group settings. open: anyone who fits can find and join it, not only
-- people the starter invites. women_only and the ages say who fits.
alter table public.groups
  add column open boolean not null default false,
  add column women_only boolean not null default false,
  add column age_min smallint check (age_min between 18 and 99),
  add column age_max smallint check (age_max between 18 and 99),
  add constraint groups_age_order check (age_min is null or age_max is null or age_min <= age_max);

-- Whether a member fits a group's women-only and age settings.
create function private.fits_group(g public.groups, p public.profiles)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (not g.women_only or p.gender = 'woman')
     and (g.age_min is null or public.member_age(p) >= g.age_min)
     and (g.age_max is null or public.member_age(p) <= g.age_max)
$$;
revoke all on function private.fits_group(public.groups, public.profiles) from public, anon, authenticated;

-- Checks the settings the starter picks.
create function private.check_group_settings(p_owner uuid, p_women_only boolean, p_age_min smallint, p_age_max smallint)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_women_only and not exists (select 1 from public.profiles where id = p_owner and gender = 'woman') then
    raise exception 'Only women can start a women-only group' using errcode = 'check_violation';
  end if;
  if p_age_min is not null and p_age_max is not null and p_age_min > p_age_max then
    raise exception 'Please pick a youngest age below the oldest' using errcode = 'check_violation';
  end if;
  if (p_age_min is not null and p_age_min not between 18 and 99) or (p_age_max is not null and p_age_max not between 18 and 99) then
    raise exception 'Ages can be from 18 to 99' using errcode = 'check_violation';
  end if;
end;
$$;
revoke all on function private.check_group_settings(uuid, boolean, smallint, smallint) from public, anon, authenticated;

-- 2 ----------------------------------------------------------------------
-- Invites keep to the group's settings too.
create or replace function public.add_group_invites(p_group bigint, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := auth.uid();
  person uuid;
  grp    public.groups;
begin
  select * into grp from public.groups where id = p_group;
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
    if not private.fits_group(grp, (select p from public.profiles p where p.id = person)) then
      raise exception 'Someone you picked doesn''t fit this group''s settings' using errcode = 'check_violation';
    end if;
    insert into public.group_members (group_id, profile_id, role, status, invited_by)
    values (p_group, person, 'member', 'invited', me);
  end loop;
end;
$$;

-- create_group takes the settings. The old call (no settings) still works.
drop function public.create_group(text, integer, date, date, uuid[]);
create function public.create_group(p_name text, p_city_id integer, p_start date, p_end date, p_invite uuid[] default '{}',
                                    p_open boolean default false, p_women_only boolean default false,
                                    p_age_min smallint default null, p_age_max smallint default null)
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
  if p_open and p_city_id is null then
    raise exception 'Only trip groups can be open to others' using errcode = 'check_violation';
  end if;
  perform private.check_group_settings(me, coalesce(p_women_only, false), p_age_min, p_age_max);
  if (select count(*) from public.groups
       where owner_id = me and coalesce(end_date, current_date) >= current_date and not is_pair) >= public.group_limit(me) then
    raise exception 'Group limit reached' using errcode = 'check_violation';
  end if;
  insert into public.groups (name, owner_id, city_id, start_date, end_date, open, women_only, age_min, age_max)
  values (btrim(p_name), me, p_city_id, p_start, p_end, coalesce(p_open, false), coalesce(p_women_only, false), p_age_min, p_age_max)
  returning id into new_id;
  insert into public.group_members (group_id, profile_id, role, status, joined_at)
  values (new_id, me, 'owner', 'joined', now());
  insert into public.conversations (kind, group_id) values ('group', new_id) returning id into conv;
  insert into public.conversation_members (conversation_id, profile_id) values (conv, me);
  perform public.add_group_invites(new_id, p_invite);
  return new_id;
end;
$$;
revoke all on function public.create_group(text, integer, date, date, uuid[], boolean, boolean, smallint, smallint) from public, anon;
grant execute on function public.create_group(text, integer, date, date, uuid[], boolean, boolean, smallint, smallint) to authenticated;

-- A group's settings, for the people in it.
create function public.group_settings(p_group bigint)
returns table (open boolean, women_only boolean, age_min smallint, age_max smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select g.open, g.women_only, g.age_min, g.age_max
    from public.groups g
   where g.id = p_group and public.is_group_member(p_group, auth.uid())
$$;
revoke all on function public.group_settings(bigint) from public, anon;
grant execute on function public.group_settings(bigint) to authenticated;

-- The starter changes the settings. Women-only needs everyone in it to be a woman.
create function public.set_group_settings(p_group bigint, p_open boolean, p_women_only boolean, p_age_min smallint, p_age_max smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  grp public.groups;
begin
  select * into grp from public.groups where id = p_group and owner_id = auth.uid();
  if not found then
    raise exception 'Only the person who started the group can do this' using errcode = '42501';
  end if;
  if p_open and grp.city_id is null then
    raise exception 'Only trip groups can be open to others' using errcode = 'check_violation';
  end if;
  perform private.check_group_settings(auth.uid(), p_women_only, p_age_min, p_age_max);
  if p_women_only and exists (select 1 from public.group_members gm join public.profiles p on p.id = gm.profile_id
                               where gm.group_id = p_group and p.gender is distinct from 'woman') then
    raise exception 'Everyone in the group needs to be a woman for it to be women-only' using errcode = 'check_violation';
  end if;
  update public.groups set open = p_open, women_only = p_women_only, age_min = p_age_min, age_max = p_age_max where id = p_group;
end;
$$;
revoke all on function public.set_group_settings(bigint, boolean, boolean, smallint, smallint) from public, anon;
grant execute on function public.set_group_settings(bigint, boolean, boolean, smallint, smallint) to authenticated;

-- 3 ----------------------------------------------------------------------
-- Open trip groups I could join: not full, not ended, ones I fit, with no
-- one in them blocked with me. Ones going when I'm there come first.
-- p_city_id narrows it to one place (and places nearby).
create function public.open_groups(p_city_id integer default null)
returns table (id bigint, name text, city text, country_code text, city_id integer, start_date date, end_date date,
               members integer, max_people integer, owner_name text, women_only boolean, age_min smallint, age_max smallint,
               going_when_you_are boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, ci.name, ci.country_code::text, g.city_id, g.start_date, g.end_date,
         (select count(*)::int from public.group_members m where m.group_id = g.id and m.status = 'joined'),
         private.rule('groups.maxPeople')::int, o.display_name, g.women_only, g.age_min, g.age_max,
         exists (select 1 from public.trips t where t.owner_id = me.id and t.city_id = any (private.nearby_cities(g.city_id))
                  and t.start_date <= g.end_date and t.end_date >= g.start_date)
    from public.profiles me
    join public.groups g on g.open and g.city_id is not null and g.end_date >= current_date and not g.is_pair
    join public.cities ci on ci.id = g.city_id
    join public.profiles o on o.id = g.owner_id and o.status = 'active'
   where me.id = auth.uid() and me.status = 'active' and me.onboarded_at is not null
     and (p_city_id is null or g.city_id = any (private.nearby_cities(p_city_id)))
     and private.fits_group(g, me)
     and not exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.profile_id = me.id)
     and (select count(*) from public.group_members gm where gm.group_id = g.id) < private.rule('groups.maxPeople')
     and not exists (select 1 from public.group_members gm where gm.group_id = g.id and public.is_blocked(me.id, gm.profile_id))
   order by 14 desc, g.start_date, g.id
   limit 20
$$;
revoke all on function public.open_groups(integer) from public, anon;
grant execute on function public.open_groups(integer) to authenticated;

-- Join an open group. Like accepting an invite: the chat and the trip are added.
create function public.join_open_group(p_group bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  public.profiles;
  grp public.groups;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.status <> 'active' or me.onboarded_at is null then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  select * into grp from public.groups where id = p_group and open and city_id is not null and end_date >= current_date;
  if not found or exists (select 1 from public.group_members gm where gm.group_id = p_group and public.is_blocked(me.id, gm.profile_id)) then
    raise exception 'This group isn''t available' using errcode = 'check_violation';
  end if;
  if not private.fits_group(grp, me) then
    raise exception 'This group is for other members' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.group_members where group_id = p_group and profile_id = me.id and status = 'joined') then
    return;
  end if;
  if not exists (select 1 from public.group_members where group_id = p_group and profile_id = me.id)
     and (select count(*) from public.group_members where group_id = p_group) >= private.rule('groups.maxPeople') then
    raise exception 'This group is full' using errcode = 'check_violation';
  end if;
  insert into public.group_members (group_id, profile_id, role, status, joined_at)
  values (p_group, me.id, 'member', 'joined', now())
  on conflict (group_id, profile_id) do update set status = 'joined', joined_at = now();
  insert into public.conversation_members (conversation_id, profile_id)
  select c.id, me.id from public.conversations c where c.group_id = p_group
  on conflict do nothing;
  perform private.add_group_trip(p_group, me.id);
end;
$$;
revoke all on function public.join_open_group(bigint) from public, anon;
grant execute on function public.join_open_group(bigint) to authenticated;

-- 4 ----------------------------------------------------------------------
-- Twin-room sharing (survey: to avoid the single supplement). The answer
-- (room_sharing: share, unsure or separate) is already kept; now it shows
-- on member cards too.
drop function public.member_extras(uuid);
create function public.member_extras(p_profile uuid)
returns table (
  photo_book text[], holiday_prefs jsonb, holiday_locked boolean, sexuality text, religion text, ethnicity text,
  moving text, travel_often text, booking text, group_size text, drinking text, smoking text, room_sharing text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.photo_book,
         case when p.id = me.id or public.has_plus(me.id) then p.holiday_prefs end,
         p.id <> me.id and not public.has_plus(me.id) and p.holiday_prefs <> '{}'::jsonb,
         case when p.id = me.id or 'sexuality' = any (p.shown_fields) then p.sexuality end,
         case when p.id = me.id or 'religion' = any (p.shown_fields) then p.religion end,
         case when p.id = me.id or 'ethnicity' = any (p.shown_fields) then p.ethnicity end,
         p.moving, p.travel_often, p.booking, p.group_size, p.drinking, p.smoking, p.room_sharing
    from public.profiles p
    join public.profiles me on me.id = auth.uid()
   where p.id = p_profile
     and me.status = 'active'
     and (p.id = me.id
          or (p.status = 'active'
              and p.onboarded_at is not null
              and not public.is_blocked(me.id, p.id)))
$$;
revoke all on function public.member_extras(uuid) from public, anon;
grant execute on function public.member_extras(uuid) to authenticated;

-- 5 ----------------------------------------------------------------------
-- Download my data includes your Nice to know tips.
create or replace function public.my_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at) from auth.users u where u.id = auth.uid()),
    'profile', (select to_jsonb(p) - 'role' from public.profiles p where p.id = auth.uid()),
    'preferences', (select to_jsonb(x) from public.preferences x where x.profile_id = auth.uid()),
    'interests', (select coalesce(jsonb_agg(i.label order by i.label), '[]') from public.profile_interests pi join public.interests i on i.id = pi.interest_id where pi.profile_id = auth.uid()),
    'trips', (select coalesce(jsonb_agg(to_jsonb(t) || jsonb_build_object('city', c.name) order by t.start_date), '[]') from public.trips t join public.cities c on c.id = t.city_id where t.owner_id = auth.uid()),
    'wishlist', (select coalesce(jsonb_agg(c.name order by c.name), '[]') from public.wishlist w join public.cities c on c.id = w.city_id where w.profile_id = auth.uid()),
    'connections', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'with', o.display_name, 'you_asked', x.requester_id = auth.uid(), 'status', x.status, 'note', x.note,
        'created_at', x.created_at, 'responded_at', x.responded_at) order by x.created_at), '[]')
      from public.connections x
      join public.profiles o on o.id = case when x.requester_id = auth.uid() then x.addressee_id else x.requester_id end
      where auth.uid() in (x.requester_id, x.addressee_id)
    ),
    'messages_you_sent', (select coalesce(jsonb_agg(jsonb_build_object('conversation', m.conversation_id, 'body', m.body, 'sent_at', m.created_at) order by m.created_at), '[]') from public.messages m where m.sender_id = auth.uid()),
    'groups', (select coalesce(jsonb_agg(jsonb_build_object('name', g.name, 'role', gm.role, 'status', gm.status, 'start', g.start_date, 'end', g.end_date)), '[]') from public.group_members gm join public.groups g on g.id = gm.group_id where gm.profile_id = auth.uid()),
    'plan_ideas_you_added', (select coalesce(jsonb_agg(jsonb_build_object('title', pi.title, 'link', pi.source_url, 'added_at', pi.created_at)), '[]') from public.plan_items pi where pi.added_by = auth.uid()),
    'people_you_blocked', (select coalesce(jsonb_agg(o.display_name), '[]') from public.blocks b join public.profiles o on o.id = b.blocked_id where b.blocker_id = auth.uid()),
    'reports_you_made', (select coalesce(jsonb_agg(jsonb_build_object('reason', r.reason, 'details', r.details, 'status', r.status, 'created_at', r.created_at)), '[]') from public.reports r where r.reporter_id = auth.uid()),
    'did_you_meet_answers', (select coalesce(jsonb_agg(jsonb_build_object('met', f.met, 'would_travel_again', f.would_travel_again, 'created_at', f.created_at)), '[]') from public.meet_feedback f where f.from_id = auth.uid()),
    'recommend_scores', (select coalesce(jsonb_agg(jsonb_build_object('score', n.score, 'comment', n.comment, 'created_at', n.created_at)), '[]') from public.nps_responses n where n.profile_id = auth.uid()),
    'plan', (select coalesce(jsonb_agg(jsonb_build_object('plan', e.plan, 'source', e.source, 'expires_at', e.expires_at)), '[]') from public.entitlements e where e.profile_id = auth.uid()),
    'meetup_links_you_shared', (select coalesce(jsonb_agg(jsonb_build_object('place', s.place, 'meet_at', s.meet_at, 'note', s.note, 'meeting_with', s.meeting_with, 'checked_in_at', s.checked_in_at, 'stopped_at', s.stopped_at, 'created_at', s.created_at) order by s.created_at), '[]') from public.meetup_shares s where s.owner_id = auth.uid()),
    'days_you_opened_the_app', (select count(*) from public.member_days d where d.profile_id = auth.uid()),
    'your_location', (select jsonb_build_object('lat', l.lat, 'lng', l.lng, 'updated_at', l.updated_at) from public.member_locations l where l.profile_id = auth.uid()),
    'privacy_choices', (select jsonb_build_object('measuring', c.measuring, 'marketing', c.marketing, 'chosen_at', c.chosen_at) from public.privacy_choices c where c.profile_id = auth.uid()),
    'your_trip_plans', (select coalesce(jsonb_agg(jsonb_build_object('city', c.name, 'title', i.title, 'day', i.day, 'link', i.source_url, 'done', i.done) order by t.start_date, i.day nulls last, i.id), '[]') from public.trip_plan_items i join public.trips t on t.id = i.trip_id join public.cities c on c.id = t.city_id where t.owner_id = auth.uid()),
    'your_reviews', (select coalesce(jsonb_agg(jsonb_build_object('city', c.name, 'rating', r.rating, 'review', r.body, 'updated_at', r.updated_at) order by r.updated_at), '[]') from public.city_reviews r join public.cities c on c.id = r.city_id where r.profile_id = auth.uid()),
    'nice_to_know_tips', (select coalesce(jsonb_agg(jsonb_build_object('city', c.name, 'kind', t.category, 'place', t.place, 'tip', t.body, 'stars', t.rating, 'added_at', t.created_at) order by t.created_at), '[]') from public.city_tips t join public.cities c on c.id = t.city_id where t.profile_id = auth.uid()),
    'people_you_skipped', (select coalesce(jsonb_agg(jsonb_build_object('name', o.display_name, 'skipped_at', s.skipped_at)), '[]') from public.skipped_members s join public.profiles o on o.id = s.skipped_id where s.profile_id = auth.uid())
  )
$$;

-- 6 ----------------------------------------------------------------------
-- People going on the same trip aren't hidden by the distance limit
-- (testers, 13 Oct): where they live doesn't matter when you're both there.
create or replace function public.suggest_for_trip(p_trip_id bigint)
returns table (
  profile_id       uuid,
  display_name     text,
  birth_year       smallint,
  home_city        text,
  home_country     text,
  photo_path       text,
  travelling_with  text,
  trip_city        text,
  trip_start       date,
  trip_end         date,
  overlap_start    date,
  overlap_end      date,
  shared_interests text[],
  score            integer,
  rank             numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me       uuid := auth.uid();
  my_trip  public.trips;
  my       public.profiles;
  my_prefs public.preferences;
  nearby   integer[];
  closed   uuid[] := public.closed_with(me);
  plus     boolean := public.has_plus(me);
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  select * into my_trip from public.trips t where t.id = p_trip_id and t.owner_id = me;
  if not found then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  select * into my from public.profiles p where p.id = me;
  select * into my_prefs from public.preferences pr where pr.profile_id = me;
  nearby := private.nearby_cities(my_trip.city_id);

  return query
  with candidates as (
    select t.owner_id, t.city_id, t.start_date, t.end_date, p as person, pr as their_prefs,
           greatest(t.start_date, my_trip.start_date) as o_start,
           least(t.end_date, my_trip.end_date) as o_end,
           case when p.home_city_id = my.home_city_id then 0 else public.member_distance_km(p.id, me) end as km
    from public.trips t
    join public.profiles p on p.id = t.owner_id
    join public.preferences pr on pr.profile_id = p.id
    where t.owner_id <> me
      and t.visibility = 'members'
      and t.end_date >= current_date
      and t.city_id = any (nearby)
      and least(t.end_date + t.flexible_days, my_trip.end_date + my_trip.flexible_days)
          - greatest(t.start_date - t.flexible_days, my_trip.start_date - my_trip.flexible_days) + 1
          >= least(2, t.end_date - t.start_date + 1, my_trip.end_date - my_trip.start_date + 1)
      and p.status = 'active'
      and p.onboarded_at is not null
      and p.last_active_at > now() - interval '60 days'
      and not (p.id = any (closed))
      and not public.is_skipped(me, p.id)
      and public.passes_viewer_filters(my_prefs, plus, p)
  ),
  fitting as (
    select c.*,
           public.preference_fit(public.member_age(c.person), (c.person).gender, null, my_prefs)
           + public.preference_fit(public.member_age(my), my.gender, null, c.their_prefs) as penalty,
           -- one card per member: their best-matching trip
           row_number() over (partition by c.owner_id order by least(c.o_end, c.end_date) - c.o_start desc, c.start_date) as nth
    from candidates c
  ),
  scored as (
    select f.*,
           public.interest_points(me, f.owner_id) + public.place_points(me, f.owner_id) + public.style_points(f.person, my) as total,
           f.o_start <= f.o_end as overlaps
    from fitting f
    where f.penalty is not null and f.nth = 1
  ),
  best as (
    select s.*,
           s.total - s.penalty - public.activity_penalty(s.person) - case when (s.person).photo_path is null then 100 else 0 end
           + case when s.overlaps then private.rule('matching.sameTripBonus') + case when public.has_plus(s.owner_id) then 3 else 0 end else 0 end as ranking
    from scored s
    order by ranking desc
    limit private.rule('matching.maxSuggestions')
  )
  select b.owner_id, (b.person).display_name, public.age_year(b.person), hc.name, hc.country_code::text,
         (b.person).photo_path, (b.person).travelling_with,
         tc.name,
         case when plus then b.start_date else date_trunc('month', b.start_date)::date end,
         case when plus then b.end_date else date_trunc('month', b.end_date)::date end,
         case when b.overlaps then case when plus then b.o_start else date_trunc('month', b.o_start)::date end end,
         case when b.overlaps then case when plus then b.o_end else date_trunc('month', b.o_start)::date end end,
         array(select i.label from public.profile_interests x
                 join public.profile_interests y on y.interest_id = x.interest_id and y.profile_id = me
                 join public.interests i on i.id = x.interest_id
                where x.profile_id = b.owner_id
                order by i.sort),
         round(b.total)::int,
         round(b.ranking, 2)
  from best b
  join public.cities tc on tc.id = b.city_id
  left join public.cities hc on hc.id = (b.person).home_city_id
  order by b.ranking desc;
end;
$$;
