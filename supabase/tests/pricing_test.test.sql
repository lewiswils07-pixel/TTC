-- pgTAP: the pricing test (Part 29).
begin;
select plan(9);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

-- Twenty members finish sign-up while the test is on.
create temp table m as
select n, gen_random_uuid() as id from generate_series(1, 20) n;
grant select on m to authenticated;
insert into auth.users (id, email, aud, role) select id, 'pt' || n || '@example.com', 'authenticated', 'authenticated' from m;
update public.profiles set display_name = 'P', gender = 'woman', birth_date = date '1980-01-01', home_city_id = 2644688, onboarded_at = now()
 where id in (select id from m);

select is((select count(*)::int from m where private.price_group(id) = 0) + (select count(*)::int from public.price_test where profile_id in (select id from m)), 20,
  'every member gets either the founding months or a test price');
select is((select count(*)::int from public.price_test t join public.entitlements e using (profile_id)), 0, 'nobody in the test has Sodalis+');
select ok((select bool_and(price_pence in (399, 599, 899)) from public.price_test), 'test prices come from rules.json');

-- A member in the test views the page and taps Join twice.
select pg_temp.sign_in_as((select id from m where private.price_group(id) > 0 order by n limit 1));
select is((select joined from public.my_price_test()), false, 'they see their price, not yet joined');
select lives_ok($$select public.note_plus_interest('view', 'requests')$$, 'a visit is counted');
select public.note_plus_interest('join', 'requests');
select public.note_plus_interest('join', 'requests');
select is((select joined from public.my_price_test()), true, 'and the Join tap');
select throws_ok($$select * from public.plus_interest$$, '42501', null, 'members can''t read the taps');
reset role;
select is((select count(*)::int from public.plus_interest where action = 'join'), 1, 'a second Join tap isn''t counted twice');

-- A member on the founding months sees no test.
select pg_temp.sign_in_as((select id from m where private.price_group(id) = 0 order by n limit 1));
select is((select count(*)::int from public.my_price_test()), 0, 'founding members aren''t in the test');
reset role;

select * from finish();
rollback;
