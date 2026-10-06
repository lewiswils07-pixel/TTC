-- pgTAP: wider gender list, "Recently online" and "Use my location".
begin;
select plan(14);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('5e5e5e5e-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'sv' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 4) n;
update public.profiles set display_name = 'S' || right(id::text, 1), gender = 'woman', birth_date = date '1960-05-01',
       home_city_id = 2644688, onboarded_at = now(), last_active_at = now()
 where id::text like '5e5e5e5e%';

-- Genders
select lives_ok($$update public.profiles set gender = 'genderfluid' where id = pg_temp.m(2)$$, 'genderfluid is a choice');
select throws_ok($$update public.profiles set gender = 'robot' where id = pg_temp.m(2)$$, '23514', null, 'made-up genders are refused');
select ok(public.fits_preferences(50, 'agender', row(pg_temp.m(1), 18, 99, '{nonbinary}', null, false, '{}', '{}', '{}')::public.preferences),
  'choosing non-binary also shows agender members');
select ok(not public.fits_preferences(50, 'another', row(pg_temp.m(1), 18, 99, '{woman}', null, false, '{}', '{}', '{}')::public.preferences),
  'but not to someone who only chose women');

-- Recently online: 2 was here just now, 3 a week ago, 4 is blocked by 1.
update public.profiles set last_active_at = now() - interval '7 days' where id = pg_temp.m(3);
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.m(1), pg_temp.m(4));
select pg_temp.sign_in_as(pg_temp.m(1));
select results_eq($$select * from public.recently_online(array[pg_temp.m(2), pg_temp.m(3), pg_temp.m(4)])$$,
  array[pg_temp.m(2)], 'only members active today, and never someone blocked');
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$select * from public.recently_online(array[pg_temp.m(2)])$$, '42501', null, 'signed-out visitors can''t ask');
reset role;

-- Use my location: a spot in Leeds city centre, then one in Bradford.
select pg_temp.sign_in_as(pg_temp.m(1));
select is((select country_code from public.set_my_location(53.7997, -1.5492)), 'GB', 'the nearest town is found');
select is((select home_city_id from public.profiles where id = pg_temp.m(1)),
          (select id from public.set_my_location(53.7997, -1.5492)), 'and becomes the home city');
select is((select count(*)::int from public.member_locations), 1, 'members see their own spot');
reset role;
select pg_temp.sign_in_as(pg_temp.m(2));
select public.set_my_location(53.7960, -1.7594);
select is((select count(*)::int from public.member_locations), 1, 'but nobody else''s');
reset role;
select ok(public.member_distance_km(pg_temp.m(1), pg_temp.m(2)) between 12 and 16, 'distance comes from the two spots (Leeds to Bradford, about 14 km)');
select is(public.member_distance_km(pg_temp.m(1), pg_temp.m(3)), public.city_distance_km(
  (select home_city_id from public.profiles where id = pg_temp.m(1)), 2644688), 'without a spot, it falls back to home towns');
select pg_temp.sign_in_as(pg_temp.m(1));
delete from public.member_locations where profile_id = pg_temp.m(1);
select is((select count(*)::int from public.member_locations), 0, 'members can remove their spot');
select throws_ok($$select public.set_my_location(123, 0)$$, '23514', null, 'impossible places are refused');
reset role;

select * from finish();
rollback;
