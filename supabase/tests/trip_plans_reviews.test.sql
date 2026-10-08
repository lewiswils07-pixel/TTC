-- pgTAP: the planner on your own trips, and destination reviews.
begin;
select plan(17);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('7e7e7e7e-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'tp' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 3) n;
update public.profiles set display_name = 'Member ' || right(id::text, 1) where id in (pg_temp.m(1), pg_temp.m(2), pg_temp.m(3));
-- Member 1 has a 5-day Paris trip.
insert into public.trips (owner_id, city_id, start_date, end_date) values (pg_temp.m(1), 2988507, current_date + 10, current_date + 14);
create temp table t as select id from public.trips where owner_id = pg_temp.m(1);
grant select on t to authenticated;

-- The planner
select pg_temp.sign_in_as(pg_temp.m(1));
select lives_ok($$select public.add_trip_idea((select id from t), 'Musée d’Orsay', 2::smallint, 'https://www.musee-orsay.fr')$$, 'owners add ideas to their trip');
select lives_ok($$select public.add_trip_idea((select id from t), 'Find a good bakery')$$, 'ideas can be for any day');
select throws_ok($$select public.add_trip_idea((select id from t), 'Too late', 6::smallint)$$, '23514', null, 'days must fall within the trip');
select is((select string_agg(title, ' | ' order by day nulls last) from public.trip_plan((select id from t))), 'Musée d’Orsay | Find a good bakery', 'the plan lists ideas by day');
select lives_ok($$select public.update_trip_idea((select id from public.trip_plan((select id from t)) where day is null), true, 3::smallint)$$, 'ideas can be ticked off and moved to a day');
select is((select done::text || day from public.trip_plan((select id from t)) where title = 'Find a good bakery'), 'true3', 'and the change is saved');
select is(jsonb_array_length(public.my_data() -> 'your_trip_plans'), 2, 'plans are in "Download my data"');
select throws_ok($$select * from public.trip_plan_items$$, '42501', null, 'the table itself is closed');
reset role;
create temp table i as select min(id) id from public.trip_plan_items;
grant select on i to authenticated;

select pg_temp.sign_in_as(pg_temp.m(2));
select is((select count(*)::int from public.trip_plan((select id from t))), 0, 'nobody else can see your plan');
select throws_ok($$select public.add_trip_idea((select id from t), 'Sneaky')$$, 'P0002', null, 'or add to it');
select throws_ok($$select public.delete_trip_idea((select id from i))$$, 'P0002', null, 'or remove from it');

-- Reviews: once your trip has started, or for your home town.
reset role;
select pg_temp.sign_in_as(pg_temp.m(1));
select throws_ok($$select public.save_city_review(2988507, 4::smallint)$$, '23514', 'You can review a place once your trip there has started', 'no reviews before the trip');
reset role;
insert into public.trips (owner_id, city_id, start_date, end_date) values (pg_temp.m(2), 2988507, current_date - 1, current_date + 2);
update public.profiles set home_city_id = 2988507 where id = pg_temp.m(1);
select pg_temp.sign_in_as(pg_temp.m(2));
select lives_ok($$select public.save_city_review(2988507, 4::smallint, 'Lovely for slow walks.')$$, 'members can review a place');
select public.save_city_review(2988507, 5::smallint, 'Even better the second time.');
reset role;
select pg_temp.sign_in_as(pg_temp.m(1));
select throws_ok($$select public.save_city_review(2988507, 6::smallint)$$, '23514', null, 'ratings are 1 to 5 stars');
select public.save_city_review(2988507, 3::smallint);
select is((select average::text || '/' || total from public.city_reviews(2988507) limit 1), '4.0/2', 'everyone sees the average and count, one review each');
reset role;
-- Member 3 blocked member 2, so doesn't see their review.
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.m(3), pg_temp.m(2));
select pg_temp.sign_in_as(pg_temp.m(3));
select is((select string_agg(author, ',') from public.city_reviews(2988507)), 'Member 1', 'reviews from blocked people are hidden');
reset role;
select pg_temp.sign_in_as(pg_temp.m(2));
select public.delete_city_review(2988507);
select is((select count(*)::int from public.city_reviews(2988507)), 1, 'members can delete their own review');
reset role;

select * from finish();
rollback;
