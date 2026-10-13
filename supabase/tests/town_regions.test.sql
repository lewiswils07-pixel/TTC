-- pgTAP: the county beside UK towns in the town search.
begin;
select plan(4);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
insert into auth.users (id, email, aud, role) values ('0c0c0c0c-0000-4000-8000-000000000001', 'tr1@example.com', 'authenticated', 'authenticated');
select pg_temp.sign_in_as('0c0c0c0c-0000-4000-8000-000000000001');

select is((select region from public.search_cities('St Ives') where name = 'St Ives' limit 1), 'Cornwall', 'St Ives shows its county');
select ok((select count(distinct region) from public.search_cities('Newport')) > 1, 'towns with the same name show different counties');
select is((select count(*)::int from public.search_cities('Newport, Pemb') where region <> 'Pembrokeshire'), 0, 'typing the county after a comma narrows the list');
select ok(exists (select 1 from public.search_cities('Lisbon, pt') where name = 'Lisbon'), 'a country code after a comma works too');

select * from finish();
rollback;
