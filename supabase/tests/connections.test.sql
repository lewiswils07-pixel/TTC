-- pgTAP: connection requests (spec §2, §4.1, §5, §6.1). Who can ask whom,
-- the weekly limit, accept, decline and withdraw, and privacy.
-- Run with: npx supabase test db
begin;
select plan(24);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('bbbbbbbb-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'c' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 11) n;

update public.profiles p set photo_path = p.id || '/photo.jpg',
  display_name = v.name, gender = v.gender, birth_year = v.born, home_city_id = 2644688,
  onboarded_at = case when v.done then now() end
from (values
  (1, 'Ann', 'woman', 1960, true), (2, 'Bob', 'man', 1962, true), (3, 'Cat', 'woman', 1958, true),
  (4, 'Dan', 'man', 1990, true),   (5, 'Kim', 'woman', 1963, false),
  (6, 'M6', 'man', 1960, true), (7, 'M7', 'man', 1960, true), (8, 'M8', 'man', 1960, true),
  (9, 'M9', 'man', 1960, true), (10, 'M10', 'man', 1960, true), (11, 'M11', 'man', 1960, true)
) as v(n, name, gender, born, done)
where p.id = pg_temp.m(v.n);
update public.preferences set age_min = 40 where profile_id = pg_temp.m(1);   -- Ann: 40 and over, so not Dan

create temp table ids (name text primary key, id bigint);
grant select, insert on ids to authenticated;

select ok((select relrowsecurity from pg_class where oid = 'public.connections'::regclass), 'connections has row-level security');

-- ------------------------------------------------------------ as Ann
select pg_temp.sign_in_as(pg_temp.m(1));
select lives_ok($$insert into ids select 'ann-bob', public.send_connection_request(pg_temp.m(2), '  Hello Bob!  ')$$, 'Ann can send Bob a request with a note');
select is((select note from public.connections where id = (select id from ids where name = 'ann-bob')), 'Hello Bob!', 'the note is tidied');
select is(public.requests_left_this_week(), 4, 'Ann has 4 requests left this week');
select throws_ok($$select public.send_connection_request(pg_temp.m(2))$$, '23514', 'You''re already in touch with this member', 'Ann cannot ask Bob twice');
select throws_ok($$select public.send_connection_request(pg_temp.m(4))$$, '23514', 'This member isn''t available', 'Ann cannot ask someone outside her preferences');
select throws_ok($$select public.send_connection_request(pg_temp.m(5))$$, '23514', 'This member isn''t available', 'Ann cannot ask someone who hasn''t finished sign-up');
select throws_ok($$select public.send_connection_request(pg_temp.m(1))$$, '23514', 'This member isn''t available', 'Ann cannot ask herself');
select throws_ok($$insert into public.connections (requester_id, addressee_id) values (pg_temp.m(1), pg_temp.m(3))$$, '42501', null, 'requests cannot skip the rules by writing to the table');
select throws_ok($$update public.connections set status = 'accepted'$$, '42501', null, 'Ann cannot accept her own request');

-- ------------------------------------------------------------ as Bob and Cat
select pg_temp.sign_in_as(pg_temp.m(2));
select results_eq($$select direction, status, display_name, note from public.my_connections()$$,
  $$values ('received'::text, 'pending'::text, 'Ann'::text, 'Hello Bob!'::text)$$, 'Bob sees Ann''s request');
select throws_ok($$select public.send_connection_request(pg_temp.m(1))$$, '23514', 'You''re already in touch with this member', 'Bob cannot send Ann a second, crossing request');

select pg_temp.sign_in_as(pg_temp.m(3));
select is_empty('select 1 from public.connections', 'Cat cannot see Ann and Bob''s request');
select throws_ok($$select public.respond_to_request((select id from ids where name = 'ann-bob'), true)$$, 'P0002', 'Request not found', 'Cat cannot answer Bob''s request');

select pg_temp.sign_in_as(pg_temp.m(2));
select lives_ok($$select public.respond_to_request((select id from ids where name = 'ann-bob'), false)$$, 'Bob can decline');
select is_empty('select 1 from public.my_connections()', 'a declined request disappears from Bob''s list');

-- ------------------------------------------------------------ back to Ann
select pg_temp.sign_in_as(pg_temp.m(1));
select throws_ok($$select public.send_connection_request(pg_temp.m(2))$$, '23514', 'You''re already in touch with this member', 'Ann cannot ask Bob again within 90 days');

select lives_ok($$insert into ids select 'm' || n, public.send_connection_request(pg_temp.m(n)) from generate_series(6, 9) n$$, 'Ann sends 4 more requests');
select throws_ok($$select public.send_connection_request(pg_temp.m(10))$$, '23514', 'Weekly request limit reached', 'the 6th request in a week is refused');
select lives_ok($$select public.withdraw_request((select id from ids where name = 'm6'))$$, 'Ann can withdraw a request');
select is(public.requests_left_this_week(), 0, 'a withdrawn request still counts this week');

select pg_temp.sign_in_as(pg_temp.m(7));
select lives_ok($$select public.respond_to_request((select id from ids where name = 'm7'), true)$$, 'M7 accepts');

select pg_temp.sign_in_as(pg_temp.m(1));
select results_eq($$select display_name, status from public.my_connections() order by display_name$$,
  $$values ('M7'::text, 'accepted'::text), ('M8', 'pending'), ('M9', 'pending')$$,
  'Ann sees her connection and open requests, not withdrawn or declined ones');
reset role;

-- Suggestions leave out anyone Ann is already in touch with, or who declined her.
update public.trips set visibility = 'hidden';
insert into public.trips (owner_id, city_id, start_date, end_date)
select pg_temp.m(n), 2267057, current_date + 10, current_date + 14 from unnest(array[1, 2, 7, 8, 11]) n;
create temp table ann_trip as select id from public.trips where owner_id = pg_temp.m(1);
grant select on ann_trip to authenticated;
select pg_temp.sign_in_as(pg_temp.m(1));
select results_eq('select display_name from public.suggest_for_trip((select id from ann_trip))', $$values ('M11'::text)$$,
  'suggestions skip declined, connected and pending members');

select * from finish();
rollback;
