-- Interests: pick 5 to 8 instead of exactly 8 (round 7 testers found 8 a lot to start with, 21 Oct).
-- interests.min comes from app/rules.json (see the rules update just before this).

create or replace function public.set_my_interests(interest_ids smallint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  wanted smallint[] := array(select distinct unnest(interest_ids));
  low integer := private.rule('interests.min');
  pick integer := private.rule('interests.pick');
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if cardinality(wanted) not between low and pick
     or (select count(*) from public.interests where id = any (wanted)) <> cardinality(wanted) then
    raise exception 'Pick % to % interests', low, pick using errcode = 'check_violation';
  end if;
  delete from public.profile_interests where profile_id = me and interest_id <> all (wanted);
  insert into public.profile_interests (profile_id, interest_id)
    select me, unnest(wanted)
    on conflict do nothing;
end;
$$;

create or replace function public.finish_onboarding()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  done_at timestamptz;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  update public.profiles p
     set onboarded_at = coalesce(p.onboarded_at, now())
   where p.id = me
     and p.display_name is not null
     and p.birth_date is not null
     and p.gender is not null
     and p.home_city_id is not null
     and (select count(*) from public.profile_interests i where i.profile_id = me) >= private.rule('interests.min')
  returning p.onboarded_at into done_at;
  if done_at is null then
    raise exception 'Profile is not finished' using errcode = 'check_violation';
  end if;
  return done_at;
end;
$$;
