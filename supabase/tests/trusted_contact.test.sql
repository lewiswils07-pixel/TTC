-- pgTAP: the trusted-contact link (T17).
-- Run with: npx supabase test db
begin;
select plan(16);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('cdcdcdcd-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

-- Ann and Bob are connected and have a chat; Cat is a stranger.
insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'tc' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 3) n;
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
create temp table chat as select c.id from public.conversations c join public.connections x on x.id = c.connection_id where x.requester_id = pg_temp.m(1);
grant select on chat to authenticated;

-- ------------------------------------------------------------- make a link
select pg_temp.sign_in_as(pg_temp.m(1));
create temp table made as select * from public.create_meetup_share((select id from chat), 'Café Nero, Leeds station', now() + interval '1 day', 'Back by 6');
grant select on made to anon, authenticated;
select is((select char_length(token) from made), 32, 'a link gets a 32-character code');
select ok((select token ~ '^[A-Za-z0-9_-]+$' from made), 'that is safe to put in a web address');
select is((select meeting_with -> 0 ->> 'name' from made), 'Bob', 'it remembers who they are meeting');
select ok((select not (meeting_with -> 0 ? 'email') and not (meeting_with -> 0 ? 'photo_path') from made), 'but not their email or photo');
select throws_ok($$select public.create_meetup_share((select id from chat), 'Somewhere', now() - interval '3 days')$$, '23514', null, 'a meeting long in the past is refused');
select throws_ok($$select public.create_meetup_share((select id from chat), ' ', now() + interval '1 day')$$, '23514', null, 'a place is needed');
reset role;

select pg_temp.sign_in_as(pg_temp.m(3));
select throws_ok($$select public.create_meetup_share((select id from chat), 'Somewhere', now() + interval '1 day')$$, '42501', null, 'nobody can share from a chat they are not in');
select is((select count(*)::int from public.meetup_shares), 0, 'and nobody else can read the shares');
reset role;

-- ----------------------------------------------------- the contact's view
set local role anon;
select is((select public.view_meetup_share((select token from made)) ->> 'place'), 'Café Nero, Leeds station', 'anyone with the link sees where');
select is((select public.view_meetup_share((select token from made)) ->> 'member'), 'Ann', 'and whose meet-up it is');
select is(public.view_meetup_share('wrongwrongwrongwrongwrongwrong12'), null, 'a wrong code shows nothing');
select throws_ok($$select * from public.meetup_shares$$, '42501', null, 'the table itself is closed to visitors');
reset role;

-- ---------------------------------------------------- check in, then stop
select pg_temp.sign_in_as(pg_temp.m(3));
select public.check_in_meetup_share((select id from made));
reset role;
select is((select checked_in_at from public.meetup_shares where id = (select id from made)), null, 'only the member can check in');
select pg_temp.sign_in_as(pg_temp.m(1));
select public.check_in_meetup_share((select id from made));
select isnt((select public.view_meetup_share((select token from made)) ->> 'checked_in_at'), null, 'the contact sees they are back safe');
select public.stop_meetup_share((select id from made));
select is(public.view_meetup_share((select token from made)), null, 'a stopped link shows nothing');
reset role;
update public.meetup_shares set stopped_at = null, meet_at = now() - interval '3 days' where id = (select id from made);
select is(public.view_meetup_share((select token from made)), null, 'and links end two days after the meeting');

select * from finish();
rollback;
