-- pgTAP: matching v2 (Lewis's answers, 5 Oct). The 2-day overlap rule,
-- members away for 60 days, photo-less members shown lower down, the
-- lifestyle questions, the photo needed to connect, and last active.
-- Run with: npx supabase test db
begin;
select plan(13);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('eeeeeeee-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'v' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 8) n;

-- Everyone lives in Leeds (2644688) and is going to Lisbon (2267057).
update public.profiles p set
  display_name = v.name, gender = 'woman', birth_year = 1960, home_city_id = 2644688,
  onboarded_at = now(), photo_path = case when v.photo then p.id || '/photo.jpg' end,
  last_active_at = now() - v.away, room_sharing = v.room, day_rhythm = v.rhythm,
  walking = v.walk, languages = v.langs
from (values
  (1, 'Ann', true,  interval '0',       'share',    'early', 'lots',   '{en}'::text[]),
  (2, 'Bob', true,  interval '0',       null,       null,    null,     '{}'),             -- neutral habits
  (3, 'Cat', false, interval '0',       null,       null,    null,     '{}'),             -- no photo
  (4, 'Dan', true,  interval '61 days', null,       null,    null,     '{}'),             -- away for 61 days
  (5, 'Eve', true,  interval '0',       'separate', 'late',  'gentle', '{fr}'),           -- habits clash
  (6, 'Fay', true,  interval '0',       'share',    'early', 'lots',   '{en,fr}'),        -- habits fit
  (7, 'Gus', true,  interval '0',       null,       null,    null,     '{}'),             -- 1 day together
  (8, 'Hal', true,  interval '2 days',  null,       null,    null,     '{}')              -- a 1-day trip
) as v(n, name, photo, away, room, rhythm, walk, langs)
where p.id = pg_temp.m(v.n);

insert into public.profile_interests (profile_id, interest_id)
select pg_temp.m(v.n), unnest(v.ids) from (values
  (1, array[1, 2, 3, 4]),
  (2, array[1, 2]), (3, array[1, 2, 3]), (4, array[1, 2]), (5, array[1, 2]),
  (6, array[1, 2]), (7, array[1, 2]), (8, array[1, 2])
) as v(n, ids);

update public.trips set visibility = 'hidden';
insert into public.trips (owner_id, city_id, start_date, end_date, flexible_days, visibility) values
  (pg_temp.m(1), 2267057, current_date + 30, current_date + 37, 0, 'members'),
  (pg_temp.m(2), 2267057, current_date + 31, current_date + 34, 0, 'members'),
  (pg_temp.m(3), 2267057, current_date + 31, current_date + 34, 0, 'members'),
  (pg_temp.m(4), 2267057, current_date + 31, current_date + 34, 0, 'members'),
  (pg_temp.m(5), 2267057, current_date + 31, current_date + 34, 0, 'members'),
  (pg_temp.m(6), 2267057, current_date + 31, current_date + 34, 0, 'members'),
  (pg_temp.m(7), 2267057, current_date + 37, current_date + 40, 0, 'members'),
  (pg_temp.m(8), 2267057, current_date + 33, current_date + 33, 0, 'members');
create temp table ann_trip as select id from public.trips where owner_id = pg_temp.m(1);
grant select on ann_trip to authenticated;

-- ------------------------------------------------------------ as Ann
select pg_temp.sign_in_as(pg_temp.m(1));

select results_eq(
  'select display_name from public.suggest_for_trip((select id from ann_trip))',
  $$values ('Fay'::text), ('Bob'), ('Hal'), ('Eve'), ('Cat')$$,
  'habits that fit come first, members without a photo come last');
select is_empty($$select 1 from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Gus'$$,
  'one day together is not enough');
select is_empty($$select 1 from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Dan'$$,
  'members away for over 60 days are left out');
select is((select score from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Fay'), 60, 'habits that fit keep the full score');
select is((select score from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Eve'), 51, 'habits that clash take off 15%');
select is((select score from public.suggest_for_trip((select id from ann_trip)) where display_name = 'Cat'), 67, 'Cat scores higher but has no photo');
select is((select display_name from public.suggest_by_interests() limit 1), 'Fay', 'interests mode uses the same rules');
select is_empty($$select 1 from public.suggest_by_interests() where display_name = 'Dan'$$,
  'interests mode leaves out members away for over 60 days');

-- New answers: Ann can save them; bad language codes are refused.
select lives_ok($$update public.profiles set travelling_with = 'My sister Jo', languages = '{en,es}' where id = pg_temp.m(1)$$,
  'members can save a travelling-with note and languages');
select throws_ok($$update public.profiles set languages = '{English}' where id = pg_temp.m(1)$$, '23514', null,
  'languages are 2-letter codes');
reset role;

-- A photo is needed to ask to connect.
select pg_temp.sign_in_as(pg_temp.m(3));
select throws_ok($$select public.send_connection_request(pg_temp.m(2))$$, '23514', 'Add a profile photo before asking to connect',
  'members without a photo cannot ask to connect');
reset role;
select pg_temp.sign_in_as(pg_temp.m(2));
select lives_ok($$select public.send_connection_request(pg_temp.m(6))$$, 'members with a photo can');
reset role;

-- Opening the app brings a member back into suggestions.
select pg_temp.sign_in_as(pg_temp.m(4));
select public.touch_last_active();
reset role;
select ok((select last_active_at > now() - interval '1 minute' from public.profiles where id = pg_temp.m(4)),
  'touch_last_active marks a member as active');

select * from finish();
rollback;
