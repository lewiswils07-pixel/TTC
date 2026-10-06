-- pgTAP: download my data and delete my account (T19).
-- Run with: npx supabase test db
begin;
select plan(9);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('abababab-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

-- Ann starts a group with Bob; Ann and Bob are connected and chat.
insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'del' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 3) n;
update public.profiles p set photo_path = p.id || '/photo.jpg', display_name = v.name, gender = 'woman', birth_year = 1960, home_city_id = 2644688, onboarded_at = now()
from (values (1, 'Ann'), (2, 'Bob'), (3, 'Cat')) as v(n, name)
where p.id = pg_temp.m(v.n);
insert into public.profile_interests (profile_id, interest_id) select pg_temp.m(n), i from generate_series(1, 3) n, generate_series(1, 3) i;

select pg_temp.sign_in_as(pg_temp.m(1));
select public.send_connection_request(pg_temp.m(2), 'Hello Bob');
reset role;
select pg_temp.sign_in_as(pg_temp.m(2));
select public.respond_to_request((select id from public.connections where requester_id = pg_temp.m(1)), true);
reset role;
insert into public.groups (name, owner_id, city_id, start_date, end_date) values ('Lisbon walkers', pg_temp.m(1), 2267057, current_date + 30, current_date + 35);
insert into public.group_members (group_id, profile_id, role, status, joined_at)
select g.id, v.p, v.r, 'joined', now() from public.groups g, (values (pg_temp.m(1), 'owner'), (pg_temp.m(2), 'member')) v(p, r) where g.name = 'Lisbon walkers';

-- --------------------------------------------------------------- download
select pg_temp.sign_in_as(pg_temp.m(1));
create temp table d as select public.my_data() as v;
select is((select v -> 'profile' ->> 'display_name' from d), 'Ann', 'the download has the member''s profile');
select is((select v -> 'account' ->> 'email' from d), 'del1@example.com', 'and their email');
select is((select jsonb_array_length(v -> 'connections') from d), 1, 'and their connections');
select ok((select not (v -> 'profile' ? 'role') from d), 'but not internal fields');
select is((select jsonb_array_length(v -> 'interests') from d), 3, 'and their interests by name');

-- ----------------------------------------------------------------- delete
select lives_ok($$select public.delete_my_account()$$, 'a member can delete their account');
reset role;
select is((select count(*)::int from public.profiles where id = pg_temp.m(1)), 0, 'their profile is gone');
select is((select count(*)::int from public.connections where pg_temp.m(1) in (requester_id, addressee_id)), 0, 'and their connections');
select is((select owner_id from public.groups where name = 'Lisbon walkers'), pg_temp.m(2), 'a group they started carries on with another member in charge');

select * from finish();
rollback;
