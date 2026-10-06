-- Security hardening from the launch security review (task T31).
--
--  1. A paused or removed member can't delete their account to start again.
--  2. Who has blocked you is no longer readable through the API.
--  3. Photos: blocked members and paused accounts can't load each other's.
--  4. Requests are paused by 3 reports only when the reporters are real,
--     active members who have actually been in touch with the person.
--  5. Paused or removed members can't browse suggestions, use chats or plan
--     boards, or use admin tools.
--  6. A full date of birth is needed to finish signing up (no year-only
--     route round the 18+ check).
--  7. A limit of 60 messages in 10 minutes, against spam.
--  8. "Did you meet?" answers only for people you actually connected with.

-- 1 ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  g record;
begin
  if me is null then
    raise exception 'Please sign in again' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = me and status <> 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  -- Groups they started carry on: the longest-standing member takes over.
  for g in
    select gr.id, (
      select gm.profile_id from public.group_members gm
      where gm.group_id = gr.id and gm.profile_id <> me and gm.status = 'joined'
      order by gm.joined_at nulls last, gm.created_at limit 1
    ) as heir
    from public.groups gr where gr.owner_id = me
  loop
    if g.heir is not null then
      update public.groups set owner_id = g.heir where id = g.id;
      update public.group_members set role = 'owner' where group_id = g.id and profile_id = g.heir;
    end if;
  end loop;
  -- Removing the sign-in removes the profile and everything linked to it.
  delete from auth.users where id = me;
end;
$$;

-- 2 ---------------------------------------------------------------------
-- Helpers that row-level security needs, kept out of the public API.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.hidden_senders()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$ select public.blocked_with(auth.uid()) $$;
revoke all on function private.hidden_senders() from public, anon;
grant execute on function private.hidden_senders() to authenticated;

drop policy "Members read messages in their conversations" on public.messages;
create policy "Members read messages in their conversations" on public.messages
  for select to authenticated
  using (public.in_conversation(conversation_id)
         -- worked out once per query, not once per message
         and not (sender_id = any ('{}'::uuid[] || (select private.hidden_senders()))));
drop function public.hidden_senders();

-- 3 ---------------------------------------------------------------------
create or replace function public.is_current_profile_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.photo_path = object_name and p.status = 'active' and p.onboarded_at is not null
      and (p.id = auth.uid()
           or (exists (select 1 from public.profiles v where v.id = auth.uid() and v.status = 'active')
               and not (p.id = any ('{}'::uuid[] || public.blocked_with(auth.uid())))))
  )
$$;

