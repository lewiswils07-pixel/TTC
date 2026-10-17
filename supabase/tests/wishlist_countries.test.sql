-- pgTAP: countries in Places I'd love to go (Part 27).
begin;
select plan(5);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('0d0d0d0d-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'wc' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 2) n;
update public.profiles set display_name = 'W', gender = 'woman', birth_date = date '1970-05-01', home_city_id = 2644688, onboarded_at = now()
 where id in (pg_temp.m(1), pg_temp.m(2));

-- Ann wants Japan and Lisbon; Bea wants Portugal.
select pg_temp.sign_in_as(pg_temp.m(1));
select lives_ok($$insert into public.wishlist_countries (country_code) values ('JP')$$, 'members can add a country');
insert into public.wishlist (city_id) values (2267057);
reset role;
select pg_temp.sign_in_as(pg_temp.m(2));
insert into public.wishlist_countries (country_code) values ('PT');
select is((select count(*)::int from public.wishlist_countries), 1, 'and only see their own');
select is(array(select unnest(public.wishlist_of(pg_temp.m(1))) order by 1), array['Japan', 'Lisbon'], 'countries show on their card');
select is((select places from public.what_we_share(pg_temp.m(1))), array['Lisbon'], 'a city in a country you want is shared');
reset role;
select is(public.place_points(pg_temp.m(2), pg_temp.m(1)), 20::numeric, 'and counts for matching, up to 20 points');

select * from finish();
rollback;
