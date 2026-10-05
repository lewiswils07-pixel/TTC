-- pgTAP: the shared plan board (T23). Members of a chat add ideas, vote
-- and tick them off; no one else can see or change them.
-- Run with: npx supabase test db
begin;
select plan(17);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('aaaaaaaa-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'p' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 3) n;
update public.profiles p set display_name = v.name, gender = 'woman', birth_year = 1960, home_city_id = 2644688, onboarded_at = now()
from (values (1, 'Ann'), (2, 'Bob'), (3, 'Cat')) as v(n, name)
where p.id = pg_temp.m(v.n);
insert into public.connections (requester_id, addressee_id) values (pg_temp.m(1), pg_temp.m(2));
update public.connections set status = 'accepted';

create temp table ids (name text primary key, id bigint);
grant select, insert on ids to authenticated;

select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.plan_items'::regclass, 'public.plan_votes'::regclass)),
  'plan tables have row-level security');

select pg_temp.sign_in_as(pg_temp.m(1));
insert into ids select 'conv', id from public.my_conversations();
insert into ids select 'tiles', public.add_plan_item((select id from ids where name = 'conv'), '  Tile museum  ', 2::smallint, 'https://example.com/tiles');
insert into ids select 'tram', public.add_plan_item((select id from ids where name = 'conv'), 'Tram 28', 1::smallint);
select throws_ok($$select public.add_plan_item((select id from ids where name = 'conv'), 'Bad link', null, 'javascript:alert(1)')$$,
  '23514', null, 'only https links');
select throws_ok($$select public.add_plan_item((select id from ids where name = 'conv'), '   ')$$, '23514', null, 'an idea needs a title');
select is((select title from public.plan_board((select id from ids where name = 'conv')) where id = (select id from ids where name = 'tiles')),
  'Tile museum', 'Ann adds ideas');
select throws_ok('select * from public.plan_items', '42501', null, 'members cannot read the table directly');

-- Bob votes for the tile museum; it goes to the top.
select pg_temp.sign_in_as(pg_temp.m(2));
select lives_ok($$select public.toggle_plan_vote((select id from ids where name = 'tiles'))$$, 'Bob votes');
select results_eq($$select title, votes, i_voted, mine from public.plan_board((select id from ids where name = 'conv'))$$,
  $$values ('Tile museum', 1, true, false), ('Tram 28', 0, false, false)$$, 'the idea with most votes comes first');
select lives_ok($$select public.toggle_plan_vote((select id from ids where name = 'tiles'))$$, 'Bob takes his vote back');
select is((select votes from public.plan_board((select id from ids where name = 'conv')) where id = (select id from ids where name = 'tiles')), 0,
  'the vote is gone');
select lives_ok($$select public.set_plan_item_done((select id from ids where name = 'tram'), true)$$, 'Bob ticks off the tram');
select is((select title from public.plan_board((select id from ids where name = 'conv')) offset 1), 'Tram 28', 'done ideas go last');
select throws_ok($$select public.delete_plan_item((select id from ids where name = 'tiles'))$$, '42501', 'Only the person who added this can remove it',
  'Bob cannot remove Ann''s idea');

-- Cat isn't in the chat.
select pg_temp.sign_in_as(pg_temp.m(3));
select is_empty($$select 1 from public.plan_board((select id from ids where name = 'conv'))$$, 'outsiders see nothing');
select throws_ok($$select public.toggle_plan_vote((select id from ids where name = 'tiles'))$$, 'P0002', 'Idea not found', 'or vote');
select throws_ok($$select public.add_plan_item((select id from ids where name = 'conv'), 'Sneaky')$$, 'P0002', 'Conversation not found', 'or add ideas');

-- After a block the board is read-only.
select pg_temp.sign_in_as(pg_temp.m(1));
select public.block_member(pg_temp.m(2));
select throws_ok($$select public.add_plan_item((select id from ids where name = 'conv'), 'One more')$$, '23514', 'This conversation has ended',
  'no new ideas once the chat has ended');
select throws_ok($$select public.toggle_plan_vote((select id from ids where name = 'tram'))$$, '23514', 'This conversation has ended',
  'or votes');

select * from finish();
rollback;
