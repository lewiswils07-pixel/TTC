-- The back of a member's card: answers to 3 questions the member picks
-- from the app's list (such as "Describe your perfect holiday"). Each answer
-- is kept short so all three fit on the card. Members write their own;
-- other members read them through member_card(), which applies the same
-- rules as suggestions (both active, no block either way).

alter table public.profiles add column card_answers jsonb not null default '[]'::jsonb;

/** Up to 3 answers, each {"q": question key, "a": up to 30 words and 200 characters}, no question twice. */
create function public.valid_card_answers(answers jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(answers) = 'array'
     and jsonb_array_length(answers) <= 3
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

grant update (card_answers) on public.profiles to authenticated;

/** The back of another member's card, for people the caller could be suggested. */
create function public.member_card(p_profile uuid)
returns table (card_answers jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select p.card_answers
    from public.profiles p
    join public.profiles me on me.id = auth.uid()
   where p.id = p_profile
     and me.status = 'active'
     and (p.id = me.id
          or (p.status = 'active'
              and p.onboarded_at is not null
              and not public.is_blocked(me.id, p.id)))
$$;

revoke all on function public.member_card(uuid) from public, anon;
grant execute on function public.member_card(uuid) to authenticated;
