-- pgTAP: the grouped interests list (89 interests in 9 categories since v3).
begin;
select plan(4);
select is((select count(*)::int from public.interests), 89, 'there are 89 interests');
select is((select count(distinct category)::int from public.interests), 9, 'they sit in 9 categories');
select is_empty($$select 1 from public.interests group by lower(label) having count(*) > 1$$, 'no interest is listed twice');
select results_eq(
  $$select slug from public.interests where id in (1, 5, 10) order by id$$,
  $$values ('museums'::text), ('castles-stately-homes'), ('local-cuisine')$$,
  'original interests keep their ids, so members'' picks carry over');
select * from finish();
rollback;
