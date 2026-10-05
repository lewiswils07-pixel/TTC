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
    select o.owner_id, o.shared_count,
           p.display_name, p.birth_year, p.home_city_id, p.photo_path,
           p.travel_style, p.pace, p.budget, p.last_active_at,
           public.city_distance_km(p.home_city_id, my.home_city_id) as km
    from overlap o
    join public.profiles p on p.id = o.owner_id
    join public.preferences pr on pr.profile_id = p.id
    where p.status = 'active'
      and p.onboarded_at is not null
      and not (p.id = any (closed))
      and public.fits_preferences(public.age_from_year(p.birth_year), p.gender, my_prefs)
      and public.fits_preferences(public.age_from_year(my.birth_year), my.gender, pr)
      and (my_prefs.max_distance_km is null
           or public.city_distance_km(p.home_city_id, my.home_city_id) <= my_prefs.max_distance_km)
      and public.passes_viewer_filters(my_prefs, plus, p)
  ),
  -- Score on counts first, keep the best 20, then fetch the names for
  -- those 20 only, so this stays quick with many members.
  scored as (
    select c.*,
           round(
             -- interests: Jaccard overlap
             55 * c.shared_count::numeric
               / (my_count + (select count(*) from public.profile_interests where profile_id = c.owner_id) - c.shared_count)
             -- places both want to visit, against the shorter list
             + 25 * coalesce(
                 (select count(*) from public.wishlist w join public.wishlist v on v.city_id = w.city_id and v.profile_id = me
                   where w.profile_id = c.owner_id)::numeric
                 / nullif(least(my_places, (select count(*) from public.wishlist where profile_id = c.owner_id)), 0), 0)
             -- style, pace and budget together
             + 20 * (public.scale_match(c.travel_style, my.travel_style, '{planner,mix,spontaneous}')
                     + public.scale_match(c.pace, my.pace, '{slow,steady,packed}')
                     + public.scale_match(c.budget, my.budget, '{budget,mid,comfort}')) / 3
           )::int as total
    from candidates c
  ),
  best as (
    select * from scored s order by s.total desc, s.last_active_at desc limit 20
  )
  select b.owner_id, b.display_name, b.birth_year, hc.name, hc.country_code::text, b.photo_path,
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
  left join public.cities hc on hc.id = b.home_city_id
  order by b.total desc, b.last_active_at desc;
end;
$$;

revoke all on function public.suggest_by_interests() from public, anon;
grant execute on function public.suggest_by_interests() to authenticated;
