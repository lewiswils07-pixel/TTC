-- Fixes from the 10 AI testers (7 Oct), and "Plan a trip together".
--
--  * One age everywhere: lists showed "this year minus birth year", profiles
--    the exact age, so the same member could be 62 and 63 at once.
--  * "Not now" is kept with the account, so it holds on every device.
--  * Suggestions go past 20 people.
--  * A trip page keeps the people you've asked or connected with.
--  * Asking someone who has already asked you connects you both.
--  * Reviews only once your trip has started (or for your home town).
--  * Trip plan and plan board ideas can be edited.
--  * Plan a trip together: a two-person group with real dates, its own chat
--    and plan board. Joining any group adds its trip to your trips.
--  * Food preferences, and six more interests testers asked for.

-- ---------------------------------------------------------------------------
-- One age everywhere

-- public.member_age and public.age_year (from sign-up polish) give the exact
-- age; later rewrites of these functions had gone back to the birth year.

create or replace function public.my_connections()
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
         p.id, p.display_name, public.age_year(p), hc.name, hc.country_code::text, p.photo_path,
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

create or replace function public.group_people(p_group bigint)
returns table (profile_id uuid, display_name text, birth_year smallint, photo_path text, role text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, public.age_year(p), p.photo_path, gm.role, gm.status
  from public.group_members gm
  join public.profiles p on p.id = gm.profile_id
  where gm.group_id = p_group
    and exists (select 1 from public.group_members me where me.group_id = p_group and me.profile_id = auth.uid())
    and (p.id = auth.uid() or not public.is_blocked(auth.uid(), p.id))
    and p.status = 'active'
  order by gm.role desc, gm.status desc, gm.joined_at, p.display_name
$$;

-- ---------------------------------------------------------------------------
-- Food preferences (testers: nowhere to say vegetarian)

alter table public.profiles
  add column diet text[] not null default '{}'
    constraint profiles_diet_check check (diet <@ array['vegetarian', 'vegan', 'pescatarian', 'halal', 'kosher', 'gluten-free', 'dairy-free']::text[]);
grant update (diet) on public.profiles to authenticated;

create or replace function public.member_profile(p_profile uuid)
returns table (
  profile_id       uuid,
  display_name     text,
  birth_year       smallint,
  home_city        text,
  home_country     text,
  photo_path       text,
  bio              text,
  travel_style     text,
  pace             text,
  budget           text,
  room_sharing     text,
  day_rhythm       text,
  walking          text,
  languages        text[],
  travelling_with  text,
  interests        jsonb,
  card_answers     jsonb,
  connected_at     timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select id from public.profiles where id = auth.uid() and status = 'active'
  ),
  link as (
    select max(coalesce(c.responded_at, c.created_at)) as since
      from public.connections c, me
     where c.status = 'accepted'
       and ((c.requester_id = me.id and c.addressee_id = p_profile)
         or (c.addressee_id = me.id and c.requester_id = p_profile))
  )
  select p.id, p.display_name, public.age_year(p), hc.name, hc.country_code::text, p.photo_path, p.bio,
         p.travel_style, p.pace, p.budget, p.room_sharing, p.day_rhythm, p.walking, p.languages,
         p.travelling_with,
         coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'label', i.label) order by i.sort)
                     from public.profile_interests pi join public.interests i on i.id = pi.interest_id
                    where pi.profile_id = p.id), '[]'::jsonb),
         p.card_answers,
         (select since from link)
    from public.profiles p
    join me on true
    left join public.cities hc on hc.id = p.home_city_id
   where p.id = p_profile
     and p.status = 'active'
     and p.onboarded_at is not null
     and not public.is_blocked(me.id, p.id)
     and (exists (select 1 from link where since is not null)
          or exists (select 1
                       from public.group_members a
                       join public.group_members b on b.group_id = a.group_id
                      where a.profile_id = me.id and a.status = 'joined'
                        and b.profile_id = p.id and b.status = 'joined'))
$$;

