-- pgTAP: general groups (no place or dates), turning one into a trip group,
-- and everyone's dates for a trip group.
begin;
select plan(11);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('9a9a9a9a-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

-- Ann (1) is connected with Bob (2) and Cat (3).
insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'gg' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 4) n;
update public.profiles p set photo_path = p.id || '/photo.jpg', display_name = v.name, onboarded_at = now()
from (values (1, 'Ann'), (2, 'Bob'), (3, 'Cat'), (4, 'Dee')) as v(n, name)
where p.id = pg_temp.m(v.n);
insert into public.connections (requester_id, addressee_id, status)
values (pg_temp.m(1), pg_temp.m(2), 'accepted'), (pg_temp.m(1), pg_temp.m(3), 'accepted');
delete from public.entitlements where source = 'founding';
create temp table ids (name text primary key, id bigint);
grant select, insert on ids to authenticated;

select pg_temp.sign_in_as(pg_temp.m(1));
insert into ids select 'g', public.create_group('Book club', null, null, null, array[pg_temp.m(2), pg_temp.m(3)]);
select is((select city from public.my_groups()), null, 'a general group has no place');
select is(public.groups_i_can_start(), 0, 'and counts towards the group limit');
select is((select count(*)::int from public.my_conversations() where kind = 'group'), 1, 'its chat is in Ann''s messages');
select throws_ok($$select public.create_group('Half', 2267057, null, null)$$, '23514', 'Please pick a place and dates', 'a trip needs a place and dates');

select pg_temp.sign_in_as(pg_temp.m(2));
select public.respond_to_group_invite((select id from ids where name = 'g'), true);
select throws_ok($$select public.set_group_trip((select id from ids where name = 'g'), 2267057, current_date + 10, current_date + 14)$$,
  '42501', 'Only the person who started the group can do this', 'only the person who started it can make it a trip');
select is_empty($$select 1 from public.group_dates((select id from ids where name = 'g'))$$, 'a general group has no dates');

select pg_temp.sign_in_as(pg_temp.m(1));
select lives_ok($$select public.set_group_trip((select id from ids where name = 'g'), 2267057, current_date + 10, current_date + 14)$$,
  'Ann turns it into a Lisbon trip');
select is((select city from public.my_groups()), 'Lisbon', 'the group now has a place');
select is((select count(*)::int from public.group_dates((select id from ids where name = 'g'))), 2,
  'both members who joined have the trip, so both have dates');

select pg_temp.sign_in_as(pg_temp.m(4));
select is_empty($$select 1 from public.group_dates((select id from ids where name = 'g'))$$, 'outsiders can''t see the dates');

select pg_temp.sign_in_as(pg_temp.m(3));
select is_empty($$select 1 from public.group_dates((select id from ids where name = 'g'))$$, 'or someone only invited');

select * from finish();
rollback;
