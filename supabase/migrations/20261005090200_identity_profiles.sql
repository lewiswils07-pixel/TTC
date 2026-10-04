-- identity + profiles: one profile per account, travel preferences,
-- interests, and private profile photos.
--
-- Privacy rule (spec §3): a member can only ever read their OWN rows here.
-- Other members will be shown through the suggest_* functions in week 2,
-- which return a fixed set of public fields. Email and phone stay in
-- auth.users, which the API never exposes.

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text check (char_length(btrim(display_name)) between 1 and 40),
  birth_year         smallint check (birth_year between 1900 and 2100),
  gender             text check (gender in ('woman', 'man', 'nonbinary')),
  home_city_id       integer references public.cities (id),
  bio                text check (char_length(bio) <= 500),
  photo_path         text check (char_length(photo_path) <= 200),
  travel_style       text check (travel_style in ('planner', 'mix', 'spontaneous')),
  pace               text check (pace in ('slow', 'steady', 'packed')),
  budget             text check (budget in ('budget', 'mid', 'comfort')),
  mobility_note      text check (char_length(mobility_note) <= 200),
  phone_verified_at  timestamptz,
  id_verified_at     timestamptz,
  role               text not null default 'member' check (role in ('member', 'admin')),
  status             text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  onboarded_at       timestamptz,
  created_at         timestamptz not null default now(),
  last_active_at     timestamptz not null default now()
);

-- Rules a CHECK constraint can't express: minimum age 18 (by birth year,
-- spec §15) and photos only from the member's own storage folder.
create function public.profiles_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_year is not null
     and new.birth_year > extract(year from now())::int - 18 then
    raise exception 'Members must be 18 or over' using errcode = 'check_violation';
  end if;
  if new.photo_path is not null and new.photo_path not like new.id::text || '/%' then
    raise exception 'Photo must be in the member''s own folder' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_validate
  before insert or update of birth_year, photo_path on public.profiles
  for each row execute function public.profiles_validate();

alter table public.profiles enable row level security;

create policy "Members read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Members update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Column-level rights: members may change their own details, but never
-- role, status, verification dates or onboarded_at. Rows are created by
-- the sign-up trigger below, never by the app.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, birth_year, gender, home_city_id, bio, photo_path,
              travel_style, pace, budget, mobility_note)
  on public.profiles to authenticated;

-- ------------------------------------------------------------- preferences
-- Who a member wants to see. The last four columns only take effect for
-- Sodalis+ members (enforced in matching, week 2).
create table public.preferences (
  profile_id       uuid primary key references public.profiles (id) on delete cascade,
  age_min          smallint not null default 18 check (age_min >= 18),
  age_max          smallint not null default 99 check (age_max <= 120),
  genders          text[] not null default '{woman,man,nonbinary}'
                     check (cardinality(genders) >= 1 and genders <@ '{woman,man,nonbinary}'::text[]),
  max_distance_km  integer check (max_distance_km between 1 and 20000),
  verified_only    boolean not null default false,
  styles           text[] not null default '{}' check (styles <@ '{planner,mix,spontaneous}'::text[]),
  budgets          text[] not null default '{}' check (budgets <@ '{budget,mid,comfort}'::text[]),
  paces            text[] not null default '{}' check (paces <@ '{slow,steady,packed}'::text[]),
  check (age_min <= age_max)
);

alter table public.preferences enable row level security;

create policy "Members read their own preferences" on public.preferences
  for select to authenticated using ((select auth.uid()) = profile_id);
create policy "Members update their own preferences" on public.preferences
  for update to authenticated
  using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id);

revoke all on public.preferences from anon, authenticated;
grant select on public.preferences to authenticated;
grant update (age_min, age_max, genders, max_distance_km, verified_only, styles, budgets, paces)
  on public.preferences to authenticated;

-- ------------------------------------------------------- profile_interests
create table public.profile_interests (
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  interest_id  smallint not null references public.interests (id),
  primary key (profile_id, interest_id)
);
create index profile_interests_interest_idx on public.profile_interests (interest_id);

alter table public.profile_interests enable row level security;
create policy "Members read their own interests" on public.profile_interests
  for select to authenticated using ((select auth.uid()) = profile_id);

-- Changes go through set_my_interests(), which enforces 3 to 10.
revoke all on public.profile_interests from anon, authenticated;
grant select on public.profile_interests to authenticated;

create function public.set_my_interests(interest_ids smallint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  wanted smallint[] := array(select distinct unnest(interest_ids));
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if cardinality(wanted) not between 3 and 10
     or (select count(*) from public.interests where id = any (wanted)) <> cardinality(wanted) then
    raise exception 'Pick 3 to 10 interests' using errcode = 'check_violation';
  end if;
  delete from public.profile_interests where profile_id = me and interest_id <> all (wanted);
  insert into public.profile_interests (profile_id, interest_id)
    select me, unnest(wanted)
    on conflict do nothing;
end;
$$;
revoke all on function public.set_my_interests(smallint[]) from public, anon;
grant execute on function public.set_my_interests(smallint[]) to authenticated;

-- ------------------------------------------------------- finish onboarding
-- Marks the profile complete once everything required is there.
create function public.finish_onboarding()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  done_at timestamptz;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  update public.profiles p
     set onboarded_at = coalesce(p.onboarded_at, now())
   where p.id = me
     and p.display_name is not null
     and p.birth_year is not null
     and p.gender is not null
     and p.home_city_id is not null
     and (select count(*) from public.profile_interests i where i.profile_id = me) >= 3
  returning p.onboarded_at into done_at;
  if done_at is null then
    raise exception 'Profile is not finished' using errcode = 'check_violation';
  end if;
  return done_at;
end;
$$;
revoke all on function public.finish_onboarding() from public, anon;
grant execute on function public.finish_onboarding() to authenticated;

-- -------------------------------------------------------- new-member setup
-- Every new account gets an empty profile and default preferences.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.preferences (profile_id) values (new.id);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------- photo storage
-- Private bucket: files sit in a folder named after the member's id. Only
-- the owner can add, see, replace or remove them for now; other members
-- will get short-lived signed links through matching later.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Members add photos to their own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Members see their own photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Members replace their own photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Members remove their own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
