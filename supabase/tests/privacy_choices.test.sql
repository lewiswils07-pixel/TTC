-- pgTAP: "We value your privacy" choices.
begin;
select plan(7);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('9c9c9c9c-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'pc' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 2) n;

select pg_temp.sign_in_as(pg_temp.m(1));
select is((select count(*)::int from public.privacy_choices), 0, 'nothing is saved until the member chooses');
select lives_ok($$select public.set_privacy_choices(true, false)$$, 'members can save their choices');
select is((select measuring::text || ',' || marketing::text from public.privacy_choices), 'true,false', 'and see them');
select public.set_privacy_choices(false, true);
select is((select measuring::text || ',' || marketing::text from public.privacy_choices), 'false,true', 'and change them later');
select is(public.my_data() -> 'privacy_choices' ->> 'marketing', 'true', 'their choices are in "Download my data"');
select throws_ok($$insert into public.privacy_choices (profile_id, measuring) values (pg_temp.m(2), true)$$, '42501', null,
  'nobody can write choices for someone else');
reset role;

select pg_temp.sign_in_as(pg_temp.m(2));
select is((select count(*)::int from public.privacy_choices), 0, 'members can''t see other people''s choices');
reset role;

select * from finish();
rollback;
