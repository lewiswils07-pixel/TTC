-- matching: suggest_by_interests (spec §4.1, §4.3). For members with no
-- trip booked: people who share at least 2 interests, within the viewer's
-- distance filter, best match first. The same hard filters as trip mode:
-- active, finished sign-up, mutual age and gender, no block or open
-- connection, and the viewer's Sodalis+ filters.

create function public.suggest_by_interests()
returns table (
  profile_id       uuid,
  display_name     text,
  birth_year       smallint,
  home_city        text,
  home_country     text,
  photo_path       text,
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
    select o.owner_id, o.shared_count,
           p.display_name, p.birth_year, p.home_city_id, p.photo_path,
           p.travel_style, p.pace, p.budget, p.last_active_at,
           public.city_distance_km(p.home_city_id, my.home_city_id) as km
    from overlap o
    join public.profiles p on p.id = o.owner_id
    join public.preferences pr on pr.profile_id = p.id
    where p.status = 'active'
      and p.onboarded_at is not null
      and not public.pair_is_closed(me, p.id)
      and public.fits_preferences(public.age_from_year(p.birth_year), p.gender, my_prefs)
      and public.fits_preferences(public.age_from_year(my.birth_year), my.gender, pr)
      and (my_prefs.max_distance_km is null
           or public.city_distance_km(p.home_city_id, my.home_city_id) <= my_prefs.max_distance_km)
      and public.passes_viewer_filters(my_prefs, p)
  ),
  scored as (
    select c.*,
           (select count(*) from public.profile_interests where profile_id = c.owner_id) as their_count,
           array(select i.label from public.profile_interests a
                   join mine b on b.interest_id = a.interest_id
                   join public.interests i on i.id = a.interest_id
                  where a.profile_id = c.owner_id
                  order by i.sort) as shared,
           array(select ci.name from public.wishlist w
                   join public.wishlist v on v.city_id = w.city_id and v.profile_id = me
                   join public.cities ci on ci.id = w.city_id
                  where w.profile_id = c.owner_id
                  order by ci.name) as places,
           (select count(*) from public.wishlist where profile_id = c.owner_id) as their_places
    from candidates c
  )
  select s.owner_id, s.display_name, s.birth_year, hc.name, hc.country_code::text, s.photo_path,
         round(s.km)::int,
         s.shared, s.places,
         round(
           -- interests: Jaccard overlap
           55 * s.shared_count::numeric / (my_count + s.their_count - s.shared_count)
           -- places both want to visit, against the shorter list
           + 25 * coalesce(cardinality(s.places)::numeric / nullif(least(my_places, s.their_places), 0), 0)
           -- style, pace and budget together
           + 20 * (public.scale_match(s.travel_style, my.travel_style, '{planner,mix,spontaneous}')
                   + public.scale_match(s.pace, my.pace, '{slow,steady,packed}')
                   + public.scale_match(s.budget, my.budget, '{budget,mid,comfort}')) / 3
         )::int as total
  from scored s
  left join public.cities hc on hc.id = s.home_city_id
  order by total desc, s.last_active_at desc
  limit 20;
end;
$$;

revoke all on function public.suggest_by_interests() from public, anon;
grant execute on function public.suggest_by_interests() to authenticated;
