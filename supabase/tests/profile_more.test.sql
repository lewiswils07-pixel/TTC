-- pgTAP: holiday preferences, the photo book and the personal details
-- (sexuality, religion, ethnicity) from Lewis's 11 Oct list.
begin;
select plan(14);

create function pg_temp.sign_in_as(member uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.m(n int) returns uuid language sql as $$
  select ('7b7b7b7b-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;

-- Ann (1) and Bob (2) are members; Cat (3) has Sodalis+.
insert into auth.users (id, email, aud, role)
select pg_temp.m(n), 'pm' || n || '@example.com', 'authenticated', 'authenticated' from generate_series(1, 3) n;
update public.profiles p set photo_path = p.id || '/photo.jpg', display_name = v.name, onboarded_at = now()
from (values (1, 'Ann'), (2, 'Bob'), (3, 'Cat')) as v(n, name)
where p.id = pg_temp.m(v.n);
delete from public.entitlements where source = 'founding';
insert into public.entitlements (profile_id, plan, source) values (pg_temp.m(3), 'plus', 'manual');
insert into storage.objects (bucket_id, name, owner_id)
values ('profile-photos', pg_temp.m(1) || '/book-1.jpg', pg_temp.m(1)), ('profile-photos', pg_temp.m(1) || '/old.jpg', pg_temp.m(1));

select pg_temp.sign_in_as(pg_temp.m(1));
select lives_ok($$update public.profiles set holiday_prefs = '{"stay": "bnb", "packing": "light"}' where id = auth.uid()$$, 'Ann saves her holiday preferences');
select throws_ok($$update public.profiles set holiday_prefs = '{"stay": "castle"}' where id = auth.uid()$$, '23514', null, 'only answers from the list');
select throws_ok($$update public.profiles set holiday_prefs = '{"pets": "dog"}' where id = auth.uid()$$, '23514', null, 'only questions from the list');
select lives_ok($$update public.profiles set photo_book = array[auth.uid() || '/book-1.jpg'] where id = auth.uid()$$, 'Ann adds a photo book photo');
select throws_ok(format($$update public.profiles set photo_book = array['%s/x.jpg'] where id = auth.uid()$$, pg_temp.m(2)), '23514', null, 'only photos from her own folder');
select throws_ok($$update public.profiles set photo_book = (select array_agg(auth.uid() || '/b' || n || '.jpg') from generate_series(1, 7) n) where id = auth.uid()$$,
  '23514', null, 'at most 6 photo book photos');
select lives_ok($$update public.profiles set religion = 'buddhist', sexuality = 'straight', shown_fields = '{religion}' where id = auth.uid()$$, 'Ann adds personal details, showing only her religion');

select pg_temp.sign_in_as(pg_temp.m(2));
select is((select holiday_prefs from public.member_extras(pg_temp.m(1))), null, 'without Sodalis+ Bob can''t see her holiday preferences');
select is((select holiday_locked from public.member_extras(pg_temp.m(1))), true, 'but is told there are some');
select is((select array[religion, sexuality] from public.member_extras(pg_temp.m(1))), array['buddhist', null], 'he sees only what she chose to show');
select is((select photo_book from public.member_extras(pg_temp.m(1))), array[pg_temp.m(1) || '/book-1.jpg'], 'and her photo book');
select results_eq(format($$select name from storage.objects where name like '%s/%%' order by name$$, pg_temp.m(1)), array[pg_temp.m(1) || '/book-1.jpg'],
  'he can open her photo book photo, but not her old photos');

select pg_temp.sign_in_as(pg_temp.m(3));
select is((select holiday_prefs ->> 'stay' from public.member_extras(pg_temp.m(1))), 'bnb', 'Cat, with Sodalis+, sees them');
select is((select holiday_locked from public.member_extras(pg_temp.m(1))), false, 'with nothing locked');

select * from finish();
rollback;
