-- pgTAP: "Did you meet?" (spec §6.10). Asked 2 days after the trip a
-- connection was about ends, once per member, and the answers stay private.
-- Run with: npx supabase test db
begin;
select plan(11);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('cccccccc-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'f' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 2) n;
update public.profiles p set photo_path = p.id || '/photo.jpg', display_name = v.name, gender = 'woman', birth_year = 1960, home_city_id = 2644688, onboarded_at = now()
from (values (1, 'Ann'), (2, 'Bob')) as v(n, name)
where p.id = pg_temp.m(v.n);

create temp table ids (name text primary key, id bigint);
grant select, insert on ids to authenticated;

-- Ann asks Bob about her Lisbon trip; he accepts.
with t as (
  insert into public.trips (owner_id, city_id, start_date, end_date) values (pg_temp.m(1), 2267057, current_date + 10, current_date + 15) returning id
)
insert into ids select 'trip', id from t;
select pg_temp.sign_in_as(pg_temp.m(1));
insert into ids select 'req', public.send_connection_request(pg_temp.m(2), null, (select id from ids where name = 'trip'));
select pg_temp.sign_in_as(pg_temp.m(2));
select public.respond_to_request((select id from ids where name = 'req'), true);
select is_empty('select 1 from public.meet_prompts()', 'nothing is asked before the trip');

-- The trip ended yesterday: still too soon.
reset role;
set local session_replication_role = replica;
update public.trips set start_date = current_date - 6, end_date = current_date - 1 where id = (select id from ids where name = 'trip');
set local session_replication_role = origin;
select pg_temp.sign_in_as(pg_temp.m(2));
select is_empty('select 1 from public.meet_prompts()', 'nothing is asked the day after');

-- Two days after, both are asked.
reset role;
set local session_replication_role = replica;
update public.trips set start_date = current_date - 7, end_date = current_date - 2 where id = (select id from ids where name = 'trip');
set local session_replication_role = origin;
select pg_temp.sign_in_as(pg_temp.m(2));
select results_eq('select display_name, trip_city from public.meet_prompts()', $$values ('Ann', 'Lisbon')$$, 'Bob is asked about Ann in Lisbon');
select pg_temp.sign_in_as(pg_temp.m(1));
select results_eq('select display_name from public.meet_prompts()', $$values ('Bob')$$, 'and Ann about Bob');

select lives_ok($$select public.answer_meet((select id from ids where name = 'req'), true, true)$$, 'Ann answers: met, would travel again');
select is_empty('select 1 from public.meet_prompts()', 'Ann is not asked again');
select pg_temp.sign_in_as(pg_temp.m(2));
select is((select count(*)::int from public.meet_prompts()), 1, 'Bob still is');
select lives_ok($$select public.answer_meet((select id from ids where name = 'req'), false, true)$$, 'Bob answers: didn''t meet');
select throws_ok('select * from public.meet_feedback', '42501', null, 'members cannot read the answers');
select throws_ok($$select public.answer_meet(-1, true)$$, 'P0002', 'Connection not found', 'only your own connections');

reset role;
select results_eq('select from_id, met, would_travel_again from public.meet_feedback order by id',
  $$values (pg_temp.m(1), true, true), (pg_temp.m(2), false, null::boolean)$$, 'answers are kept, "travel again" only if they met');

select * from finish();
rollback;
