-- Round 8 testers (Lewis, 23 Oct).
-- 1. Suggested groups: one group for each interest and each destination,
--    run by the club (no organiser). Members are shown the ones that fit
--    their interests, trips and wish list. Free members can be in up to
--    groups.suggestedFree of them; Sodalis+ members can join any.
-- 2. Seven new interests testers asked for.
-- 3. Exact overlap dates and travel-style filters are free for everyone.
--    Holiday preference filters stay with Sodalis+.
-- 4. A stand-in "Verify me" button: tapping it marks the member as
--    verified until the real ID check replaces it.

-- 1 ----------------------------------------------------------------------
alter table public.groups
  alter column owner_id drop not null,
  add column club_interest_id integer references public.interests (id) on delete cascade,
  add column club_city_id integer references public.cities (id) on delete cascade,
  add constraint groups_club_or_owned check (
    (owner_id is not null and club_interest_id is null and club_city_id is null)
    or (owner_id is null and city_id is null and ((club_interest_id is null) <> (club_city_id is null))));
create unique index groups_club_interest_idx on public.groups (club_interest_id) where club_interest_id is not null;
create unique index groups_club_city_idx on public.groups (club_city_id) where club_city_id is not null;

-- Club-run groups never close when people leave. An owned group still
-- passes to its longest-standing member, or closes when it empties.
create or replace function public.leave_group(p_group bigint, p_member uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := auth.uid();
  target uuid := coalesce(p_member, auth.uid());
  grp    public.groups;
  heir   uuid;
begin
  select * into grp from public.groups g where g.id = p_group;
  if grp.id is null or not exists (select 1 from public.group_members where group_id = p_group and profile_id = target)
     or (target <> me and grp.owner_id is distinct from me) then
    raise exception 'Group not found' using errcode = 'P0002';
  end if;
  delete from public.group_members where group_id = p_group and profile_id = target;
  delete from public.conversation_members
   where profile_id = target and conversation_id = (select id from public.conversations where group_id = p_group);
  if grp.owner_id is not null and target = grp.owner_id then
    select gm.profile_id into heir from public.group_members gm
    where gm.group_id = p_group and gm.status = 'joined'
    order by gm.joined_at, gm.created_at limit 1;
    if heir is null then
      delete from public.groups where id = p_group;
    else
      update public.groups set owner_id = heir where id = p_group;
      update public.group_members set role = 'owner' where group_id = p_group and profile_id = heir;
    end if;
  end if;
end;
$$;

-- my_groups: club groups have no organiser. club says it's one of ours.
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
  city_id         integer,
  club            boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, ci.name, ci.country_code::text, g.start_date, g.end_date, me.status, coalesce(g.owner_id = auth.uid(), false),
         o.display_name,
         (select count(*)::int from public.group_members m where m.group_id = g.id and m.status = 'joined'),
         case when me.status = 'joined' then c.id end,
         g.is_pair, g.city_id, g.owner_id is null
  from public.group_members me
  join public.groups g on g.id = me.group_id
  left join public.cities ci on ci.id = g.city_id
  left join public.profiles o on o.id = g.owner_id
  left join public.conversations c on c.group_id = g.id
  where me.profile_id = auth.uid()
    and (g.end_date is null or g.end_date >= current_date - 30)
  order by me.status desc, g.start_date nulls first, g.id
$$;
revoke all on function public.my_groups() from public, anon;
grant execute on function public.my_groups() to authenticated;

-- Groups suggested for me: my upcoming trips' places first, then my wish
-- list, then my interests (most popular first). Ones I'm in are left out.
-- fans = members going there or who picked that interest.
create function public.suggested_groups()
returns table (kind text, topic_id integer, name text, country_code text, members integer, fans integer, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id from public.profiles p where p.id = auth.uid() and p.status = 'active' and p.onboarded_at is not null
  ),
  places as (
    select t.city_id, 1 as tier, min(t.start_date) as soonest, 'Your trip' as reason
      from public.trips t join me on t.owner_id = me.id
     where t.end_date >= current_date
     group by t.city_id
    union all
    select w.city_id, 2, null::date, 'On your wish list'
      from public.wishlist w join me on w.profile_id = me.id
  ),
  topics as (
    (select distinct on (pl.city_id) 'place'::text as kind, pl.city_id as topic_id, ci.name || ' travellers' as name, ci.country_code::text as cc,
           pl.tier, pl.soonest, pl.reason,
           (select count(distinct t.owner_id)::int from public.trips t join public.profiles o on o.id = t.owner_id
             where t.city_id = pl.city_id and t.end_date >= current_date and o.status = 'active') as fans
      from places pl join public.cities ci on ci.id = pl.city_id
     order by pl.city_id, pl.tier)
    union all
    select 'interest', i.id, i.label, null, 3, null, 'You picked ' || i.label,
           (select count(*)::int from public.profile_interests x join public.profiles o on o.id = x.profile_id
             where x.interest_id = i.id and o.status = 'active')
      from public.profile_interests pi join me on pi.profile_id = me.id
      join public.interests i on i.id = pi.interest_id
  )
  select t.kind, t.topic_id, t.name, t.cc,
         coalesce((select count(*)::int from public.group_members gm where gm.group_id = g.id and gm.status = 'joined'), 0),
         t.fans, t.reason
    from topics t
    left join public.groups g on (t.kind = 'place' and g.club_city_id = t.topic_id) or (t.kind = 'interest' and g.club_interest_id = t.topic_id)
   where not exists (select 1 from public.group_members gm, me where gm.group_id = g.id and gm.profile_id = me.id)
   order by t.tier, t.soonest nulls last, t.fans desc, t.name
   limit 30
$$;
revoke all on function public.suggested_groups() from public, anon;
grant execute on function public.suggested_groups() to authenticated;

-- Join a suggested group. The group and its chat are made the first time
-- someone joins. Free members can be in up to groups.suggestedFree.
create function public.join_suggested_group(p_kind text, p_topic integer)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     public.profiles;
  grp_id bigint;
  label  text;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.status <> 'active' or me.onboarded_at is null then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  if p_kind = 'interest' then
    select i.label into label from public.interests i where i.id = p_topic;
    select g.id into grp_id from public.groups g where g.club_interest_id = p_topic;
  elsif p_kind = 'place' then
    select c.name || ' travellers' into label from public.cities c where c.id = p_topic;
    select g.id into grp_id from public.groups g where g.club_city_id = p_topic;
  end if;
  if label is null then
    raise exception 'This group isn''t available' using errcode = 'check_violation';
  end if;
  if grp_id is not null and exists (select 1 from public.group_members where group_id = grp_id and profile_id = me.id and status = 'joined') then
    return grp_id;
  end if;
  if not public.has_plus(me.id)
     and (select count(*) from public.group_members gm join public.groups g on g.id = gm.group_id
           where gm.profile_id = me.id and gm.status = 'joined' and g.owner_id is null) >= private.rule('groups.suggestedFree') then
    raise exception 'Free members can join up to % suggested groups', private.rule('groups.suggestedFree') using errcode = 'check_violation';
  end if;
  if grp_id is null then
    insert into public.groups (name, owner_id, club_interest_id, club_city_id)
    values (left(label, 60), null, case when p_kind = 'interest' then p_topic end, case when p_kind = 'place' then p_topic end)
    on conflict do nothing
    returning id into grp_id;
    if grp_id is null then
      select g.id into grp_id from public.groups g
       where (p_kind = 'interest' and g.club_interest_id = p_topic) or (p_kind = 'place' and g.club_city_id = p_topic);
    else
      insert into public.conversations (kind, group_id) values ('group', grp_id);
    end if;
  end if;
  insert into public.group_members (group_id, profile_id, role, status, joined_at)
  values (grp_id, me.id, 'member', 'joined', now())
  on conflict (group_id, profile_id) do update set status = 'joined', joined_at = now();
  insert into public.conversation_members (conversation_id, profile_id)
  select c.id, me.id from public.conversations c where c.group_id = grp_id
  on conflict do nothing;
  return grp_id;
end;
$$;
revoke all on function public.join_suggested_group(text, integer) from public, anon;
grant execute on function public.join_suggested_group(text, integer) to authenticated;

-- 2 ----------------------------------------------------------------------
insert into public.interests (id, slug, label, sort, category, category_label, category_sort) values
  (109, 'wild-swimming',   'Wild swimming',   108, 'nature',   'Outdoors',      4),
  (110, 'camping',         'Camping',         109, 'nature',   'Outdoors',      4),
  (111, 'rugby',           'Rugby',           110, 'sport',    'Active',        5),
  (112, 'faith-trips',     'Faith trips',     111, 'heritage', 'Heritage',      2),
  (113, 'step-free-trips', 'Step-free trips', 112, 'trips',    'Kinds of trip', 7),
  (114, 'hostels',         'Hostels',         113, 'trips',    'Kinds of trip', 7),
  (115, 'pride-events',    'Pride events',    114, 'social',   'Social',        9)
on conflict (slug) do nothing;

-- 3 ----------------------------------------------------------------------
-- Travel-style filters (and verified only) work for everyone. Holiday
-- preference filters stay with Sodalis+.
create or replace function public.passes_viewer_filters(prefs public.preferences, plus boolean, p public.profiles)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (not prefs.verified_only or p.id_verified_at is not null)
     and (cardinality(prefs.styles) = 0 or p.travel_style = any (prefs.styles))
     and (cardinality(prefs.paces) = 0 or p.pace = any (prefs.paces))
     and (cardinality(prefs.budgets) = 0 or p.budget = any (prefs.budgets))
     and (cardinality(prefs.movings) = 0 or p.moving = any (prefs.movings))
     and (cardinality(prefs.travel_oftens) = 0 or p.travel_often = any (prefs.travel_oftens))
     and (cardinality(prefs.bookings) = 0 or p.booking = any (prefs.bookings))
     and (cardinality(prefs.group_sizes) = 0 or p.group_size = any (prefs.group_sizes))
     and (not plus
          or (public.holiday_pick(p, 'stay', prefs.stays)
              and public.holiday_pick(p, 'length', prefs.lengths)
              and public.holiday_pick(p, 'season', prefs.seasons)))
$$;

-- Exact trip and overlap dates for everyone ("Going when you are" is free).
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
  score            integer,
  rank             numeric
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
    select t.owner_id, t.city_id, t.start_date, t.end_date, p as person, pr as their_prefs,
           greatest(t.start_date, my_trip.start_date) as o_start,
           least(t.end_date, my_trip.end_date) as o_end,
           case when p.home_city_id = my.home_city_id then 0 else public.member_distance_km(p.id, me) end as km
    from public.trips t
    join public.profiles p on p.id = t.owner_id
    join public.preferences pr on pr.profile_id = p.id
    where t.owner_id <> me
      and t.visibility = 'members'
      and t.end_date >= current_date
      and t.city_id = any (nearby)
      and least(t.end_date + t.flexible_days, my_trip.end_date + my_trip.flexible_days)
          - greatest(t.start_date - t.flexible_days, my_trip.start_date - my_trip.flexible_days) + 1
          >= least(2, t.end_date - t.start_date + 1, my_trip.end_date - my_trip.start_date + 1)
      and p.status = 'active'
      and p.onboarded_at is not null
      and p.last_active_at > now() - interval '60 days'
      and not (p.id = any (closed))
      and not public.is_skipped(me, p.id)
      and public.passes_viewer_filters(my_prefs, plus, p)
  ),
  fitting as (
    select c.*,
           public.preference_fit(public.member_age(c.person), (c.person).gender, null, my_prefs)
           + public.preference_fit(public.member_age(my), my.gender, null, c.their_prefs) as penalty,
           -- one card per member: their best-matching trip
           row_number() over (partition by c.owner_id order by least(c.o_end, c.end_date) - c.o_start desc, c.start_date) as nth
    from candidates c
  ),
  scored as (
    select f.*,
           public.interest_points(me, f.owner_id) + public.place_points(me, f.owner_id) + public.style_points(f.person, my) as total,
           f.o_start <= f.o_end as overlaps
    from fitting f
    where f.penalty is not null and f.nth = 1
  ),
  best as (
    select s.*,
           s.total - s.penalty - public.activity_penalty(s.person) - case when (s.person).photo_path is null then 100 else 0 end
           + case when s.overlaps then private.rule('matching.sameTripBonus') + case when public.has_plus(s.owner_id) then 3 else 0 end else 0 end as ranking
    from scored s
    order by ranking desc
    limit private.rule('matching.maxSuggestions')
  )
  select b.owner_id, (b.person).display_name, public.age_year(b.person), hc.name, hc.country_code::text,
         (b.person).photo_path, (b.person).travelling_with,
         tc.name,
         b.start_date,
         b.end_date,
         case when b.overlaps then b.o_start end,
         case when b.overlaps then b.o_end end,
         array(select i.label from public.profile_interests x
                 join public.profile_interests y on y.interest_id = x.interest_id and y.profile_id = me
                 join public.interests i on i.id = x.interest_id
                where x.profile_id = b.owner_id
                order by i.sort),
         round(b.total)::int,
         round(b.ranking, 2)
  from best b
  join public.cities tc on tc.id = b.city_id
  left join public.cities hc on hc.id = (b.person).home_city_id
  order by b.ranking desc;
end;
$$;

-- 4 ----------------------------------------------------------------------
-- Stand-in verification until the real ID check: tapping "Verify me" marks
-- the member as verified.
create function public.verify_me_now()
returns timestamptz
language sql
volatile
security definer
set search_path = ''
as $$
  update public.profiles set id_verified_at = coalesce(id_verified_at, now())
   where id = auth.uid() and status = 'active'
  returning id_verified_at
$$;
revoke all on function public.verify_me_now() from public, anon;
grant execute on function public.verify_me_now() to authenticated;

-- Which of these people are verified, for the badge on their card.
create function public.verified_members(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
    from public.profiles p
   where auth.uid() is not null
     and p.id = any (p_ids[1:100])
     and p.status = 'active'
     and p.id_verified_at is not null
     and (p.id = auth.uid() or not public.is_blocked(auth.uid(), p.id))
$$;
revoke all on function public.verified_members(uuid[]) from public, anon;
grant execute on function public.verified_members(uuid[]) to authenticated;
