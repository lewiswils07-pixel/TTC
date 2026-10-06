-- Distance "Your town only" (Lewis, 6 Oct): the slider starts at 0, saved
-- as 1 km, and people in your own town always count as in range.
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
      and public.fits_preferences(public.age_from_year(p.birth_year), p.gender, my_prefs)
      and public.fits_preferences(public.age_from_year(my.birth_year), my.gender, pr)
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

-- "We value your privacy" (Lewis, 6 Oct): each member's choices about
-- optional tools, asked once after sign-up and changeable in Settings. Tools
-- that are strictly needed to run the app are always on and aren't stored.
create table public.privacy_choices (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  -- Measuring how many people use the app and how.
  measuring   boolean not null default false,
  -- Personalised ads and our own marketing.
  marketing   boolean not null default false,
  chosen_at   timestamptz not null default now()
);
alter table public.privacy_choices enable row level security;
create policy "Members see their own privacy choices" on public.privacy_choices
  for select to authenticated using (profile_id = auth.uid());
revoke all on public.privacy_choices from anon;
grant select on public.privacy_choices to authenticated;

-- Saves the signed-in member's choices, with the time they made them.
create function public.set_privacy_choices(p_measuring boolean, p_marketing boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.privacy_choices (profile_id, measuring, marketing, chosen_at)
  select auth.uid(), coalesce(p_measuring, false), coalesce(p_marketing, false), now()
  where auth.uid() is not null
  on conflict (profile_id) do update
    set measuring = excluded.measuring, marketing = excluded.marketing, chosen_at = excluded.chosen_at;
$$;
revoke all on function public.set_privacy_choices(boolean, boolean) from public, anon;
grant execute on function public.set_privacy_choices(boolean, boolean) to authenticated;

-- "Download my data" also includes the saved location and these choices.
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
    'privacy_choices', (select jsonb_build_object('measuring', c.measuring, 'marketing', c.marketing, 'chosen_at', c.chosen_at) from public.privacy_choices c where c.profile_id = auth.uid())
  )
$$;
