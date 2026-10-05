-- pgTAP: the interests list v3. Short, distinct labels, and members keep
-- (and gain) picks when interests are split or merged.
-- Run with: npx supabase test db
begin;
select plan(6);

select is((select count(*)::int from public.interests), 89, '89 interests');
select is((select count(distinct lower(label))::int from public.interests), 89, 'every label is different');
select is_empty($$select label from public.interests where label ~ ' and ' or char_length(label) > 17$$,
  'labels are short enough for a chip and join nothing with "and"');
select is((select count(distinct category_label)::int from public.interests), 9, '9 groups');
select is_empty($$select 1 from public.interests where slug in ('coastal-walks', 'hot-springs')$$, 'overlapping interests are merged away');
select is((select label from public.interests where slug = 'opera-ballet'), 'Opera', 'ids and slugs stay, labels change');

select * from finish();
rollback;
