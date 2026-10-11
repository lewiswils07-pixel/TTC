-- Lewis's 11 Oct list:
--   * More about you: sexuality, religion and ethnicity, each optional and
--     hidden unless the member chooses to show it on their profile.
--   * Holiday preferences: short chip questions (where I stay, packing,
--     evenings…). They replace the planning question, aren't used for
--     matching, and seeing other people's is a Sodalis+ feature.
--   * A photo book: up to 6 more photos, of the member or their trips.
--   * Interests kept to holidays: hobbies that aren't about travel go.
-- The answer lists match app/rules.json (`choices`); rules.test.sql checks.

-- 1 ----------------------------------------------------------------------
alter table public.profiles
  add column sexuality text constraint profiles_sexuality_check
    check (sexuality = any (array['straight', 'gay', 'lesbian', 'bisexual', 'pansexual', 'asexual', 'demisexual', 'queer', 'questioning', 'another'])),
  add column religion text constraint profiles_religion_check
    check (religion = any (array['agnostic', 'atheist', 'buddhist', 'catholic', 'christian', 'hindu', 'jewish', 'muslim', 'sikh', 'spiritual', 'another'])),
  add column ethnicity text constraint profiles_ethnicity_check
    check (ethnicity = any (array['black', 'east_asian', 'hispanic', 'middle_eastern', 'mixed', 'pacific_islander', 'south_asian', 'southeast_asian', 'white', 'another'])),
  -- Which of the three the member shows on their profile. Hidden unless chosen.
  add column shown_fields text[] not null default '{}' constraint profiles_shown_fields_check
    check (shown_fields <@ array['sexuality', 'religion', 'ethnicity']),
  add column holiday_prefs jsonb not null default '{}'::jsonb,
  add column photo_book text[] not null default '{}';

/** Holiday preferences: {"question": "answer"}, one answer per question, from the lists in rules.json. */
create function public.valid_holiday_prefs(prefs jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(prefs) = 'object'
     and not exists (
       select 1 from jsonb_each(prefs) e
        where jsonb_typeof(e.value) <> 'string'
           or not coalesce((e.value #>> '{}') = any (case e.key
                when 'planning' then array['planner', 'mix', 'spontaneous']
                when 'stay' then array['hotel', 'apartment', 'bnb', 'resort', 'hostel', 'camping']
                when 'transport' then array['fly', 'train', 'drive', 'ferry', 'coach']
                when 'length' then array['weekend', 'week', 'fortnight', 'longer']
                when 'season' then array['spring', 'summer', 'autumn', 'winter', 'any']
                when 'packing' then array['light', 'case', 'everything']
                when 'evenings' then array['early', 'dinner', 'late']
                when 'drinking' then array['none', 'sometimes', 'socially', 'often']
                when 'smoking' then array['no', 'social', 'yes']
                when 'photos' then array['lots', 'few', 'rarely']
              end), false))
$$;

/** Up to 6 photo book photos, each in the member's own folder, none twice. */
create function public.valid_photo_book(owner uuid, book text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(book) <= 6
     and not exists (select 1 from unnest(book) b where b is null or b not like owner::text || '/%')
     and (select count(distinct b) from unnest(book) b) = cardinality(book)
$$;

alter table public.profiles
  add constraint profiles_holiday_prefs_check check (public.valid_holiday_prefs(holiday_prefs)),
  add constraint profiles_photo_book_check check (public.valid_photo_book(id, photo_book));

grant update (sexuality, religion, ethnicity, shown_fields, holiday_prefs, photo_book) on public.profiles to authenticated;

-- Photo book photos can be seen by the same members as the main photo.
create or replace function public.is_current_profile_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where (p.photo_path = object_name or object_name = any (p.photo_book))
      and p.status = 'active' and p.onboarded_at is not null
      and (p.id = auth.uid()
           or (exists (select 1 from public.profiles v where v.id = auth.uid() and v.status = 'active')
               and not (p.id = any ('{}'::uuid[] || public.blocked_with(auth.uid())))))
  )
$$;

-- 2 ----------------------------------------------------------------------
-- The extras on someone's card and profile, for the members who can see
-- their card. Holiday preferences only for members on Sodalis+ (or your
-- own); `holiday_locked` says there are some to see with Sodalis+.
create function public.member_extras(p_profile uuid)
returns table (photo_book text[], holiday_prefs jsonb, holiday_locked boolean, sexuality text, religion text, ethnicity text)
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
         case when p.id = me.id or 'ethnicity' = any (p.shown_fields) then p.ethnicity end
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

-- 3 ----------------------------------------------------------------------
-- Interests are about holidays (Lewis, 11 Oct). Hobbies that aren't go;
-- members who picked them simply have fewer picks until they add more.
delete from public.profile_interests
 where interest_id in (select id from public.interests
                        where slug in ('knitting', 'gaming', 'crafts', 'writing', 'fitness', 'running', 'choir', 'music-making', 'fashion'));
delete from public.interests
 where slug in ('knitting', 'gaming', 'crafts', 'writing', 'fitness', 'running', 'choir', 'music-making', 'fashion');
update public.interests set category_label = 'Active' where category = 'sport';
update public.interests set category_label = 'Kinds of trip' where category = 'trips';
update public.interests set category_label = 'Pastimes' where category = 'hobbies';
