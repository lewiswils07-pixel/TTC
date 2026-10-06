-- Task T17 (last part): the trusted-contact link. Before meeting someone, a
-- member can send a private link to a friend or relative. It shows who
-- they're meeting, where and when, and whether they've checked in as back
-- safe. No email is needed: the member sends the link from their own phone.
--
-- Security:
--   - The link holds a random 32-character code (192 bits), so it can't be
--     guessed. Anyone with the link can view it, so it shows as little as
--     possible: first names, ages, home towns, member numbers, the place
--     and time. Never an email address, photo, exact birthday or messages.
--   - It stops working when the member stops sharing, or two days after
--     the meeting. Deleting the account removes it too.
--   - Members can only read their own shares; every change goes through
--     the functions below, which check who is asking.
--   - Who they're meeting is saved when the link is made, so the contact
--     still sees it if the other person later blocks them or leaves.

create table public.meetup_shares (
  id               bigint generated always as identity primary key,
  token            text not null unique
                   default translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  conversation_id  bigint references public.conversations (id) on delete set null,
  meeting_with     jsonb not null,
  place            text not null check (char_length(btrim(place)) between 2 and 120),
  meet_at          timestamptz not null,
  note             text check (char_length(note) <= 300),
  checked_in_at    timestamptz,
  stopped_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index meetup_shares_owner_idx on public.meetup_shares (owner_id, meet_at desc);

alter table public.meetup_shares enable row level security;
create policy "Members read their own shares" on public.meetup_shares
  for select to authenticated using (owner_id = auth.uid());
revoke all on public.meetup_shares from anon, authenticated;
grant select on public.meetup_shares to authenticated;

-- How long a link keeps working after the meeting.
create function public.meetup_share_ends(s public.meetup_shares)
returns timestamptz
language sql
immutable
set search_path = ''
as $$ select s.meet_at + interval '2 days' $$;
revoke all on function public.meetup_share_ends(public.meetup_shares) from public, anon;

-- ------------------------------------------------------------ make a link
create function public.create_meetup_share(p_conversation_id bigint, p_place text, p_meet_at timestamptz, p_note text default null)
returns public.meetup_shares
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  who jsonb;
  made public.meetup_shares;
begin
  if me is null then
    raise exception 'Please sign in again' using errcode = '42501';
  end if;
  if not public.in_conversation(p_conversation_id) then
    raise exception 'You can only share a meet-up from one of your chats' using errcode = '42501';
  end if;
  if p_meet_at is null or p_meet_at < now() - interval '12 hours' or p_meet_at > now() + interval '1 year' then
    raise exception 'Please pick when you’re meeting' using errcode = 'check_violation';
  end if;
  if char_length(btrim(coalesce(p_place, ''))) < 2 then
    raise exception 'Please say where you’re meeting' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.meetup_shares s
      where s.owner_id = me and s.stopped_at is null and public.meetup_share_ends(s) > now()) >= 10 then
    raise exception 'You have 10 links open. Stop one you no longer need first.' using errcode = 'check_violation';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', p.display_name,
           'age', public.member_age(p),
           'home', c.name,
           'member_number', p.member_number) order by p.display_name), '[]')
    into who
  from public.conversation_members cm
  join public.profiles p on p.id = cm.profile_id
  left join public.cities c on c.id = p.home_city_id
  where cm.conversation_id = p_conversation_id and cm.profile_id <> me;

  insert into public.meetup_shares (owner_id, conversation_id, meeting_with, place, meet_at, note)
  values (me, p_conversation_id, who, btrim(p_place), p_meet_at, nullif(btrim(coalesce(p_note, '')), ''))
  returning * into made;
  return made;
end;
$$;

