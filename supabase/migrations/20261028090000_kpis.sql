-- KPIs for the team (Lewis's KPI list, 5 Oct): one admin-only function that
-- counts what the database already knows, plus the few new things it needs
-- to start recording: which days members open the app, where they heard
-- about us, when they first saw a suggested person, and a "would you
-- recommend us" score.

-- ------------------------------------------------------------ active days
-- One row per member per day they open the app, for weekly and monthly
-- active members over time.
create table public.member_days (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  day         date not null default current_date,
  primary key (profile_id, day)
);
alter table public.member_days enable row level security;
revoke all on public.member_days from anon, authenticated;

-- The app already calls this whenever a member opens it.
create or replace function public.touch_last_active()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.member_days (profile_id) select auth.uid() where auth.uid() is not null
  on conflict do nothing;
  update public.profiles set last_active_at = now()
  where id = auth.uid() and last_active_at < now() - interval '1 hour';
$$;

-- ------------------------------------------------- where members came from
alter table public.profiles
  add column heard_from text check (heard_from in ('member', 'friend', 'instagram', 'facebook', 'tiktok', 'search', 'press', 'event', 'other')),
  add column first_match_at timestamptz;
grant update (heard_from) on public.profiles to authenticated;

-- ----------------------------------------------------- first match shown
-- Called by the app the first time a member is shown a suggested person.
create function public.note_first_match()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set first_match_at = now() where id = auth.uid() and first_match_at is null
$$;
revoke all on function public.note_first_match() from public, anon;
grant execute on function public.note_first_match() to authenticated;

-- --------------------------------------------------- would you recommend us
create table public.nps_responses (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  score       smallint not null check (score between 0 and 10),
  comment     text check (char_length(comment) <= 500),
  created_at  timestamptz not null default now()
);
create index nps_responses_profile_idx on public.nps_responses (profile_id, created_at);
alter table public.nps_responses enable row level security;
revoke all on public.nps_responses from anon, authenticated;

-- Asked once members have been in for 2 weeks, then at most every 90 days.
create function public.nps_due()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.onboarded_at < now() - interval '14 days'
      and not exists (select 1 from public.nps_responses n where n.profile_id = p.id and n.created_at > now() - interval '90 days')
  )
$$;
revoke all on function public.nps_due() from public, anon;
grant execute on function public.nps_due() to authenticated;

