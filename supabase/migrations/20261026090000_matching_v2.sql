-- matching v2 (Lewis's answers to the 12 matching questions, 5 Oct).
--  1. Same place: same town or within 30 km (unchanged).
--  2. Dates: trips must share at least 2 days (after each trip's
--     flexibility), or the whole of a shorter trip.
--  3. Weights: interests 50, dates 20, budget 15, style 10, pace 5. With
--     no trip in common, the 20 for dates goes to places both want to visit.
--  4, 5. Age and gender stay strict, both ways (unchanged).
--  6. The app shows words ("Great match") instead of a number.
--  7. A photo is needed to ask to connect; members without one show lower down.
--  8. Members who haven't opened the app for 60 days are left out.
--  9. One person per profile, with an optional "travelling with" note.
-- 10, 11, 12. New questions: room sharing, early riser or night owl,
--     walking, and languages spoken. Together they can lower a score by up
--     to 15% when they clash; they never hide anyone.

-- ------------------------------------------------------------ new answers
alter table public.profiles
  add column travelling_with text check (char_length(btrim(travelling_with)) between 1 and 80),
  add column room_sharing   text check (room_sharing in ('share', 'unsure', 'separate')),
  add column day_rhythm     text check (day_rhythm in ('early', 'either', 'late')),
  add column walking        text check (walking in ('gentle', 'moderate', 'lots')),
  add column languages      text[] not null default '{}'
    check (cardinality(languages) <= 10 and array_to_string(languages, ',') ~ '^([a-z]{2}(,[a-z]{2})*)?$');

grant update (travelling_with, room_sharing, day_rhythm, walking, languages)
  on public.profiles to authenticated;

-- ------------------------------------------------------------ last active
-- The app calls this when a signed-in member opens it. It writes at most
-- once an hour, so it stays cheap.
create function public.touch_last_active()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set last_active_at = now()
  where id = auth.uid() and last_active_at < now() - interval '1 hour'
$$;
revoke all on function public.touch_last_active() from public, anon;
grant execute on function public.touch_last_active() to authenticated;

-- ------------------------------------------------------- photo to connect
create function public.connections_need_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = new.requester_id and photo_path is not null) then
    raise exception 'Add a profile photo before asking to connect' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.connections_need_photo() from public, anon, authenticated;

create trigger connections_need_photo
  before insert on public.connections
  for each row execute function public.connections_need_photo();

-- ------------------------------------------------------------ the scoring
-- How well two members' everyday habits fit, from 0 (clash) to 1. Unanswered
-- questions count as neutral.
create function public.lifestyle_fit(a public.profiles, b public.profiles)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select (
    public.scale_match(a.room_sharing, b.room_sharing, '{share,unsure,separate}')
    + public.scale_match(a.day_rhythm, b.day_rhythm, '{early,either,late}')
    + public.scale_match(a.walking, b.walking, '{gentle,moderate,lots}')
    + case when cardinality(a.languages) = 0 or cardinality(b.languages) = 0 then 0.5
           when a.languages && b.languages then 1 else 0 end
  ) / 4
$$;

-- Style, pace and budget with Lewis's weights (out of 30).
create function public.style_points(a public.profiles, b public.profiles)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select 10 * public.scale_match(a.travel_style, b.travel_style, '{planner,mix,spontaneous}')
       + 5 * public.scale_match(a.pace, b.pace, '{slow,steady,packed}')
       + 15 * public.scale_match(a.budget, b.budget, '{budget,mid,comfort}')
$$;
revoke all on function public.lifestyle_fit(public.profiles, public.profiles) from public, anon;
revoke all on function public.style_points(public.profiles, public.profiles) from public, anon;

