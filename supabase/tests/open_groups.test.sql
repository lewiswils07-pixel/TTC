-- pgTAP: open travel groups, women-only and age ranges, twin-room sharing,
-- tips in Download my data, and same-trip people past the distance limit.
begin;
select plan(14);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('0b0b0b0b-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

-- Ann (woman, 60), Bea (woman, 55), Cal (man, 58), Dot (woman, 30).
insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'og' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 4) n;
update public.profiles p set display_name = v.name, gender = v.gender, birth_year = v.born, home_city_id = 2644688, onboarded_at = now(), last_active_at = now()
  from (values (pg_temp.m(1), 'Ann', 'woman', extract(year from current_date)::int - 60),
               (pg_temp.m(2), 'Bea', 'woman', extract(year from current_date)::int - 55),
               (pg_temp.m(3), 'Cal', 'man', extract(year from current_date)::int - 58),
               (pg_temp.m(4), 'Dot', 'woman', extract(year from current_date)::int - 30)) v(id, name, gender, born)
 where p.id = v.id;
-- Bea is going to Lisbon at the same time.
insert into public.trips (owner_id, city_id, start_date, end_date) values (pg_temp.m(2), 2267057, current_date + 20, current_date + 25);

-- Ann starts an open, women-only Lisbon group for ages 45 to 75.
select pg_temp.sign_in_as(pg_temp.m(1));
create temp table g as select public.create_group('Lisbon walkers', 2267057, current_date + 20, current_date + 25, '{}', true, true, 45::smallint, 75::smallint) as id;
select is((select open and women_only and age_min = 45 and age_max = 75 from public.group_settings((select id from g))), true, 'the group keeps its settings');

reset role;
select pg_temp.sign_in_as(pg_temp.m(2));
select is((select going_when_you_are from public.open_groups(2267057) where id = (select id from g)), true, 'Bea sees it, marked as going when she is');
reset role;
select pg_temp.sign_in_as(pg_temp.m(3));
select is((select count(*)::int from public.open_groups() where id = (select id from g)), 0, 'a man doesn’t see a women-only group');
select throws_ok(format('select public.join_open_group(%s)', (select id from g)), '23514', null, 'or join it');
reset role;
select pg_temp.sign_in_as(pg_temp.m(4));
select is((select count(*)::int from public.open_groups() where id = (select id from g)), 0, 'someone outside the ages doesn’t see it');

reset role;
select pg_temp.sign_in_as(pg_temp.m(2));
select lives_ok(format('select public.join_open_group(%s)', (select id from g)), 'Bea joins');
select is((select my_status from public.my_groups() where id = (select id from g)), 'joined', 'and she’s in the group');
select is((select count(*)::int from public.open_groups() where id = (select id from g)), 0, 'it leaves her list of groups to join');

-- Only women can start a women-only group.
reset role;
select pg_temp.sign_in_as(pg_temp.m(3));
select throws_ok($$ select public.create_group('Men?', 2267057, current_date + 20, current_date + 25, '{}', true, true) $$, '23514', null, 'a man can’t start a women-only group');
select throws_ok($$ select public.create_group('Chat', null, null, null, '{}', true) $$, '23514', null, 'a chat-only group can’t be open');

-- Twin-room sharing shows on the card.
update public.profiles set room_sharing = 'share' where id = pg_temp.m(3);
reset role;
select pg_temp.sign_in_as(pg_temp.m(1));
select is((select room_sharing from public.member_extras(pg_temp.m(3))), 'share', 'a member sees someone is happy to share a twin room');

-- Tips are in Download my data.
reset role;
insert into public.city_tips (profile_id, city_id, category, place, body, rating) values (pg_temp.m(1), 2267057, 'food', 'Time Out Market', 'Go early', 5);
select pg_temp.sign_in_as(pg_temp.m(1));
select is(public.my_data() -> 'nice_to_know_tips' -> 0 ->> 'place', 'Time Out Market', 'Download my data includes your tips');

-- The distance limit doesn't hide someone going on the same trip.
reset role;
insert into public.trips (owner_id, city_id, start_date, end_date) values (pg_temp.m(1), 2267057, current_date + 20, current_date + 25);
update public.profiles set home_city_id = 2643743 where id = pg_temp.m(2);
update public.preferences set max_distance_km = 1, distance_flexible = false where profile_id = pg_temp.m(1);
select pg_temp.sign_in_as(pg_temp.m(1));
select is((select count(*)::int from public.suggest_for_trip((select max(id) from public.trips where owner_id = pg_temp.m(1))) where profile_id = pg_temp.m(2)), 1,
  'someone going to Lisbon at the same time shows, however far away they live');

reset role;
select throws_ok($$ set local role anon; select public.open_groups() $$, '42501', null, 'signed-out visitors can’t see open groups');

select * from finish();
rollback;
