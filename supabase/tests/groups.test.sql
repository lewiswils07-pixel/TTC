-- pgTAP: groups (spec §2, §5). Up to 6 people, invited from connections;
-- group chat for members only; leave and remove; limits; blocks respected.
-- Run with: npx supabase test db
begin;
select plan(30);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('bbbbbbbb-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

-- Ann (1) is connected with Bob, Cat, Dan, Eve, Fay and Gus (2 to 7). Hal (8) is not.
insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'g' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 8) n;
update public.profiles p set photo_path = p.id || '/photo.jpg', display_name = v.name, gender = 'woman', birth_year = 1960, home_city_id = 2644688, onboarded_at = now()
from (values (1, 'Ann'), (2, 'Bob'), (3, 'Cat'), (4, 'Dan'), (5, 'Eve'), (6, 'Fay'), (7, 'Gus'), (8, 'Hal')) as v(n, name)
where p.id = pg_temp.m(v.n);
insert into public.connections (requester_id, addressee_id, status)
select pg_temp.m(1), pg_temp.m(n), 'pending' from generate_series(2, 7) n;
update public.connections set status = 'accepted';

create temp table ids (name text primary key, id bigint);
grant select, insert on ids to authenticated;

select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.groups'::regclass, 'public.group_members'::regclass)),
  'group tables have row-level security');

-- These tests start on the free plan, without the founding offer.
delete from public.entitlements where source = 'founding';

select pg_temp.sign_in_as(pg_temp.m(1));
select is(public.groups_i_can_start(), 1, 'a free member can start 1 group');
select throws_ok($$select public.create_group('Lisbon', 2267057, current_date + 10, current_date + 14, array[pg_temp.m(8)])$$,
  '23514', 'You can only invite people you''re connected with', 'only connections can be invited');
select throws_ok($$select public.create_group('Lisbon', 2267057, current_date - 10, current_date - 4)$$,
  '23514', 'This trip has already ended', 'no groups for trips that have ended');
select throws_ok($$select public.create_group('Lisbon', 2267057, current_date + 10, current_date + 14,
  array[pg_temp.m(2), pg_temp.m(3), pg_temp.m(4), pg_temp.m(5), pg_temp.m(6), pg_temp.m(7)])$$,
  '23514', 'Groups can have up to 6 people', 'at most 6 people');
insert into ids select 'g', public.create_group('  Lisbon in May  ', 2267057, current_date + 10, current_date + 14,
  array[pg_temp.m(2), pg_temp.m(3), pg_temp.m(4)]);
select is((select name from public.my_groups()), 'Lisbon in May', 'Ann creates the group');
select is(public.groups_i_can_start(), 0, 'and has used her free group');
select throws_ok($$select public.create_group('Rome', 3169070, current_date + 30, current_date + 34)$$,
  '23514', 'Group limit reached', 'a second active group needs Sodalis+');
insert into ids select 'conv', conversation_id from public.my_groups();
select is((select count(*)::int from public.my_conversations() where kind = 'group'), 1, 'the group chat is in Ann''s messages');

-- Bob sees the invite but not the chat until he joins.
select pg_temp.sign_in_as(pg_temp.m(2));
select is((select my_status from public.my_groups()), 'invited', 'Bob is invited');
select is((select count(*)::int from public.group_people((select id from ids where name = 'g'))), 4, 'and can see who is in it');
select is_empty($$select 1 from public.my_conversations() where kind = 'group'$$, 'no chat before joining');
select lives_ok($$select public.respond_to_group_invite((select id from ids where name = 'g'), true)$$, 'Bob joins');
select lives_ok($$select public.send_message((select id from ids where name = 'conv'), 'Hello everyone!')$$, 'and can write in the group chat');

-- Hal, not in the group, can't read it.
select pg_temp.sign_in_as(pg_temp.m(8));
select is_empty($$select 1 from public.messages where conversation_id = (select id from ids where name = 'conv')$$, 'outsiders cannot read the chat');
select is_empty($$select 1 from public.group_people((select id from ids where name = 'g'))$$, 'or see who is in the group');
select throws_ok($$select public.send_message((select id from ids where name = 'conv'), 'hi')$$, 'P0002', 'Conversation not found', 'or write in it');

-- Cat says no; Dan joins.
select pg_temp.sign_in_as(pg_temp.m(3));
select lives_ok($$select public.respond_to_group_invite((select id from ids where name = 'g'), false)$$, 'Cat declines');
select is_empty('select 1 from public.my_groups()', 'and the invite goes');
select pg_temp.sign_in_as(pg_temp.m(4));
select public.respond_to_group_invite((select id from ids where name = 'g'), true);

-- Dan blocks Bob: neither sees the other's messages in the group.
select public.block_member(pg_temp.m(2));
select is_empty($$select 1 from public.messages where conversation_id = (select id from ids where name = 'conv') and sender_id = pg_temp.m(2)$$,
  'Dan no longer sees Bob''s messages');
select is((select count(*)::int from public.group_people((select id from ids where name = 'g'))), 2, 'or sees him in the member list');
select pg_temp.sign_in_as(pg_temp.m(1));
select is((select count(*)::int from public.messages where conversation_id = (select id from ids where name = 'conv')), 1, 'Ann still sees Bob''s message');

-- Ann can't invite someone blocked with a member, or add a 7th person.
select throws_ok($$select public.invite_to_group((select id from ids where name = 'g'), array[pg_temp.m(8)])$$,
  '23514', 'You can only invite people you''re connected with', 'invites need a connection');
select lives_ok($$select public.invite_to_group((select id from ids where name = 'g'), array[pg_temp.m(5), pg_temp.m(6), pg_temp.m(7)])$$,
  'Ann invites three more');
select throws_ok($$select public.invite_to_group((select id from ids where name = 'g'), array[pg_temp.m(3)])$$,
  '23514', 'Groups can have up to 6 people', 'but not a seventh');

-- Members can't remove others; Ann can.
select pg_temp.sign_in_as(pg_temp.m(2));
select throws_ok($$select public.leave_group((select id from ids where name = 'g'), pg_temp.m(4))$$, 'P0002', 'Group not found',
  'members cannot remove others');
select pg_temp.sign_in_as(pg_temp.m(1));
select lives_ok($$select public.leave_group((select id from ids where name = 'g'), pg_temp.m(2))$$, 'Ann removes Bob');
select pg_temp.sign_in_as(pg_temp.m(2));
select throws_ok($$select public.send_message((select id from ids where name = 'conv'), 'Still here?')$$, 'P0002', 'Conversation not found',
  'Bob can no longer write in the chat');

-- When Ann leaves, Dan (the longest-standing member) takes over.
select pg_temp.sign_in_as(pg_temp.m(1));
select public.leave_group((select id from ids where name = 'g'));
select pg_temp.sign_in_as(pg_temp.m(4));
select is((select i_own from public.my_groups()), true, 'Dan takes over when Ann leaves');
select pg_temp.sign_in_as(pg_temp.m(1));
select is(public.groups_i_can_start(), 1, 'and Ann can start a new group');

select * from finish();
rollback;
