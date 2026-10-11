-- Lewis's 11 Oct list (Part 21):
--   * Your travel style: pace, budget (now 3 answers), planning, moving
--     around, how often you travel, booking and group size. These are the
--     30 travel-style points in matching.
--   * Holiday preferences: just where I stay, trip length and season, with
--     several answers each. Still a Sodalis+ feature, not used for matching.
--   * Drinking and smoking move to "About you" (one answer each).
--   * Matching: interests 50 (shared out of your 8, no minimum), places you
--     both want to visit 20 (10 when either has none), travel style 30.
--     Age and distance can be strict or flexible (just outside shows lower
--     down). Recently active members rank higher. "On the road" and
--     languages no longer count.
--   * Trips: people on the same trip get a bump on free accounts and are
--     pinned to the top with Sodalis+; free accounts see the month, not the
--     dates. A trip's People section is for people you're in touch with,
--     ordered by interests, other trips in common and travel style.
--   * Sodalis+: filters for every travel style question and holiday
--     preference, and other members' trip plans for inspiration.
-- The answer lists match app/rules.json (`choices`); rules.test.sql checks.

-- 1 ----------------------------------------------------------------------
alter table public.profiles
  add column moving text constraint profiles_moving_check
    check (moving = any (array['base', 'few', 'move'])),
  add column travel_often text constraint profiles_travel_often_check
    check (travel_often = any (array['once', 'twice', 'few', 'many'])),
  add column booking text constraint profiles_booking_check
    check (booking = any (array['ahead', 'weeks', 'last'])),
  add column group_size text constraint profiles_group_size_check
    check (group_size = any (array['two', 'small', 'more'])),
  add column drinking text constraint profiles_drinking_check
    check (drinking = any (array['none', 'sometimes', 'socially', 'often'])),
  add column smoking text constraint profiles_smoking_check
    check (smoking = any (array['no', 'social', 'yes']));
grant update (moving, travel_often, booking, group_size, drinking, smoking) on public.profiles to authenticated;

-- Planning, drinking and smoking were holiday preferences: carry answers over.
update public.profiles
   set travel_style = coalesce(travel_style, holiday_prefs ->> 'planning'),
       drinking = holiday_prefs ->> 'drinking',
       smoking = holiday_prefs ->> 'smoking'
 where holiday_prefs ?| array['planning', 'drinking', 'smoking'];

-- 2 ----------------------------------------------------------------------
-- Holiday preferences: {"question": ["answer", ...]}, several answers each.
alter table public.profiles drop constraint profiles_holiday_prefs_check;

