-- pgTAP: suggest_by_interests (spec §4.1, §4.3). At least 2 shared
-- interests, the hard filters, and the ranking order on fixed fixtures.
-- Run with: npx supabase test db
begin;
select plan(9);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('dddddddd-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'i' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 8) n;

-- Leeds 2644688, York 2633352 (about 35 km), Paris 2988507.
update public.profiles p set photo_path = p.id || '/photo.jpg',
  display_name = v.name, gender = v.gender, birth_year = v.born, home_city_id = v.home,
  travel_style = v.style, pace = v.pace, budget = v.budget, onboarded_at = now()
from (values
  (1, 'Ann', 'woman', 1960, 2644688, 'planner', 'slow', 'mid'),
  (2, 'Bob', 'man',   1962, 2633352, 'planner', 'slow', 'mid'),
  (3, 'Cat', 'woman', 1958, 2644688, 'spontaneous', 'packed', 'comfort'),
  (4, 'Dan', 'man',   1961, 2644688, null, null, null),
  (5, 'Eve', 'woman', 1963, 2988507, null, null, null),
  (6, 'Fay', 'woman', 1990, 2644688, null, null, null),
  (7, 'Gus', 'man',   1960, 2644688, null, null, null),
  (8, 'Hal', 'man',   1960, 2644688, null, null, null)
) as v(n, name, gender, born, home, style, pace, budget)
where p.id = pg_temp.m(v.n);

-- Clear seed data that could leak into the results.
delete from public.profile_interests where profile_id not in (select pg_temp.m(n) from generate_series(1, 8) n);

insert into public.profile_interests (profile_id, interest_id)
select pg_temp.m(v.n), unnest(v.ids) from (values
  (1, array[1, 2, 3, 4]),
  (2, array[1, 2, 3]),          -- Bob: 3 shared, same style
  (3, array[1, 2, 9, 10]),      -- Cat: 2 shared, opposite style
  (4, array[1, 2, 11]),         -- Dan: 2 shared, plus a shared place
  (5, array[1, 2, 3, 4]),       -- Eve: lives in Paris
  (6, array[1, 2, 3, 4]),       -- Fay: 36, under Ann's minimum age
  (7, array[1, 12, 13]),        -- Gus: only 1 shared
  (8, array[1, 2, 3])           -- Hal: Ann blocked him
) as v(n, ids);

update public.preferences set age_min = 40 where profile_id = pg_temp.m(1);
insert into public.wishlist (profile_id, city_id) values
  (pg_temp.m(1), 2988507), (pg_temp.m(4), 2988507), (pg_temp.m(4), 2267057);
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.m(1), pg_temp.m(8));

select pg_temp.sign_in_as(pg_temp.m(1));
select results_eq('select display_name from public.suggest_by_interests()', $$values ('Bob'::text), ('Eve'), ('Dan'), ('Cat')$$,
  'Ann sees Bob, Eve, Dan and Cat, best match first');
select is((select score from public.suggest_by_interests() where display_name = 'Bob'), 62, 'Bob scores 62 (3 of 4 interests, same style)');
select is((select score from public.suggest_by_interests() where display_name = 'Dan'), 51, 'Dan scores 51 (2 of 5 interests, a shared place)');
select is((select shared_places from public.suggest_by_interests() where display_name = 'Dan'), array['Paris'], 'Dan''s card says you both want to visit Paris');
select is((select distance_km from public.suggest_by_interests() where display_name = 'Bob') between 30 and 40, true, 'cards show how far away they live');
select is_empty($$select 1 from public.suggest_by_interests() where display_name in ('Fay', 'Gus', 'Hal')$$,
  'out-of-range, 1-interest and blocked members are left out');

reset role;
update public.preferences set max_distance_km = 50 where profile_id = pg_temp.m(1);
select pg_temp.sign_in_as(pg_temp.m(1));
select results_eq('select display_name from public.suggest_by_interests()', $$values ('Bob'::text), ('Dan'), ('Cat')$$,
  'the distance filter leaves out Eve in Paris');
reset role;

set local role anon;
select throws_ok('select * from public.suggest_by_interests()', '42501', null, 'signed-out visitors cannot get suggestions');
reset role;

select pg_temp.sign_in_as(pg_temp.m(7));
select is_empty($$select 1 from public.suggest_by_interests() where display_name = 'Ann'$$, 'Gus, sharing 1 interest, doesn''t see Ann');

select * from finish();
rollback;
