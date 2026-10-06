-- pgTAP: sign-up polish (Lewis's sign-up review, 5 Oct). Date of birth and
-- exact ages, "Prefer not to say" for gender, founding member numbers and
-- the founding Sodalis+ offer.
-- Run with: npx supabase test db
begin;
select plan(12);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('ffffffff-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'p' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 3) n;

-- ------------------------------------------------------------ date of birth
select pg_temp.sign_in_as(pg_temp.m(1));
select throws_ok(
  format($$update public.profiles set birth_date = %L where id = %L$$, (current_date - interval '18 years' + interval '1 day')::date, pg_temp.m(1)),
  '23514', 'Members must be 18 or over', 'the day before an 18th birthday is too young');
select lives_ok(
  format($$update public.profiles set birth_date = %L where id = %L$$, (current_date - interval '40 years' + interval '1 day')::date, pg_temp.m(1)),
  'members can save a date of birth');
reset role;
select is((select birth_year from public.profiles where id = pg_temp.m(1)),
  extract(year from current_date - interval '40 years' + interval '1 day')::smallint, 'the birth year follows the date');
select is((select public.member_age(p) from public.profiles p where id = pg_temp.m(1)), 39, 'ages are exact: 40 tomorrow is 39 today');
select is((select extract(year from current_date)::int - public.age_year(p) from public.profiles p where id = pg_temp.m(1)), 39,
  'cards show the exact age, not the date');

-- ------------------------------------------------------------ gender
update public.profiles set gender = 'unsaid' where id = pg_temp.m(1);
select ok(public.fits_preferences(39, 'unsaid', row(null, 18, 99, '{woman,man,nonbinary}', null, false, '{}', '{}', '{}')::public.preferences),
  '"Prefer not to say" is shown to members who show everyone');
select ok(not public.fits_preferences(39, 'unsaid', row(null, 18, 99, '{woman}', null, false, '{}', '{}', '{}')::public.preferences),
  'but not to members who chose particular genders');

-- ------------------------------------------------------- founding members
update public.profiles p set display_name = 'P' || right(p.id::text, 1), birth_date = date '1960-05-01', gender = 'woman', home_city_id = 2644688
where p.id in (pg_temp.m(2), pg_temp.m(3));
update public.profiles set display_name = 'P1', home_city_id = 2644688 where id = pg_temp.m(1);
insert into public.profile_interests (profile_id, interest_id)
select pg_temp.m(n), i from generate_series(1, 3) n, generate_series(1, 3) i;

select pg_temp.sign_in_as(pg_temp.m(2));
select public.finish_onboarding();
reset role;
select pg_temp.sign_in_as(pg_temp.m(1));
select public.finish_onboarding();
reset role;

select is((select member_number from public.profiles where id = pg_temp.m(1)) - (select member_number from public.profiles where id = pg_temp.m(2)), 1,
  'members are numbered in the order they finish sign-up');
select ok(public.has_plus(pg_temp.m(1)), 'finishing sign-up starts 3 months of Sodalis+');
select is((select expires_at::date from public.entitlements where profile_id = pg_temp.m(1)), (now() + interval '3 months')::date,
  'the founding offer ends after 3 months');

select pg_temp.sign_in_as(pg_temp.m(1));
select is((select member_number from public.my_welcome()), (select member_number from public.profiles where id = pg_temp.m(1)),
  'the welcome screen shows the member''s own number');
reset role;
select is((select member_number from public.profiles where id = pg_temp.m(3)), null, 'members who haven''t finished have no number yet');

select * from finish();
rollback;
