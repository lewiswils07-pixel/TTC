-- pgTAP: suggest_for_trip (spec §4.1, §4.2). Hard filters, the mutual age
-- and gender rule, and the ranking order on fixed fixtures.
-- Run with: npx supabase test db
begin;
select plan(17);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

-- People: a = Ann, the viewer; the rest are other members.
insert into auth.users (id, email, aud, role)
select ('aaaaaaaa-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, n || '@example.com', 'authenticated', 'authenticated'
from generate_series(1, 11) n;

create function pg_temp.m(n int) returns uuid language sql as $$
  select ('aaaaaaaa-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

-- Leeds 2644688, Lisbon 2267057, Cascais 2269594 (about 25 km away), Paris 2988507.
update public.profiles p set
  display_name = v.name, gender = v.gender, birth_year = v.born, home_city_id = v.home,
  travel_style = v.style, pace = v.pace, budget = v.budget, onboarded_at = case when v.done then now() end,
  status = v.status
from (values
  (1,  'Ann', 'woman', 1960, 2644688, 'planner', 'slow', 'mid', true, 'active'),
  (2,  'Bob', 'man',   1962, 2267057, 'planner', 'slow', 'mid', true, 'active'),
  (3,  'Cat', 'woman', 1958, 2644688, 'spontaneous', 'packed', 'comfort', true, 'active'),
  (4,  'Dan', 'man',   1961, 2644688, null, null, null, true, 'active'),
  (5,  'Eve', 'woman', 1963, 2644688, null, null, null, true, 'active'),
  (6,  'Fay', 'woman', 1963, 2644688, null, null, null, true, 'active'),
  (7,  'Gus', 'man',   1963, 2644688, null, null, null, true, 'active'),
  (8,  'Hal', 'man',   1996, 2644688, null, null, null, true, 'active'),
  (9,  'Ivy', 'woman', 1963, 2644688, null, null, null, true, 'active'),
  (10, 'Jo',  'woman', 1963, 2644688, null, null, null, true, 'suspended'),
  (11, 'Kim', 'woman', 1963, 2644688, null, null, null, false, 'active')
) as v(n, name, gender, born, home, style, pace, budget, done, status)
where p.id = pg_temp.m(v.n);

insert into public.profile_interests (profile_id, interest_id) values
  (pg_temp.m(1), 1), (pg_temp.m(1), 2), (pg_temp.m(1), 3), (pg_temp.m(1), 4),
  (pg_temp.m(2), 1), (pg_temp.m(2), 2), (pg_temp.m(2), 3),
  (pg_temp.m(3), 1);

update public.preferences set age_min = 40 where profile_id = pg_temp.m(1);            -- Ann: 40 and over
update public.preferences set genders = '{man}' where profile_id = pg_temp.m(7);        -- Gus only wants men

-- Keep any demo trips from the local seed out of these fixtures.
update public.trips set visibility = 'hidden';

insert into public.trips (owner_id, city_id, start_date, end_date, flexible_days, visibility) values
  (pg_temp.m(1),  2267057, current_date + 30, current_date + 37, 0, 'members'),  -- Ann: Lisbon
  (pg_temp.m(2),  2267057, current_date + 32, current_date + 35, 0, 'members'),  -- Bob: best match
  (pg_temp.m(3),  2269594, current_date + 36, current_date + 40, 0, 'members'),  -- Cat: Cascais, 2 days overlap
  (pg_temp.m(4),  2267057, current_date + 40, current_date + 45, 0, 'members'),  -- Dan: no overlap
  (pg_temp.m(5),  2267057, current_date + 39, current_date + 42, 2, 'members'),  -- Eve: overlaps only with flexibility
  (pg_temp.m(6),  2267057, current_date + 31, current_date + 33, 0, 'hidden'),   -- Fay: hidden trip
  (pg_temp.m(7),  2267057, current_date + 31, current_date + 33, 0, 'members'),  -- Gus: wouldn't want Ann
  (pg_temp.m(8),  2267057, current_date + 31, current_date + 33, 0, 'members'),  -- Hal: 30, under Ann's minimum
  (pg_temp.m(9),  2988507, current_date + 31, current_date + 33, 0, 'members'),  -- Ivy: Paris
  (pg_temp.m(10), 2267057, current_date + 31, current_date + 33, 0, 'members'),  -- Jo: suspended
  (pg_temp.m(11), 2267057, current_date + 31, current_date + 33, 0, 'members'),  -- Kim: hasn't finished sign-up
  (pg_temp.m(2),  2267057, current_date + 60, current_date + 62, 0, 'members');  -- Bob's second trip: one card only

create temp table ann_trip as select id from public.trips where owner_id = pg_temp.m(1);
create temp table bob_trip as select min(id) as id from public.trips where owner_id = pg_temp.m(2);
grant select on ann_trip, bob_trip to authenticated;

-- ------------------------------------------------------------ as Ann
select pg_temp.sign_in_as(pg_temp.m(1));

select results_eq(
  'select display_name from public.suggest_for_trip((select id from ann_trip))',
  $$values ('Bob'::text), ('Cat'), ('Eve')$$,
  'Ann sees Bob, Cat and Eve, best match first');

select is((select score from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Bob'), 89, 'Bob scores 89 (3 of 4 interests, full overlap, same style)');
select is((select score from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Cat'), 24, 'Cat scores 24');
select is((select score from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Eve'), 18, 'Eve scores 18 (nothing in common, neutral style)');

select is((select cardinality(shared_interests) from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Bob'), 3, 'Bob''s card lists 3 shared interests');
select is((select overlap_start from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Bob'), current_date + 32, 'Bob''s card shows when they overlap');
select is((select overlap_start from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Eve'), null, 'Eve overlaps only through flexible dates');
select is((select trip_city from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Cat'), 'Cascais', 'nearby towns (within 30 km) count');

select is_empty($$select 1 from public.suggest_for_trip((select id from ann_trip)) where display_name in ('Dan', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kim')$$,
  'no-overlap, hidden, unwanted, out-of-range, elsewhere, suspended and unfinished members are left out');
select is((select count(*)::int from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Bob'), 1, 'one card per member, even with two trips');

select throws_ok('select * from public.suggest_for_trip((select id from bob_trip))', 'P0002', 'Trip not found', 'Ann cannot get suggestions for Bob''s trip');

-- Ann only wants people within 50 km of home: Bob lives in Lisbon.
reset role;
update public.preferences set max_distance_km = 50 where profile_id = pg_temp.m(1);
select pg_temp.sign_in_as(pg_temp.m(1));
select results_eq('select display_name from public.suggest_for_trip((select id from ann_trip))', $$values ('Cat'::text), ('Eve')$$,
  'the distance filter uses home towns');
reset role;

-- Mutual: if Bob only wants to see people under 60, Ann (66) doesn't see him either.
update public.preferences set max_distance_km = null where profile_id = pg_temp.m(1);
update public.preferences set age_max = 60 where profile_id = pg_temp.m(2);
select pg_temp.sign_in_as(pg_temp.m(1));
select is_empty($$select 1 from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Bob'$$,
  'the age rule works both ways');
reset role;

-- Signed out.
set local role anon;
select throws_ok('select * from public.suggest_for_trip(1)', '42501', null, 'signed-out visitors cannot get suggestions');
reset role;

-- Photos: only a member's current photo is shared.
update public.profiles set photo_path = pg_temp.m(2) || '/now.jpg' where id = pg_temp.m(2);
select ok(public.is_current_profile_photo(pg_temp.m(2) || '/now.jpg'), 'a member''s current photo can be shown to others');
select ok(not public.is_current_profile_photo(pg_temp.m(2) || '/old.jpg'), 'old photos stay private');
select ok(not public.is_current_profile_photo(pg_temp.m(11) || '/x.jpg'), 'photos of unfinished profiles stay private');

select * from finish();
rollback;
