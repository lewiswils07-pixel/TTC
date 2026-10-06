-- pgTAP: the KPI numbers on the Insights page (Lewis's KPI list, 5 Oct).
-- Run with: npx supabase test db
begin;
select plan(14);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('eeeeeeee-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

-- Lewis (admin), Ann and Bob, who have finished sign-up.
insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'k' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 3) n;
update public.profiles p set photo_path = p.id || '/photo.jpg', display_name = v.name, gender = 'woman', birth_year = 1960,
  home_city_id = 2644688, onboarded_at = now()
from (values (1, 'Lewis'), (2, 'Ann'), (3, 'Bob')) as v(n, name)
where p.id = pg_temp.m(v.n);
update public.profiles set role = 'admin' where id = pg_temp.m(1);
insert into public.profile_interests (profile_id, interest_id) select pg_temp.m(n), i from generate_series(2, 3) n, generate_series(1, 3) i;

-- --------------------------------------------------------- recording
select pg_temp.sign_in_as(pg_temp.m(2));
select public.touch_last_active();
select public.touch_last_active();
select public.note_first_match();
update public.profiles set heard_from = 'member' where id = pg_temp.m(2);
select ok(not public.nps_due(), 'new members aren''t asked to rate us yet');
reset role;
select is((select count(*)::int from public.member_days where profile_id = pg_temp.m(2)), 1, 'opening the app twice in a day counts as one active day');
select isnt((select first_match_at from public.profiles where id = pg_temp.m(2)), null, 'the first suggestion shown is recorded');

update public.profiles set onboarded_at = now() - interval '20 days' where id = pg_temp.m(2);
select pg_temp.sign_in_as(pg_temp.m(2));
select ok(public.nps_due(), 'after 2 weeks members are asked how likely they are to recommend us');
select lives_ok($$select public.answer_nps(9, 'Lovely people')$$, 'they can answer');
select throws_ok($$select public.answer_nps(3)$$, '22023', null, 'and aren''t asked again for 90 days');
select throws_ok($$select public.admin_kpis()$$, '42501', 'Admins only', 'members can''t see the KPIs');

-- Ann asks Bob to connect and he accepts.
select public.send_connection_request(pg_temp.m(3));
reset role;
select pg_temp.sign_in_as(pg_temp.m(3));
select public.respond_to_request((select id from public.connections where addressee_id = pg_temp.m(3)), true);
reset role;

-- ------------------------------------------------------------- the KPIs
select pg_temp.sign_in_as(pg_temp.m(1));
create temp table k as select public.admin_kpis(30) as v;
reset role;
select ok((select (v -> 'acquisition' ->> 'members')::int >= 3 from k), 'counts members who finished sign-up');
select ok((select (v -> 'acquisition' -> 'by_channel' ->> 'member')::int >= 1 from k), 'counts sign-ups by where they heard about us');
select ok((select (v -> 'matching' ->> 'accepted')::int >= 1 and (v -> 'matching' ->> 'requests')::int >= 1 from k), 'counts requests and how many were accepted');
select ok((select (v -> 'liquidity' ->> 'shown_a_match')::int >= 1 from k), 'counts members who have been shown a match');
select ok((select (v -> 'retention' ->> 'with_a_connection')::int >= 2 from k), 'counts members with a connection');
select ok((select (v -> 'community' ->> 'nps_promoters')::int >= 1 from k), 'counts people who would recommend us');
select is((select jsonb_array_length(v -> 'acquisition' -> 'by_week') from k), 8, 'sign-ups are shown for the last 8 weeks');

select * from finish();
rollback;
