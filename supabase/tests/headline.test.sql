-- pgTAP: the one-line about me on a member's card (Part 26).
begin;
select plan(6);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('0c0c0c0c-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'hl' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 2) n;
update public.profiles set display_name = 'H', gender = 'woman', birth_date = date '1990-05-01', home_city_id = 2644688, onboarded_at = now()
 where id in (pg_temp.m(1), pg_temp.m(2));

select pg_temp.sign_in_as(pg_temp.m(1));
select lives_ok($$update public.profiles set headline = 'Happiest with a map and a good coffee' where id = auth.uid()$$, 'members can write their line');
select throws_ok($$update public.profiles set headline = repeat('x', 81) where id = auth.uid()$$, '23514', null, 'of up to 80 characters');
reset role;

select pg_temp.sign_in_as(pg_temp.m(2));
select is((select headline from public.member_extras(pg_temp.m(1))), 'Happiest with a map and a good coffee', 'other members see it on the card');
reset role;

select is((select count(*)::int from public.interests where slug in ('football', 'surfing', 'backpacking', 'brunch')), 4, 'the younger interests are there');

insert into public.profile_interests (profile_id, interest_id)
select m, i.id from (values (pg_temp.m(1)), (pg_temp.m(2))) v(m), public.interests i where i.slug in ('football', 'brunch');
insert into public.profile_interests (profile_id, interest_id) select pg_temp.m(1), id from public.interests where slug = 'surfing';
select pg_temp.sign_in_as(pg_temp.m(2));
select is((select interests from public.what_we_share(pg_temp.m(1))), array['Football', 'Brunch'], 'what you share lists only interests you both picked');
select public.block_member(pg_temp.m(1));
select is((select count(*)::int from public.what_we_share(pg_temp.m(1))), 0, 'not after a block');
reset role;

select * from finish();
rollback;