-- A connection's food preferences, for their profile page.
create function public.member_diet(p_profile uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select p.diet from public.profiles p
  where p.id = p_profile
    and exists (select 1 from public.member_profile(p_profile))
$$;
revoke all on function public.member_diet(uuid) from public, anon;
grant execute on function public.member_diet(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- "Not now", kept with the account

create table public.skipped_members (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  skipped_id  uuid not null references public.profiles (id) on delete cascade,
  skipped_at  timestamptz not null default now(),
  primary key (profile_id, skipped_id),
  check (profile_id <> skipped_id)
);
alter table public.skipped_members enable row level security;
revoke all on public.skipped_members from anon, authenticated;

create function public.skip_member(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.skipped_members (profile_id, skipped_id)
  select auth.uid(), p_id where auth.uid() is not null and auth.uid() <> p_id
  on conflict (profile_id, skipped_id) do update set skipped_at = now()
$$;

create function public.unskip_member(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.skipped_members where profile_id = auth.uid() and skipped_id = p_id $$;

-- Bring everyone back; returns how many.
create function public.unskip_all()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (delete from public.skipped_members where profile_id = auth.uid() returning 1)
  select count(*)::int from gone
$$;

create function public.skipped_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.skipped_members
  where profile_id = auth.uid() and skipped_at > now() - make_interval(days => private.rule('connections.notNowDays'))
$$;

create function public.is_skipped(me uuid, them uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.skipped_members s
                 where s.profile_id = me and s.skipped_id = them
                   and s.skipped_at > now() - make_interval(days => private.rule('connections.notNowDays')))
$$;

revoke all on function public.skip_member(uuid), public.unskip_member(uuid), public.unskip_all(), public.skipped_count() from public, anon;
revoke all on function public.is_skipped(uuid, uuid) from public, anon, authenticated;
grant execute on function public.skip_member(uuid), public.unskip_member(uuid), public.unskip_all(), public.skipped_count() to authenticated;

-- ---------------------------------------------------------------------------
-- Suggestions: exact ages, skips left out, and more than 20 people

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
           public.member_distance_km(p.id, my.id) as km
    from overlap o
    join public.profiles p on p.id = o.owner_id
    join public.preferences pr on pr.profile_id = p.id
    where p.status = 'active'
      and p.onboarded_at is not null
      and p.last_active_at > now() - interval '60 days'
      and not (p.id = any (closed))
      and not public.is_skipped(me, p.id)
      and public.fits_preferences(public.member_age(p), p.gender, my_prefs)
      and public.fits_preferences(public.member_age(my), my.gender, pr)
      and (my_prefs.max_distance_km is null
           or p.home_city_id = my.home_city_id
           or public.member_distance_km(p.id, my.id) <= my_prefs.max_distance_km)
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
    order by (s.person).photo_path is null, s.total desc, (s.person).last_active_at desc
    limit private.rule('matching.maxSuggestions')
  )
  select b.owner_id, (b.person).display_name, public.age_year(b.person), hc.name, hc.country_code::text,
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

-- The trip's town and everywhere within 30 km.
create function private.nearby_cities(p_city_id integer)
returns integer[]
language sql
stable
set search_path = ''
as $$
  select array_agg(c.id)
  from public.cities c, public.cities m
  where m.id = p_city_id
    and c.lat between m.lat - 0.3 and m.lat + 0.3
    and abs(c.lng - m.lng) <= 0.3 / greatest(cos(radians(m.lat)), 0.01)
    and public.city_distance_km(c.id, m.id) <= 30
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
  nearby := private.nearby_cities(my_trip.city_id);

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
      and not public.is_skipped(me, p.id)
      and public.fits_preferences(public.member_age(p), p.gender, my_prefs)
      and public.fits_preferences(public.member_age(my), my.gender, pr)
      and (my_prefs.max_distance_km is null
           or p.home_city_id = my.home_city_id
           or public.member_distance_km(p.id, my.id) <= my_prefs.max_distance_km)
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
    order by (r.person).photo_path is null, r.total desc, (r.person).last_active_at desc
    limit private.rule('matching.maxSuggestions')
  )
  select b.owner_id, (b.person).display_name, public.age_year(b.person), hc.name, hc.country_code::text,
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

-- ---------------------------------------------------------------------------
-- A trip page keeps the people you're already in touch with: connections and
-- requests either way with a trip there at the same time, and people in a
-- group with you for that place and dates.

create function public.trip_companions(p_trip_id bigint)
returns table (
  profile_id     uuid,
  display_name   text,
  birth_year     smallint,
  home_city      text,
  home_country   text,
  photo_path     text,
  status         text,   -- connected, you_asked, they_asked, group
  trip_start     date,
  trip_end       date,
  overlap_start  date,
  overlap_end    date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me      uuid := auth.uid();
  my_trip public.trips;
  nearby  integer[];
begin
  select * into my_trip from public.trips t where t.id = p_trip_id and t.owner_id = me;
  if not found then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  nearby := private.nearby_cities(my_trip.city_id);

  return query
  with links as (
    select case when c.requester_id = me then c.addressee_id else c.requester_id end as other,
           case when c.status = 'accepted' then 'connected'
                when c.requester_id = me then 'you_asked'
                else 'they_asked' end as how
    from public.connections c
    where me in (c.requester_id, c.addressee_id) and c.status in ('pending', 'accepted')
  ),
  shared_groups as (
    select b.profile_id as other, g.start_date, g.end_date
    from public.group_members a
    join public.group_members b on b.group_id = a.group_id and b.profile_id <> me
    join public.groups g on g.id = a.group_id
    where a.profile_id = me and a.status = 'joined' and b.status = 'joined'
      and g.city_id = any (nearby)
      and g.start_date <= my_trip.end_date and g.end_date >= my_trip.start_date
  ),
  dates as (
    -- their own trip there at the same time
    select l.other, l.how, t.start_date, t.end_date
    from links l
    join public.trips t on t.owner_id = l.other
    where t.city_id = any (nearby)
      and t.end_date >= current_date
      and (t.visibility = 'members' or l.how = 'connected')
      and t.start_date - t.flexible_days <= my_trip.end_date + my_trip.flexible_days
      and t.end_date + t.flexible_days >= my_trip.start_date - my_trip.flexible_days
    union all
    select s.other, coalesce((select l.how from links l where l.other = s.other), 'group'), s.start_date, s.end_date
    from shared_groups s
  ),
  best as (
    select distinct on (d.other) d.*,
           greatest(d.start_date, my_trip.start_date) as o_start,
           least(d.end_date, my_trip.end_date) as o_end
    from dates d
    order by d.other, least(d.end_date, my_trip.end_date) - greatest(d.start_date, my_trip.start_date) desc
  )
  select p.id, p.display_name, public.age_year(p), hc.name, hc.country_code::text, p.photo_path,
         b.how, b.start_date, b.end_date,
         case when b.o_start <= b.o_end then b.o_start end,
         case when b.o_start <= b.o_end then b.o_end end
  from best b
  join public.profiles p on p.id = b.other
  left join public.cities hc on hc.id = p.home_city_id
  where p.status = 'active'
    and not public.is_blocked(me, p.id)
  order by b.how = 'they_asked' desc, b.start_date, p.display_name;
end;
$$;
revoke all on function public.trip_companions(bigint) from public, anon;
grant execute on function public.trip_companions(bigint) to authenticated;
revoke all on function private.nearby_cities(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Asking someone who has already asked you: you're both saying yes, so it
-- connects you. A note you wrote goes into your new chat.

create or replace function public.send_connection_request(p_to uuid, p_note text default null, p_trip_id bigint default null)
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
  conv   bigint;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into my from public.profiles where id = me;
  select * into them from public.profiles where id = p_to;
  if my.status <> 'active' then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  if my.onboarded_at is null then
    raise exception 'Finish your profile before sending requests' using errcode = 'check_violation';
  end if;
  if public.requests_paused(me) then
    raise exception 'Requests are paused' using errcode = 'check_violation';
  end if;
  if them.id is null or them.id = me or them.onboarded_at is null or them.status <> 'active'
     or public.is_blocked(me, p_to) then
    raise exception 'This member isn''t available' using errcode = 'check_violation';
  end if;

  -- They asked first: accept theirs. It doesn't use up a request.
  select c.id into new_id from public.connections c
   where c.requester_id = p_to and c.addressee_id = me and c.status = 'pending';
  if new_id is not null then
    update public.connections set status = 'accepted', responded_at = now() where id = new_id;
    if nullif(btrim(p_note), '') is not null then
      select cv.id into conv from public.conversations cv where cv.connection_id = new_id;
      if conv is not null then
        insert into public.messages (conversation_id, sender_id, body) values (conv, me, btrim(p_note));
      end if;
    end if;
    return new_id;
  end if;

  -- Only people who'd appear in each other's suggestions (spec §4.1).
  if not public.fits_preferences(public.member_age(them), them.gender,
                                 (select pr from public.preferences pr where pr.profile_id = me))
     or not public.fits_preferences(public.member_age(my), my.gender,
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

-- ---------------------------------------------------------------------------
-- Reviews once you've been

create or replace function public.save_city_review(p_city_id integer, p_rating smallint, p_body text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in again' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and status <> 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  if not exists (select 1 from public.trips where owner_id = auth.uid() and city_id = p_city_id and start_date <= current_date)
     and not exists (select 1 from public.profiles where id = auth.uid() and home_city_id = p_city_id) then
    raise exception 'You can review a place once your trip there has started' using errcode = 'check_violation';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) > private.rule('reviews.textMax') then
    raise exception 'Please keep your review shorter' using errcode = 'check_violation';
  end if;
  insert into public.city_reviews (profile_id, city_id, rating, body)
  values (auth.uid(), p_city_id, p_rating, nullif(btrim(p_body), ''))
  on conflict (profile_id, city_id) do update
    set rating = excluded.rating, body = excluded.body, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Editing ideas

create function public.edit_trip_idea(p_item bigint, p_title text, p_day smallint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.trip_plan_items;
  trip_days int;
begin
  select * into item from public.trip_plan_items where id = p_item;
  if item.id is null or not private.owns_trip(item.trip_id) then
    raise exception 'Idea not found' using errcode = 'P0002';
  end if;
  select t.end_date - t.start_date + 1 into trip_days from public.trips t where t.id = item.trip_id;
  if p_day is not null and (p_day < 1 or p_day > trip_days) then
    raise exception 'Please pick a day during the trip' using errcode = 'check_violation';
  end if;
  update public.trip_plan_items set title = btrim(p_title), day = p_day where id = p_item;
end;
$$;

-- Only the person who added an idea can change its words; anyone on the board can move it to a day.
create function public.edit_plan_item(p_item bigint, p_title text, p_day smallint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.plan_items;
begin
  perform public.plan_item_conversation(p_item);
  select * into item from public.plan_items where id = p_item;
  if item.added_by is distinct from auth.uid() and btrim(p_title) <> item.title then
    raise exception 'Only the person who added this idea can change it' using errcode = 'check_violation';
  end if;
  update public.plan_items set title = btrim(p_title), day = p_day where id = p_item;
end;
$$;

revoke all on function public.edit_trip_idea(bigint, text, smallint), public.edit_plan_item(bigint, text, smallint) from public, anon;
grant execute on function public.edit_trip_idea(bigint, text, smallint), public.edit_plan_item(bigint, text, smallint) to authenticated;

-- ---------------------------------------------------------------------------
-- Plan a trip together (Lewis, 7 Oct): a two-person group, so more people
-- can be added later. It doesn't count towards the group limit.

alter table public.groups add column is_pair boolean not null default false;

create or replace function public.groups_i_can_start()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(public.group_limit(auth.uid())
                  - (select count(*)::int from public.groups
                      where owner_id = auth.uid() and end_date >= current_date and not is_pair), 0)
$$;

create or replace function public.create_group(p_name text, p_city_id integer, p_start date, p_end date, p_invite uuid[] default '{}')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := auth.uid();
  new_id bigint;
  conv   bigint;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = me and status <> 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  if p_end < current_date then
    raise exception 'This trip has already ended' using errcode = 'check_violation';
  end if;
  if p_start > current_date + private.rule('trips.maxDaysAhead') then
    raise exception 'Trips can be up to % days ahead', private.rule('trips.maxDaysAhead') using errcode = 'check_violation';
  end if;
  if (select count(*) from public.groups where owner_id = me and end_date >= current_date and not is_pair) >= public.group_limit(me) then
    raise exception 'Group limit reached' using errcode = 'check_violation';
  end if;
  insert into public.groups (name, owner_id, city_id, start_date, end_date)
  values (btrim(p_name), me, p_city_id, p_start, p_end)
  returning id into new_id;
  insert into public.group_members (group_id, profile_id, role, status, joined_at)
  values (new_id, me, 'owner', 'joined', now());
  insert into public.conversations (kind, group_id) values ('group', new_id) returning id into conv;
  insert into public.conversation_members (conversation_id, profile_id) values (conv, me);
  perform public.add_group_invites(new_id, p_invite);
  return new_id;
end;
$$;

-- Adds a group's trip to a member's trips, unless they already have one
-- there at that time (or are at their trip limit).
create function private.add_group_trip(p_group bigint, p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trips (owner_id, city_id, start_date, end_date)
  select p_member, g.city_id, g.start_date, g.end_date
  from public.groups g
  where g.id = p_group
    and g.end_date >= current_date
    and not exists (select 1 from public.trips t
                    where t.owner_id = p_member and t.city_id = any (private.nearby_cities(g.city_id))
                      and t.start_date <= g.end_date and t.end_date >= g.start_date);
exception when check_violation then
  null;
end;
$$;
revoke all on function private.add_group_trip(bigint, uuid) from public, anon, authenticated;

create or replace function public.respond_to_group_invite(p_group bigint, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if not exists (select 1 from public.group_members where group_id = p_group and profile_id = me and status = 'invited') then
    raise exception 'Invite not found' using errcode = 'P0002';
  end if;
  if not p_accept then
    delete from public.group_members where group_id = p_group and profile_id = me;
    return;
  end if;
  if exists (select 1 from public.profiles where id = me and status <> 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  -- Someone joined since the invite who is blocked with me: the invite lapses.
  if exists (select 1 from public.group_members gm
             where gm.group_id = p_group and gm.status = 'joined' and public.is_blocked(me, gm.profile_id)) then
    delete from public.group_members where group_id = p_group and profile_id = me;
    raise exception 'This group isn''t available' using errcode = 'check_violation';
  end if;
  update public.group_members set status = 'joined', joined_at = now()
   where group_id = p_group and profile_id = me;
  insert into public.conversation_members (conversation_id, profile_id)
  select c.id, me from public.conversations c where c.group_id = p_group
  on conflict do nothing;
  perform private.add_group_trip(p_group, me);
end;
$$;

-- Invite a connection to plan a trip together: one of my trips, or a new
-- place and dates (which become my trip too). Returns the trip's group; if
-- we're already planning that trip together, returns the one we have.
create function public.plan_trip_together(p_with uuid, p_trip_id bigint default null, p_city_id integer default null,
                                          p_start date default null, p_end date default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := auth.uid();
  city     integer := p_city_id;
  starts   date := p_start;
  ends     date := p_end;
  place    text;
  new_id   bigint;
  conv     bigint;
  direct   bigint;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = me and status <> 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  select cv.id into direct
  from public.connections k
  join public.conversations cv on cv.connection_id = k.id
  where k.status = 'accepted'
    and ((k.requester_id = me and k.addressee_id = p_with) or (k.addressee_id = me and k.requester_id = p_with));
  if direct is null or public.is_blocked(me, p_with) then
    raise exception 'You can only invite people you''re connected with' using errcode = 'check_violation';
  end if;
  if p_trip_id is not null then
    select t.city_id, t.start_date, t.end_date into city, starts, ends
    from public.trips t where t.id = p_trip_id and t.owner_id = me;
    if city is null then
      raise exception 'Trip not found' using errcode = 'P0002';
    end if;
  elsif city is null or starts is null or ends is null then
    raise exception 'Please pick a place and dates' using errcode = 'check_violation';
  end if;
  if ends < starts then
    raise exception 'Please pick a place and dates' using errcode = 'check_violation';
  end if;

  -- Already planning this one together?
  select g.id into new_id
  from public.groups g
  join public.group_members a on a.group_id = g.id and a.profile_id = me
  join public.group_members b on b.group_id = g.id and b.profile_id = p_with
  where g.city_id = city and g.start_date <= ends and g.end_date >= starts
  limit 1;
  if new_id is not null then
    return new_id;
  end if;

  if p_trip_id is null then
    -- A new place and dates become my trip as well (this checks the dates).
    if not exists (select 1 from public.trips t
                   where t.owner_id = me and t.city_id = any (private.nearby_cities(city))
                     and t.start_date <= ends and t.end_date >= starts) then
      insert into public.trips (owner_id, city_id, start_date, end_date) values (me, city, starts, ends);
    end if;
  elsif ends < current_date then
    raise exception 'This trip has already ended' using errcode = 'check_violation';
  end if;

  select c.name into place from public.cities c where c.id = city;
  insert into public.groups (name, owner_id, city_id, start_date, end_date, is_pair)
  values (left(place || ' trip', 60), me, city, starts, ends, true)
  returning id into new_id;
  insert into public.group_members (group_id, profile_id, role, status, joined_at)
  values (new_id, me, 'owner', 'joined', now());
  insert into public.conversations (kind, group_id) values ('group', new_id) returning id into conv;
  insert into public.conversation_members (conversation_id, profile_id) values (conv, me);
  perform public.add_group_invites(new_id, array[p_with]);
  insert into public.messages (conversation_id, sender_id, body)
  values (direct, me, format('Shall we plan a trip to %s together? %s to %s. You can join it from the top of this chat.',
                             place, to_char(starts, 'FMDD FMMonth YYYY'), to_char(ends, 'FMDD FMMonth YYYY')));
  return new_id;
end;
$$;

-- Trips I'm planning (or invited to plan) with this member.
create function public.trips_together(p_profile uuid)
returns table (
  group_id         bigint,
  name             text,
  city             text,
  country_code     text,
  start_date       date,
  end_date         date,
  my_status        text,
  their_status     text,
  i_own            boolean,
  is_pair          boolean,
  conversation_id  bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, ci.name, ci.country_code::text, g.start_date, g.end_date, a.status, b.status,
         g.owner_id = auth.uid(), g.is_pair,
         case when a.status = 'joined' then cv.id end
  from public.group_members a
  join public.group_members b on b.group_id = a.group_id and b.profile_id = p_profile
  join public.groups g on g.id = a.group_id
  join public.cities ci on ci.id = g.city_id
  left join public.conversations cv on cv.group_id = g.id
  where a.profile_id = auth.uid()
    and p_profile <> auth.uid()
    and g.end_date >= current_date
    and not public.is_blocked(auth.uid(), p_profile)
  order by g.start_date
$$;

revoke all on function public.plan_trip_together(uuid, bigint, integer, date, date), public.trips_together(uuid) from public, anon;
grant execute on function public.plan_trip_together(uuid, bigint, integer, date, date), public.trips_together(uuid) to authenticated;

-- my_groups also says which are two-person trips.
drop function public.my_groups();
create function public.my_groups()
returns table (
  id              bigint,
  name            text,
  city            text,
  country_code    text,
  start_date      date,
  end_date        date,
  my_status       text,
  i_own           boolean,
  owner_name      text,
  members         integer,
  conversation_id bigint,
  is_pair         boolean,
  city_id         integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, ci.name, ci.country_code::text, g.start_date, g.end_date, me.status, g.owner_id = auth.uid(),
         o.display_name,
         (select count(*)::int from public.group_members m where m.group_id = g.id and m.status = 'joined'),
         case when me.status = 'joined' then c.id end,
         g.is_pair, g.city_id
  from public.group_members me
  join public.groups g on g.id = me.group_id
  join public.cities ci on ci.id = g.city_id
  join public.profiles o on o.id = g.owner_id
  left join public.conversations c on c.group_id = g.id
  where me.profile_id = auth.uid()
    and g.end_date >= current_date - 30
  order by me.status desc, g.start_date
$$;
revoke all on function public.my_groups() from public, anon;
grant execute on function public.my_groups() to authenticated;

-- ---------------------------------------------------------------------------
-- Six more interests testers asked for. ("History", "rail" and "cinema"
-- already have homes; the app's search now finds them.)

insert into public.interests (id, slug, label, sort, category, category_label, category_sort) values
  (92, 'design',    'Design',    90, 'culture', 'Arts and culture', 1),
  (93, 'cocktails', 'Cocktails', 91, 'food',    'Food and drink',   3),
  (94, 'cricket',   'Cricket',   92, 'sport',   'Sport',            5),
  (95, 'choir',     'Choir',     93, 'hobbies', 'Hobbies',          8),
  (96, 'knitting',  'Knitting',  94, 'hobbies', 'Hobbies',          8),
  (97, 'gaming',    'Gaming',    95, 'hobbies', 'Hobbies',          8)
on conflict (id) do nothing;

-- "Download my data" also includes the people you skipped.
create or replace function public.my_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at) from auth.users u where u.id = auth.uid()),
    'profile', (select to_jsonb(p) - 'role' from public.profiles p where p.id = auth.uid()),
    'preferences', (select to_jsonb(x) from public.preferences x where x.profile_id = auth.uid()),
    'interests', (select coalesce(jsonb_agg(i.label order by i.label), '[]') from public.profile_interests pi join public.interests i on i.id = pi.interest_id where pi.profile_id = auth.uid()),
    'trips', (select coalesce(jsonb_agg(to_jsonb(t) || jsonb_build_object('city', c.name) order by t.start_date), '[]') from public.trips t join public.cities c on c.id = t.city_id where t.owner_id = auth.uid()),
    'wishlist', (select coalesce(jsonb_agg(c.name order by c.name), '[]') from public.wishlist w join public.cities c on c.id = w.city_id where w.profile_id = auth.uid()),
    'connections', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'with', o.display_name, 'you_asked', x.requester_id = auth.uid(), 'status', x.status, 'note', x.note,
        'created_at', x.created_at, 'responded_at', x.responded_at) order by x.created_at), '[]')
      from public.connections x
      join public.profiles o on o.id = case when x.requester_id = auth.uid() then x.addressee_id else x.requester_id end
      where auth.uid() in (x.requester_id, x.addressee_id)
    ),
    'messages_you_sent', (select coalesce(jsonb_agg(jsonb_build_object('conversation', m.conversation_id, 'body', m.body, 'sent_at', m.created_at) order by m.created_at), '[]') from public.messages m where m.sender_id = auth.uid()),
    'groups', (select coalesce(jsonb_agg(jsonb_build_object('name', g.name, 'role', gm.role, 'status', gm.status, 'start', g.start_date, 'end', g.end_date)), '[]') from public.group_members gm join public.groups g on g.id = gm.group_id where gm.profile_id = auth.uid()),
    'plan_ideas_you_added', (select coalesce(jsonb_agg(jsonb_build_object('title', pi.title, 'link', pi.source_url, 'added_at', pi.created_at)), '[]') from public.plan_items pi where pi.added_by = auth.uid()),
    'people_you_blocked', (select coalesce(jsonb_agg(o.display_name), '[]') from public.blocks b join public.profiles o on o.id = b.blocked_id where b.blocker_id = auth.uid()),
    'reports_you_made', (select coalesce(jsonb_agg(jsonb_build_object('reason', r.reason, 'details', r.details, 'status', r.status, 'created_at', r.created_at)), '[]') from public.reports r where r.reporter_id = auth.uid()),
    'did_you_meet_answers', (select coalesce(jsonb_agg(jsonb_build_object('met', f.met, 'would_travel_again', f.would_travel_again, 'created_at', f.created_at)), '[]') from public.meet_feedback f where f.from_id = auth.uid()),
    'recommend_scores', (select coalesce(jsonb_agg(jsonb_build_object('score', n.score, 'comment', n.comment, 'created_at', n.created_at)), '[]') from public.nps_responses n where n.profile_id = auth.uid()),
    'plan', (select coalesce(jsonb_agg(jsonb_build_object('plan', e.plan, 'source', e.source, 'expires_at', e.expires_at)), '[]') from public.entitlements e where e.profile_id = auth.uid()),
    'meetup_links_you_shared', (select coalesce(jsonb_agg(jsonb_build_object('place', s.place, 'meet_at', s.meet_at, 'note', s.note, 'meeting_with', s.meeting_with, 'checked_in_at', s.checked_in_at, 'stopped_at', s.stopped_at, 'created_at', s.created_at) order by s.created_at), '[]') from public.meetup_shares s where s.owner_id = auth.uid()),
    'days_you_opened_the_app', (select count(*) from public.member_days d where d.profile_id = auth.uid()),
    'your_location', (select jsonb_build_object('lat', l.lat, 'lng', l.lng, 'updated_at', l.updated_at) from public.member_locations l where l.profile_id = auth.uid()),
    'privacy_choices', (select jsonb_build_object('measuring', c.measuring, 'marketing', c.marketing, 'chosen_at', c.chosen_at) from public.privacy_choices c where c.profile_id = auth.uid()),
    'your_trip_plans', (select coalesce(jsonb_agg(jsonb_build_object('city', c.name, 'title', i.title, 'day', i.day, 'link', i.source_url, 'done', i.done) order by t.start_date, i.day nulls last, i.id), '[]') from public.trip_plan_items i join public.trips t on t.id = i.trip_id join public.cities c on c.id = t.city_id where t.owner_id = auth.uid()),
    'your_reviews', (select coalesce(jsonb_agg(jsonb_build_object('city', c.name, 'rating', r.rating, 'review', r.body, 'updated_at', r.updated_at) order by r.updated_at), '[]') from public.city_reviews r join public.cities c on c.id = r.city_id where r.profile_id = auth.uid()),
    'people_you_skipped', (select coalesce(jsonb_agg(jsonb_build_object('name', o.display_name, 'skipped_at', s.skipped_at)), '[]') from public.skipped_members s join public.profiles o on o.id = s.skipped_id where s.profile_id = auth.uid())
  )
$$;

-- ---------------------------------------------------------------------------
-- Sodalis+ is easy to leave: one tap ends the free months now.

create function public.stop_my_plus()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.entitlements
     set plan = 'free', source = null, expires_at = null, updated_at = now()
   where profile_id = auth.uid() and plan = 'plus' and source in ('founding', 'manual')
$$;
revoke all on function public.stop_my_plus() from public, anon;
grant execute on function public.stop_my_plus() to authenticated;

-- ---------------------------------------------------------------------------
-- Town search (testers): small places people go on holiday, and the English
-- names of places the list knows by their own name.

insert into public.cities (id, name, country_code, lat, lng, population, search_name)
select v.id, v.name, 'GB', v.lat, v.lng, v.pop, lower(extensions.unaccent(v.name))
from (values
  (900000001, 'St Ives', 50.211, -5.480, 11000), (900000002, 'Hayle', 50.186, -5.420, 8900),
  (900000003, 'Mousehole', 50.083, -5.538, 700), (900000004, 'Padstow', 50.540, -4.939, 2400),
  (900000005, 'Port Isaac', 50.593, -4.829, 700), (900000006, 'Tintagel', 50.664, -4.750, 1800),
  (900000007, 'Fowey', 50.335, -4.637, 2300), (900000008, 'Dartmouth', 50.351, -3.579, 5000),
  (900000009, 'Salcombe', 50.238, -3.769, 1800), (900000010, 'Lyme Regis', 50.725, -2.937, 3700),
  (900000011, 'Rye', 50.950, 0.733, 4800), (900000012, 'Kirkwall', 58.981, -2.960, 9300),
  (900000013, 'Stromness', 58.965, -3.296, 2200), (900000014, 'Lerwick', 60.155, -1.145, 7000),
  (900000015, 'Portree', 57.412, -6.196, 2500), (900000016, 'Tobermory', 56.622, -6.068, 1000),
  (900000017, 'Oban', 56.415, -5.472, 8600), (900000018, 'Fort William', 56.820, -5.105, 10500),
  (900000019, 'Pitlochry', 56.704, -3.729, 2800), (900000020, 'Aviemore', 57.195, -3.825, 3700),
  (900000021, 'Keswick', 54.600, -3.134, 4800), (900000022, 'Ambleside', 54.433, -2.962, 2600),
  (900000023, 'Windermere', 54.377, -2.907, 5400), (900000024, 'Grasmere', 54.458, -3.024, 1500),
  (900000025, 'Hay-on-Wye', 52.074, -3.126, 1600), (900000026, 'Tenby', 51.673, -4.704, 4700),
  (900000027, 'St Davids', 51.882, -5.266, 1800), (900000028, 'Conwy', 53.280, -3.829, 4000),
  (900000029, 'Betws-y-Coed', 53.093, -3.800, 600), (900000030, 'Bourton-on-the-Water', 51.885, -1.758, 3300),
  (900000031, 'Stow-on-the-Wold', 51.930, -1.723, 2000), (900000032, 'Chipping Campden', 52.050, -1.780, 2200),
  (900000033, 'Burford', 51.808, -1.636, 1400), (900000034, 'Bakewell', 53.214, -1.676, 4000),
  (900000035, 'Lavenham', 52.108, 0.797, 1800), (900000036, 'Southwold', 52.327, 1.680, 1100),
  (900000037, 'Aldeburgh', 52.153, 1.601, 2500), (900000038, 'Wells-next-the-Sea', 52.954, 0.851, 2200),
  (900000039, 'Ilfracombe', 51.208, -4.122, 11000), (900000040, 'Glastonbury', 51.148, -2.714, 9000),
  (900000041, 'Whitby', 54.486, -0.615, 13000), (900000042, 'St Andrews', 56.340, -2.797, 17000),
  (900000043, 'Ludlow', 52.367, -2.718, 10500), (900000044, 'Stornoway', 58.209, -6.389, 8000)
) as v(id, name, lat, lng, pop)
where not exists (select 1 from public.cities c where c.country_code = 'GB' and c.search_name = lower(extensions.unaccent(v.name)))
on conflict (id) do nothing;

create table public.city_aliases (
  search_name  text primary key,
  city_id      integer not null references public.cities (id) on delete cascade
);
alter table public.city_aliases enable row level security;
revoke all on public.city_aliases from anon, authenticated;

insert into public.city_aliases (search_name, city_id)
select a.alias, c.id
from (values
  ('bruges', 'brugge', 'BE'), ('ghent', 'gent', 'BE'), ('antwerp', 'antwerpen', 'BE'),
  ('seville', 'sevilla', 'ES'), ('geneva', 'geneve', 'CH'), ('gothenburg', 'goteborg', 'SE'),
  ('nuremberg', 'nurnberg', 'DE'), ('cologne', 'koln', 'DE'), ('oporto', 'porto', 'PT'),
  ('madeira', 'funchal', 'PT'), ('marrakech', 'marrakesh', 'MA'), ('cracow', 'krakow', 'PL'),
  ('skye', 'portree', 'GB'), ('isle of skye', 'portree', 'GB'), ('orkney', 'kirkwall', 'GB'),
  ('shetland', 'lerwick', 'GB'), ('mull', 'tobermory', 'GB'), ('isle of mull', 'tobermory', 'GB'),
  ('lewis', 'stornoway', 'GB'), ('isle of lewis', 'stornoway', 'GB')
) as a(alias, target, cc)
join lateral (select c.id from public.cities c where c.search_name = a.target and c.country_code = a.cc
              order by c.population desc limit 1) c on true
on conflict (search_name) do nothing;

create or replace function public.search_cities(q text)
returns table (id integer, name text, country_code char(2))
language sql
stable
security definer
set search_path = ''
as $$
  with typed as (
    select replace(replace(lower(extensions.unaccent(btrim(q))), '%', ''), '_', '\_') || '%' as pattern
  )
  select c.id, c.name, c.country_code
  from public.cities c, typed
  where char_length(btrim(q)) >= 2
    and (c.search_name like typed.pattern
         or c.id in (select a.city_id from public.city_aliases a where a.search_name like typed.pattern))
  order by c.population desc
  limit 8;
$$;
