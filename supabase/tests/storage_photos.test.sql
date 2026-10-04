-- pgTAP: profile photos sit in a private bucket, one folder per member.
begin;
select plan(5);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'ann@example.com', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.com', 'authenticated', 'authenticated');

select is((select public from storage.buckets where id = 'profile-photos'), false, 'the photo bucket is private');

insert into storage.objects (bucket_id, name, owner_id)
values ('profile-photos', '22222222-2222-4222-8222-222222222222/bob.jpg', '22222222-2222-4222-8222-222222222222');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('profile-photos', '11111111-1111-4111-8111-111111111111/ann.jpg', '11111111-1111-4111-8111-111111111111')$$, 'Ann can upload to her own folder');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('profile-photos', '22222222-2222-4222-8222-222222222222/fake.jpg', '11111111-1111-4111-8111-111111111111')$$, '42501', null, 'Ann cannot upload into Bob''s folder');
select results_eq($$select name from storage.objects where bucket_id = 'profile-photos'$$, $$values ('11111111-1111-4111-8111-111111111111/ann.jpg'::text)$$, 'Ann sees only her own photos');
select is_empty($$update storage.objects set metadata = '{}' where name = '22222222-2222-4222-8222-222222222222/bob.jpg' returning 1$$, 'Ann cannot change Bob''s photo');

select * from finish();
rollback;
