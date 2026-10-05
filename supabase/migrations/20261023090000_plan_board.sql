-- trip-planner: the shared plan board (spec §2 "Trip planner", task T23).
-- Every chat, one-to-one or group, has a board where members add ideas,
-- vote for them and tick them off. The trip planner (T21) will add its
-- suggestions here too, through plan_id. Members use the board only
-- through the functions below, and only while they can write in the chat.

create table public.plan_items (
  id               bigint generated always as identity primary key,
  conversation_id  bigint not null references public.conversations (id) on delete cascade,
  plan_id          bigint,  -- the planner's suggestion this came from (T21)
  title            text not null check (char_length(btrim(title)) between 1 and 120),
  day              smallint check (day between 1 and 91),
  source_url       text check (source_url ~ '^https://' and char_length(source_url) <= 500),
  added_by         uuid references public.profiles (id) on delete set null,
  done             boolean not null default false,
  done_by          uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index plan_items_conversation_idx on public.plan_items (conversation_id);

create table public.plan_votes (
  item_id     bigint not null references public.plan_items (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (item_id, profile_id)
);

alter table public.plan_items enable row level security;
alter table public.plan_votes enable row level security;
revoke all on public.plan_items, public.plan_votes from anon, authenticated;

-- The board for a chat: ideas to do first (most votes, then by day), then done.
create function public.plan_board(p_conversation_id bigint)
returns table (
  id          bigint,
  title       text,
  day         smallint,
  source_url  text,
  added_by    text,
  mine        boolean,
  votes       integer,
  i_voted     boolean,
  done        boolean,
  created_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.title, i.day, i.source_url, p.display_name, i.added_by = auth.uid(),
         (select count(*)::int from public.plan_votes v where v.item_id = i.id),
         exists (select 1 from public.plan_votes v where v.item_id = i.id and v.profile_id = auth.uid()),
         i.done, i.created_at
  from public.plan_items i
  left join public.profiles p on p.id = i.added_by
  where i.conversation_id = p_conversation_id
    and public.in_conversation(p_conversation_id)
  order by i.done, 7 desc, i.day nulls last, i.id
$$;

-- The chat an item belongs to, if I can write in it right now.
create function public.plan_item_conversation(p_item bigint)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  conv bigint;
begin
  select conversation_id into conv from public.plan_items where id = p_item;
  if conv is null or not public.in_conversation(conv) then
    raise exception 'Idea not found' using errcode = 'P0002';
  end if;
  if not public.can_message(conv) then
    raise exception 'This conversation has ended' using errcode = 'check_violation';
  end if;
  return conv;
end;
$$;
revoke all on function public.plan_item_conversation(bigint) from public, anon, authenticated;

create function public.add_plan_item(p_conversation_id bigint, p_title text, p_day smallint default null, p_url text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if not public.in_conversation(p_conversation_id) then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
  if not public.can_message(p_conversation_id) then
    raise exception 'This conversation has ended' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and status <> 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  if (select count(*) from public.plan_items where conversation_id = p_conversation_id) >= 100 then
    raise exception 'The plan board is full' using errcode = 'check_violation';
  end if;
  insert into public.plan_items (conversation_id, title, day, source_url, added_by)
  values (p_conversation_id, btrim(p_title), p_day, nullif(btrim(p_url), ''), auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

-- Vote for an idea, or take the vote back.
create function public.toggle_plan_vote(p_item bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.plan_item_conversation(p_item);
  if exists (select 1 from public.plan_votes where item_id = p_item and profile_id = auth.uid()) then
    delete from public.plan_votes where item_id = p_item and profile_id = auth.uid();
  else
    insert into public.plan_votes (item_id, profile_id) values (p_item, auth.uid());
  end if;
end;
$$;

create function public.set_plan_item_done(p_item bigint, p_done boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.plan_item_conversation(p_item);
  update public.plan_items
     set done = p_done, done_by = case when p_done then auth.uid() end
   where id = p_item;
end;
$$;

-- Only the person who added an idea can remove it.
create function public.delete_plan_item(p_item bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.plan_item_conversation(p_item);
  delete from public.plan_items where id = p_item and added_by = auth.uid();
  if not found then
    raise exception 'Only the person who added this can remove it' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.plan_board(bigint) from public, anon;
revoke all on function public.add_plan_item(bigint, text, smallint, text) from public, anon;
revoke all on function public.toggle_plan_vote(bigint) from public, anon;
revoke all on function public.set_plan_item_done(bigint, boolean) from public, anon;
revoke all on function public.delete_plan_item(bigint) from public, anon;
grant execute on function public.plan_board(bigint) to authenticated;
grant execute on function public.add_plan_item(bigint, text, smallint, text) to authenticated;
grant execute on function public.toggle_plan_vote(bigint) to authenticated;
grant execute on function public.set_plan_item_done(bigint, boolean) to authenticated;
grant execute on function public.delete_plan_item(bigint) to authenticated;
