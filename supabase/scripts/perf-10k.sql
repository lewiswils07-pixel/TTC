-- Speed check (spec §4.4, task T12): with 10,000 members, suggestions must
-- come back in under 300 ms. LOCAL database only. Everything runs inside
-- one transaction that is rolled back, so the local data is left as it was.
--
--   docker exec -i supabase_db_ttc psql -U postgres -q < supabase/scripts/perf-10k.sql
--
-- Prints the average and slowest time for each kind of suggestion, over
-- 25 members picked at random. Members get 1 or 2 trips across 60 cities
-- over 6 months. (Checked 5 Oct 2026: about 10 ms for a trip, 60 ms by
-- interests. An extreme case with all 10,000 in one city in the same
-- fortnight takes about 0.5 s per search.)

begin;
select setseed(0.7);

insert into auth.users (id, aud, role, email)
select ('00000000-0000-4000-9000-' || lpad(i::text, 12, '0'))::uuid, 'authenticated', 'authenticated', 'perf' || i || '@example.com'
from generate_series(1, 10000) i;

-- 150 home towns in the UK and Ireland, and 60 holiday cities.
create temp table perf_ids as select
  (select array_agg(id) from (select id from public.cities where country_code in ('GB', 'IE')
     and population > 30000 order by population desc limit 150) h) as homes,
  (select array_agg(id) from (select id from public.cities where country_code in ('ES', 'PT', 'IT', 'FR', 'GR', 'NL', 'DE', 'HR')
     and population > 150000 order by population desc limit 60) d) as places;

update public.profiles p
   set display_name = 'Perf ' || right(p.id::text, 5),
       gender = (array['woman', 'woman', 'man', 'man', 'nonbinary'])[1 + floor(random() * 5)::int],
       birth_year = 1946 + floor(random() * 50)::int,
       home_city_id = (select homes from perf_ids)[1 + floor(random() * 150)::int],
       travel_style = (array['planner', 'mix', 'spontaneous'])[1 + floor(random() * 3)::int],
       pace = (array['slow', 'steady', 'packed'])[1 + floor(random() * 3)::int],
       budget = (array['budget', 'mid', 'comfort'])[1 + floor(random() * 3)::int],
       onboarded_at = now(),
       last_active_at = now() - make_interval(days => floor(random() * 60)::int)
 where p.id::text like '00000000-0000-4000-9000-%';

update public.preferences
   set age_min = 18 + floor(random() * 30)::int, age_max = 70 + floor(random() * 30)::int,
       max_distance_km = (array[null, null, 150, 500])[1 + floor(random() * 4)::int]
 where profile_id::text like '00000000-0000-4000-9000-%';

-- 3 to 10 interests each.
insert into public.profile_interests (profile_id, interest_id)
select p.id, x.id
from public.profiles p
cross join lateral (
  select i.id from public.interests i where p.id is not null order by random() limit 3 + floor(random() * 8)::int
) x
where p.id::text like '00000000-0000-4000-9000-%';

-- 1 or 2 trips each over the next 6 months, across 60 cities.
insert into public.trips (owner_id, city_id, start_date, end_date, flexible_days)
select p.id, t.city_id, t.start_date, t.start_date + 2 + floor(random() * 10)::int, (array[0, 0, 1, 3, 7])[1 + floor(random() * 5)::int]
from public.profiles p
cross join lateral (
  select (select places from perf_ids)[1 + floor(random() * 60)::int] as city_id,
         current_date + 3 + floor(random() * 180)::int as start_date
  from generate_series(1, 1 + floor(random() * 2)::int) g
  where p.id is not null                 -- ties the subquery to each member, so each gets their own
) t
where p.id::text like '00000000-0000-4000-9000-%';

-- Up to 5 wishlist places each.
insert into public.wishlist (profile_id, city_id)
select distinct p.id, (select places from perf_ids)[1 + floor(random() * 60)::int]
from public.profiles p
cross join lateral generate_series(1, case when p.id is null then 0 else floor(random() * 6)::int end) g
where p.id::text like '00000000-0000-4000-9000-%';

analyze public.profiles, public.preferences, public.profile_interests, public.trips, public.wishlist;

create temp table perf_times (kind text, ms numeric, rows int);
do $$
declare
  member uuid;
  trip   bigint;
  t0     timestamptz;
  n      int;
begin
  for member, trip in
    select t.owner_id, min(t.id) from public.trips t
    where t.owner_id::text like '00000000-0000-4000-9000-%'
    group by t.owner_id order by random() limit 25
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
    t0 := clock_timestamp();
    select count(*) into n from public.suggest_for_trip(trip);
    insert into perf_times values ('for a trip', extract(epoch from clock_timestamp() - t0) * 1000, n);
    t0 := clock_timestamp();
    select count(*) into n from public.suggest_by_interests();
    insert into perf_times values ('by interests', extract(epoch from clock_timestamp() - t0) * 1000, n);
  end loop;
end;
$$;

select kind, round(avg(ms)) as avg_ms, round(max(ms)) as slowest_ms, round(avg(rows)) as avg_cards,
       case when max(ms) < 300 then 'PASS' else 'TOO SLOW' end as result
from perf_times group by kind order by kind;

rollback;
