-- A connection's full profile: once two members have both said yes (or are
-- in the same group), each can look back at the other's photo, interests,
-- how they travel and the back of their card. Members who aren't connected
-- still see only the suggestion card.

create function public.member_profile(p_profile uuid)
returns table (
  profile_id       uuid,
  display_name     text,
  birth_year       smallint,
  home_city        text,
  home_country     text,
  photo_path       text,
  bio              text,
  travel_style     text,
  pace             text,
  budget           text,
  room_sharing     text,
  day_rhythm       text,
  walking          text,
  languages        text[],
  travelling_with  text,
  interests        jsonb,
  card_answers     jsonb,
  connected_at     timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select id from public.profiles where id = auth.uid() and status = 'active'
  ),
  link as (
    select max(coalesce(c.responded_at, c.created_at)) as since
      from public.connections c, me
     where c.status = 'accepted'
       and ((c.requester_id = me.id and c.addressee_id = p_profile)
         or (c.addressee_id = me.id and c.requester_id = p_profile))
  )
  select p.id, p.display_name, p.birth_year, hc.name, hc.country_code::text, p.photo_path, p.bio,
         p.travel_style, p.pace, p.budget, p.room_sharing, p.day_rhythm, p.walking, p.languages,
         p.travelling_with,
         coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'label', i.label) order by i.sort)
                     from public.profile_interests pi join public.interests i on i.id = pi.interest_id
                    where pi.profile_id = p.id), '[]'::jsonb),
         p.card_answers,
         (select since from link)
    from public.profiles p
    join me on true
    left join public.cities hc on hc.id = p.home_city_id
   where p.id = p_profile
     and p.status = 'active'
     and p.onboarded_at is not null
     and not public.is_blocked(me.id, p.id)
     and (exists (select 1 from link where since is not null)
          or exists (select 1
                       from public.group_members a
                       join public.group_members b on b.group_id = a.group_id
                      where a.profile_id = me.id and a.status = 'joined'
                        and b.profile_id = p.id and b.status = 'joined'))
$$;

revoke all on function public.member_profile(uuid) from public, anon;
grant execute on function public.member_profile(uuid) to authenticated;
