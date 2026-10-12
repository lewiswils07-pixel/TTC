-- pgTAP: Nice to know tips about a place.
begin;
select plan(8);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('7e7e7e7e-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'tip' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 2) n;
update public.profiles set display_name = 'Tipper', home_city_id = 2644688, onboarded_at = now() where id in (pg_temp.m(1), pg_temp.m(2));
-- Ann has been to Lisbon; Bea is only going later.
insert into public.trips (owner_id, city_id, start_date, end_date) values
  (pg_temp.m(1), 2267057, current_date - 3, current_date + 2),
  (pg_temp.m(2), 2267057, current_date + 30, current_date + 35);
delete from public.entitlements where profile_id in (pg_temp.m(1), pg_temp.m(2));

select pg_temp.sign_in_as(pg_temp.m(1));
select lives_ok($$ select public.add_city_tip(2267057, 'food', 'Time Out Market', 'Go before noon', 5::smallint) $$, 'you can share a tip once your trip has started');
select lives_ok($$ select public.add_city_tip(2267057, 'drink', 'Park Bar', 'Sunset', null) $$, 'stars are optional');
select throws_ok($$ select public.add_city_tip(2267057, 'casino', 'Somewhere', null, null) $$, '23514', null, 'only the listed categories');

select pg_temp.sign_in_as(pg_temp.m(2));
select throws_ok($$ select public.add_city_tip(2267057, 'food', 'Somewhere', null, null) $$, '23514', 'You can share tips once your trip there has started', 'not before your trip');
select is((select count(*)::int from public.city_tips(2267057)), 2, 'everyone can read the tips');
select is((select count(*)::int from public.city_tips(2267057, 'food', null)), 2, 'without Sodalis+ the category is ignored');

reset role;
insert into public.entitlements (profile_id, plan, source) values (pg_temp.m(2), 'plus', 'manual');
select pg_temp.sign_in_as(pg_temp.m(2));
select is((select place from public.city_tips(2267057, 'food', null)), 'Time Out Market', 'Sodalis+ can pick a category');
select is((select place from public.city_tips(2267057, null, 'sunset')), 'Park Bar', 'Sodalis+ can search the words');

select * from finish();
rollback;
