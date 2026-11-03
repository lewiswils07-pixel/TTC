-- Pricing test (Part 29). While private.rule('pricingTest.on') is 1, every
-- other new member starts on the free plan instead of the founding months,
-- and is given one of three test prices. The Sodalis+ page shows that price
-- with a Join button. Nothing is charged: a tap is only counted, so we learn
-- whether members want Sodalis+, at which price, and from which screen.
-- The split comes from the member's id, so it is fixed and roughly even.

create table public.price_test (
  profile_id   uuid primary key references public.profiles (id) on delete cascade,
  price_pence  integer not null check (price_pence > 0),
  joined_at    timestamptz not null default now()
);

create table public.plus_interest (
  id           bigint generated always as identity primary key,
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  action       text not null check (action in ('view', 'join')),
  came_from    text check (char_length(came_from) <= 20),
  price_pence  integer not null,
  created_at   timestamptz not null default now()
);
create unique index plus_interest_one_join_idx on public.plus_interest (profile_id) where action = 'join';

-- Only the functions below touch these tables; Lewis reads them in the SQL editor.
alter table public.price_test enable row level security;
alter table public.plus_interest enable row level security;
revoke all on public.price_test, public.plus_interest from anon, authenticated;

-- 0 = founding months as usual, 1 to 3 = test price low, mid, high.
create function private.price_group(member uuid)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when get_byte(decode(md5(member::text), 'hex'), 0) % 2 = 1 then 0
              else (get_byte(decode(md5(member::text), 'hex'), 0) / 2) % 3 + 1 end
$$;

create or replace function public.profiles_welcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  test_group integer := case when private.rule('pricingTest.on') = 1 then private.price_group(new.id) else 0 end;
begin
  if old.onboarded_at is null and new.onboarded_at is not null then
    if new.member_number is null then
      new.member_number := nextval('public.member_number_seq');
    end if;
    if test_group = 0 then
      insert into public.entitlements (profile_id, plan, source, expires_at)
      values (new.id, 'plus', 'founding', now() + make_interval(months => private.rule('founding.plusMonths')))
      on conflict (profile_id) do nothing;
    else
      insert into public.price_test (profile_id, price_pence)
      values (new.id, private.rule(case test_group when 1 then 'pricingTest.lowPence' when 2 then 'pricingTest.midPence' else 'pricingTest.highPence' end))
      on conflict (profile_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- The signed-in member's test price, and whether they already tapped Join.
-- No row when they aren't in the test.
create function public.my_price_test()
returns table (price_pence integer, joined boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.price_pence, exists (select 1 from public.plus_interest i where i.profile_id = t.profile_id and i.action = 'join')
  from public.price_test t
  where t.profile_id = auth.uid()
$$;
revoke all on function public.my_price_test() from public, anon;
grant execute on function public.my_price_test() to authenticated;

-- Counts a visit to the Sodalis+ page, or a Join tap, for members in the test.
create function public.note_plus_interest(p_action text, p_from text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.plus_interest (profile_id, action, came_from, price_pence)
  select t.profile_id, p_action, left(nullif(p_from, ''), 20), t.price_pence
  from public.price_test t
  where t.profile_id = auth.uid()
  on conflict (profile_id) where action = 'join' do nothing
$$;
revoke all on function public.note_plus_interest(text, text) from public, anon;
grant execute on function public.note_plus_interest(text, text) to authenticated;
