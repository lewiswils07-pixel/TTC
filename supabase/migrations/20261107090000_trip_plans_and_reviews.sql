-- Trip planner on your own trips, and members' reviews of destinations
-- (Lewis, 7 Oct). Part 16 for the live database.
--
-- 1. trip_plan_items: a private day-by-day plan for each of your trips.
--    Only the trip's owner can see or change it, through the functions below.
-- 2. city_reviews: one star rating (1-5) and an optional few words per member
--    per place. Every signed-in member can read them, apart from people
--    blocked either way and paused accounts. A review from someone who has
--    already been on a trip there is marked as such.

create table public.trip_plan_items (
  id          bigint generated always as identity primary key,
  trip_id     bigint not null references public.trips (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  day         smallint check (day between 1 and 91),
  source_url  text check (source_url ~ '^https://' and char_length(source_url) <= 500),
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index trip_plan_items_trip_idx on public.trip_plan_items (trip_id);
alter table public.trip_plan_items enable row level security;
revoke all on public.trip_plan_items from anon, authenticated;

create function private.owns_trip(p_trip_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.trips t where t.id = p_trip_id and t.owner_id = auth.uid()) $$;
revoke all on function private.owns_trip(bigint) from public, anon, authenticated;

-- Your plan for one of your trips: by day, then "any day", ticked ones last.
create function public.trip_plan(p_trip_id bigint)
returns table (id bigint, title text, day smallint, source_url text, done boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.title, i.day, i.source_url, i.done, i.created_at
  from public.trip_plan_items i
  where i.trip_id = p_trip_id and private.owns_trip(p_trip_id)
  order by i.day nulls last, i.done, i.id
$$;

create function public.add_trip_idea(p_trip_id bigint, p_title text, p_day smallint default null, p_url text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip_days int;
  new_id bigint;
begin
  if not private.owns_trip(p_trip_id) then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  select t.end_date - t.start_date + 1 into trip_days from public.trips t where t.id = p_trip_id;
  if p_day is not null and (p_day < 1 or p_day > trip_days) then
    raise exception 'Please pick a day during the trip' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.trip_plan_items where trip_id = p_trip_id) >= private.rule('planBoard.maxIdeas') then
    raise exception 'Your plan is full' using errcode = 'check_violation';
  end if;
  insert into public.trip_plan_items (trip_id, title, day, source_url)
  values (p_trip_id, btrim(p_title), p_day, nullif(btrim(p_url), ''))
  returning id into new_id;
  return new_id;
end;
$$;

-- Tick an idea off, or move it to another day (null = any day).
create function public.update_trip_idea(p_item bigint, p_done boolean, p_day smallint default null)
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
  update public.trip_plan_items set done = p_done, day = p_day where id = p_item;
end;
$$;

create function public.delete_trip_idea(p_item bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.trip_plan_items i where i.id = p_item and private.owns_trip(i.trip_id);
  if not found then
    raise exception 'Idea not found' using errcode = 'P0002';
  end if;
end;
$$;

create table public.city_reviews (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  city_id     integer not null references public.cities (id),
  rating      smallint not null check (rating between 1 and 5),
  body        text check (char_length(body) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (profile_id, city_id)
);
create index city_reviews_city_idx on public.city_reviews (city_id, updated_at desc);
alter table public.city_reviews enable row level security;
revoke all on public.city_reviews from anon, authenticated;

-- Reviews of one place, newest first, with the overall average and count.
create function public.city_reviews(p_city_id integer)
returns table (
  author_id   uuid,
  author      text,
  rating      smallint,
  body        text,
  updated_at  timestamptz,
  mine        boolean,
  went_on_trip boolean,
  average     numeric,
  total       integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.profile_id, p.display_name, r.rating, r.body, r.updated_at, r.profile_id = auth.uid(),
         exists (select 1 from public.trips t where t.owner_id = r.profile_id and t.city_id = r.city_id and t.start_date <= current_date),
         round(avg(r.rating) over (), 1), (count(*) over ())::int
  from public.city_reviews r
  join public.profiles p on p.id = r.profile_id
  where auth.uid() is not null
    and r.city_id = p_city_id
    and p.status = 'active'
    and not public.is_blocked(auth.uid(), r.profile_id)
  order by r.profile_id = auth.uid() desc, r.updated_at desc
  limit 100
$$;

-- Add or change your review of a place.
create function public.save_city_review(p_city_id integer, p_rating smallint, p_body text default null)
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
  if char_length(btrim(coalesce(p_body, ''))) > private.rule('reviews.textMax') then
    raise exception 'Please keep your review shorter' using errcode = 'check_violation';
  end if;
  insert into public.city_reviews (profile_id, city_id, rating, body)
  values (auth.uid(), p_city_id, p_rating, nullif(btrim(p_body), ''))
  on conflict (profile_id, city_id) do update
    set rating = excluded.rating, body = excluded.body, updated_at = now();
end;
$$;

create function public.delete_city_review(p_city_id integer)
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.city_reviews where profile_id = auth.uid() and city_id = p_city_id $$;

revoke all on function public.trip_plan(bigint), public.add_trip_idea(bigint, text, smallint, text),
  public.update_trip_idea(bigint, boolean, smallint), public.delete_trip_idea(bigint),
  public.city_reviews(integer), public.save_city_review(integer, smallint, text), public.delete_city_review(integer)
  from public, anon;
grant execute on function public.trip_plan(bigint), public.add_trip_idea(bigint, text, smallint, text),
  public.update_trip_idea(bigint, boolean, smallint), public.delete_trip_idea(bigint),
  public.city_reviews(integer), public.save_city_review(integer, smallint, text), public.delete_city_review(integer)
  to authenticated;

-- "Download my data" also includes your trip plans and reviews.
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
    'your_reviews', (select coalesce(jsonb_agg(jsonb_build_object('city', c.name, 'rating', r.rating, 'review', r.body, 'updated_at', r.updated_at) order by r.updated_at), '[]') from public.city_reviews r join public.cities c on c.id = r.city_id where r.profile_id = auth.uid())
  )
$$;
