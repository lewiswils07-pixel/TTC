-- pgTAP: trips and wishlist. Members read and change only their own rows,
-- and the date and size rules hold in the database (spec §3).
-- Run with: npx supabase test db
begin;
select plan(24);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'ann@example.com', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.com', 'authenticated', 'authenticated');

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select ok((select relrowsecurity from pg_class where oid = 'public.trips'::regclass), 'trips has row-level security');
select ok((select relrowsecurity from pg_class where oid = 'public.wishlist'::regclass), 'wishlist has row-level security');

-- Bob already has a trip to Lisbon and Lisbon on his wishlist.
insert into public.trips (owner_id, city_id, start_date, end_date)
  values ('22222222-2222-4222-8222-222222222222', 2267057, current_date + 30, current_date + 37);
insert into public.wishlist (profile_id, city_id) values ('22222222-2222-4222-8222-222222222222', 2267057);

-- ------------------------------------------------------------ signed out
set local role anon;
select throws_ok('select * from public.trips', '42501', null, 'signed-out visitors cannot read trips');
select throws_ok('select * from public.wishlist', '42501', null, 'signed-out visitors cannot read wishlists');
reset role;

-- ------------------------------------------------------------ as Ann
select pg_temp.sign_in_as('11111111-1111-4111-8111-111111111111');

select is_empty('select 1 from public.trips', 'Ann cannot see Bob''s trips');
select is_empty('select 1 from public.wishlist', 'Ann cannot see Bob''s wishlist');

select lives_ok($$insert into public.trips (city_id, start_date, end_date, flexible_days, note)
  values (2267057, current_date + 31, current_date + 35, 2, 'First time in Portugal')$$, 'Ann can add a trip');
select is((select owner_id from public.trips), '11111111-1111-4111-8111-111111111111'::uuid, 'the trip belongs to Ann automatically');
select throws_ok($$insert into public.trips (owner_id, city_id, start_date, end_date)
  values ('22222222-2222-4222-8222-222222222222', 2267057, current_date + 1, current_date + 2)$$, '42501', null, 'Ann cannot add a trip for Bob');

select throws_ok($$insert into public.trips (city_id, start_date, end_date) values (2267057, current_date - 10, current_date - 3)$$,
  '23514', 'This trip has already ended', 'trips that have ended are refused');
select throws_ok($$insert into public.trips (city_id, start_date, end_date) values (2267057, current_date + 5, current_date + 2)$$,
  '23514', null, 'a trip cannot end before it starts');
select throws_ok($$insert into public.trips (city_id, start_date, end_date) values (2267057, current_date + 1, current_date + 100)$$,
  '23514', null, 'trips longer than 3 months are refused');
select throws_ok($$insert into public.trips (city_id, start_date, end_date) values (2267057, current_date + 731, current_date + 732)$$,
  '23514', 'Trips can be up to 730 days ahead', 'trips more than 2 years ahead are refused');
select throws_ok($$insert into public.trips (city_id, start_date, end_date, flexible_days) values (2267057, current_date + 1, current_date + 2, 8)$$,
  '23514', null, 'flexibility is at most 7 days');

select lives_ok($$update public.trips set end_date = current_date + 36, visibility = 'hidden'$$, 'Ann can change her trip');
select is((select visibility from public.trips), 'hidden', 'and hide it from suggestions');
select throws_ok($$update public.trips set owner_id = '22222222-2222-4222-8222-222222222222'$$, '42501', null, 'Ann cannot hand her trip to Bob');

select lives_ok($$insert into public.wishlist (city_id) values (2644688)$$, 'Ann can save a place to her wishlist');
select throws_ok($$insert into public.wishlist (city_id) values (2644688)$$, '23505', null, 'the same place cannot be saved twice');

-- Bob's rows are untouched by Ann's deletes.
select lives_ok('delete from public.trips', 'Ann can delete her trips');
select lives_ok('delete from public.wishlist', 'Ann can clear her wishlist');
reset role;
select is((select count(*)::int from public.trips where owner_id = '22222222-2222-4222-8222-222222222222'), 1, 'Bob''s trip survives Ann''s delete');
select is((select count(*)::int from public.wishlist where profile_id = '22222222-2222-4222-8222-222222222222'), 1, 'Bob''s wishlist survives Ann''s delete');

-- Wishlist holds at most 10 places.
insert into public.wishlist (profile_id, city_id)
  select '22222222-2222-4222-8222-222222222222', id from public.cities where id <> 2267057 order by population desc limit 9;
select throws_ok($$insert into public.wishlist (profile_id, city_id) values ('22222222-2222-4222-8222-222222222222', 2644688)$$,
  '23514', 'You can save up to 10 places', 'wishlists hold at most 10 places');

select * from finish();
rollback;
