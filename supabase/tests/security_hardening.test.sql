-- pgTAP: fixes from the launch security review (T31).
-- Run with: npx supabase test db
begin;
select plan(16);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('efefefef-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

-- Ann and Bob are connected; Cat, Dan and Eve are strangers; Fay is mid sign-up.
insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'sh' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 6) n;
update public.profiles p set photo_path = p.id || '/photo.jpg', display_name = v.name, gender = 'woman', birth_date = date '1960-05-01', home_city_id = 2644688, onboarded_at = now()
from (values (1, 'Ann'), (2, 'Bob'), (3, 'Cat'), (4, 'Dan'), (5, 'Eve')) as v(n, name)
where p.id = pg_temp.m(v.n);
update public.profiles set display_name = 'Fay', gender = 'woman', birth_year = 1960, home_city_id = 2644688 where id = pg_temp.m(6);
insert into public.profile_interests (profile_id, interest_id) select pg_temp.m(n), i from generate_series(1, 6) n, generate_series(1, 8) i;

select pg_temp.sign_in_as(pg_temp.m(1));
select public.send_connection_request(pg_temp.m(2), 'Hello Bob');
reset role;
select pg_temp.sign_in_as(pg_temp.m(2));
select public.respond_to_request((select id from public.connections where requester_id = pg_temp.m(1)), true);
reset role;
create temp table chat as select c.id from public.conversations c join public.connections x on x.id = c.connection_id where x.requester_id = pg_temp.m(1);
grant select on chat to authenticated;

-- ------------------------------------------------- who blocked you stays private
select is(to_regprocedure('public.hidden_senders()'), null, 'who has blocked you is not readable through the API');

-- -------------------------------------------------- strangers can't gang up
select pg_temp.sign_in_as(pg_temp.m(3)); select public.report_member(pg_temp.m(1), 'other'); reset role;
select pg_temp.sign_in_as(pg_temp.m(4)); select public.report_member(pg_temp.m(1), 'other'); reset role;
select pg_temp.sign_in_as(pg_temp.m(5)); select public.report_member(pg_temp.m(1), 'other'); reset role;
select ok(not public.requests_paused(pg_temp.m(1)), 'three reports from strangers don''t pause a member''s requests');

-- -------------------------------------------------------------- photos
select pg_temp.sign_in_as(pg_temp.m(3));
select ok(public.is_current_profile_photo(pg_temp.m(1) || '/photo.jpg'), 'members can see each other''s photos');
select public.block_member(pg_temp.m(1));
select ok(not public.is_current_profile_photo(pg_temp.m(1) || '/photo.jpg'), 'but not after a block');
reset role;
select pg_temp.sign_in_as(pg_temp.m(1));
select ok(not public.is_current_profile_photo(pg_temp.m(3) || '/photo.jpg'), 'either way round');
reset role;

-- ------------------------------------------------------------ date of birth
select pg_temp.sign_in_as(pg_temp.m(6));
select throws_ok($$select public.finish_onboarding()$$, '23514', null, 'a full date of birth is needed to finish signing up');
select throws_ok($$update public.profiles set birth_year = 2010 where id = auth.uid()$$, '42501', null, 'and the year can''t be set on its own');
reset role;

-- --------------------------------------------------------- message limit
insert into public.messages (conversation_id, sender_id, body) select (select id from chat), pg_temp.m(1), 'hi ' || g from generate_series(1, 60) g;
select pg_temp.sign_in_as(pg_temp.m(1));
select throws_like($$select public.send_message((select id from chat), 'one more')$$, '%very quickly%', 'at most 60 messages in 10 minutes');
reset role;

-- ------------------------------------------------------- "Did you meet?"
select pg_temp.sign_in_as(pg_temp.m(4));
select public.send_connection_request(pg_temp.m(5), 'Hello Eve');
select throws_ok($$select public.answer_meet((select id from public.connections where requester_id = pg_temp.m(4)), true, false)$$, 'P0002', null, '"Did you meet?" only for people you connected with');
reset role;

-- ------------------------------------------------- paused accounts are paused
update public.profiles set status = 'suspended', role = 'admin' where id = pg_temp.m(2);
select ok(not public.is_admin(pg_temp.m(2)), 'a paused admin loses the admin tools');
select pg_temp.sign_in_as(pg_temp.m(2));
select throws_ok($$select * from public.suggest_by_interests()$$, '42501', null, 'a paused member can''t browse suggestions');
select ok(not public.can_message((select id from chat)), 'or use their chats');
select throws_ok($$select public.create_meetup_share((select id from chat), 'Café', now() + interval '1 day')$$, '42501', null, 'or share a meet-up');
select throws_ok($$select public.delete_my_account()$$, '42501', null, 'or delete their account to start again');
reset role;
select is((select count(*)::int from public.profiles where id = pg_temp.m(2)), 1, 'so the account is still there');

-- ------------------------------------- shares leave out people who blocked you
update public.profiles set status = 'active', role = 'member' where id = pg_temp.m(2);
select pg_temp.sign_in_as(pg_temp.m(1));
select throws_ok($$select public.create_meetup_share((select id from chat), 'Café', now() + interval '800 days')$$, '23514', null, 'shares are for meet-ups in the next 2 years');
reset role;

select * from finish();
rollback;
