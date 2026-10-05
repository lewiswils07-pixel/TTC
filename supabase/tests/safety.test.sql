-- pgTAP: block and report (spec §6.3, §6.4). Blocks work both ways and
-- end anything open; reports stay private; 3 reports pause requests.
-- Run with: npx supabase test db
begin;
select plan(22);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('cccccccc-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 's' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 6) n;

update public.profiles p set photo_path = p.id || '/photo.jpg',
  display_name = v.name, gender = 'woman', birth_year = 1960, home_city_id = 2644688, onboarded_at = now()
from (values (1, 'Ann'), (2, 'Bob'), (3, 'Cat'), (4, 'Dee'), (5, 'Eve'), (6, 'Fay')) as v(n, name)
where p.id = pg_temp.m(v.n);

-- Everyone going to Lisbon at the same time.
update public.trips set visibility = 'hidden';
insert into public.trips (owner_id, city_id, start_date, end_date)
select pg_temp.m(n), 2267057, current_date + 10, current_date + 14 from generate_series(1, 6) n;
create temp table trip_of as select owner_id, id from public.trips where owner_id in (select pg_temp.m(n) from generate_series(1, 6) n);
grant select on trip_of to authenticated;

select ok((select relrowsecurity from pg_class where oid = 'public.blocks'::regclass), 'blocks has row-level security');
select ok((select relrowsecurity from pg_class where oid = 'public.reports'::regclass), 'reports has row-level security');

-- Ann and Bob are connected; Cat has asked Ann.
select pg_temp.sign_in_as(pg_temp.m(1));
select public.send_connection_request(pg_temp.m(2));
select pg_temp.sign_in_as(pg_temp.m(2));
select public.respond_to_request((select max(id) from public.connections), true);
select pg_temp.sign_in_as(pg_temp.m(3));
select public.send_connection_request(pg_temp.m(1));

-- ------------------------------------------------------------ Ann blocks Bob and Cat
select pg_temp.sign_in_as(pg_temp.m(1));
select lives_ok($$select public.block_member(pg_temp.m(2))$$, 'Ann can block Bob');
select lives_ok($$select public.block_member(pg_temp.m(2))$$, 'blocking twice is harmless');
select lives_ok($$select public.block_member(pg_temp.m(3))$$, 'Ann can block Cat');
select is_empty('select 1 from public.my_connections()', 'blocking ends the connection and the request');
select results_eq('select display_name from public.my_blocks() order by display_name', $$values ('Bob'::text), ('Cat')$$, 'Ann sees who she blocked');
select throws_ok($$select public.block_member(pg_temp.m(1))$$, 'P0002', 'Member not found', 'Ann cannot block herself');
select throws_ok($$insert into public.blocks (blocked_id) values (pg_temp.m(4))$$, '42501', null, 'blocks go through the function');
select results_eq('select display_name from public.suggest_for_trip((select id from trip_of where owner_id = pg_temp.m(1))) order by display_name',
  $$values ('Dee'::text), ('Eve'), ('Fay')$$, 'Ann no longer sees Bob or Cat');
select throws_ok($$select public.send_connection_request(pg_temp.m(2))$$, '23514', 'This member isn''t available', 'Ann cannot ask Bob while he''s blocked');

-- ------------------------------------------------------------ Bob, who was blocked
select pg_temp.sign_in_as(pg_temp.m(2));
select is_empty('select 1 from public.blocks', 'Bob cannot see that Ann blocked him');
select is_empty($$select 1 from public.suggest_for_trip((select id from trip_of where owner_id = pg_temp.m(2))) where display_name = 'Ann'$$, 'Bob no longer sees Ann either');
select throws_ok($$select public.send_connection_request(pg_temp.m(1))$$, '23514', 'This member isn''t available', 'Bob cannot ask Ann');

-- ------------------------------------------------------------ Ann unblocks Bob
select pg_temp.sign_in_as(pg_temp.m(1));
select lives_ok($$select public.unblock_member(pg_temp.m(2))$$, 'Ann can unblock Bob');
select is((select count(*)::int from public.suggest_for_trip((select id from trip_of where owner_id = pg_temp.m(1))) where display_name = 'Bob'), 1, 'Bob shows again after unblocking');

-- ------------------------------------------------------------ reports
select lives_ok($$select public.report_member(pg_temp.m(6), 'asking_for_money', '  Asked me for a loan  ')$$, 'Ann can report Fay');
select lives_ok($$select public.report_member(pg_temp.m(6), 'harassment')$$, 'reporting again updates the open report');
select throws_ok($$select public.report_member(pg_temp.m(6), 'rude')$$, '23514', null, 'only the listed reasons are accepted');
select throws_ok('select 1 from public.reports', '42501', null, 'members cannot read reports, even their own');

select pg_temp.sign_in_as(pg_temp.m(4));
select public.report_member(pg_temp.m(6), 'fake_profile');
select pg_temp.sign_in_as(pg_temp.m(6));
select lives_ok($$select public.send_connection_request(pg_temp.m(5))$$, 'after 2 reports, Fay can still send requests');
select pg_temp.sign_in_as(pg_temp.m(5));
select public.report_member(pg_temp.m(6), 'feels_unsafe');
select pg_temp.sign_in_as(pg_temp.m(6));
select throws_ok($$select public.send_connection_request(pg_temp.m(4))$$, '23514', 'Requests are paused', 'after reports from 3 members, Fay''s requests are paused');

select * from finish();
rollback;
