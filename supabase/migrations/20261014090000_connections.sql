-- connections: requests, accept, decline, withdraw, and the weekly limit
-- (spec §2 "Connect", §3, §5, §6.1). Members read only connections they
-- are part of; every change goes through the functions below, so the
-- rules can't be skipped from the app.
--
-- Not yet here, added by later tasks: Sodalis+ limits (T10, everyone is
-- on the free 5 a week until entitlements exist) and the phone check (T4).
-- Blocks and the 3-report pause come in through blocked_with and
-- requests_paused, which the safety migration fills in.

create table public.connections (
  id            bigint generated always as identity primary key,
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  note          text check (char_length(note) <= 280),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'ended')),
  trip_id       bigint references public.trips (id) on delete set null,
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  check (requester_id <> addressee_id)
);
-- At most one open (pending or accepted) connection per pair, whoever asked.
create unique index connections_open_pair_idx on public.connections
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  where status in ('pending', 'accepted');
create index connections_requester_idx on public.connections (requester_id, created_at);
create index connections_addressee_idx on public.connections (addressee_id, status);

alter table public.connections enable row level security;
create policy "Members read their own connections" on public.connections
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

revoke all on public.connections from anon, authenticated;
grant select on public.connections to authenticated;

-- Weeks start Monday 00:00 UK time (spec §3 usage_counters).
create function public.week_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select date_trunc('week', now() at time zone 'Europe/London') at time zone 'Europe/London' $$;

-- Free members: 5 a week. Sodalis+ (50, fair use) arrives with entitlements in T10.
create function public.weekly_request_limit(member uuid)
returns integer
language sql
stable
set search_path = ''
as $$ select 5 $$;

create function public.requests_left_this_week()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, public.weekly_request_limit(auth.uid()) - (
    select count(*)::int from public.connections
    where requester_id = auth.uid() and created_at >= public.week_start()
  ))
$$;

-- Placeholders, replaced by the safety migration: who has this member
-- blocked or been blocked by, and are their requests paused after reports?
create function public.blocked_with(member uuid)
returns uuid[]
language sql
stable
set search_path = ''
as $$ select '{}'::uuid[] $$;

create function public.requests_paused(member uuid)
returns boolean
language sql
stable
set search_path = ''
as $$ select false $$;

create function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
set search_path = ''
as $$ select b = any (public.blocked_with(a)) $$;

-- Replaces the placeholder from the matching migration. Who is kept out of
-- this member's suggestions and requests? Anyone blocked either way, in an
-- open connection either way, or who declined (or was declined) in the
-- last 90 days.
create or replace function public.closed_with(member uuid)
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select array(
    select case when c.requester_id = member then c.addressee_id else c.requester_id end
    from public.connections c
    where member in (c.requester_id, c.addressee_id)
      and (c.status in ('pending', 'accepted')
           or (c.status = 'declined' and c.responded_at > now() - interval '90 days'))
  ) || public.blocked_with(member)
$$;

create function public.pair_is_closed(a uuid, b uuid)
returns boolean
language sql
stable
set search_path = ''
as $$ select b = any (public.closed_with(a)) $$;

create function public.send_connection_request(p_to uuid, p_note text default null, p_trip_id bigint default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := auth.uid();
  my     public.profiles;
  them   public.profiles;
  new_id bigint;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into my from public.profiles where id = me;
  select * into them from public.profiles where id = p_to;
  if my.onboarded_at is null or my.status <> 'active' then
    raise exception 'Finish your profile before sending requests' using errcode = 'check_violation';
  end if;
  if public.requests_paused(me) then
    raise exception 'Requests are paused' using errcode = 'check_violation';
  end if;
  if them.id is null or them.id = me or them.onboarded_at is null or them.status <> 'active'
     or public.is_blocked(me, p_to) then
    raise exception 'This member isn''t available' using errcode = 'check_violation';
  end if;
  -- Only people who'd appear in each other's suggestions (spec §4.1).
  if not public.fits_preferences(public.age_from_year(them.birth_year), them.gender,
                                 (select pr from public.preferences pr where pr.profile_id = me))
     or not public.fits_preferences(public.age_from_year(my.birth_year), my.gender,
                                    (select pr from public.preferences pr where pr.profile_id = p_to)) then
    raise exception 'This member isn''t available' using errcode = 'check_violation';
  end if;
  if public.pair_is_closed(me, p_to) then
    raise exception 'You''re already in touch with this member' using errcode = 'check_violation';
  end if;
  if p_trip_id is not null and not exists (select 1 from public.trips where id = p_trip_id and owner_id = me) then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  -- Counted under a lock on the member's own row, so two quick taps can't both slip under the limit.
  perform 1 from public.profiles where id = me for update;
  if public.requests_left_this_week() <= 0 then
    raise exception 'Weekly request limit reached' using errcode = 'check_violation';
  end if;

  insert into public.connections (requester_id, addressee_id, note, trip_id)
  values (me, p_to, nullif(btrim(p_note), ''), p_trip_id)
  returning id into new_id;
  return new_id;
end;
$$;

-- Accept or decline a request sent to me.
create function public.respond_to_request(p_id bigint, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.connections
     set status = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now()
   where id = p_id and addressee_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Take back a request I sent that hasn't been answered. It still counts
-- towards this week's limit.
create function public.withdraw_request(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.connections
     set status = 'withdrawn', responded_at = now()
   where id = p_id and requester_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
end;
$$;

-- My requests and connections, with the other person's public details.
create function public.my_connections()
returns table (
  id            bigint,
  status        text,
  direction     text,
  note          text,
  created_at    timestamptz,
  profile_id    uuid,
  display_name  text,
  birth_year    smallint,
  home_city     text,
  home_country  text,
  photo_path    text,
  trip_city     text,
  trip_start    date,
  trip_end      date
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.status,
         case when c.requester_id = auth.uid() then 'sent' else 'received' end,
         c.note, c.created_at,
         p.id, p.display_name, p.birth_year, hc.name, hc.country_code::text, p.photo_path,
         tc.name, t.start_date, t.end_date
  from public.connections c
  join public.profiles p
    on p.id = case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end
  left join public.cities hc on hc.id = p.home_city_id
  left join public.trips t on t.id = c.trip_id
  left join public.cities tc on tc.id = t.city_id
  where auth.uid() in (c.requester_id, c.addressee_id)
    and c.status in ('pending', 'accepted')
    and p.status = 'active'
  order by c.created_at desc
$$;

revoke all on function public.week_start() from public, anon;
revoke all on function public.weekly_request_limit(uuid) from public, anon;
revoke all on function public.pair_is_closed(uuid, uuid) from public, anon, authenticated;
revoke all on function public.is_blocked(uuid, uuid) from public, anon, authenticated;
revoke all on function public.blocked_with(uuid) from public, anon, authenticated;
revoke all on function public.requests_paused(uuid) from public, anon, authenticated;
revoke all on function public.requests_left_this_week() from public, anon;
revoke all on function public.send_connection_request(uuid, text, bigint) from public, anon;
revoke all on function public.respond_to_request(bigint, boolean) from public, anon;
revoke all on function public.withdraw_request(bigint) from public, anon;
revoke all on function public.my_connections() from public, anon;
grant execute on function public.requests_left_this_week() to authenticated;
grant execute on function public.send_connection_request(uuid, text, bigint) to authenticated;
grant execute on function public.respond_to_request(bigint, boolean) to authenticated;
grant execute on function public.withdraw_request(bigint) to authenticated;
grant execute on function public.my_connections() to authenticated;
