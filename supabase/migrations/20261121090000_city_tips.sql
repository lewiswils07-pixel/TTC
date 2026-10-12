-- Nice to know: members' tips from their trips, replacing city reviews on a
-- trip (Lewis, 12 Oct). A tip has a category (food, drink, museums...), the
-- place, a few words and optional stars. Everyone signed in can read them;
-- searching and picking a category is Sodalis+. Like reviews, you can add
-- tips once your trip has started, or for your home town.

create table public.city_tips (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  city_id     integer not null references public.cities (id),
  category    text not null check (category in ('food', 'drink', 'museums', 'sights', 'walks', 'shopping', 'getting_around', 'stays')),
  place       text not null check (char_length(place) > 0 and char_length(place) <= 80),
  body        text check (char_length(body) <= 500),
  rating      smallint check (rating between 1 and 5),
  created_at  timestamptz not null default now()
);
create index city_tips_city_idx on public.city_tips (city_id, created_at desc);
create index city_tips_profile_idx on public.city_tips (profile_id);
alter table public.city_tips enable row level security;
revoke all on public.city_tips from anon, authenticated;

-- Tips about one place, yours first then newest. Sodalis+ members can narrow
-- them to one category and search the place and words; for everyone else
-- those two are ignored.
create function public.city_tips(p_city_id integer, p_category text default null, p_query text default null)
returns table (
  id           bigint,
  author_id    uuid,
  author       text,
  category     text,
  place        text,
  body         text,
  rating       smallint,
  created_at   timestamptz,
  mine         boolean,
  went_on_trip boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id, public.has_plus(auth.uid()) as plus)
  select t.id, t.profile_id, p.display_name, t.category, t.place, t.body, t.rating, t.created_at, t.profile_id = me.id,
         exists (select 1 from public.trips tr where tr.owner_id = t.profile_id and tr.city_id = t.city_id and tr.start_date <= current_date)
  from public.city_tips t
  join public.profiles p on p.id = t.profile_id
  cross join me
  where me.id is not null
    and t.city_id = p_city_id
    and p.status = 'active'
    and not public.is_blocked(me.id, t.profile_id)
    and (not me.plus or p_category is null or t.category = p_category)
    and (not me.plus or nullif(btrim(p_query), '') is null
         or t.place ilike '%' || btrim(p_query) || '%' or t.body ilike '%' || btrim(p_query) || '%')
  order by t.profile_id = me.id desc, t.created_at desc
  limit 200
$$;

-- Share a tip about a place you've been to (or live in).
create function public.add_city_tip(p_city_id integer, p_category text, p_place text, p_body text default null, p_rating smallint default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Please sign in again' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and status <> 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  if not exists (select 1 from public.trips where owner_id = auth.uid() and city_id = p_city_id and start_date <= current_date)
     and not exists (select 1 from public.profiles where id = auth.uid() and home_city_id = p_city_id) then
    raise exception 'You can share tips once your trip there has started' using errcode = 'check_violation';
  end if;
  if btrim(coalesce(p_place, '')) = '' then
    raise exception 'Please name the place' using errcode = 'check_violation';
  end if;
  if char_length(btrim(p_place)) > private.rule('tips.placeMax') then
    raise exception 'Please keep the place name shorter' using errcode = 'check_violation';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) > private.rule('tips.textMax') then
    raise exception 'Please keep your tip shorter' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.city_tips where profile_id = auth.uid() and city_id = p_city_id) >= private.rule('tips.perCityMax') then
    raise exception 'You''ve shared as many tips about this place as we allow' using errcode = 'check_violation';
  end if;
  insert into public.city_tips (profile_id, city_id, category, place, body, rating)
  values (auth.uid(), p_city_id, p_category, btrim(p_place), nullif(btrim(p_body), ''), p_rating)
  returning id into new_id;
  return new_id;
end;
$$;

create function public.delete_city_tip(p_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.city_tips where id = p_id and profile_id = auth.uid() $$;

revoke all on function public.city_tips(integer, text, text), public.add_city_tip(integer, text, text, text, smallint),
  public.delete_city_tip(bigint) from public, anon;
grant execute on function public.city_tips(integer, text, text), public.add_city_tip(integer, text, text, text, smallint),
  public.delete_city_tip(bigint) to authenticated;
