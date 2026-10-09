-- pgTAP: wishlists on cards and popular destinations.
begin;
select plan(6);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('7e7e7e7e-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'tv' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 3) n;
update public.profiles set onboarded_at = now() where id in (pg_temp.m(1), pg_temp.m(2), pg_temp.m(3));
-- Bea would love Lisbon and Tokyo.
insert into public.wishlist (profile_id, city_id) values (pg_temp.m(2), 2267057), (pg_temp.m(2), 1850147);
-- How many members were already going to Lisbon in the demo data.
create temp table before as
  select count(distinct t.owner_id)::int n from public.trips t join public.profiles p on p.id = t.owner_id and p.status = 'active'
  where t.city_id = 2267057 and t.end_date >= current_date;
grant select on before to authenticated;
-- All three going to Lisbon (Ann twice), only Cal to Tokyo.
insert into public.trips (owner_id, city_id, start_date, end_date) values
  (pg_temp.m(1), 2267057, current_date + 10, current_date + 14),
  (pg_temp.m(1), 2267057, current_date + 60, current_date + 64),
  (pg_temp.m(2), 2267057, current_date + 30, current_date + 34),
  (pg_temp.m(3), 2267057, current_date + 5, current_date + 7),
  (pg_temp.m(3), 1850147, current_date + 10, current_date + 14);

select pg_temp.sign_in_as(pg_temp.m(1));
select is(public.wishlist_of(pg_temp.m(2)), array['Lisbon', 'Tokyo'], 'a member sees someone’s wishlist on their card');
select is((select members from public.popular_destinations() where city = 'Lisbon'), (select n + 3 from before), 'Lisbon counts each member going once');
select is((select count(*)::int from public.popular_destinations() where city_id = 1850147 and members = 1), 0, 'a city with only one member going isn’t shown');

-- Across a block, the wishlist is hidden.
reset role;
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.m(2), pg_temp.m(1));
select pg_temp.sign_in_as(pg_temp.m(1));
select is(public.wishlist_of(pg_temp.m(2)), null, 'no wishlist across a block');

-- Signed out, neither works.
reset role;
select throws_ok($$ set local role anon; select public.popular_destinations() $$, '42501', null, 'signed-out visitors can’t see popular places');
reset role;
select throws_ok($$ set local role anon; select public.wishlist_of('7e7e7e7e-0000-4000-8000-000000000002') $$, '42501', null, 'or wishlists');

select * from finish();
rollback;
