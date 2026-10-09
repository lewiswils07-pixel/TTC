-- Make the app feel more about travel (Lewis, 9 Oct):
--   * "Places I'd love to go" on each suggested member's card, from their wishlist
--   * "Where members are heading" on Trips: popular cities for upcoming trips

-- A member's wishlist, for their card. Anyone signed in can see it, like the
-- trips and interests already on cards, except across a block or for an
-- account that isn't active.
create function public.wishlist_of(p_profile uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array(
    select c.name from public.wishlist w
    join public.cities c on c.id = w.city_id
    where w.profile_id = p_profile
    order by w.created_at
  ), '{}')
  from public.profiles p
  where p.id = p_profile
    and auth.uid() is not null
    and p.status = 'active'
    and not (p_profile = any (public.blocked_with(auth.uid())))
$$;
revoke all on function public.wishlist_of(uuid) from public, anon;
grant execute on function public.wishlist_of(uuid) to authenticated;

-- Cities with upcoming trips from several members, busiest first. Only counts
-- are shared, never who is going, and a city needs at least
-- trips.popularMinMembers different members to appear.
create function public.popular_destinations()
returns table (city_id integer, city text, country_code text, members integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.country_code::text, count(distinct t.owner_id)::integer
  from public.trips t
  join public.cities c on c.id = t.city_id
  join public.profiles p on p.id = t.owner_id and p.status = 'active'
  where auth.uid() is not null
    and t.end_date >= current_date
  group by c.id, c.name, c.country_code
  having count(distinct t.owner_id) >= private.rule('trips.popularMinMembers')
  order by count(distinct t.owner_id) desc, c.name
  limit private.rule('trips.popularShown')
$$;
revoke all on function public.popular_destinations() from public, anon;
grant execute on function public.popular_destinations() to authenticated;
