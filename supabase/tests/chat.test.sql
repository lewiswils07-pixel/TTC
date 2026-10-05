-- pgTAP: one-to-one chat (spec §2, §6.1). No messages without an accepted
-- connection; only the two members can read; unread counts; blocks end it.
-- Run with: npx supabase test db
begin;
select plan(16);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('ffffffff-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'h' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 3) n;
update public.profiles p set display_name = v.name, gender = 'woman', birth_year = 1960, home_city_id = 2644688, onboarded_at = now()
from (values (1, 'Ann'), (2, 'Bob'), (3, 'Cat')) as v(n, name)
where p.id = pg_temp.m(v.n);

create temp table ids (name text primary key, id bigint);
grant select, insert on ids to authenticated;

select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.conversations'::regclass, 'public.conversation_members'::regclass, 'public.messages'::regclass)),
  'chat tables have row-level security');

-- Ann asks Bob; no conversation until he accepts.
select pg_temp.sign_in_as(pg_temp.m(1));
insert into ids select 'req', public.send_connection_request(pg_temp.m(2));
select is_empty('select 1 from public.my_conversations()', 'no conversation while the request is pending');
select throws_ok($$insert into public.messages (conversation_id, sender_id, body) values (1, pg_temp.m(1), 'hi')$$, '42501', null,
  'messages cannot be written to the table directly');

select pg_temp.sign_in_as(pg_temp.m(2));
select public.respond_to_request((select id from ids where name = 'req'), true);
select is((select count(*)::int from public.my_conversations()), 1, 'accepting opens a conversation');
insert into ids select 'conv', id from public.my_conversations();
select lives_ok($$select public.send_message((select id from ids where name = 'conv'), '  Hello Ann!  ')$$, 'Bob can send a message');
select lives_ok($$select public.send_message((select id from ids where name = 'conv'), 'Lisbon in May?')$$, 'and another');
select throws_ok($$select public.send_message((select id from ids where name = 'conv'), '   ')$$, '23514', 'Write a message first', 'empty messages are refused');

select pg_temp.sign_in_as(pg_temp.m(1));
select results_eq('select display_name, last_body, unread, can_message from public.my_conversations()',
  $$values ('Bob'::text, 'Lisbon in May?'::text, 2, true)$$, 'Ann sees Bob''s chat with 2 unread');
select results_eq('select body from public.messages order by id', $$values ('Hello Ann!'::text), ('Lisbon in May?')$$, 'Ann can read the messages, tidied');
select lives_ok($$select public.mark_read((select id from ids where name = 'conv'))$$, 'Ann reads them');
select is((select unread from public.my_conversations()), 0, 'nothing unread after reading');

select pg_temp.sign_in_as(pg_temp.m(3));
select is_empty('select 1 from public.messages', 'Cat cannot read Ann and Bob''s messages');
select is_empty('select 1 from public.conversation_members', 'Cat cannot see who is talking to whom');
select throws_ok($$select public.send_message((select id from ids where name = 'conv'), 'hi')$$, 'P0002', 'Conversation not found', 'Cat cannot post in their chat');

-- Ann blocks Bob: the chat ends and leaves both lists.
select pg_temp.sign_in_as(pg_temp.m(1));
select public.block_member(pg_temp.m(2));
select is_empty('select 1 from public.my_conversations()', 'after a block, the chat leaves Ann''s list');
select pg_temp.sign_in_as(pg_temp.m(2));
select throws_ok($$select public.send_message((select id from ids where name = 'conv'), 'Hello?')$$, '23514', 'This conversation has ended', 'Bob can no longer send');

select * from finish();
rollback;