-- ------------------------------------------------------------ trip mode
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
  score            integer
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
  select * into my_trip from public.trips t where t.id = p_trip_id and t.owner_id = me;
  if not found then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  select * into my from public.profiles p where p.id = me;
  select * into my_prefs from public.preferences pr where pr.profile_id = me;
  -- The trip's town and everywhere within 30 km, worked out once.
  select array_agg(c.id) into nearby
  from public.cities c, public.cities m
  where m.id = my_trip.city_id
    and c.lat between m.lat - 0.3 and m.lat + 0.3
    and abs(c.lng - m.lng) <= 0.3 / greatest(cos(radians(m.lat)), 0.01)
    and public.city_distance_km(c.id, m.id) <= 30;

  return query
  with candidates as (
    select t.owner_id, t.city_id, t.start_date, t.end_date, p as person,
           -- real overlap, before any flexibility
           greatest(t.start_date, my_trip.start_date) as o_start,
           least(t.end_date, my_trip.end_date) as o_end
    from public.trips t
    join public.profiles p on p.id = t.owner_id
    join public.preferences pr on pr.profile_id = p.id
    where t.owner_id <> me
      and t.visibility = 'members'
      and t.end_date >= current_date
      and t.city_id = any (nearby)
      -- the windows, each widened by its flexibility, share 2 days or more
      -- (or all of a one-day trip)
      and least(t.end_date + t.flexible_days, my_trip.end_date + my_trip.flexible_days)
          - greatest(t.start_date - t.flexible_days, my_trip.start_date - my_trip.flexible_days) + 1
          >= least(2, t.end_date - t.start_date + 1, my_trip.end_date - my_trip.start_date + 1)
      and p.status = 'active'
      and p.onboarded_at is not null
      and p.last_active_at > now() - interval '60 days'
      and not (p.id = any (closed))
      and public.fits_preferences(public.age_from_year(p.birth_year), p.gender, my_prefs)
      and public.fits_preferences(public.age_from_year(my.birth_year), my.gender, pr)
      and (my_prefs.max_distance_km is null
           or public.city_distance_km(p.home_city_id, my.home_city_id) <= my_prefs.max_distance_km)
      and public.passes_viewer_filters(my_prefs, plus, p)
  ),
  scored as (
    select c.*,
           (select count(*) from public.profile_interests a
              join public.profile_interests b on b.interest_id = a.interest_id and b.profile_id = me
             where a.profile_id = c.owner_id) as shared_count,
           (select count(distinct interest_id) from public.profile_interests
             where profile_id in (c.owner_id, me)) as union_count,
           greatest(0, c.o_end - c.o_start + 1)::numeric
             / least(c.end_date - c.start_date + 1, my_trip.end_date - my_trip.start_date + 1) as date_fit
    from candidates c
  ),
  ranked as (
    select s.*,
           round(
             (50 * coalesce(s.shared_count::numeric / nullif(s.union_count, 0), 0)
              + 20 * s.date_fit
              + public.style_points(s.person, my))
             * (0.85 + 0.15 * public.lifestyle_fit(s.person, my))
           )::int as total,
           -- one card per member: their best-matching trip
           row_number() over (partition by s.owner_id order by s.date_fit desc, s.start_date) as nth
    from scored s
  ),
  best as (
    select * from ranked r where r.nth = 1
    order by (r.person).photo_path is null, r.total desc, (r.person).last_active_at desc limit 20
  )
  select b.owner_id, (b.person).display_name, (b.person).birth_year, hc.name, hc.country_code::text,
         (b.person).photo_path, (b.person).travelling_with,
         tc.name, b.start_date, b.end_date,
         case when b.o_start <= b.o_end then b.o_start end,
         case when b.o_start <= b.o_end then b.o_end end,
         array(select i.label from public.profile_interests x
                 join public.profile_interests y on y.interest_id = x.interest_id and y.profile_id = me
                 join public.interests i on i.id = x.interest_id
                where x.profile_id = b.owner_id
                order by i.sort),
         b.total
  from best b
  join public.cities tc on tc.id = b.city_id
  left join public.cities hc on hc.id = (b.person).home_city_id
  order by (b.person).photo_path is null, b.total desc, (b.person).last_active_at desc;
