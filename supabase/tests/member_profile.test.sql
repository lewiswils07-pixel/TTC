-- pgTAP: a connection's full profile.
begin;
select plan(11);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('cececece-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

-- 1 and 2 are connected, 3 asked 1 but hasn't been answered, 4 shares a group with 1, 5 is a stranger.
insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'mp' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 5) n;
update public.profiles set display_name = 'M' || right(id::text, 1), gender = 'woman', birth_date = date '1960-05-01',
       home_city_id = 2644688, onboarded_at = now(), travel_style = 'planner', pace = 'slow',
       photo_path = id::text || '/me.jpg'
 where id::text like 'cececece%';
update public.profiles set bio = 'Retired teacher, loves trains.',
       card_answers = '[{"q":"dream_trip","a":"Japan in spring"},{"q":"always_pack","a":"A good book"},{"q":"how_often","a":"Four times a year"}]'
 where id = pg_temp.m(2);
insert into public.profile_interests (profile_id, interest_id)
select pg_temp.m(2), id from public.interests order by sort limit 3;
insert into public.connections (requester_id, addressee_id, status, responded_at) values
  (pg_temp.m(1), pg_temp.m(2), 'accepted', now()),
  (pg_temp.m(3), pg_temp.m(1), 'pending', null);
insert into public.groups (name, owner_id, city_id, start_date, end_date)
values ('Lisbon walkers', pg_temp.m(1), 2267057, current_date + 30, current_date + 35);
insert into public.group_members (group_id, profile_id, role, status)
select g.id, x.member, x.role, x.status
  from public.groups g,
       (values (pg_temp.m(1), 'owner', 'joined'), (pg_temp.m(4), 'member', 'joined'), (pg_temp.m(5), 'member', 'invited')) x(member, role, status)
 where g.owner_id = pg_temp.m(1);

select pg_temp.sign_in_as(pg_temp.m(1));
select is((select bio from public.member_profile(pg_temp.m(2))), 'Retired teacher, loves trains.', 'connections can see each other''s full profile');
select is((select jsonb_array_length(interests) from public.member_profile(pg_temp.m(2))), 3, 'with their interests');
select is((select card_answers -> 0 ->> 'a' from public.member_profile(pg_temp.m(2))), 'Japan in spring', 'and the back of their card');
select ok((select connected_at from public.member_profile(pg_temp.m(2))) is not null, 'and when they connected');
select is((select count(*)::int from public.member_profile(pg_temp.m(3))), 0, 'not someone whose request is still waiting');
select is((select count(*)::int from public.member_profile(pg_temp.m(4))), 1, 'members of the same group can see each other');
select is((select count(*)::int from public.member_profile(pg_temp.m(5))), 0, 'but not someone only invited to it');
reset role;

select pg_temp.sign_in_as(pg_temp.m(5));
select is((select count(*)::int from public.member_profile(pg_temp.m(2))), 0, 'strangers can''t see it');
reset role;

select pg_temp.sign_in_as(pg_temp.m(2));
select is((select display_name from public.member_profile(pg_temp.m(1))), 'M1', 'it works both ways');
select public.block_member(pg_temp.m(1));
select is((select count(*)::int from public.member_profile(pg_temp.m(1))), 0, 'not after a block');
reset role;

set local role anon;
select throws_ok($$select * from public.member_profile(pg_temp.m(1))$$, '42501', null, 'visitors who aren''t signed in can''t read it');
reset role;

select * from finish();
rollback;
