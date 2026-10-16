-- Part 26 (Lewis, 16 Oct): a one-line "about me" on each member's card, and
-- some interests younger travellers asked for (testers, 15 Oct).

-- 1 ----------------------------------------------------------------------
-- "Me in one line", shown under the name on Who's going. Optional.
alter table public.profiles add column headline text check (char_length(headline) <= 80);
grant update (headline) on public.profiles to authenticated;

-- member_extras also returns it (the card already asks for the extras).
drop function public.member_extras(uuid);
create function public.member_extras(p_profile uuid)
returns table (
  photo_book text[], holiday_prefs jsonb, holiday_locked boolean, sexuality text, religion text, ethnicity text,
  moving text, travel_often text, booking text, group_size text, drinking text, smoking text, room_sharing text,
  headline text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.photo_book,
         case when p.id = me.id or public.has_plus(me.id) then p.holiday_prefs end,
         p.id <> me.id and not public.has_plus(me.id) and p.holiday_prefs <> '{}'::jsonb,
         case when p.id = me.id or 'sexuality' = any (p.shown_fields) then p.sexuality end,
         case when p.id = me.id or 'religion' = any (p.shown_fields) then p.religion end,
         case when p.id = me.id or 'ethnicity' = any (p.shown_fields) then p.ethnicity end,
         p.moving, p.travel_often, p.booking, p.group_size, p.drinking, p.smoking, p.room_sharing,
         p.headline
    from public.profiles p
    join public.profiles me on me.id = auth.uid()
   where p.id = p_profile
     and me.status = 'active'
     and (p.id = me.id
          or (p.status = 'active'
              and p.onboarded_at is not null
              and not public.is_blocked(me.id, p.id)))
$$;
revoke all on function public.member_extras(uuid) from public, anon;
grant execute on function public.member_extras(uuid) to authenticated;

-- 2 ----------------------------------------------------------------------
-- Younger interests (Lewis, 16 Oct), each a single holiday idea.
insert into public.interests (id, slug, label, sort, category, category_label, category_sort) values
  (101, 'football',    'Football',    100, 'sport',  'Active',         5),
  (102, 'surfing',     'Surfing',     101, 'sport',  'Active',         5),
  (103, 'climbing',    'Climbing',    102, 'sport',  'Active',         5),
  (104, 'fitness',     'Fitness',     103, 'sport',  'Active',         5),
  (105, 'backpacking', 'Backpacking', 104, 'trips',  'Kinds of trip',  7),
  (106, 'theme-parks', 'Theme parks', 105, 'trips',  'Kinds of trip',  7),
  (107, 'brunch',      'Brunch',      106, 'food',   'Food and drink', 3),
  (108, 'beach-clubs', 'Beach clubs', 107, 'social', 'Social',         9)
on conflict (slug) do nothing;

-- 3 ----------------------------------------------------------------------
-- Two card questions instead of three, now there's the line above (Lewis,
-- 16 Oct). Members who answered three keep their first two.
alter table public.profiles drop constraint profiles_card_answers_check;
update public.profiles set card_answers = card_answers - 2 where jsonb_array_length(card_answers) > 2;

/** Up to 2 answers, each {"q": question key, "a": up to 30 words and 200 characters}, no question twice. */
create or replace function public.valid_card_answers(answers jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(answers) = 'array'
     and jsonb_array_length(answers) <= 2
     and not exists (
       select 1 from jsonb_array_elements(answers) e
        where jsonb_typeof(e) <> 'object'
           or not (e ? 'q' and e ? 'a')
           or (select count(*) from jsonb_object_keys(e)) <> 2
           or jsonb_typeof(e -> 'q') <> 'string'
           or jsonb_typeof(e -> 'a') <> 'string'
           or (e ->> 'q') !~ '^[a-z_]{2,40}$'
           or char_length(btrim(e ->> 'a')) not between 1 and 200
           or cardinality(regexp_split_to_array(btrim(e ->> 'a'), '\s+')) > 30
     )
     and (select count(distinct e ->> 'q') from jsonb_array_elements(answers) e) = jsonb_array_length(answers)
$$;

alter table public.profiles add constraint profiles_card_answers_check check (public.valid_card_answers(card_answers));

-- 4 ----------------------------------------------------------------------
-- What you share with someone who asked to connect (Lewis, 16 Oct): the
-- interests and wish-list places you both picked. Same rules as their card.
create function public.what_we_share(p_profile uuid)
returns table (interests text[], places text[])
language sql
stable
security definer
set search_path = ''
as $$
  select array(select i.label
                 from public.profile_interests a
                 join public.profile_interests b on b.interest_id = a.interest_id and b.profile_id = me.id
                 join public.interests i on i.id = a.interest_id
                where a.profile_id = p.id
                order by i.sort),
         array(select c.name
                 from public.wishlist a
                 join public.wishlist b on b.city_id = a.city_id and b.profile_id = me.id
                 join public.cities c on c.id = a.city_id
                where a.profile_id = p.id
                order by c.name)
    from public.profiles p
    join public.profiles me on me.id = auth.uid()
   where p.id = p_profile
     and p.id <> me.id
     and me.status = 'active'
     and p.status = 'active'
     and p.onboarded_at is not null
     and not public.is_blocked(me.id, p.id)
$$;
revoke all on function public.what_we_share(uuid) from public, anon;
grant execute on function public.what_we_share(uuid) to authenticated;
