-- matching, trip mode (spec §4.1, §4.2): suggest_for_trip(trip_id) returns
-- up to 20 members going to the same place at the same time, best first,
-- with the reasons we think they'd get on. Members never read each other's
-- rows directly; this function returns a fixed set of public fields.
--
-- Not yet applied here: the phone check (T4). Blocks and connection
-- history come in through pair_is_closed (T11, T14), and Sodalis+
-- filters through passes_viewer_filters (T10).

-- Distance between two cities in km (haversine).
create function public.city_distance_km(a integer, b integer)
returns double precision
language sql
stable
set search_path = ''
as $$
  select case when a = b then 0 else
    2 * 6371 * asin(sqrt(
      power(sin(radians(cb.lat - ca.lat) / 2), 2)
      + cos(radians(ca.lat)) * cos(radians(cb.lat)) * power(sin(radians(cb.lng - ca.lng) / 2), 2)
    )) end
  from public.cities ca, public.cities cb
  where ca.id = a and cb.id = b
$$;

-- How close two answers on a 3-step scale are: same 1, next door 0.5,
-- opposite ends 0, not answered 0.5 (spec §4.2).
create function public.scale_match(a text, b text, steps text[])
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when a is null or b is null then 0.5
    when a = b then 1
    when abs(array_position(steps, a) - array_position(steps, b)) = 1 then 0.5
    else 0
  end
$$;

-- Age as this year minus birth year (members only give the year).
create function public.age_from_year(birth_year smallint)
returns integer
language sql
stable
set search_path = ''
as $$ select extract(year from current_date)::int - birth_year $$;

-- Does a member of this age and gender fit these preferences? 99 means "99+".
create function public.fits_preferences(age integer, gender text, prefs public.preferences)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select age >= prefs.age_min
     and (prefs.age_max >= 99 or age <= prefs.age_max)
     and gender = any (prefs.genders)
$$;

-- Is anything between these two members that should keep them out of
-- each other's suggestions? Nothing yet: the connections migration
-- replaces this with the real rule (open request, or declined lately).
create function public.pair_is_closed(a uuid, b uuid)
returns boolean
language sql
stable
set search_path = ''
as $$ select false $$;
revoke all on function public.pair_is_closed(uuid, uuid) from public, anon, authenticated;

-- Does this member pass the viewer's Sodalis+ filters (verified only,
-- style, pace, budget)? Everyone does for now: the filters migration
-- replaces this once there's a way to tell who has Sodalis+.
create function public.passes_viewer_filters(prefs public.preferences, p public.profiles)
returns boolean
language sql
stable
set search_path = ''
as $$ select true $$;
revoke all on function public.passes_viewer_filters(public.preferences, public.profiles) from public, anon, authenticated;

create function public.suggest_for_trip(p_trip_id bigint)
returns table (
  profile_id       uuid,
  display_name     text,
  birth_year       smallint,
  home_city        text,
  home_country     text,
  photo_path       text,
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
begin
  select * into my_trip from public.trips t where t.id = p_trip_id and t.owner_id = me;
  if not found then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  select * into my from public.profiles p where p.id = me;
  select * into my_prefs from public.preferences pr where pr.profile_id = me;

  return query
  with candidates as (
    select t.owner_id, t.city_id, t.start_date, t.end_date,
           p.display_name, p.birth_year, p.home_city_id, p.photo_path,
           p.travel_style, p.pace, p.budget, p.last_active_at,
           -- real overlap, before any flexibility
           greatest(t.start_date, my_trip.start_date) as o_start,
           least(t.end_date, my_trip.end_date) as o_end
    from public.trips t
    join public.profiles p on p.id = t.owner_id
    join public.preferences pr on pr.profile_id = p.id
    where t.owner_id <> me
      and t.visibility = 'members'
      and t.end_date >= current_date
      -- same place, or within 30 km (Lisbon and Cascais)
      and (t.city_id = my_trip.city_id or public.city_distance_km(t.city_id, my_trip.city_id) <= 30)
      -- date windows, each widened by its flexibility, overlap by a day or more
      and t.start_date - t.flexible_days <= my_trip.end_date + my_trip.flexible_days
      and my_trip.start_date - my_trip.flexible_days <= t.end_date + t.flexible_days
      and p.status = 'active'
      and p.onboarded_at is not null
      and not public.pair_is_closed(me, p.id)
      -- mutual: each fits what the other is looking for
      and public.fits_preferences(public.age_from_year(p.birth_year), p.gender, my_prefs)
      and public.fits_preferences(public.age_from_year(my.birth_year), my.gender, pr)
      and (my_prefs.max_distance_km is null
           or public.city_distance_km(p.home_city_id, my.home_city_id) <= my_prefs.max_distance_km)
      and public.passes_viewer_filters(my_prefs, p)
  ),
  scored as (
    select c.*,
           array(select i.label from public.profile_interests a
                   join public.profile_interests b on b.interest_id = a.interest_id and b.profile_id = me
                   join public.interests i on i.id = a.interest_id
                  where a.profile_id = c.owner_id
                  order by i.sort) as shared,
           (select count(distinct interest_id) from public.profile_interests
             where profile_id in (c.owner_id, me)) as union_count,
           greatest(0, c.o_end - c.o_start + 1)::numeric
             / least(c.end_date - c.start_date + 1, my_trip.end_date - my_trip.start_date + 1) as date_fit
    from candidates c
  ),
  ranked as (
    select s.*,
           round(
             45 * coalesce(cardinality(s.shared)::numeric / nullif(s.union_count, 0), 0)
             + 20 * s.date_fit
             + 15 * public.scale_match(s.travel_style, my.travel_style, '{planner,mix,spontaneous}')
             + 10 * public.scale_match(s.pace, my.pace, '{slow,steady,packed}')
             + 10 * public.scale_match(s.budget, my.budget, '{budget,mid,comfort}')
           )::int as total,
           -- one card per member: their best-matching trip
           row_number() over (partition by s.owner_id order by s.date_fit desc, s.start_date) as nth
    from scored s
  )
  select r.owner_id, r.display_name, r.birth_year, hc.name, hc.country_code::text, r.photo_path,
         tc.name, r.start_date, r.end_date,
         case when r.o_start <= r.o_end then r.o_start end,
         case when r.o_start <= r.o_end then r.o_end end,
         r.shared, r.total
  from ranked r
  join public.cities tc on tc.id = r.city_id
  left join public.cities hc on hc.id = r.home_city_id
  where r.nth = 1
  order by r.total desc, r.last_active_at desc
  limit 20;
end;
$$;

revoke all on function public.suggest_for_trip(bigint) from public, anon;
grant execute on function public.suggest_for_trip(bigint) to authenticated;
revoke all on function public.city_distance_km(integer, integer) from public, anon;
revoke all on function public.fits_preferences(integer, text, public.preferences) from public, anon;

-- Suggested members' photos: any signed-in member may read a file that is
-- some active, finished profile's current photo (via short-lived signed
-- links). Old or replaced photos stay private to their owner.
-- (security definer: the policy runs as the viewer, who can't read other
-- members' profile rows.)
create function public.is_current_profile_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.photo_path = object_name and p.status = 'active' and p.onboarded_at is not null
  )
$$;
revoke all on function public.is_current_profile_photo(text) from public, anon;
grant execute on function public.is_current_profile_photo(text) to authenticated;

create policy "Members see other members' current photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and public.is_current_profile_photo(name));
