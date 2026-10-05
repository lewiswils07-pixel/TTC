-- chat: one-to-one conversations (spec §2 "Chat", §3, §6.1). A conversation
-- opens when a connection request is accepted. Members read only the
-- conversations they are in, and can only send while the connection stands.
-- A block ends the connection, and the chat leaves both members' lists.
--
-- Not yet here: group chats (T20), the scam guard and reporting a
-- message (in 20261019090000_scam_guard.sql), new-account message limits and email nudges (T18).

create table public.conversations (
  id             bigint generated always as identity primary key,
  kind           text not null default 'direct' check (kind in ('direct', 'group')),
  connection_id  bigint unique references public.connections (id) on delete cascade,
  created_at     timestamptz not null default now(),
  check ((kind = 'direct') = (connection_id is not null))
);

create table public.conversation_members (
  conversation_id  bigint not null references public.conversations (id) on delete cascade,
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  last_read_at     timestamptz not null default clock_timestamp(),
  joined_at        timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
create index conversation_members_profile_idx on public.conversation_members (profile_id);

create table public.messages (
  id               bigint generated always as identity primary key,
  conversation_id  bigint not null references public.conversations (id) on delete cascade,
  sender_id        uuid not null references public.profiles (id) on delete cascade,
  body             text not null check (char_length(body) between 1 and 2000),
  flagged          boolean not null default false,
  -- clock time, so messages sent in one transaction still have an order
  created_at       timestamptz not null default clock_timestamp()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

-- Is the signed-in member in this conversation? (security definer, so the
-- policies below don't have to read conversation_members through its own policy.)
create function public.in_conversation(conv bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv and profile_id = auth.uid()
  )
$$;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy "Members read their conversations" on public.conversations
  for select to authenticated using (public.in_conversation(id));
create policy "Members see who is in their conversations" on public.conversation_members
  for select to authenticated using (public.in_conversation(conversation_id));
create policy "Members read messages in their conversations" on public.messages
  for select to authenticated using (public.in_conversation(conversation_id));

revoke all on public.conversations, public.conversation_members, public.messages from anon, authenticated;
grant select on public.conversations, public.conversation_members, public.messages to authenticated;

-- A conversation opens when a request is accepted.
create function public.open_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv bigint;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.conversations (kind, connection_id) values ('direct', new.id)
    on conflict (connection_id) do nothing
    returning id into conv;
    if conv is not null then
      insert into public.conversation_members (conversation_id, profile_id)
      values (conv, new.requester_id), (conv, new.addressee_id);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.open_conversation() from public, anon, authenticated;

create trigger connections_open_conversation
  after update of status on public.connections
  for each row execute function public.open_conversation();

-- Can the signed-in member send in this conversation right now?
create function public.can_message(conv bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.in_conversation(conv) and exists (
    select 1 from public.conversations c
    join public.connections k on k.id = c.connection_id
    where c.id = conv and k.status = 'accepted'
  )
$$;

create function public.send_message(p_conversation_id bigint, p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  body   text := btrim(p_body);
  new_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.in_conversation(p_conversation_id) then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
  if not public.can_message(p_conversation_id) then
    raise exception 'This conversation has ended' using errcode = 'check_violation';
  end if;
  if body is null or body = '' then
    raise exception 'Write a message first' using errcode = 'check_violation';
  end if;
  insert into public.messages (conversation_id, sender_id, body)
  values (p_conversation_id, auth.uid(), body)
  returning id into new_id;
  -- Sending counts as reading everything before it.
  update public.conversation_members set last_read_at = clock_timestamp()
   where conversation_id = p_conversation_id and profile_id = auth.uid();
  return new_id;
end;
$$;

create function public.mark_read(p_conversation_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.conversation_members set last_read_at = clock_timestamp()
   where conversation_id = p_conversation_id and profile_id = auth.uid()
$$;

-- My conversations, with the other person, the latest message and how many
-- I haven't read, most recent first.
create function public.my_conversations()
returns table (
  id            bigint,
  profile_id    uuid,
  display_name  text,
  birth_year    smallint,
  photo_path    text,
  last_body     text,
  last_at       timestamptz,
  last_mine     boolean,
  unread        integer,
  can_message   boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, p.id, p.display_name, p.birth_year, p.photo_path,
         last.body, coalesce(last.created_at, c.created_at), last.sender_id = auth.uid(),
         (select count(*)::int from public.messages m
           where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.created_at > me.last_read_at),
         k.status = 'accepted'
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  join public.connections k on k.id = c.connection_id
  join public.conversation_members them on them.conversation_id = c.id and them.profile_id <> me.profile_id
  join public.profiles p on p.id = them.profile_id
  left join lateral (
    select m.body, m.created_at, m.sender_id from public.messages m
    where m.conversation_id = c.id order by m.id desc limit 1
  ) last on true
  where me.profile_id = auth.uid()
    and p.status = 'active'
    and not public.is_blocked(auth.uid(), p.id)
  order by coalesce(last.created_at, c.created_at) desc
$$;

revoke all on function public.in_conversation(bigint) from public, anon;
revoke all on function public.can_message(bigint) from public, anon;
revoke all on function public.send_message(bigint, text) from public, anon;
revoke all on function public.mark_read(bigint) from public, anon;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.in_conversation(bigint) to authenticated;
grant execute on function public.can_message(bigint) to authenticated;
grant execute on function public.send_message(bigint, text) to authenticated;
grant execute on function public.mark_read(bigint) to authenticated;
grant execute on function public.my_conversations() to authenticated;

-- Live updates: the app listens for new messages (row-level security
-- still decides who receives each one).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