create function public.answer_nps(p_score integer, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.nps_due() then
    raise exception 'Thanks, you’ve already answered recently' using errcode = '22023';
  end if;
  insert into public.nps_responses (profile_id, score, comment) values (auth.uid(), p_score, nullif(btrim(p_comment), ''));
end;
$$;
revoke all on function public.answer_nps(integer, text) from public, anon;
grant execute on function public.answer_nps(integer, text) to authenticated;

-- --------------------------------------------------------------- the KPIs
-- Everything on the Insights page in one call. p_days is the period for
-- "new" counts (sign-ups, requests, reports). Admins only.
create function public.admin_kpis(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  since timestamptz := now() - make_interval(days => greatest(p_days, 1));
  result jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  with members as (
    select p.* from public.profiles p where p.onboarded_at is not null and p.status <> 'deleted'
  ),
  new_members as (select * from members where onboarded_at >= since),
  mau as (select count(*)::numeric as n from members where last_active_at > now() - interval '30 days'),
  upcoming as (
    select t.* from public.trips t join members m on m.id = t.owner_id
    where t.end_date >= current_date and t.visibility = 'members'
  ),
  requests as (select * from public.connections c where c.created_at >= since),
  accepted as (select requester_id as a, addressee_id as b from public.connections where status in ('accepted', 'ended')),
  per_member as (
    select m.id, (select count(*) from accepted x where m.id in (x.a, x.b)) as connections from members m
  ),
  nps as (
    select score from public.nps_responses n
    where n.created_at > now() - interval '90 days'
      and n.id = (select max(id) from public.nps_responses x where x.profile_id = n.profile_id)
  )
  select jsonb_build_object(
    'period_days', greatest(p_days, 1),
    'acquisition', jsonb_build_object(
      'members', (select count(*) from members),
      'new_members', (select count(*) from new_members),
      'started_not_finished', (select count(*) from public.profiles where onboarded_at is null and created_at >= since),
      'by_week', (
        select coalesce(jsonb_agg(jsonb_build_object('week', w::date, 'count',
          (select count(*) from members m where m.onboarded_at >= w and m.onboarded_at < w + interval '7 days')) order by w), '[]')
        from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') w
      ),
      'by_channel', (
        select coalesce(jsonb_object_agg(coalesce(heard_from, 'not_said'), n), '{}')
        from (select heard_from, count(*) as n from new_members group by heard_from) c
      ),
      'phone_verified', (select count(*) from new_members where phone_verified_at is not null),
      'age_bands', (
        select coalesce(jsonb_object_agg(band, n), '{}') from (
          select case when age < 35 then '18–34' when age < 50 then '35–49' when age < 65 then '50–64' else '65+' end as band, count(*) as n
          from (select coalesce(extract(year from age(birth_date))::int, extract(year from now())::int - birth_year) as age from new_members) a
          where age is not null group by 1
        ) b
      ),
      'genders', (select coalesce(jsonb_object_agg(coalesce(gender, 'unsaid'), n), '{}') from (select gender, count(*) as n from new_members group by gender) g)
    ),
    'liquidity', jsonb_build_object(
      'members_with_trip', (select count(distinct owner_id) from upcoming),
      'upcoming_trips', (select count(*) from upcoming),
      'trips_with_overlap', (
        select count(*) from upcoming t where exists (
          select 1 from upcoming o where o.city_id = t.city_id and o.owner_id <> t.owner_id
            and o.start_date - o.flexible_days <= t.end_date + t.flexible_days
            and t.start_date - t.flexible_days <= o.end_date + o.flexible_days)
      ),
      'top_places', (
        select coalesce(jsonb_agg(jsonb_build_object('city', c.name, 'month', d.month, 'members', d.members) order by d.members desc, c.name), '[]')
        from (
          select city_id, to_char(start_date, 'YYYY-MM') as month, count(distinct owner_id) as members
          from upcoming group by 1, 2 order by 3 desc limit 10
        ) d join public.cities c on c.id = d.city_id
      ),
      'shown_a_match', (select count(*) from members where first_match_at is not null),
      'median_hours_to_first_match', (
        select round((percentile_cont(0.5) within group (order by extract(epoch from first_match_at - onboarded_at)) / 3600)::numeric, 1)
        from members where first_match_at is not null
      )
    ),
    'matching', jsonb_build_object(
      'requests', (select count(*) from requests),
      'accepted', (select count(*) from requests where status in ('accepted', 'ended')),
      'declined', (select count(*) from requests where status = 'declined'),
      'waiting', (select count(*) from requests where status = 'pending'),
      'met', (select count(*) from public.meet_feedback where met),
      'would_travel_again', (select count(*) from public.meet_feedback where would_travel_again),
      'would_not', (select count(*) from public.meet_feedback where would_travel_again = false),
      'reports', (select count(*) from public.reports where created_at >= since),
      'blocks', (select count(*) from public.blocks where created_at >= since),
      'flagged_messages', (select count(*) from public.message_flags where created_at >= since),
      'active_members', (select n from mau)
    ),
    'retention', jsonb_build_object(
      'active_today', (select count(*) from members where last_active_at >= current_date),
      'active_7_days', (select count(*) from members where last_active_at > now() - interval '7 days'),
      'active_30_days', (select n from mau),
      'weekly_active', (
        select coalesce(jsonb_agg(jsonb_build_object('week', w::date, 'count',
          (select count(distinct d.profile_id) from public.member_days d where d.day >= w and d.day < w + interval '7 days')) order by w), '[]')
        from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') w
      ),
      'with_a_connection', (select count(*) from per_member where connections >= 1),
      'with_2_connections', (select count(*) from per_member where connections >= 2),
      'profile', jsonb_build_object(
        'photo', (select count(*) from members where photo_path is not null),
        'bio', (select count(*) from members where bio is not null),
        'travel_style', (select count(*) from members where travel_style is not null and pace is not null and budget is not null),
        'trip', (select count(distinct owner_id) from public.trips t join members m on m.id = t.owner_id)
      ),
      'joined_over_30_days', (select count(*) from members where onboarded_at < now() - interval '30 days'),
      'gone_quiet', (select count(*) from members where onboarded_at < now() - interval '30 days' and last_active_at < now() - interval '30 days'),
      'quiet_after_poor_match', (
        select count(distinct f.from_id) from public.meet_feedback f join members m on m.id = f.from_id
        where f.would_travel_again = false and m.last_active_at < now() - interval '30 days'
      ),
      'poor_match_members', (select count(distinct from_id) from public.meet_feedback where would_travel_again = false)
    ),
    'community', jsonb_build_object(
      'groups', (select count(*) from public.groups where end_date >= current_date),
      'in_a_group', (select count(distinct gm.profile_id) from public.group_members gm join members m on m.id = gm.profile_id where gm.status = 'joined'),
      'heard_from_member', (select count(*) from members where heard_from = 'member'),
      'said_where_heard', (select count(*) from members where heard_from is not null),
      'nps_responses', (select count(*) from nps),
      'nps_promoters', (select count(*) from nps where score >= 9),
      'nps_detractors', (select count(*) from nps where score <= 6),
      'nps_comments', (
        select coalesce(jsonb_agg(jsonb_build_object('score', score, 'comment', comment, 'at', created_at) order by created_at desc), '[]')
        from (select score, comment, created_at from public.nps_responses where comment is not null order by created_at desc limit 5) c
      )
    )
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_kpis(integer) from public, anon;
grant execute on function public.admin_kpis(integer) to authenticated;