-- 4 ---------------------------------------------------------------------
-- A report counts towards pausing someone's requests only when the reporter
-- is an active member who finished signing up, and the person reported asked
-- them to connect or shares a chat with them. Throwaway accounts can't gang up.
create or replace function public.requests_paused(member uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select count(distinct r.reporter_id) >= 3
  from public.reports r
  join public.profiles rp on rp.id = r.reporter_id and rp.status = 'active' and rp.onboarded_at is not null
  where r.subject_profile_id = member and r.status = 'open'
    and (exists (select 1 from public.connections k where k.requester_id = member and k.addressee_id = r.reporter_id)
         or exists (select 1 from public.conversation_members a
                    join public.conversation_members b on b.conversation_id = a.conversation_id
                    where a.profile_id = r.reporter_id and b.profile_id = member))
$$;

-- 5 ---------------------------------------------------------------------
create or replace function public.can_message(conv bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.in_conversation(conv)
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.status = 'active')
    and exists (
    select 1 from public.conversations c
    left join public.connections k on k.id = c.connection_id
    where c.id = conv
      and ((c.kind = 'direct' and k.status = 'accepted')
           or (c.kind = 'group' and public.is_group_member(c.group_id, auth.uid())))
  )
$$;

create or replace function public.is_admin(member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.profiles where id = member and role = 'admin' and status = 'active') $$;

create or replace function public.suggest_by_interests()
returns table (
  profile_id       uuid,
  display_name     text,
  birth_year       smallint,
  home_city        text,
  home_country     text,
  photo_path       text,
  travelling_with  text,
  distance_km      integer,
  shared_interests text[],
  shared_places    text[],
  score            integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me        uuid := auth.uid();
  my        public.profiles;
  my_prefs  public.preferences;
  my_count  integer;
  my_places integer;
  closed    uuid[] := public.closed_with(me);
  plus      boolean := public.has_plus(me);
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into my from public.profiles p where p.id = me;
  select * into my_prefs from public.preferences pr where pr.profile_id = me;
  select count(*) into my_count from public.profile_interests where profile_id = me;
  select count(*) into my_places from public.wishlist where profile_id = me;

  return query
  with mine as (
    select interest_id from public.profile_interests where profile_id = me
  ),
  -- Only members sharing 2 or more interests are worth looking at.
  overlap as (
    select pi.profile_id as owner_id, count(*)::int as shared_count
    from public.profile_interests pi
    join mine using (interest_id)
    where pi.profile_id <> me
    group by pi.profile_id
    having count(*) >= 2
  ),
  candidates as (
    select o.owner_id, o.shared_count, p as person,
           public.city_distance_km(p.home_city_id, my.home_city_id) as km
    from overlap o
    join public.profiles p on p.id = o.owner_id
    join public.preferences pr on pr.profile_id = p.id
    where p.status = 'active'
      and p.onboarded_at is not null
      and p.last_active_at > now() - interval '60 days'
      and not (p.id = any (closed))
      and public.fits_preferences(public.age_from_year(p.birth_year), p.gender, my_prefs)
      and public.fits_preferences(public.age_from_year(my.birth_year), my.gender, pr)
      and (my_prefs.max_distance_km is null
           or public.city_distance_km(p.home_city_id, my.home_city_id) <= my_prefs.max_distance_km)
      and public.passes_viewer_filters(my_prefs, plus, p)
  ),
  scored as (
    select c.*,
           round(
             -- interests: Jaccard overlap
             (50 * c.shared_count::numeric
                / (my_count + (select count(*) from public.profile_interests where profile_id = c.owner_id) - c.shared_count)
              -- places both want to visit, against the shorter list
              + 20 * coalesce(
                  (select count(*) from public.wishlist w join public.wishlist v on v.city_id = w.city_id and v.profile_id = me
                    where w.profile_id = c.owner_id)::numeric
                  / nullif(least(my_places, (select count(*) from public.wishlist where profile_id = c.owner_id)), 0), 0)
              + public.style_points(c.person, my))
             * (0.85 + 0.15 * public.lifestyle_fit(c.person, my))
           )::int as total
    from candidates c
  ),
  best as (
    select * from scored s
    order by (s.person).photo_path is null, s.total desc, (s.person).last_active_at desc limit 20
  )
  select b.owner_id, (b.person).display_name, (b.person).birth_year, hc.name, hc.country_code::text,
         (b.person).photo_path, (b.person).travelling_with,
         round(b.km)::int,
         array(select i.label from public.profile_interests a
                 join mine m on m.interest_id = a.interest_id
                 join public.interests i on i.id = a.interest_id
                where a.profile_id = b.owner_id
                order by i.sort),
         array(select ci.name from public.wishlist w
                 join public.wishlist v on v.city_id = w.city_id and v.profile_id = me
                 join public.cities ci on ci.id = w.city_id
                where w.profile_id = b.owner_id
                order by ci.name),
         b.total
  from best b
  left join public.cities hc on hc.id = (b.person).home_city_id
  order by (b.person).photo_path is null, b.total desc, (b.person).last_active_at desc;
end;
$$;

create or replace function public.suggest_for_trip(p_trip_id bigint)
returns table (
  profile_id       uuid,
  display_name     text,
  birth_year       smallint,
  home_city        text,
  home_country     text,
  photo_path       text,
  travelling_with  text,
  trip_city        text,
  trip_start       date,
  trip_end         date,
  overlap_start    date,
  overlap_end      date,
  shared_interests text[],
  score            integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me       uuid := auth.uid();
  my_trip  public.trips;
  my       public.profiles;
  my_prefs public.preferences;
  nearby   integer[];
  closed   uuid[] := public.closed_with(me);
  plus     boolean := public.has_plus(me);
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  select * into my_trip from public.trips t where t.id = p_trip_id and t.owner_id = me;
  if not found then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  select * into my from public.profiles p where p.id = me;
  select * into my_prefs from public.preferences pr where pr.profile_id = me;
  -- The trip's town and everywhere within 30 km, worked out once.
  select array_agg(c.id) into nearby
  from public.cities c, public.cities m
  where m.id = my_trip.city_id
    and c.lat between m.lat - 0.3 and m.lat + 0.3
    and abs(c.lng - m.lng) <= 0.3 / greatest(cos(radians(m.lat)), 0.01)
    and public.city_distance_km(c.id, m.id) <= 30;

  return query
  with candidates as (
    select t.owner_id, t.city_id, t.start_date, t.end_date, p as person,
           -- real overlap, before any flexibility
           greatest(t.start_date, my_trip.start_date) as o_start,
           least(t.end_date, my_trip.end_date) as o_end
    from public.trips t
    join public.profiles p on p.id = t.owner_id
    join public.preferences pr on pr.profile_id = p.id
    where t.owner_id <> me
      and t.visibility = 'members'
      and t.end_date >= current_date
      and t.city_id = any (nearby)
      -- the windows, each widened by its flexibility, share 2 days or more
      -- (or all of a one-day trip)
      and least(t.end_date + t.flexible_days, my_trip.end_date + my_trip.flexible_days)
          - greatest(t.start_date - t.flexible_days, my_trip.start_date - my_trip.flexible_days) + 1
          >= least(2, t.end_date - t.start_date + 1, my_trip.end_date - my_trip.start_date + 1)
      and p.status = 'active'
      and p.onboarded_at is not null
      and p.last_active_at > now() - interval '60 days'
      and not (p.id = any (closed))
      and public.fits_preferences(public.age_from_year(p.birth_year), p.gender, my_prefs)
      and public.fits_preferences(public.age_from_year(my.birth_year), my.gender, pr)
      and (my_prefs.max_distance_km is null
           or public.city_distance_km(p.home_city_id, my.home_city_id) <= my_prefs.max_distance_km)
      and public.passes_viewer_filters(my_prefs, plus, p)
  ),
  scored as (
    select c.*,
           (select count(*) from public.profile_interests a
              join public.profile_interests b on b.interest_id = a.interest_id and b.profile_id = me
             where a.profile_id = c.owner_id) as shared_count,
           (select count(distinct interest_id) from public.profile_interests
             where profile_id in (c.owner_id, me)) as union_count,
           greatest(0, c.o_end - c.o_start + 1)::numeric
             / least(c.end_date - c.start_date + 1, my_trip.end_date - my_trip.start_date + 1) as date_fit
    from candidates c
  ),
  ranked as (
    select s.*,
           round(
             (50 * coalesce(s.shared_count::numeric / nullif(s.union_count, 0), 0)
              + 20 * s.date_fit
              + public.style_points(s.person, my))
             * (0.85 + 0.15 * public.lifestyle_fit(s.person, my))
           )::int as total,
           -- one card per member: their best-matching trip
           row_number() over (partition by s.owner_id order by s.date_fit desc, s.start_date) as nth
    from scored s
  ),
  best as (
    select * from ranked r where r.nth = 1
    order by (r.person).photo_path is null, r.total desc, (r.person).last_active_at desc limit 20
  )
  select b.owner_id, (b.person).display_name, (b.person).birth_year, hc.name, hc.country_code::text,
         (b.person).photo_path, (b.person).travelling_with,
         tc.name, b.start_date, b.end_date,
         case when b.o_start <= b.o_end then b.o_start end,
         case when b.o_start <= b.o_end then b.o_end end,
         array(select i.label from public.profile_interests x
                 join public.profile_interests y on y.interest_id = x.interest_id and y.profile_id = me
                 join public.interests i on i.id = x.interest_id
                where x.profile_id = b.owner_id
                order by i.sort),
         b.total
  from best b
  join public.cities tc on tc.id = b.city_id
  left join public.cities hc on hc.id = (b.person).home_city_id
  order by (b.person).photo_path is null, b.total desc, (b.person).last_active_at desc;
end;
$$;

-- 6 ---------------------------------------------------------------------
create or replace function public.finish_onboarding()
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
     and p.birth_date is not null
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
revoke update (birth_year) on public.profiles from authenticated;

-- 7 ---------------------------------------------------------------------
create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);
create or replace function public.send_message(p_conversation_id bigint, p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  body      text := btrim(p_body);
  new_id    bigint;
  first_day boolean;
  reasons   text[];
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.in_conversation(p_conversation_id) then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
  if not public.can_message(p_conversation_id) then
    raise exception 'This conversation has ended' using errcode = 'check_violation';
  end if;
  if body is null or body = '' then
    raise exception 'Write a message first' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.messages m
      where m.sender_id = auth.uid() and m.created_at > clock_timestamp() - interval '10 minutes') >= 60 then
    raise exception 'You’re sending messages very quickly. Please wait a few minutes.' using errcode = 'check_violation';
  end if;
  select c.created_at > now() - interval '24 hours' into first_day
  from public.conversations c where c.id = p_conversation_id;
  reasons := public.scam_reasons(body, first_day);

  insert into public.messages (conversation_id, sender_id, body, flagged)
  values (p_conversation_id, auth.uid(), body, cardinality(reasons) > 0)
  returning id into new_id;
  if cardinality(reasons) > 0 then
    insert into public.message_flags (message_id, sender_id, body, reasons)
    values (new_id, auth.uid(), body, reasons);
  end if;
  -- Sending counts as reading everything before it.
  update public.conversation_members set last_read_at = clock_timestamp()
   where conversation_id = p_conversation_id and profile_id = auth.uid();
  return new_id;
end;
$$;

-- 8 ---------------------------------------------------------------------
create or replace function public.answer_meet(p_connection_id bigint, p_met boolean, p_again boolean default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.connections;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into k from public.connections c
  where c.id = p_connection_id and auth.uid() in (c.requester_id, c.addressee_id)
    and c.status in ('accepted', 'ended');
  if k.id is null then
    raise exception 'Connection not found' using errcode = 'P0002';
  end if;
  insert into public.meet_feedback (from_id, about_id, trip_id, connection_id, met, would_travel_again)
  values (auth.uid(),
          case when k.requester_id = auth.uid() then k.addressee_id else k.requester_id end,
          k.trip_id, k.id, p_met, case when p_met then p_again end)
  on conflict (from_id, connection_id) do update
    set met = excluded.met, would_travel_again = excluded.would_travel_again, created_at = now();
end;
$$;
