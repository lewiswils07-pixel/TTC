-- pgTAP: ID check (Part 28). Only the server records checks; members see
-- their own status and who else has passed, nothing more.
-- Run with: npx supabase test db
begin;
select plan(12);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('eeeeeeee-1d00-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'idc' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 2) n;

-- The server (service_role) starts three checks for Ann.
set local role service_role;
select is(public.id_check_allowed(pg_temp.m(1)), 'ok', 'Ann can start a check');
select public.id_check_start(pg_temp.m(1), 's1');
select public.id_check_start(pg_temp.m(1), 's2');
select public.id_check_result('s2', 'Declined');
select is(public.id_check_owner('s2'), pg_temp.m(1), 'the server can tell whose check it is');
select public.id_check_start(pg_temp.m(1), 's3');
select is(public.id_check_allowed(pg_temp.m(1)), 'limit', 'three tries in 30 days, then no more');
select public.id_check_result('s3', 'Approved');
select is(public.id_check_allowed(pg_temp.m(1)), 'verified', 'Approved marks Ann as ID checked');
select public.id_check_result('nope', 'Approved');
select is((select count(*)::int from public.profiles where id_verified_at is not null and id in (pg_temp.m(1), pg_temp.m(2))), 1, 'an unknown check changes nothing');
reset role;

select pg_temp.sign_in_as(pg_temp.m(1));
select results_eq('select status, tries_left from public.my_id_check()', $$values ('Approved'::text, 0)$$, 'Ann sees her latest check and tries left');
select ok((select verified_at is not null from public.my_id_check()), 'Ann sees when she passed');
select throws_ok($$select public.id_check_result('s1', 'Approved')$$, '42501', null, 'members cannot record a result');
select throws_ok($$select public.id_check_start(auth.uid(), 'mine')$$, '42501', null, 'members cannot start a check without the server');
select throws_ok('select * from private.id_checks', '42501', null, 'members cannot read the checks table');

select pg_temp.sign_in_as(pg_temp.m(2));
select results_eq(format('select * from public.id_checked(array[%L, %L]::uuid[])', pg_temp.m(1), pg_temp.m(2)), format('values (%L::uuid)', pg_temp.m(1)), 'Bob sees that Ann is ID checked');
select results_eq('select status, tries_left from public.my_id_check()', $$values (null::text, 3)$$, 'Bob has not started a check');

select * from finish();
rollback;
