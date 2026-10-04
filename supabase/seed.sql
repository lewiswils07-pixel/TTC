-- Local-only demo data: 200 finished member profiles for trying the app and
-- testing matching. Runs on `npx supabase db reset` against the LOCAL
-- database only; it is never applied to the live project.
-- Demo accounts are demo001@example.com ... demo200@example.com (sign in
-- with an email code; local emails appear in Mailpit, http://127.0.0.1:54324).

select setseed(0.42);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000',
       ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       'authenticated', 'authenticated',
       'demo' || lpad(i::text, 3, '0') || '@example.com',
       '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from generate_series(1, 200) as i;

-- The sign-up trigger has created empty profiles; fill them in.
with first_names(n, name, gender) as (
  select row_number() over (), * from (values
    ('Margaret','woman'),('Susan','woman'),('Linda','woman'),('Carol','woman'),('Patricia','woman'),
    ('Janet','woman'),('Elaine','woman'),('Gillian','woman'),('Helen','woman'),('Ruth','woman'),
    ('Anne','woman'),('Fiona','woman'),('Maureen','woman'),('Sheila','woman'),('Brenda','woman'),
    ('Pauline','woman'),('Deborah','woman'),('Alison','woman'),('Wendy','woman'),('Sandra','woman'),
    ('John','man'),('David','man'),('Peter','man'),('Michael','man'),('Robert','man'),
    ('Stephen','man'),('Paul','man'),('Richard','man'),('Graham','man'),('Ian','man'),
    ('Keith','man'),('Colin','man'),('Martin','man'),('Alan','man'),('Nigel','man'),
    ('Geoff','man'),('Trevor','man'),('Andrew','man'),('Kevin','man'),('Barry','man'),
    ('Sam','nonbinary'),('Alex','nonbinary'),('Robin','nonbinary'),('Jules','nonbinary')
  ) v(name, gender)
),
homes as (
  select row_number() over (order by population desc) as n, id
  from public.cities
  where country_code in ('GB', 'IE') and population > 60000
  limit 60
),
demo as (
  select p.id, row_number() over (order by p.id) as i
  from public.profiles p
  where p.id::text like '00000000-0000-4000-8000-%'
)
update public.profiles p
   set display_name = f.name,
       gender       = f.gender,
       birth_year   = 1946 + floor(random() * 40)::int,      -- aged about 40 to 80
       home_city_id = h.id,
       bio          = 'Demo member for local testing.',
       travel_style = (array['planner', 'mix', 'spontaneous'])[1 + floor(random() * 3)::int],
       pace         = (array['slow', 'steady', 'packed'])[1 + floor(random() * 3)::int],
       budget       = (array['budget', 'mid', 'comfort'])[1 + floor(random() * 3)::int],
       phone_verified_at = now(),
       onboarded_at = now(),
       last_active_at = now() - make_interval(days => floor(random() * 30)::int)
  from demo d
  join first_names f on f.n = 1 + (d.i - 1) % 44
  join homes h on h.n = 1 + (d.i * 7) % 60
 where p.id = d.id;

-- 3 to 8 interests each.
insert into public.profile_interests (profile_id, interest_id)
select p.id, i.id
from public.profiles p
cross join lateral (
  select x.id from public.interests x
  where p.id is not null                 -- ties the subquery to each member
  order by random()
  limit 3 + floor(random() * 6)::int
) i
where p.id::text like '00000000-0000-4000-8000-%';

-- Varied age preferences.
update public.preferences
   set age_min = 18 + floor(random() * 30)::int,
       age_max = 70 + floor(random() * 30)::int
 where profile_id::text like '00000000-0000-4000-8000-%';
