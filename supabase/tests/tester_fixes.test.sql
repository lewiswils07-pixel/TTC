-- pgTAP: fixes from the tester round, and Plan a trip together.
begin;
select plan(20);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('7f7f7f7f-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'tf' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 3) n;
update public.profiles p set photo_path = p.id || '/photo.jpg', display_name = v.name, gender = v.gender,
  birth_date = v.born, home_city_id = 2644688, onboarded_at = now()
from (values
  -- Bea's birthday is always tomorrow, so "this year minus birth year" would be a year too old.
  (1, 'Ann', 'woman', date '1960-01-01'),
  (2, 'Bea', 'woman', (current_date + 1 - interval '62 years')::date),
  (3, 'Cal', 'man', date '1961-05-05')
) as v(n, name, gender, born)
where p.id = pg_temp.m(v.n);
-- Everyone going to Lisbon at the same time.
insert into public.trips (owner_id, city_id, start_date, end_date)
select pg_temp.m(n), 2267057, current_date + 20, current_date + 25 from generate_series(1, 3) n;
create temp table ann_trip as select id from public.trips where owner_id = pg_temp.m(1);
create temp table ids (name text primary key, id bigint);
grant select on ann_trip to authenticated;
grant select, insert on ids to authenticated;

-- On the free plan, without the founding offer.
delete from public.entitlements where source = 'founding';

-- One age everywhere
select pg_temp.sign_in_as(pg_temp.m(1));
select is((select extract(year from current_date)::int - birth_year from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Bea'),
  61, 'lists give the exact age (61 until her birthday)');

-- Not now
select lives_ok($$select public.skip_member(pg_temp.m(3))$$, 'Ann can skip Cal');
select is((select count(*)::int from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Cal'), 0, 'a skipped member is left out of trip suggestions');
select is(public.skipped_count(), 1, 'and counted, so they can be brought back');
select is(public.unskip_all(), 1, 'Ann can bring everyone back');
select is((select count(*)::int from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Cal'), 1, 'and Cal is suggested again');

-- People you've asked stay on the trip page
select lives_ok($$insert into ids select 'ann-bea', public.send_connection_request(pg_temp.m(2))$$, 'Ann asks Bea');
select is((select count(*)::int from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Bea'), 0, 'Bea leaves the suggestions');
select results_eq($$select display_name, status from public.trip_companions((select id from ann_trip))$$,
  $$values ('Bea'::text, 'you_asked'::text)$$, 'but stays on the trip page as someone Ann asked');

select pg_temp.sign_in_as(pg_temp.m(2));
select is(public.send_connection_request(pg_temp.m(1)), (select id from ids where name = 'ann-bea'), 'Bea asking back connects them');

-- Plan a trip together
select pg_temp.sign_in_as(pg_temp.m(1));
select throws_ok($$select public.plan_trip_together(pg_temp.m(3), (select id from ann_trip))$$, '23514', null, 'only with connections');
select lives_ok($$insert into ids select 'trip', public.plan_trip_together(pg_temp.m(2), null, 2988507, current_date + 40, current_date + 44)$$,
  'Ann invites Bea to plan a new Paris trip');
select is((select count(*)::int from public.trips where owner_id = pg_temp.m(1) and city_id = 2988507), 1, 'the new trip is added to Ann''s trips');
select is(public.groups_i_can_start(), 1, 'and doesn''t use up her group');
select is(public.plan_trip_together(pg_temp.m(2), null, 2988507, current_date + 41, current_date + 43), (select id from ids where name = 'trip'),
  'asking again opens the same trip');
select is((select count(*)::int from public.trips_together(pg_temp.m(2))), 1, 'Ann sees the trip she''s planning with Bea');

select pg_temp.sign_in_as(pg_temp.m(2));
select ok((select body like 'Shall we plan a trip to Paris together?%' from public.messages order by id desc limit 1), 'Bea gets the invite in their chat');
select lives_ok($$select public.respond_to_group_invite((select id from ids where name = 'trip'), true)$$, 'Bea joins');
reset role;
select is((select count(*)::int from public.trips where owner_id = pg_temp.m(2) and city_id = 2988507), 1, 'and the trip is added to Bea''s trips');
select results_eq($$select count(*)::int from public.trips where owner_id = pg_temp.m(2)$$, $$values (2)$$, 'once only');

select * from finish();
rollback;
