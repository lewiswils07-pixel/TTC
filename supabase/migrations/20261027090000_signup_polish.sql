-- Sign-up polish (Lewis's sign-up review, 5 Oct).
--  6. Full date of birth (kept private) instead of the year. Ages and the
--     age preferences are now exact. Members who joined with only a year
--     keep year-based ages until they add their date.
--  7. "Prefer not to say" for gender. They are shown only to members who
--     show everyone; they can still choose who they see.
-- 13. A founding member number and 3 months of Sodalis+ when a member
--     finishes sign-up.
-- Additive: no data is removed.

-- ------------------------------------------------------------ date of birth
alter table public.profiles add column birth_date date;
grant update (birth_date) on public.profiles to authenticated;

-- Checks the date and keeps birth_year in step, so everything that reads
-- the year keeps working.
create function public.profiles_birth_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_date is not null then
    if new.birth_date > (current_date - interval '18 years')::date then
      raise exception 'Members must be 18 or over' using errcode = 'check_violation';
    end if;
    if new.birth_date < date '1900-01-01' then
      raise exception 'Please check your date of birth' using errcode = 'check_violation';
    end if;
    new.birth_year := extract(year from new.birth_date)::smallint;
  end if;
  return new;
end;
$$;
create trigger profiles_birth_date
  before insert or update of birth_date on public.profiles
  for each row execute function public.profiles_birth_date();

-- A member's age: exact from the date of birth, or from the year for
-- members who only gave a year.
create function public.member_age(p public.profiles)
returns integer
language sql
stable
set search_path = ''
as $$
  select case
    when p.birth_date is not null then extract(year from age(current_date, p.birth_date))::int
    when p.birth_year is not null then extract(year from current_date)::int - p.birth_year
  end
$$;

-- What the app receives in the birth_year column of cards and lists: this
-- year minus the member's age, so "this year minus birth_year" in the app
-- is their exact age. The real date of birth never leaves the database.
create function public.age_year(p public.profiles)
returns smallint
language sql
stable
set search_path = ''
as $$ select (extract(year from current_date)::int - public.member_age(p))::smallint $$;

revoke all on function public.member_age(public.profiles) from public, anon;
revoke all on function public.age_year(public.profiles) from public, anon;

-- ------------------------------------------------------------ gender
alter table public.profiles drop constraint profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check
  check (gender in ('woman', 'man', 'nonbinary', 'unsaid'));

create or replace function public.fits_preferences(age integer, gender text, prefs public.preferences)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select age >= prefs.age_min
     and (prefs.age_max >= 99 or age <= prefs.age_max)
     and (gender = any (prefs.genders)
          or (gender = 'unsaid' and prefs.genders @> '{woman,man,nonbinary}'::text[]))
$$;

-- ------------------------------------------------------- founding members
create sequence public.member_number_seq;
alter table public.profiles add column member_number integer unique;

-- Numbers the members who have already finished sign-up, oldest first.
with ordered as (
  select id, row_number() over (order by onboarded_at, id) as n
  from public.profiles where onboarded_at is not null
)
update public.profiles p set member_number = o.n from ordered o where o.id = p.id;
select setval('public.member_number_seq', greatest((select max(member_number) from public.profiles), 0) + 1, false);

-- On finishing sign-up: the next member number, and 3 months of Sodalis+
-- (the founding offer). A member who already has a plan keeps it.
create function public.profiles_welcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.onboarded_at is null and new.onboarded_at is not null then
    if new.member_number is null then
      new.member_number := nextval('public.member_number_seq');
    end if;
    insert into public.entitlements (profile_id, plan, source, expires_at)
    values (new.id, 'plus', 'founding', now() + interval '3 months')
    on conflict (profile_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.profiles_welcome() from public, anon, authenticated;
create trigger profiles_welcome
  before update of onboarded_at on public.profiles
  for each row execute function public.profiles_welcome();

-- Members who finished sign-up before this change get the founding offer too.
insert into public.entitlements (profile_id, plan, source, expires_at)
select id, 'plus', 'founding', now() + interval '3 months'
from public.profiles where onboarded_at is not null
on conflict (profile_id) do nothing;

-- The signed-in member's number and founding plan end, for the welcome screen.
create function public.my_welcome()
returns table (member_number integer, plus_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.member_number, e.expires_at
  from public.profiles p
  left join public.entitlements e on e.profile_id = p.id and e.plan = 'plus'
  where p.id = auth.uid()
$$;
revoke all on function public.my_welcome() from public, anon;
grant execute on function public.my_welcome() to authenticated;

-- ------------------------------------------------------------ exact ages
-- The same functions as before, with exact ages in place of the year.
-- send_connection_request
CREATE OR REPLACE FUNCTION public.send_connection_request(p_to uuid, p_note text DEFAULT NULL::text, p_trip_id bigint DEFAULT NULL::bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

-- suggest_for_trip
CREATE OR REPLACE FUNCTION public.suggest_for_trip(p_trip_id bigint)
 RETURNS TABLE(profile_id uuid, display_name text, birth_year smallint, home_city text, home_country text, photo_path text, travelling_with text, trip_city text, trip_start date, trip_end date, overlap_start date, overlap_end date, shared_interests text[], score integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      and public.fits_preferences(public.member_age(p), p.gender, my_prefs)
      and public.fits_preferences(public.member_age(my), my.gender, pr)
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
$function$;

-- suggest_by_interests
CREATE OR REPLACE FUNCTION public.suggest_by_interests()
 RETURNS TABLE(profile_id uuid, display_name text, birth_year smallint, home_city text, home_country text, photo_path text, travelling_with text, distance_km integer, shared_interests text[], shared_places text[], score integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      and public.fits_preferences(public.member_age(p), p.gender, my_prefs)
      and public.fits_preferences(public.member_age(my), my.gender, pr)
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
$function$;

-- group_people
CREATE OR REPLACE FUNCTION public.group_people(p_group bigint)
 RETURNS TABLE(profile_id uuid, display_name text, birth_year smallint, photo_path text, role text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.id, p.display_name, public.age_year(p), p.photo_path, gm.role, gm.status
  from public.group_members gm
  join public.profiles p on p.id = gm.profile_id
  where gm.group_id = p_group
    and exists (select 1 from public.group_members me where me.group_id = p_group and me.profile_id = auth.uid())
    and (p.id = auth.uid() or not public.is_blocked(auth.uid(), p.id))
    and p.status = 'active'
  order by gm.role desc, gm.status desc, gm.joined_at, p.display_name
$function$;

-- my_connections
CREATE OR REPLACE FUNCTION public.my_connections()
 RETURNS TABLE(id bigint, status text, direction text, note text, created_at timestamp with time zone, profile_id uuid, display_name text, birth_year smallint, home_city text, home_country text, photo_path text, trip_city text, trip_start date, trip_end date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

-- my_conversations
CREATE OR REPLACE FUNCTION public.my_conversations()
 RETURNS TABLE(id bigint, kind text, group_id bigint, profile_id uuid, display_name text, birth_year smallint, photo_path text, last_body text, last_at timestamp with time zone, last_mine boolean, last_sender text, unread integer, can_message boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with mine as (
    select me.conversation_id, me.last_read_at, public.blocked_with(auth.uid()) as hidden
    from public.conversation_members me
    where me.profile_id = auth.uid()
  )
  select c.id, c.kind, c.group_id, p.id, coalesce(g.name, p.display_name), public.age_year(p), p.photo_path,
         last.body, coalesce(last.created_at, c.created_at), last.sender_id = auth.uid(), ls.display_name,
         (select count(*)::int from public.messages m
           where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.created_at > mine.last_read_at
             and not (m.sender_id = any (mine.hidden))),
         case when c.kind = 'direct' then k.status = 'accepted' else true end
  from mine
  join public.conversations c on c.id = mine.conversation_id
  left join public.connections k on k.id = c.connection_id
  left join public.groups g on g.id = c.group_id
  left join public.conversation_members them
    on c.kind = 'direct' and them.conversation_id = c.id and them.profile_id <> auth.uid()
  left join public.profiles p on p.id = them.profile_id
  left join lateral (
    select m.body, m.created_at, m.sender_id from public.messages m
    where m.conversation_id = c.id and not (m.sender_id = any (mine.hidden))
    order by m.id desc limit 1
  ) last on true
  left join public.profiles ls on ls.id = last.sender_id
  where (c.kind = 'group' and g.end_date >= current_date - 30)
     or (c.kind = 'direct' and p.status = 'active' and not (p.id = any (mine.hidden)))
  order by coalesce(last.created_at, c.created_at) desc
$function$;
