-- safety: "Did you meet?" (spec §6.10). Two days after a trip that a
-- connection was about has ended, both members are asked whether they met
-- and whether they'd travel together again. The answers are private: no
-- member can read them. Later they become a trust signal for ranking.

create table public.meet_feedback (
  id                  bigint generated always as identity primary key,
  from_id             uuid not null references public.profiles (id) on delete cascade,
  about_id            uuid not null references public.profiles (id) on delete cascade,
  trip_id             bigint references public.trips (id) on delete set null,
  connection_id       bigint references public.connections (id) on delete set null,
  met                 boolean not null,
  would_travel_again  boolean,
  created_at          timestamptz not null default now(),
  check (from_id <> about_id),
  check (met or would_travel_again is null)
);
create unique index meet_feedback_once_idx on public.meet_feedback (from_id, connection_id);
create index meet_feedback_about_idx on public.meet_feedback (about_id);
alter table public.meet_feedback enable row level security;
revoke all on public.meet_feedback from anon, authenticated;

-- Who to ask me about: connections still standing, about a trip that ended
-- 2 to 60 days ago, that I haven't answered yet.
create function public.meet_prompts()
returns table (connection_id bigint, profile_id uuid, display_name text, photo_path text, trip_city text, trip_end date)
language sql
stable
security definer
set search_path = ''
as $$
  select k.id, p.id, p.display_name, p.photo_path, ci.name, t.end_date
  from public.connections k
  join public.trips t on t.id = k.trip_id
  join public.cities ci on ci.id = t.city_id
  join public.profiles p on p.id = case when k.requester_id = auth.uid() then k.addressee_id else k.requester_id end
  where auth.uid() in (k.requester_id, k.addressee_id)
    and k.status = 'accepted'
    and t.end_date between current_date - 60 and current_date - 2
    and p.status = 'active'
    and not exists (select 1 from public.meet_feedback f where f.from_id = auth.uid() and f.connection_id = k.id)
  order by t.end_date desc
$$;

create function public.answer_meet(p_connection_id bigint, p_met boolean, p_again boolean default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.connections;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into k from public.connections c
  where c.id = p_connection_id and auth.uid() in (c.requester_id, c.addressee_id);
  if k.id is null then
    raise exception 'Connection not found' using errcode = 'P0002';
  end if;
  insert into public.meet_feedback (from_id, about_id, trip_id, connection_id, met, would_travel_again)
  values (auth.uid(),
          case when k.requester_id = auth.uid() then k.addressee_id else k.requester_id end,
          k.trip_id, k.id, p_met, case when p_met then p_again end)
  on conflict (from_id, connection_id) do update
    set met = excluded.met, would_travel_again = excluded.would_travel_again, created_at = now();
end;
$$;

revoke all on function public.meet_prompts() from public, anon;
revoke all on function public.answer_meet(bigint, boolean, boolean) from public, anon;
grant execute on function public.meet_prompts() to authenticated;
grant execute on function public.answer_meet(bigint, boolean, boolean) to authenticated;