create or replace function public.valid_holiday_prefs(prefs jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(prefs) = 'object'
     and not exists (
       select 1 from jsonb_each(prefs) e
        where jsonb_typeof(e.value) <> 'array'
           or jsonb_array_length(e.value) = 0
           or exists (select 1 from jsonb_array_elements(e.value) v where jsonb_typeof(v) <> 'string')
           or (select count(distinct v) from jsonb_array_elements_text(e.value) v) <> jsonb_array_length(e.value)
           or exists (
                select 1 from jsonb_array_elements_text(e.value) v
                 where not coalesce(v = any (case e.key
                         when 'stay' then array['hotel', 'apartment', 'bnb', 'resort', 'hostel', 'camping']
                         when 'length' then array['weekend', 'week', 'fortnight', 'longer']
                         when 'season' then array['spring', 'summer', 'autumn', 'winter']
                       end), false)))
$$;

update public.profiles p
   set holiday_prefs = coalesce((
         select jsonb_object_agg(e.key, jsonb_build_array(e.value #>> '{}'))
           from jsonb_each(p.holiday_prefs) e
          where e.key in ('stay', 'length', 'season')
            and jsonb_typeof(e.value) = 'string'
            and (e.value #>> '{}') <> 'any'), '{}'::jsonb)
 where p.holiday_prefs <> '{}'::jsonb;

alter table public.profiles add constraint profiles_holiday_prefs_check check (public.valid_holiday_prefs(holiday_prefs));

-- 3 ----------------------------------------------------------------------
-- Budget: Budget, Comfort or Luxury. Earlier answers move to the nearest.
alter table public.profiles drop constraint profiles_budget_check;
update public.profiles set budget = case budget when 'shoestring' then 'budget' when 'mid' then 'comfort' else budget end
 where budget in ('shoestring', 'mid');
alter table public.profiles add constraint profiles_budget_check check (budget = any (array['budget', 'comfort', 'luxury']));

alter table public.preferences drop constraint preferences_budgets_check;
update public.preferences
   set budgets = array(select distinct case b when 'shoestring' then 'budget' when 'mid' then 'comfort' else b end from unnest(budgets) b)
 where budgets && '{shoestring,mid}'::text[];
alter table public.preferences add constraint preferences_budgets_check check (budgets <@ '{budget,comfort,luxury}'::text[]);

-- 4 ----------------------------------------------------------------------
-- Sodalis+ filters for every travel style question and holiday preference,
-- and strict or flexible age and distance for everyone (like Hinge).
alter table public.preferences
  add column movings text[] not null default '{}' constraint preferences_movings_check
    check (movings <@ '{base,few,move}'::text[]),
  add column travel_oftens text[] not null default '{}' constraint preferences_travel_oftens_check
    check (travel_oftens <@ '{once,twice,few,many}'::text[]),
  add column bookings text[] not null default '{}' constraint preferences_bookings_check
    check (bookings <@ '{ahead,weeks,last}'::text[]),
  add column group_sizes text[] not null default '{}' constraint preferences_group_sizes_check
    check (group_sizes <@ '{two,small,more}'::text[]),
  add column stays text[] not null default '{}' constraint preferences_stays_check
    check (stays <@ '{hotel,apartment,bnb,resort,hostel,camping}'::text[]),
  add column lengths text[] not null default '{}' constraint preferences_lengths_check
    check (lengths <@ '{weekend,week,fortnight,longer}'::text[]),
  add column seasons text[] not null default '{}' constraint preferences_seasons_check
    check (seasons <@ '{spring,summer,autumn,winter}'::text[]),
  add column age_flexible boolean not null default false,
  add column distance_flexible boolean not null default false;
grant update (movings, travel_oftens, bookings, group_sizes, stays, lengths, seasons, age_flexible, distance_flexible)
  on public.preferences to authenticated;

/** One holiday preference matches a filter when any of their answers is picked. */
create function public.holiday_pick(p public.profiles, question text, wanted text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(wanted) = 0
      or exists (select 1 from jsonb_array_elements_text(coalesce(p.holiday_prefs -> question, '[]'::jsonb)) v where v = any (wanted))
$$;

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
          and (cardinality(prefs.budgets) = 0 or p.budget = any (prefs.budgets))
          and (cardinality(prefs.movings) = 0 or p.moving = any (prefs.movings))
          and (cardinality(prefs.travel_oftens) = 0 or p.travel_often = any (prefs.travel_oftens))
          and (cardinality(prefs.bookings) = 0 or p.booking = any (prefs.bookings))
          and (cardinality(prefs.group_sizes) = 0 or p.group_size = any (prefs.group_sizes))
          and public.holiday_pick(p, 'stay', prefs.stays)
          and public.holiday_pick(p, 'length', prefs.lengths)
          and public.holiday_pick(p, 'season', prefs.seasons))
$$;

-- How well someone fits one member's age, gender and distance choices:
-- null when they don't (they're hidden), 0 when they're inside them, and
-- the flexible penalty when they're just outside a flexible age range
-- (by up to matching.flexibleAgeYears) or distance (by up to half again).
create function public.preference_fit(age integer, gender text, km double precision, prefs public.preferences)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case
    when not (gender = any (prefs.genders)
              or (gender in ('genderfluid', 'agender', 'another') and 'nonbinary' = any (prefs.genders))
              or (gender = 'unsaid' and prefs.genders @> '{woman,man,nonbinary}'::text[])) then null
    else
      (case when age >= prefs.age_min and (prefs.age_max >= 99 or age <= prefs.age_max) then 0
            when prefs.age_flexible
             and age >= prefs.age_min - private.rule('matching.flexibleAgeYears')
             and (prefs.age_max >= 99 or age <= prefs.age_max + private.rule('matching.flexibleAgeYears'))
              then private.rule('matching.flexiblePenalty')
       end)
      + (case when prefs.max_distance_km is null or km is null or km <= prefs.max_distance_km then 0
              when prefs.distance_flexible and km <= prefs.max_distance_km * 1.5 then private.rule('matching.flexiblePenalty')
         end)
  end
$$;

-- 5 ----------------------------------------------------------------------
-- Points out of 100 (Lewis, 11 Oct): interests 50, places or trips 20,
-- travel style 30. Close answers on a scale get part of the points; an
-- unanswered question counts as halfway.
create or replace function public.style_points(a public.profiles, b public.profiles)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select 10 * public.scale_match(a.budget, b.budget, '{budget,comfort,luxury}')
       + 6 * public.scale_match(a.pace, b.pace, '{easy,slow,steady,busy,packed}')
       + 4 * public.scale_match(a.travel_style, b.travel_style, '{planner,mix,spontaneous}')
       + 4 * public.scale_match(a.moving, b.moving, '{base,few,move}')
       + 3 * public.scale_match(a.group_size, b.group_size, '{two,small,more}')
       + 2 * public.scale_match(a.travel_often, b.travel_often, '{once,twice,few,many}')
       + 1 * public.scale_match(a.booking, b.booking, '{ahead,weeks,last}')
$$;

/** Interests: 50 points, by how many of your picks you share. */
create function public.interest_points(a uuid, b uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select 50 * least(1, count(*)::numeric / private.rule('interests.pick'))
    from public.profile_interests x
    join public.profile_interests y on y.interest_id = x.interest_id and y.profile_id = b
   where x.profile_id = a
$$;

/** Places you both want to visit: 20 points against the shorter list, or 10 when either has none. */
create function public.place_points(a uuid, b uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    20 * (select count(*) from public.wishlist w join public.wishlist v on v.city_id = w.city_id and v.profile_id = b
           where w.profile_id = a)::numeric
       / nullif(least((select count(*) from public.wishlist where profile_id = a),
                      (select count(*) from public.wishlist where profile_id = b)), 0),
    10)
$$;

/** Recently active members rank higher: up to 9 points off after 30 days away. */
create function public.activity_penalty(p public.profiles)
returns numeric
language sql
stable
set search_path = ''
as $$
  select 0.3 * least(30, greatest(0, extract(epoch from now() - p.last_active_at) / 86400))::numeric
$$;

revoke all on function public.interest_points(uuid, uuid), public.place_points(uuid, uuid) from public, anon, authenticated;
revoke all on function public.holiday_pick(public.profiles, text, text[]) from public, anon;
revoke all on function public.preference_fit(integer, text, double precision, public.preferences) from public, anon;

-- 6 ----------------------------------------------------------------------
-- Connect: everyone who fits both ways. `score` is the match (for the words
-- on the card); `rank` is the order (flexible penalties, recent activity,
-- and people without a photo last).
drop function public.suggest_by_interests();
create function public.suggest_by_interests()
returns table (
  profile_id       uuid,
  display_name     text,
  birth_year       smallint,
  home_city        text,
  home_country     text,
  photo_path       text,
  travelling_with  text,
  distance_km      integer,
  shared_interests text[],
  shared_places    text[],
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
  my       public.profiles;
  my_prefs public.preferences;
  closed   uuid[] := public.closed_with(me);
  plus     boolean := public.has_plus(me);
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = me and status = 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  select * into my from public.profiles p where p.id = me;
  select * into my_prefs from public.preferences pr where pr.profile_id = me;

  return query
  with candidates as (
    select p as person, pr as their_prefs,
           case when p.home_city_id = my.home_city_id then 0 else public.member_distance_km(p.id, me) end as km
    from public.profiles p
    join public.preferences pr on pr.profile_id = p.id
    where p.id <> me
      and p.status = 'active'
      and p.onboarded_at is not null
      and p.last_active_at > now() - interval '60 days'
      and not (p.id = any (closed))
      and not public.is_skipped(me, p.id)
      and public.passes_viewer_filters(my_prefs, plus, p)
  ),
  fitting as (
    select c.*,
           public.preference_fit(public.member_age(c.person), (c.person).gender, c.km, my_prefs)
           -- their choices apply to you too, apart from distance
           + public.preference_fit(public.member_age(my), my.gender, null, c.their_prefs) as penalty
    from candidates c
  ),
  scored as (
    select f.*,
           public.interest_points(me, (f.person).id) + public.place_points(me, (f.person).id) + public.style_points(f.person, my) as total
    from fitting f
    where f.penalty is not null
  ),
  best as (
    select s.*,
           s.total - s.penalty - public.activity_penalty(s.person) - case when (s.person).photo_path is null then 100 else 0 end as ranking
    from scored s
    order by ranking desc
    limit private.rule('matching.maxSuggestions')
  )
  select (b.person).id, (b.person).display_name, public.age_year(b.person), hc.name, hc.country_code::text,
         (b.person).photo_path, (b.person).travelling_with,
         round(b.km)::int,
         array(select i.label from public.profile_interests a
                 join public.profile_interests m on m.interest_id = a.interest_id and m.profile_id = me
                 join public.interests i on i.id = a.interest_id
                where a.profile_id = (b.person).id
                order by i.sort),
         array(select ci.name from public.wishlist w
                 join public.wishlist v on v.city_id = w.city_id and v.profile_id = me
                 join public.cities ci on ci.id = w.city_id
                where w.profile_id = (b.person).id
                order by ci.name),
         round(b.total)::int,
         round(b.ranking, 2)
  from best b
  left join public.cities hc on hc.id = (b.person).home_city_id
  order by b.ranking desc;
end;
$$;
revoke all on function public.suggest_by_interests() from public, anon;
grant execute on function public.suggest_by_interests() to authenticated;

-- 7 ----------------------------------------------------------------------
-- People going to the same place as one of your trips, at overlapping
-- times (or nearby dates), for the tags on Connect and the Sodalis+ page.
-- `rank` adds matching.sameTripBonus for overlapping dates (plus 3 for a
-- member with Sodalis+, who shows a little higher). Without Sodalis+ you
-- see only the month of their trip, not the dates.
drop function public.suggest_for_trip(bigint);
create function public.suggest_for_trip(p_trip_id bigint)
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
           public.preference_fit(public.member_age(c.person), (c.person).gender, c.km, my_prefs)
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
revoke all on function public.suggest_for_trip(bigint) from public, anon;
grant execute on function public.suggest_for_trip(bigint) to authenticated;

-- 8 ----------------------------------------------------------------------
-- A trip's People section: the people you're in touch with going there at
-- the same time, best match first (interests 50, other trips in common 20,
-- travel style 30). Requests to you stay at the top.
create or replace function public.trip_companions(p_trip_id bigint)
returns table (
  profile_id     uuid,
  display_name   text,
  birth_year     smallint,
  home_city      text,
  home_country   text,
  photo_path     text,
  status         text,   -- connected, you_asked, they_asked, group
  trip_start     date,
  trip_end       date,
  overlap_start  date,
  overlap_end    date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me      uuid := auth.uid();
  my      public.profiles;
  my_trip public.trips;
  nearby  integer[];
begin
  select * into my_trip from public.trips t where t.id = p_trip_id and t.owner_id = me;
  if not found then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  select * into my from public.profiles p where p.id = me;
  nearby := private.nearby_cities(my_trip.city_id);

  return query
  with links as (
    select case when c.requester_id = me then c.addressee_id else c.requester_id end as other,
           case when c.status = 'accepted' then 'connected'
                when c.requester_id = me then 'you_asked'
                else 'they_asked' end as how
    from public.connections c
    where me in (c.requester_id, c.addressee_id) and c.status in ('pending', 'accepted')
  ),
  shared_groups as (
    select b.profile_id as other, g.start_date, g.end_date
    from public.group_members a
    join public.group_members b on b.group_id = a.group_id and b.profile_id <> me
    join public.groups g on g.id = a.group_id
    where a.profile_id = me and a.status = 'joined' and b.status = 'joined'
      and g.city_id = any (nearby)
      and g.start_date <= my_trip.end_date and g.end_date >= my_trip.start_date
  ),
  dates as (
    select l.other, l.how, t.start_date, t.end_date
    from links l
    join public.trips t on t.owner_id = l.other
    where t.city_id = any (nearby)
      and t.end_date >= current_date
      and (t.visibility = 'members' or l.how = 'connected')
      and t.start_date - t.flexible_days <= my_trip.end_date + my_trip.flexible_days
      and t.end_date + t.flexible_days >= my_trip.start_date - my_trip.flexible_days
    union all
    select s.other, coalesce((select l.how from links l where l.other = s.other), 'group'), s.start_date, s.end_date
    from shared_groups s
  ),
  best as (
    select distinct on (d.other) d.*,
           greatest(d.start_date, my_trip.start_date) as o_start,
           least(d.end_date, my_trip.end_date) as o_end
    from dates d
    order by d.other, least(d.end_date, my_trip.end_date) - greatest(d.start_date, my_trip.start_date) desc
  )
  select p.id, p.display_name, public.age_year(p), hc.name, hc.country_code::text, p.photo_path,
         b.how, b.start_date, b.end_date,
         case when b.o_start <= b.o_end then b.o_start end,
         case when b.o_start <= b.o_end then b.o_end end
  from best b
  join public.profiles p on p.id = b.other
  left join public.cities hc on hc.id = p.home_city_id
  where p.status = 'active'
    and not public.is_blocked(me, p.id)
  order by b.how = 'they_asked' desc,
           public.interest_points(me, p.id) + public.trip_points(me, p.id, p_trip_id) + public.style_points(p, my) desc,
           p.display_name;
end;
$$;

/** Other trips in common: 20 points for 2 or more of your other upcoming trips they're also on (10 for one). */
create function public.trip_points(a uuid, b uuid, except_trip bigint)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select 10 * least(2, count(distinct mine.id))::numeric
    from public.trips mine
    join public.trips theirs on theirs.owner_id = b
     and theirs.end_date >= current_date
     and theirs.city_id = any (private.nearby_cities(mine.city_id))
     and theirs.start_date <= mine.end_date and theirs.end_date >= mine.start_date
   where mine.owner_id = a
     and mine.id <> except_trip
     and mine.end_date >= current_date
$$;
revoke all on function public.trip_points(uuid, uuid, bigint) from public, anon, authenticated;

-- 9 ----------------------------------------------------------------------
-- The extras on someone's profile, now with the new travel style answers
-- and drinking and smoking.
drop function public.member_extras(uuid);
create function public.member_extras(p_profile uuid)
returns table (
  photo_book text[], holiday_prefs jsonb, holiday_locked boolean, sexuality text, religion text, ethnicity text,
  moving text, travel_often text, booking text, group_size text, drinking text, smoking text
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
         p.moving, p.travel_often, p.booking, p.group_size, p.drinking, p.smoking
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

-- 10 ---------------------------------------------------------------------
-- Sodalis+: other members' trip plans for inspiration. No names: just the
-- place, when, how long and the ideas on their plan (2 or more).
create function public.plan_inspiration()
returns table (trip_id bigint, city text, country_code text, month date, nights integer, ideas text[])
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, c.name, c.country_code::text, date_trunc('month', t.start_date)::date, (t.end_date - t.start_date)::int,
         array(select i.title from public.trip_plan_items i where i.trip_id = t.id order by i.day nulls last, i.id)
    from public.trips t
    join public.cities c on c.id = t.city_id
    join public.profiles p on p.id = t.owner_id and p.status = 'active'
   where public.has_plus(auth.uid())
     and t.owner_id <> auth.uid()
     and t.visibility = 'members'
     and not public.is_blocked(auth.uid(), t.owner_id)
     and (select count(*) from public.trip_plan_items i where i.trip_id = t.id) >= 2
   order by t.created_at desc
   limit 20
$$;
revoke all on function public.plan_inspiration() from public, anon;
grant execute on function public.plan_inspiration() to authenticated;

-- "On the road" (room sharing, mornings, walking) and languages no longer
-- count for matching; the answers stay saved.
drop function public.lifestyle_fit(public.profiles, public.profiles);