-- ----------------------------------------------- check in, or stop sharing
create function public.check_in_meetup_share(p_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.meetup_shares set checked_in_at = coalesce(checked_in_at, now())
  where id = p_id and owner_id = auth.uid()
$$;

create function public.stop_meetup_share(p_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.meetup_shares set stopped_at = coalesce(stopped_at, now())
  where id = p_id and owner_id = auth.uid()
$$;

-- -------------------------------------------- what the trusted contact sees
-- Open to anyone holding the link (no sign-in). Returns nothing for a code
-- that is wrong, stopped or out of date, without saying which.
create function public.view_meetup_share(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'member', o.display_name,
    'meeting_with', s.meeting_with,
    'place', s.place,
    'meet_at', s.meet_at,
    'note', s.note,
    'checked_in_at', s.checked_in_at,
    'ends_at', public.meetup_share_ends(s))
  from public.meetup_shares s
  join public.profiles o on o.id = s.owner_id
  where char_length(p_token) = 32
    and s.token = p_token
    and s.stopped_at is null
    and public.meetup_share_ends(s) > now()
$$;

revoke all on function public.create_meetup_share(bigint, text, timestamptz, text) from public, anon;
revoke all on function public.check_in_meetup_share(bigint) from public, anon;
revoke all on function public.stop_meetup_share(bigint) from public, anon;
revoke all on function public.view_meetup_share(text) from public;
grant execute on function public.create_meetup_share(bigint, text, timestamptz, text) to authenticated;
grant execute on function public.check_in_meetup_share(bigint) to authenticated;
grant execute on function public.stop_meetup_share(bigint) to authenticated;
grant execute on function public.view_meetup_share(text) to anon, authenticated;

-- The data download includes the links a member has shared.
create or replace function public.my_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at) from auth.users u where u.id = auth.uid()),
    'profile', (select to_jsonb(p) - 'role' from public.profiles p where p.id = auth.uid()),
    'preferences', (select to_jsonb(x) from public.preferences x where x.profile_id = auth.uid()),
    'interests', (select coalesce(jsonb_agg(i.label order by i.label), '[]') from public.profile_interests pi join public.interests i on i.id = pi.interest_id where pi.profile_id = auth.uid()),
    'trips', (select coalesce(jsonb_agg(to_jsonb(t) || jsonb_build_object('city', c.name) order by t.start_date), '[]') from public.trips t join public.cities c on c.id = t.city_id where t.owner_id = auth.uid()),
    'wishlist', (select coalesce(jsonb_agg(c.name order by c.name), '[]') from public.wishlist w join public.cities c on c.id = w.city_id where w.profile_id = auth.uid()),
    'connections', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'with', o.display_name, 'you_asked', x.requester_id = auth.uid(), 'status', x.status, 'note', x.note,
        'created_at', x.created_at, 'responded_at', x.responded_at) order by x.created_at), '[]')
      from public.connections x
      join public.profiles o on o.id = case when x.requester_id = auth.uid() then x.addressee_id else x.requester_id end
      where auth.uid() in (x.requester_id, x.addressee_id)
    ),
    'messages_you_sent', (select coalesce(jsonb_agg(jsonb_build_object('conversation', m.conversation_id, 'body', m.body, 'sent_at', m.created_at) order by m.created_at), '[]') from public.messages m where m.sender_id = auth.uid()),
    'groups', (select coalesce(jsonb_agg(jsonb_build_object('name', g.name, 'role', gm.role, 'status', gm.status, 'start', g.start_date, 'end', g.end_date)), '[]') from public.group_members gm join public.groups g on g.id = gm.group_id where gm.profile_id = auth.uid()),
    'plan_ideas_you_added', (select coalesce(jsonb_agg(jsonb_build_object('title', pi.title, 'link', pi.source_url, 'added_at', pi.created_at)), '[]') from public.plan_items pi where pi.added_by = auth.uid()),
    'people_you_blocked', (select coalesce(jsonb_agg(o.display_name), '[]') from public.blocks b join public.profiles o on o.id = b.blocked_id where b.blocker_id = auth.uid()),
    'reports_you_made', (select coalesce(jsonb_agg(jsonb_build_object('reason', r.reason, 'details', r.details, 'status', r.status, 'created_at', r.created_at)), '[]') from public.reports r where r.reporter_id = auth.uid()),
    'did_you_meet_answers', (select coalesce(jsonb_agg(jsonb_build_object('met', f.met, 'would_travel_again', f.would_travel_again, 'created_at', f.created_at)), '[]') from public.meet_feedback f where f.from_id = auth.uid()),
    'recommend_scores', (select coalesce(jsonb_agg(jsonb_build_object('score', n.score, 'comment', n.comment, 'created_at', n.created_at)), '[]') from public.nps_responses n where n.profile_id = auth.uid()),
    'plan', (select coalesce(jsonb_agg(jsonb_build_object('plan', e.plan, 'source', e.source, 'expires_at', e.expires_at)), '[]') from public.entitlements e where e.profile_id = auth.uid()),
    'meetup_links_you_shared', (select coalesce(jsonb_agg(jsonb_build_object('place', s.place, 'meet_at', s.meet_at, 'note', s.note, 'meeting_with', s.meeting_with, 'checked_in_at', s.checked_in_at, 'stopped_at', s.stopped_at, 'created_at', s.created_at) order by s.created_at), '[]') from public.meetup_shares s where s.owner_id = auth.uid()),
    'days_you_opened_the_app', (select count(*) from public.member_days d where d.profile_id = auth.uid())
  )
$$;
