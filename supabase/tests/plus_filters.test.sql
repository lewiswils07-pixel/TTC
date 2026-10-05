-- pgTAP: Sodalis+ filters and limits (spec §4.1, §5). Saved Sodalis+
-- filters only apply while the member has Sodalis+; plans are server-only.
-- Run with: npx supabase test db
begin;
select plan(10);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('eeeeeeee-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'f' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 4) n;

update public.profiles p set photo_path = p.id || '/photo.jpg',
  display_name = v.name, gender = 'woman', birth_year = 1960, home_city_id = 2644688, onboarded_at = now(),
  travel_style = v.style, id_verified_at = case when v.verified then now() end
from (values
  (1, 'Ann', 'planner', false),
  (2, 'Bob', 'planner', true),
  (3, 'Cat', 'spontaneous', true),
  (4, 'Dee', null, false)
) as v(n, name, style, verified)
where p.id = pg_temp.m(v.n);

delete from public.profile_interests where profile_id not in (select pg_temp.m(n) from generate_series(1, 4) n);
insert into public.profile_interests (profile_id, interest_id)
select pg_temp.m(n), i from generate_series(1, 4) n, generate_series(1, 3) i;

-- Ann saves Sodalis+ filters: verified members who like to plan.
update public.preferences set verified_only = true, styles = '{planner}' where profile_id = pg_temp.m(1);

select ok((select relrowsecurity from pg_class where oid = 'public.entitlements'::regclass), 'entitlements has row-level security');

-- These tests start on the free plan, without the founding offer.
delete from public.entitlements where source = 'founding';

select pg_temp.sign_in_as(pg_temp.m(1));
select is(public.i_have_plus(), false, 'Ann starts on the free plan');
select results_eq('select display_name from public.suggest_by_interests() order by display_name', $$values ('Bob'::text), ('Cat'), ('Dee')$$,
  'on the free plan, Sodalis+ filters are ignored');
select is(public.requests_left_this_week(), 5, 'free members get 5 requests a week');
select throws_ok($$insert into public.entitlements (profile_id, plan) values (pg_temp.m(1), 'plus')$$, '42501', null, 'members cannot give themselves Sodalis+');
reset role;

insert into public.entitlements (profile_id, plan, source, expires_at) values (pg_temp.m(1), 'plus', 'manual', now() + interval '30 days');
select pg_temp.sign_in_as(pg_temp.m(1));
select is(public.i_have_plus(), true, 'Ann now has Sodalis+');
select results_eq('select display_name from public.suggest_by_interests()', $$values ('Bob'::text)$$,
  'with Sodalis+, Ann sees only verified planners');
select is(public.requests_left_this_week(), 50, 'Sodalis+ members get 50 requests a week');
reset role;

update public.entitlements set expires_at = now() - interval '1 day' where profile_id = pg_temp.m(1);
select pg_temp.sign_in_as(pg_temp.m(1));
select is(public.i_have_plus(), false, 'an expired plan no longer counts');

select pg_temp.sign_in_as(pg_temp.m(2));
select is_empty('select 1 from public.entitlements', 'members cannot see other members'' plans');

select * from finish();
rollback;
