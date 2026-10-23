-- pgTAP: round 8 (23 Oct): suggested groups, new interests, stand-in verification.
begin;
select plan(16);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create temp table m as select n, gen_random_uuid() as id from generate_series(1, 3) n;
grant select on m to authenticated;
create function pg_temp.m(k integer) returns uuid language sql as $$ select id from m where n = k $$;
insert into auth.users (id, email, aud, role) select id, 'r8-' || n || '@example.com', 'authenticated', 'authenticated' from m;
update public.profiles set display_name = 'R' || right(id::text, 1), gender = 'woman', birth_date = date '1980-01-01', home_city_id = 2644688, onboarded_at = now()
 where id in (select id from m);
-- Free plan for these tests.
delete from public.entitlements where profile_id in (select id from m);
insert into public.profile_interests (profile_id, interest_id) select pg_temp.m(n), i from generate_series(1, 2) n, unnest(array[1, 2, 3, 4, 109]) i;
insert into public.trips (owner_id, city_id, start_date, end_date, flexible_days, visibility)
values (pg_temp.m(1), 2267057, current_date + 20, current_date + 25, 0, 'members');

select is((select count(*)::int from public.interests where slug in ('wild-swimming', 'camping', 'rugby', 'faith-trips', 'step-free-trips', 'hostels', 'pride-events')), 7, 'the 7 new interests are there');

select pg_temp.sign_in_as(pg_temp.m(1));
select is((select kind || ':' || name from public.suggested_groups() limit 1), 'place:Lisbon travellers', 'a group for my trip comes first');
select is((select count(*)::int from public.suggested_groups() where kind = 'interest'), 5, 'then one for each of my interests');
select is((select reason from public.suggested_groups() where kind = 'interest' and topic_id = 109), 'You picked Wild swimming', 'each says why');
select isnt(public.join_suggested_group('place', 2267057), null, 'joining makes the group');
select is((select club from public.my_groups()), true, 'it shows in my groups as one of ours');
select isnt((select conversation_id from public.my_groups()), null, 'with its chat');
select is_empty($$select 1 from public.suggested_groups() where kind = 'place'$$, 'and leaves my suggestions');
select public.join_suggested_group('interest', 1);
select public.join_suggested_group('interest', 2);
select throws_ok($$select public.join_suggested_group('interest', 3)$$, '23514', 'Free members can join up to 3 suggested groups', 'free members can be in 3');
reset role;

select pg_temp.sign_in_as(pg_temp.m(2));
select isnt(public.join_suggested_group('interest', 1), null, 'a second member joins');
select is((select members from public.my_groups() where club), 2, 'the same group, which now has 2 members');
select lives_ok($$select public.leave_group((select id from public.my_groups() where club))$$, 'members can leave');
reset role;
select isnt_empty($$select 1 from public.groups where club_interest_id = 1$$, 'the group stays');

-- Stand-in verification.
select pg_temp.sign_in_as(pg_temp.m(3));
select is_empty($$select public.verified_members(array[pg_temp.m(3)])$$, 'not verified to start with');
select isnt(public.verify_me_now(), null, 'tapping Verify me verifies them');
select is((select count(*)::int from public.verified_members(array[pg_temp.m(3), pg_temp.m(1)])), 1, 'and only them');
reset role;

select * from finish();
rollback;
