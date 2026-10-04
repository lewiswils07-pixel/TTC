-- pgTAP: identity and profiles. Proves members can read and change only
-- their own rows and the fields they're allowed to (spec §3, §14.2).
-- Run with: npx supabase test db
begin;
select plan(34);

-- Two members. The sign-up trigger should give each a profile and preferences.
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'ann@example.com', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.com', 'authenticated', 'authenticated');

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

-- ------------------------------------------------------------- set-up rules
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has row-level security');
select ok((select relrowsecurity from pg_class where oid = 'public.preferences'::regclass), 'preferences has row-level security');
select ok((select relrowsecurity from pg_class where oid = 'public.profile_interests'::regclass), 'profile_interests has row-level security');
select ok((select relrowsecurity from pg_class where oid = 'public.interests'::regclass), 'interests has row-level security');
select ok((select relrowsecurity from pg_class where oid = 'public.cities'::regclass), 'cities has row-level security');

select is((select count(*)::int from public.profiles where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')), 2, 'new accounts get a profile');
select is((select count(*)::int from public.preferences where profile_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')), 2, 'new accounts get default preferences');

update public.profiles set display_name = 'Bob', birth_year = 1960, gender = 'man', home_city_id = 2644688
 where id = '22222222-2222-4222-8222-222222222222';
insert into public.profile_interests values ('22222222-2222-4222-8222-222222222222', 1), ('22222222-2222-4222-8222-222222222222', 2);

-- ------------------------------------------------------------ signed out
set local role anon;
select throws_ok('select * from public.profiles', '42501', null, 'signed-out visitors cannot read profiles');
select throws_ok('select * from public.cities', '42501', null, 'signed-out visitors cannot read cities');
select throws_ok($$select public.search_cities('lis')$$, '42501', null, 'signed-out visitors cannot search cities');
reset role;

-- ------------------------------------------------------------ as Ann
select pg_temp.sign_in_as('11111111-1111-4111-8111-111111111111');

select results_eq('select id from public.profiles', $$values ('11111111-1111-4111-8111-111111111111'::uuid)$$, 'Ann sees only her own profile');
select is_empty($$select 1 from public.profiles where id = '22222222-2222-4222-8222-222222222222'$$, 'Ann cannot read Bob''s profile');
select is_empty($$select 1 from public.preferences where profile_id = '22222222-2222-4222-8222-222222222222'$$, 'Ann cannot read Bob''s preferences');
select is_empty($$select 1 from public.profile_interests where profile_id = '22222222-2222-4222-8222-222222222222'$$, 'Ann cannot read Bob''s interests');

select lives_ok($$update public.profiles set display_name = 'Ann', birth_year = 1958, gender = 'woman', home_city_id = 2267057 where id = '11111111-1111-4111-8111-111111111111'$$, 'Ann can fill in her own profile');
select lives_ok($$update public.profiles set display_name = 'Hacked' where id = '22222222-2222-4222-8222-222222222222'$$, 'updating Bob''s profile runs');
select throws_ok($$update public.profiles set role = 'admin' where id = '11111111-1111-4111-8111-111111111111'$$, '42501', null, 'Ann cannot make herself an admin');
select throws_ok($$update public.profiles set phone_verified_at = now() where id = '11111111-1111-4111-8111-111111111111'$$, '42501', null, 'Ann cannot mark her phone as checked');
select throws_ok($$update public.profiles set id_verified_at = now() where id = '11111111-1111-4111-8111-111111111111'$$, '42501', null, 'Ann cannot mark her ID as verified');
select throws_ok($$update public.profiles set onboarded_at = now() where id = '11111111-1111-4111-8111-111111111111'$$, '42501', null, 'Ann cannot skip onboarding checks');
select throws_ok($$insert into public.profiles (id) values (gen_random_uuid())$$, '42501', null, 'Ann cannot create profiles');
select throws_ok($$delete from public.profiles where id = '11111111-1111-4111-8111-111111111111'$$, '42501', null, 'Ann cannot delete profiles directly');
select throws_ok(format('update public.profiles set birth_year = %s where id = %L', extract(year from now())::int - 17, '11111111-1111-4111-8111-111111111111'), '23514', 'Members must be 18 or over', 'under-18s are refused');
select throws_ok($$update public.profiles set photo_path = '22222222-2222-4222-8222-222222222222/x.jpg' where id = '11111111-1111-4111-8111-111111111111'$$, '23514', null, 'Ann cannot point her photo at Bob''s folder');
select throws_ok($$update public.preferences set age_min = 17 where profile_id = '11111111-1111-4111-8111-111111111111'$$, '23514', null, 'preferences cannot include under-18s');

select throws_ok('select public.finish_onboarding()', '23514', 'Profile is not finished', 'onboarding cannot finish without interests');
select throws_ok('select public.set_my_interests(array[1,2]::smallint[])', '23514', 'Pick 3 to 10 interests', 'fewer than 3 interests are refused');
select throws_ok('select public.set_my_interests(array[1,2,3,4,5,6,7,8,9,10,11]::smallint[])', '23514', 'Pick 3 to 10 interests', 'more than 10 interests are refused');
select lives_ok('select public.set_my_interests(array[3,4,5,5]::smallint[])', 'Ann can pick 3 interests');
select lives_ok('select public.finish_onboarding()', 'Ann can finish onboarding');

select ok((select 'Lisbon' = any (array(select name from public.search_cities('lisb')))), 'city search finds Lisbon');
select is((select name from public.search_cities('MALAGA') limit 1), 'Málaga', 'city search ignores case and accents');

reset role;
select is((select display_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'), 'Bob', 'Bob''s profile was not changed by Ann');
select is((select count(*)::int from public.profile_interests where profile_id = '11111111-1111-4111-8111-111111111111'), 3, 'duplicate interests are stored once');

select * from finish();
rollback;
