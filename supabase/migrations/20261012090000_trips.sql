-- trips: where and when a member is going, plus cities they'd love to
-- visit one day (spec §3). Matching (T8, T9) reads these through
-- security definer functions; members can only ever read their OWN rows.

-- ------------------------------------------------------------------ trips
create table public.trips (
  id             bigint generated always as identity primary key,
  owner_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  city_id        integer not null references public.cities (id),
  start_date     date not null,
  end_date       date not null,
  flexible_days  smallint not null default 0 check (flexible_days between 0 and 7),
  note           text check (char_length(note) <= 280),
  visibility     text not null default 'members' check (visibility in ('members', 'hidden')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_date - start_date <= 90)
);
create index trips_owner_idx on public.trips (owner_id, start_date);
create index trips_city_dates_idx on public.trips (city_id, start_date, end_date) where visibility = 'members';

-- Rules that depend on today's date, so a CHECK can't hold them:
-- no trips that have already ended, nothing more than 2 years out, and
-- at most 20 upcoming trips each (keeps suggestions honest).
create function public.trips_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.start_date <> old.start_date or new.end_date <> old.end_date then
    if new.end_date < current_date then
      raise exception 'This trip has already ended' using errcode = 'check_violation';
    end if;
    if new.start_date > current_date + interval '2 years' then
      raise exception 'Trips can be up to 2 years ahead' using errcode = 'check_violation';
    end if;
  end if;
  if tg_op = 'INSERT' and (
    select count(*) from public.trips where owner_id = new.owner_id and end_date >= current_date
  ) >= 20 then
    raise exception 'You can have up to 20 upcoming trips' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trips_validate
  before insert or update on public.trips
  for each row execute function public.trips_validate();

alter table public.trips enable row level security;

create policy "Members read their own trips" on public.trips
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Members add their own trips" on public.trips
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Members change their own trips" on public.trips
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Members delete their own trips" on public.trips
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- owner_id always comes from the default (the signed-in member).
revoke all on public.trips from anon, authenticated;
grant select, delete on public.trips to authenticated;
grant insert (city_id, start_date, end_date, flexible_days, note, visibility) on public.trips to authenticated;
grant update (city_id, start_date, end_date, flexible_days, note, visibility) on public.trips to authenticated;

-- --------------------------------------------------------------- wishlist
create table public.wishlist (
  profile_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  city_id     integer not null references public.cities (id),
  created_at  timestamptz not null default now(),
  primary key (profile_id, city_id)
);
create index wishlist_city_idx on public.wishlist (city_id);

create function public.wishlist_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.wishlist where profile_id = new.profile_id) >= 10 then
    raise exception 'You can save up to 10 places' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger wishlist_limit
  before insert on public.wishlist
  for each row execute function public.wishlist_limit();

alter table public.wishlist enable row level security;

create policy "Members read their own wishlist" on public.wishlist
  for select to authenticated using ((select auth.uid()) = profile_id);
create policy "Members add to their own wishlist" on public.wishlist
  for insert to authenticated with check ((select auth.uid()) = profile_id);
create policy "Members remove from their own wishlist" on public.wishlist
  for delete to authenticated using ((select auth.uid()) = profile_id);

revoke all on public.wishlist from anon, authenticated;
grant select, delete on public.wishlist to authenticated;
grant insert (city_id) on public.wishlist to authenticated;