end;
$$;
revoke all on function public.suggest_for_trip(bigint) from public, anon;
grant execute on function public.suggest_for_trip(bigint) to authenticated;

-- -------------------------------------------------------- interests mode
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
  score            integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me        uuid := auth.uid();
  my        public.profiles;
  my_prefs  public.preferences;
  my_count  integer;
  my_places integer;
  closed    uuid[] := public.closed_with(me);
  plus      boolean := public.has_plus(me);
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into my from public.profiles p where p.id = me;
  select * into my_prefs from public.preferences pr where pr.profile_id = me;
  select count(*) into my_count from public.profile_interests where profile_id = me;
  select count(*) into my_places from public.wishlist where profile_id = me;

  return query
  with mine as (
    select interest_id from public.profile_interests where profile_id = me
  ),
  -- Only members sharing 2 or more interests are worth looking at.
  overlap as (
    select pi.profile_id as owner_id, count(*)::int as shared_count
    from public.profile_interests pi
    join mine using (interest_id)
    where pi.profile_id <> me
    group by pi.profile_id
    having count(*) >= 2
  ),
  candidates as (
    select o.owner_id, o.shared_count, p as person,
           public.city_distance_km(p.home_city_id, my.home_city_id) as km
    from overlap o
    join public.profiles p on p.id = o.owner_id
    join public.preferences pr on pr.profile_id = p.id
    where p.status = 'active'
      and p.onboarded_at is not null
      and p.last_active_at > now() - interval '60 days'
      and not (p.id = any (closed))
      and public.fits_preferences(public.age_from_year(p.birth_year), p.gender, my_prefs)
      and public.fits_preferences(public.age_from_year(my.birth_year), my.gender, pr)
      and (my_prefs.max_distance_km is null
           or public.city_distance_km(p.home_city_id, my.home_city_id) <= my_prefs.max_distance_km)
      and public.passes_viewer_filters(my_prefs, plus, p)
  ),
  scored as (
    select c.*,
           round(
             -- interests: Jaccard overlap
             (50 * c.shared_count::numeric
                / (my_count + (select count(*) from public.profile_interests where profile_id = c.owner_id) - c.shared_count)
              -- places both want to visit, against the shorter list
              + 20 * coalesce(
                  (select count(*) from public.wishlist w join public.wishlist v on v.city_id = w.city_id and v.profile_id = me
                    where w.profile_id = c.owner_id)::numeric
                  / nullif(least(my_places, (select count(*) from public.wishlist where profile_id = c.owner_id)), 0), 0)
              + public.style_points(c.person, my))
             * (0.85 + 0.15 * public.lifestyle_fit(c.person, my))
           )::int as total
    from candidates c
  ),
  best as (
    select * from scored s
    order by (s.person).photo_path is null, s.total desc, (s.person).last_active_at desc limit 20
  )
  select b.owner_id, (b.person).display_name, (b.person).birth_year, hc.name, hc.country_code::text,
         (b.person).photo_path, (b.person).travelling_with,
         round(b.km)::int,
         array(select i.label from public.profile_interests a
                 join mine m on m.interest_id = a.interest_id
                 join public.interests i on i.id = a.interest_id
                where a.profile_id = b.owner_id
                order by i.sort),
         array(select ci.name from public.wishlist w
                 join public.wishlist v on v.city_id = w.city_id and v.profile_id = me
                 join public.cities ci on ci.id = w.city_id
                where w.profile_id = b.owner_id
                order by ci.name),
         b.total
  from best b
  left join public.cities hc on hc.id = (b.person).home_city_id
  order by (b.person).photo_path is null, b.total desc, (b.person).last_active_at desc;
end;
$$;
revoke all on function public.suggest_by_interests() from public, anon;
grant execute on function public.suggest_by_interests() to authenticated;
