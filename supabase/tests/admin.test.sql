-- pgTAP: the review page (spec §6.11). Admins only; dismiss, warn, suspend,
-- remove and reinstate; every action logged; paused members can't send.
-- Run with: npx supabase test db
begin;
select plan(25);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('dddddddd-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

-- Lewis (admin), Ann, Bob (who misbehaves), Cat and Dan.
insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'a' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 5) n;
update public.profiles p set photo_path = p.id || '/photo.jpg', display_name = v.name, gender = 'woman', birth_year = 1960, home_city_id = 2644688, onboarded_at = now()
from (values (1, 'Lewis'), (2, 'Ann'), (3, 'Bob'), (4, 'Cat'), (5, 'Dan')) as v(n, name)
where p.id = pg_temp.m(v.n);
update public.profiles set role = 'admin' where id = pg_temp.m(1);

create temp table ids (name text primary key, id bigint);
grant select, insert on ids to authenticated;

-- Bob asks Ann; she accepts; he sends a risky message. Cat and Dan report him.
select pg_temp.sign_in_as(pg_temp.m(3));
insert into ids select 'req', public.send_connection_request(pg_temp.m(2));
select pg_temp.sign_in_as(pg_temp.m(2));
select public.respond_to_request((select id from ids where name = 'req'), true);
select pg_temp.sign_in_as(pg_temp.m(3));
insert into ids select 'conv', id from public.my_conversations();
select public.send_message((select id from ids where name = 'conv'), 'Please buy me some gift cards');
select pg_temp.sign_in_as(pg_temp.m(4));
select public.report_member(pg_temp.m(3), 'fake_profile', 'Photos look stolen');
select pg_temp.sign_in_as(pg_temp.m(5));
select public.report_member(pg_temp.m(3), 'harassment');

-- Members can't use the review page.
select pg_temp.sign_in_as(pg_temp.m(2));
select is(public.i_am_admin(), false, 'Ann is not an admin');
select throws_ok('select * from public.admin_queue()', '42501', 'Admins only', 'members cannot see the queue');
select throws_ok($$select public.admin_act('report', '1', 'dismiss')$$, '42501', 'Admins only', 'members cannot act');
select throws_ok('select * from public.admin_log()', '42501', 'Admins only', 'members cannot see the log');
select throws_ok('select 1 from public.moderation_actions', '42501', null, 'members cannot read actions directly');

-- Lewis sees two reports and the flagged message, oldest first.
select pg_temp.sign_in_as(pg_temp.m(1));
select is(public.i_am_admin(), true, 'Lewis is an admin');
select results_eq('select kind, subject_name, reasons from public.admin_queue()',
  $$values ('flag', 'Bob', '{gift_card}'::text[]), ('report', 'Bob', '{fake_profile}'), ('report', 'Bob', '{harassment}')$$,
  'the queue lists the flag and both reports about Bob');
select is((select open_reports from public.admin_queue() limit 1), 2, 'with the number of open reports about him');
select is((select reporter_name from public.admin_queue() where kind = 'report' limit 1), 'Cat', 'and who reported');

-- Dismissing closes just that item.
select lives_ok($$select public.admin_act('report', (select id from public.admin_queue() where reporter_name = 'Dan')::text, 'dismiss', 'Not enough to go on')$$,
  'Lewis dismisses Dan''s report');
select is((select count(*)::int from public.admin_queue()), 2, 'the other two stay open');

-- Warning closes everything about Bob and tells him.
select lives_ok($$select public.admin_act('flag', (select id from public.admin_queue() where kind = 'flag')::text, 'warn', 'Please keep money out of chats.')$$,
  'Lewis warns Bob');
select is_empty('select 1 from public.admin_queue()', 'the queue is empty');
select results_eq('select action, subject_name, note from public.admin_log() order by id',
  $$values ('dismiss', 'Bob', 'Not enough to go on'), ('warn', 'Bob', 'Please keep money out of chats.')$$, 'both actions are logged');

select pg_temp.sign_in_as(pg_temp.m(3));
select results_eq('select kind, body from public.member_notices', $$values ('warning', 'Please keep money out of chats.')$$,
  'Bob sees the warning');
select lives_ok($$select public.dismiss_notice((select id from public.member_notices))$$, 'and can close it');
select isnt((select seen_at from public.member_notices), null, 'it is marked as seen');

-- Suspending ends his connections and stops him sending.
select pg_temp.sign_in_as(pg_temp.m(1));
select throws_ok($$select public.admin_act('member', pg_temp.m(3)::text, 'suspend')$$, '23514', null,
  'reinstate is the only action on a member');
select pg_temp.sign_in_as(pg_temp.m(5));
select public.report_member(pg_temp.m(3), 'feels_unsafe');
select pg_temp.sign_in_as(pg_temp.m(1));
select lives_ok($$select public.admin_act('report', (select id from public.admin_queue())::text, 'suspend')$$, 'Lewis suspends Bob');
reset role;
select is((select status from public.connections where id = (select id from ids where name = 'req')), 'ended', 'his connection with Ann ends');
select pg_temp.sign_in_as(pg_temp.m(1));
select results_eq('select display_name, status from public.admin_paused_members()', $$values ('Bob', 'suspended')$$,
  'he is listed as paused');

select pg_temp.sign_in_as(pg_temp.m(3));
select throws_ok($$select public.send_connection_request(pg_temp.m(4))$$, '42501', 'Your account is paused', 'Bob cannot send requests');
select is((select kind from public.member_notices where seen_at is null), 'suspended', 'Bob sees he is suspended');

-- Reinstating brings him back.
select pg_temp.sign_in_as(pg_temp.m(1));
select lives_ok($$select public.admin_act('member', pg_temp.m(3)::text, 'reinstate')$$, 'Lewis reinstates Bob');
select pg_temp.sign_in_as(pg_temp.m(3));
select lives_ok($$select public.send_connection_request(pg_temp.m(4))$$, 'Bob can send requests again');

select * from finish();
rollback;
