-- pgTAP: travel style v2 (Lewis, 11 Oct). The new questions and their
-- answers, flexible age, the Sodalis+ filters for every question, month-only
-- trip dates without Sodalis+, and trip plans for inspiration.
-- Run with: npx supabase test db
begin;
select plan(13);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('ffffffff-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 't' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 5) n;

-- Everyone lives in Leeds (2644688).
update public.profiles p set photo_path = p.id || '/photo.jpg',
  display_name = v.name, gender = 'woman', birth_year = v.born, home_city_id = 2644688, onboarded_at = now(),
  holiday_prefs = v.prefs::jsonb
from (values
  (1, 'Ann', extract(year from now())::int - 65, '{}'),
  (2, 'Bob', extract(year from now())::int - 64, '{"stay": ["hotel", "bnb"]}'),  -- in Ann's range
  (3, 'Cat', extract(year from now())::int - 73, '{"stay": ["bnb"]}'),           -- 3 years over
  (4, 'Dee', extract(year from now())::int - 85, '{}'),                          -- far over
  (5, 'Eve', extract(year from now())::int - 64, '{}')
) as v(n, name, born, prefs)
where p.id = pg_temp.m(v.n);

delete from public.profile_interests where profile_id not in (select pg_temp.m(n) from generate_series(1, 5) n);
insert into public.profile_interests (profile_id, interest_id)
select pg_temp.m(n), i from generate_series(1, 5) n, generate_series(1, 3) i;

update public.preferences set age_min = 55, age_max = 70 where profile_id = pg_temp.m(1);
delete from public.entitlements where source = 'founding';

update public.trips set visibility = 'hidden';
insert into public.trips (owner_id, city_id, start_date, end_date, flexible_days, visibility) values
  (pg_temp.m(1), 2267057, current_date + 40, current_date + 47, 0, 'members'),
  (pg_temp.m(2), 2267057, current_date + 42, current_date + 45, 0, 'members'),
  (pg_temp.m(5), 2988507, current_date + 60, current_date + 64, 0, 'members');
insert into public.trip_plan_items (trip_id, title, day)
select id, v.title, v.day from public.trips, (values ('Louvre early', 1::smallint), ('Seine walk', 2::smallint)) v(title, day)
 where owner_id = pg_temp.m(5);
create temp table ann_trip as select id from public.trips where owner_id = pg_temp.m(1);
grant select on ann_trip to authenticated;

-- ------------------------------------------------------------ the answers
select pg_temp.sign_in_as(pg_temp.m(1));
select lives_ok($$update public.profiles set moving = 'few', travel_often = 'twice', booking = 'weeks', group_size = 'small', drinking = 'socially', smoking = 'no', budget = 'comfort' where id = auth.uid()$$,
  'Ann answers the new travel style questions');
select throws_ok($$update public.profiles set budget = 'shoestring' where id = auth.uid()$$, '23514', null, '"Shoestring" is gone');
select throws_ok($$update public.profiles set moving = 'castle' where id = auth.uid()$$, '23514', null, 'only answers from the list');

-- ------------------------------------------------------------ flexible age
select is_empty($$select 1 from public.suggest_by_interests() where display_name in ('Cat', 'Dee')$$, 'a strict age range hides people outside it');
update public.preferences set age_flexible = true where profile_id = auth.uid();
select isnt_empty($$select 1 from public.suggest_by_interests() where display_name = 'Cat'$$, 'a flexible range shows people just outside it');
select ok((select score - rank between 9.5 and 10.5 from public.suggest_by_interests() where display_name = 'Cat'), 'lower down, by the flexible penalty');
select is_empty($$select 1 from public.suggest_by_interests() where display_name = 'Dee'$$, 'but not people far outside it');

-- ------------------------------------------------------------ trips, free
select is((select trip_start from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Bob'), (current_date + 42)::date,
  'free members see the exact dates too (round 8, 23 Oct)');
select is((select count(*)::int from public.plan_inspiration()), 0, 'trip plans for inspiration need Sodalis+');
reset role;

-- ------------------------------------------------------------ Sodalis+
insert into public.entitlements (profile_id, plan, source, expires_at) values (pg_temp.m(1), 'plus', 'manual', now() + interval '30 days');
update public.preferences set stays = '{hotel}' where profile_id = pg_temp.m(1);
select pg_temp.sign_in_as(pg_temp.m(1));
select is((select trip_start from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Bob'), current_date + 42, 'with Sodalis+ it shows the exact dates');
select results_eq($$select display_name from public.suggest_by_interests() where display_name in ('Bob', 'Cat')$$, $$values ('Bob'::text)$$,
  'holiday preference filters work for Sodalis+ (Bob stays in hotels, Cat doesn''t)');
select is((select ideas from public.plan_inspiration()), array['Louvre early', 'Seine walk'], 'Sodalis+ members see other members'' trip plans');
select is((select city from public.plan_inspiration()), 'Paris', 'with the place, not the person');
reset role;

select * from finish();
rollback;
