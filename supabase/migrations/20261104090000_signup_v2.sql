-- Sign-up polish (Lewis, 6 Oct).
-- 1. A wider list of genders. "Non-binary" in Filters also shows members who
--    are genderfluid, agender or another identity.
-- 2. "Recently online" on suggestion cards.
-- 3. "Use my location": distances from an exact spot, kept private.

-- 1 ---------------------------------------------------------------------
alter table public.profiles drop constraint profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check
  check (gender in ('woman', 'man', 'nonbinary', 'genderfluid', 'agender', 'another', 'unsaid'));

create or replace function public.fits_preferences(age integer, gender text, prefs public.preferences)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select age >= prefs.age_min
     and (prefs.age_max >= 99 or age <= prefs.age_max)
     and (gender = any (prefs.genders)
          or (gender in ('genderfluid', 'agender', 'another') and 'nonbinary' = any (prefs.genders))
          or (gender = 'unsaid' and prefs.genders @> '{woman,man,nonbinary}'::text[]))
$$;

-- 2 ---------------------------------------------------------------------
-- Which of these members used the app recently. Only for signed-in members,
-- and never for someone blocked either way.
create function public.recently_online(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where auth.uid() is not null
    and p.id = any (p_ids[1:100])
    and p.status = 'active'
    and p.onboarded_at is not null
    and p.last_active_at > now() - make_interval(hours => private.rule('connections.recentlyOnlineHours'))
    and not public.is_blocked(auth.uid(), p.id)
$$;
revoke all on function public.recently_online(uuid[]) from public, anon;
grant execute on function public.recently_online(uuid[]) to authenticated;

-- 3 ---------------------------------------------------------------------
-- "Use my location" (Lewis, 6 Oct): an optional exact spot, used only to
-- work out distances. Nobody else can read it: other members see the
-- nearest town and country, set as the home city.
create table public.member_locations (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  updated_at  timestamptz not null default now()
);
alter table public.member_locations enable row level security;
create policy "Members see their own location" on public.member_locations
  for select to authenticated using (profile_id = auth.uid());
create policy "Members can remove their own location" on public.member_locations
  for delete to authenticated using (profile_id = auth.uid());
revoke all on public.member_locations from anon;
grant select, delete on public.member_locations to authenticated;

-- Saves the member's spot (rounded to about 100 m) and makes the nearest
-- town their home city. Returns that town.
create function public.set_my_location(p_lat double precision, p_lng double precision)
returns table (id integer, name text, country_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  town public.cities;
begin
  if me is null then
    raise exception 'Please sign in again' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'We couldn''t read your location' using errcode = 'check_violation';
  end if;
  select c.* into town from public.cities c
  order by power(c.lat - p_lat, 2) + power((c.lng - p_lng) * cos(radians(p_lat)), 2)
  limit 1;
  insert into public.member_locations (profile_id, lat, lng, updated_at)
  values (me, round(p_lat::numeric, 3), round(p_lng::numeric, 3), now())
  on conflict (profile_id) do update set lat = excluded.lat, lng = excluded.lng, updated_at = now();
  update public.profiles set home_city_id = town.id where profiles.id = me;
  return query select town.id, town.name, town.country_code::text;
end;
$$;
revoke all on function public.set_my_location(double precision, double precision) from public, anon;
grant execute on function public.set_my_location(double precision, double precision) to authenticated;

-- How far apart two members live: between their exact spots when both have
-- one, otherwise between their home towns.
create function public.member_distance_km(a uuid, b uuid)
returns double precision
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select 2 * 6371 * asin(least(1, sqrt(
              power(sin(radians(lb.lat - la.lat) / 2), 2)
              + cos(radians(la.lat)) * cos(radians(lb.lat)) * power(sin(radians(lb.lng - la.lng) / 2), 2))))
       from public.member_locations la, public.member_locations lb
      where la.profile_id = a and lb.profile_id = b),
    (select public.city_distance_km(pa.home_city_id, pb.home_city_id)
       from public.profiles pa, public.profiles pb
      where pa.id = a and pb.id = b))
$$;
revoke all on function public.member_distance_km(uuid, uuid) from public, anon, authenticated;

create or replace function public.suggest_by_interests()
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
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
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
           public.member_distance_km(p.id, my.id) as km
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
           or p.home_city_id = my.home_city_id
           or public.member_distance_km(p.id, my.id) <= my_prefs.max_distance_km)
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
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
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
           or p.home_city_id = my.home_city_id
           or public.member_distance_km(p.id, my.id) <= my_prefs.max_distance_km)
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
