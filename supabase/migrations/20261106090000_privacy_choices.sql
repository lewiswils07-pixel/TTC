-- "We value your privacy" (Lewis, 6 Oct): each member's choices about
-- optional tools, asked once after sign-up and changeable in Settings. Tools
-- that are strictly needed to run the app are always on and aren't stored.
create table public.privacy_choices (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  -- Measuring how many people use the app and how.
  measuring   boolean not null default false,
  -- Personalised ads and our own marketing.
  marketing   boolean not null default false,
  chosen_at   timestamptz not null default now()
);
alter table public.privacy_choices enable row level security;
create policy "Members see their own privacy choices" on public.privacy_choices
  for select to authenticated using (profile_id = auth.uid());
revoke all on public.privacy_choices from anon;
grant select on public.privacy_choices to authenticated;

-- Saves the signed-in member's choices, with the time they made them.
create function public.set_privacy_choices(p_measuring boolean, p_marketing boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.privacy_choices (profile_id, measuring, marketing, chosen_at)
  select auth.uid(), coalesce(p_measuring, false), coalesce(p_marketing, false), now()
  where auth.uid() is not null
  on conflict (profile_id) do update
    set measuring = excluded.measuring, marketing = excluded.marketing, chosen_at = excluded.chosen_at;
$$;
revoke all on function public.set_privacy_choices(boolean, boolean) from public, anon;
grant execute on function public.set_privacy_choices(boolean, boolean) to authenticated;

-- "Download my data" also includes the saved location and these choices.
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
    'days_you_opened_the_app', (select count(*) from public.member_days d where d.profile_id = auth.uid()),
    'your_location', (select jsonb_build_object('lat', l.lat, 'lng', l.lng, 'updated_at', l.updated_at) from public.member_locations l where l.profile_id = auth.uid()),
    'privacy_choices', (select jsonb_build_object('measuring', c.measuring, 'marketing', c.marketing, 'chosen_at', c.chosen_at) from public.privacy_choices c where c.profile_id = auth.uid())
  )
$$;
