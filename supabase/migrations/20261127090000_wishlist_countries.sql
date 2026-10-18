-- Part 27 (Lewis, 17 Oct): countries in "Places I'd love to go", as well as
-- towns and cities. A country you both want counts as a shared place, and so
-- does a city in a country the other member wants (Lisbon and Portugal).

-- 1 ----------------------------------------------------------------------
-- Country names, for cards and Download my data.
create table public.countries (
  code  char(2) primary key,
  name  text not null
);
alter table public.countries enable row level security;
create policy "Signed-in members can read countries" on public.countries for select to authenticated using (true);
revoke all on public.countries from anon, authenticated;
grant select on public.countries to authenticated;
insert into public.countries (code, name) values
('AD', 'Andorra'),
('AE', 'United Arab Emirates'),
('AF', 'Afghanistan'),
('AG', 'Antigua & Barbuda'),
('AI', 'Anguilla'),
('AL', 'Albania'),
('AM', 'Armenia'),
('AO', 'Angola'),
('AR', 'Argentina'),
('AS', 'American Samoa'),
('AT', 'Austria'),
('AU', 'Australia'),
('AW', 'Aruba'),
('AZ', 'Azerbaijan'),
('BA', 'Bosnia & Herzegovina'),
('BB', 'Barbados'),
('BD', 'Bangladesh'),
('BE', 'Belgium'),
('BF', 'Burkina Faso'),
('BG', 'Bulgaria'),
('BH', 'Bahrain'),
('BI', 'Burundi'),
('BJ', 'Benin'),
('BL', 'St Barthélemy'),
('BM', 'Bermuda'),
('BN', 'Brunei'),
('BO', 'Bolivia'),
('BQ', 'Caribbean Netherlands'),
('BR', 'Brazil'),
('BS', 'Bahamas'),
('BT', 'Bhutan'),
('BW', 'Botswana'),
('BY', 'Belarus'),
('BZ', 'Belize'),
('CA', 'Canada'),
('CC', 'Cocos (Keeling) Islands'),
('CD', 'Congo - Kinshasa'),
('CF', 'Central African Republic'),
('CG', 'Congo - Brazzaville'),
('CH', 'Switzerland'),
('CI', 'Côte d’Ivoire'),
('CK', 'Cook Islands'),
('CL', 'Chile'),
('CM', 'Cameroon'),
('CN', 'China'),
('CO', 'Colombia'),
('CR', 'Costa Rica'),
('CU', 'Cuba'),
('CV', 'Cape Verde'),
('CW', 'Curaçao'),
('CX', 'Christmas Island'),
('CY', 'Cyprus'),
('CZ', 'Czechia'),
('DE', 'Germany'),
('DJ', 'Djibouti'),
('DK', 'Denmark'),
('DM', 'Dominica'),
('DO', 'Dominican Republic'),
('DZ', 'Algeria'),
('EC', 'Ecuador'),
('EE', 'Estonia'),
('EG', 'Egypt'),
('EH', 'Western Sahara'),
('ER', 'Eritrea'),
('ES', 'Spain'),
('ET', 'Ethiopia'),
('FI', 'Finland'),
('FJ', 'Fiji'),
('FK', 'Falkland Islands'),
('FM', 'Micronesia'),
('FR', 'France'),
('GA', 'Gabon'),
('GB', 'United Kingdom'),
('GD', 'Grenada'),
('GE', 'Georgia'),
('GF', 'French Guiana'),
('GG', 'Guernsey'),
('GH', 'Ghana'),
('GI', 'Gibraltar'),
('GL', 'Greenland'),
('GM', 'Gambia'),
('GN', 'Guinea'),
('GP', 'Guadeloupe'),
('GQ', 'Equatorial Guinea'),
('GR', 'Greece'),
('GS', 'South Georgia & South Sandwich Islands'),
('GT', 'Guatemala'),
('GU', 'Guam'),
('GW', 'Guinea-Bissau'),
('GY', 'Guyana'),
('HK', 'Hong Kong SAR China'),
('HN', 'Honduras'),
('HR', 'Croatia'),
('HT', 'Haiti'),
('HU', 'Hungary'),
('ID', 'Indonesia'),
('IE', 'Ireland'),
('IL', 'Israel'),
('IM', 'Isle of Man'),
('IN', 'India'),
('IQ', 'Iraq'),
('IR', 'Iran'),
('IS', 'Iceland'),
('IT', 'Italy'),
('JE', 'Jersey'),
('JM', 'Jamaica'),
('JO', 'Jordan'),
('JP', 'Japan'),
('KE', 'Kenya'),
('KG', 'Kyrgyzstan'),
('KH', 'Cambodia'),
('KI', 'Kiribati'),
('KM', 'Comoros'),
('KN', 'St Kitts & Nevis'),
('KP', 'North Korea'),
('KR', 'South Korea'),
('KW', 'Kuwait'),
('KY', 'Cayman Islands'),
('KZ', 'Kazakhstan'),
('LA', 'Laos'),
('LB', 'Lebanon'),
('LC', 'St Lucia'),
('LK', 'Sri Lanka'),
('LR', 'Liberia'),
('LS', 'Lesotho'),
('LT', 'Lithuania'),
('LU', 'Luxembourg'),
('LV', 'Latvia'),
('LY', 'Libya'),
('MA', 'Morocco'),
('MC', 'Monaco'),
('MD', 'Moldova'),
('ME', 'Montenegro'),
('MF', 'St Martin'),
('MG', 'Madagascar'),
('MH', 'Marshall Islands'),
('MK', 'North Macedonia'),
('ML', 'Mali'),
('MM', 'Myanmar (Burma)'),
('MN', 'Mongolia'),
('MO', 'Macao SAR China'),
('MP', 'Northern Mariana Islands'),
('MQ', 'Martinique'),
('MR', 'Mauritania'),
('MS', 'Montserrat'),
('MT', 'Malta'),
('MU', 'Mauritius'),
('MV', 'Maldives'),
('MW', 'Malawi'),
('MX', 'Mexico'),
('MY', 'Malaysia'),
('MZ', 'Mozambique'),
('NA', 'Namibia'),
('NC', 'New Caledonia'),
('NE', 'Niger'),
('NF', 'Norfolk Island'),
('NG', 'Nigeria'),
('NI', 'Nicaragua'),
('NL', 'Netherlands'),
('NO', 'Norway'),
('NP', 'Nepal'),
('NR', 'Nauru'),
('NU', 'Niue'),
('NZ', 'New Zealand'),
('OM', 'Oman'),
('PA', 'Panama'),
('PE', 'Peru'),
('PF', 'French Polynesia'),
('PG', 'Papua New Guinea'),
('PH', 'Philippines'),
('PK', 'Pakistan'),
('PL', 'Poland'),
('PM', 'St Pierre & Miquelon'),
('PN', 'Pitcairn Islands'),
('PR', 'Puerto Rico'),
('PS', 'Palestinian Territories'),
('PT', 'Portugal'),
('PW', 'Palau'),
('PY', 'Paraguay'),
('QA', 'Qatar'),
('RE', 'Réunion'),
('RO', 'Romania'),
('RS', 'Serbia'),
('RU', 'Russia'),
('RW', 'Rwanda'),
('SA', 'Saudi Arabia'),
('SB', 'Solomon Islands'),
('SC', 'Seychelles'),
('SD', 'Sudan'),
('SE', 'Sweden'),
('SG', 'Singapore'),
('SH', 'St Helena'),
('SI', 'Slovenia'),
('SK', 'Slovakia'),
('SL', 'Sierra Leone'),
('SN', 'Senegal'),
('SO', 'Somalia'),
('SR', 'Suriname'),
('SS', 'South Sudan'),
('ST', 'São Tomé & Príncipe'),
('SV', 'El Salvador'),
('SX', 'Sint Maarten'),
('SY', 'Syria'),
('SZ', 'Eswatini'),
('TC', 'Turks & Caicos Islands'),
('TD', 'Chad'),
('TF', 'French Southern Territories'),
('TG', 'Togo'),
('TH', 'Thailand'),
('TJ', 'Tajikistan'),
('TL', 'Timor-Leste'),
('TM', 'Turkmenistan'),
('TN', 'Tunisia'),
('TO', 'Tonga'),
('TR', 'Türkiye'),
('TT', 'Trinidad & Tobago'),
('TV', 'Tuvalu'),
('TW', 'Taiwan'),
('TZ', 'Tanzania'),
('UA', 'Ukraine'),
('UG', 'Uganda'),
('US', 'United States'),
('UY', 'Uruguay'),
('UZ', 'Uzbekistan'),
('VC', 'St Vincent & the Grenadines'),
('VE', 'Venezuela'),
('VG', 'British Virgin Islands'),
('VI', 'US Virgin Islands'),
('VN', 'Vietnam'),
('VU', 'Vanuatu'),
('WF', 'Wallis & Futuna'),
('WS', 'Samoa'),
('XK', 'Kosovo'),
('YE', 'Yemen'),
('YT', 'Mayotte'),
('ZA', 'South Africa'),
('ZM', 'Zambia'),
('ZW', 'Zimbabwe');

-- 2 ----------------------------------------------------------------------
create table public.wishlist_countries (
  profile_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  country_code  char(2) not null references public.countries (code),
  created_at    timestamptz not null default now(),
  primary key (profile_id, country_code)
);
create index wishlist_countries_code_idx on public.wishlist_countries (country_code);

alter table public.wishlist_countries enable row level security;
create policy "Members read their own countries" on public.wishlist_countries
  for select to authenticated using ((select auth.uid()) = profile_id);
create policy "Members add their own countries" on public.wishlist_countries
  for insert to authenticated with check ((select auth.uid()) = profile_id);
create policy "Members remove their own countries" on public.wishlist_countries
  for delete to authenticated using ((select auth.uid()) = profile_id);
revoke all on public.wishlist_countries from anon, authenticated;
grant select, delete on public.wishlist_countries to authenticated;
grant insert (country_code) on public.wishlist_countries to authenticated;

-- Places and countries share the one limit.
create or replace function public.wishlist_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.wishlist where profile_id = new.profile_id)
     + (select count(*) from public.wishlist_countries where profile_id = new.profile_id) >= private.rule('wishlist.max') then
    raise exception 'You can save up to % places', private.rule('wishlist.max') using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger wishlist_countries_limit
  before insert on public.wishlist_countries
  for each row execute function public.wishlist_limit();

-- 3 ----------------------------------------------------------------------
/** Everything on a member's list: cities (with their country) and countries. */
create function public.wish_places(p uuid)
returns table (city_id integer, country_code char(2), label text, added timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.country_code, c.name, w.created_at from public.wishlist w join public.cities c on c.id = w.city_id where w.profile_id = p
  union all
  select null, n.code, n.name, x.created_at from public.wishlist_countries x join public.countries n on n.code = x.country_code where x.profile_id = p
$$;

/** The places on a's list that b wants too: the same city, the same country, or a city in a country the other wants. */
create function public.shared_places(a uuid, b uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array(
    select x.label from public.wish_places(a) x
     where exists (select 1 from public.wish_places(b) y
                    where (x.city_id is not null and y.city_id = x.city_id)
                       or (x.city_id is null and y.country_code = x.country_code)
                       or (x.city_id is not null and y.city_id is null and y.country_code = x.country_code))
     order by x.label), '{}')
$$;

/** Places you both want to visit: 20 points against the shorter list, or 10 when either has none. */
create or replace function public.place_points(a uuid, b uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  -- Capped at 20: two cities can both match one country.
  select case when n.shorter = 0 then 10
              else least(20, 20 * cardinality(public.shared_places(a, b))::numeric / n.shorter) end
    from (select least((select count(*) from public.wish_places(a)), (select count(*) from public.wish_places(b))) as shorter) n
$$;
revoke all on function public.wish_places(uuid), public.shared_places(uuid, uuid), public.place_points(uuid, uuid) from public, anon, authenticated;

-- 4 ----------------------------------------------------------------------
-- Cards, Who's going and requests show countries too.
create or replace function public.wishlist_of(p_profile uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array(select x.label from public.wish_places(p_profile) x order by x.added), '{}')
  from public.profiles p
  where p.id = p_profile
    and auth.uid() is not null
    and p.status = 'active'
    and not (p_profile = any (public.blocked_with(auth.uid())))
$$;

create or replace function public.what_we_share(p_profile uuid)
returns table (interests text[], places text[])
language sql
stable
security definer
set search_path = ''
as $$
  select array(select i.label
                 from public.profile_interests a
                 join public.profile_interests b on b.interest_id = a.interest_id and b.profile_id = me.id
                 join public.interests i on i.id = a.interest_id
                where a.profile_id = p.id
                order by i.sort),
         public.shared_places(p.id, me.id)
    from public.profiles p
    join public.profiles me on me.id = auth.uid()
   where p.id = p_profile
     and p.id <> me.id
     and me.status = 'active'
     and p.status = 'active'
     and p.onboarded_at is not null
     and not public.is_blocked(me.id, p.id)
$$;

create or replace function public.suggest_by_interests()
returns table (
  profile_id       uuid,
  display_name     text,
  birth_year       smallint,
  home_city        text,
  home_country     text,
  photo_path       text,
  travelling_with  text,
  distance_km      integer,
  shared_interests text[],
  shared_places    text[],
  score            integer,
  rank             numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me       uuid := auth.uid();
  my       public.profiles;
  my_prefs public.preferences;
  closed   uuid[] := public.closed_with(me);
  plus     boolean := public.has_plus(me);
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = me and status = 'active') then
    raise exception 'Your account is paused' using errcode = '42501';
  end if;
  select * into my from public.profiles p where p.id = me;
  select * into my_prefs from public.preferences pr where pr.profile_id = me;

  return query
  with candidates as (
    select p as person, pr as their_prefs,
           case when p.home_city_id = my.home_city_id then 0 else public.member_distance_km(p.id, me) end as km
    from public.profiles p
    join public.preferences pr on pr.profile_id = p.id
    where p.id <> me
      and p.status = 'active'
      and p.onboarded_at is not null
      and p.last_active_at > now() - interval '60 days'
      and not (p.id = any (closed))
      and not public.is_skipped(me, p.id)
      and public.passes_viewer_filters(my_prefs, plus, p)
  ),
  fitting as (
    select c.*,
           public.preference_fit(public.member_age(c.person), (c.person).gender, c.km, my_prefs)
           -- their choices apply to you too, apart from distance
           + public.preference_fit(public.member_age(my), my.gender, null, c.their_prefs) as penalty
    from candidates c
  ),
  scored as (
    select f.*,
           public.interest_points(me, (f.person).id) + public.place_points(me, (f.person).id) + public.style_points(f.person, my) as total
    from fitting f
    where f.penalty is not null
  ),
  best as (
    select s.*,
           s.total - s.penalty - public.activity_penalty(s.person) - case when (s.person).photo_path is null then 100 else 0 end as ranking
    from scored s
    order by ranking desc
    limit private.rule('matching.maxSuggestions')
  )
  select (b.person).id, (b.person).display_name, public.age_year(b.person), hc.name, hc.country_code::text,
         (b.person).photo_path, (b.person).travelling_with,
         round(b.km)::int,
         array(select i.label from public.profile_interests a
                 join public.profile_interests m on m.interest_id = a.interest_id and m.profile_id = me
                 join public.interests i on i.id = a.interest_id
                where a.profile_id = (b.person).id
                order by i.sort),
         public.shared_places((b.person).id, me),
         round(b.total)::int,
         round(b.ranking, 2)
  from best b
  left join public.cities hc on hc.id = (b.person).home_city_id
  order by b.ranking desc;
end;
$$;

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
    'wishlist', (select coalesce(jsonb_agg(x.label order by x.label), '[]') from public.wish_places(auth.uid()) x),
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
    'privacy_choices', (select jsonb_build_object('measuring', c.measuring, 'marketing', c.marketing, 'chosen_at', c.chosen_at) from public.privacy_choices c where c.profile_id = auth.uid()),
    'your_trip_plans', (select coalesce(jsonb_agg(jsonb_build_object('city', c.name, 'title', i.title, 'day', i.day, 'link', i.source_url, 'done', i.done) order by t.start_date, i.day nulls last, i.id), '[]') from public.trip_plan_items i join public.trips t on t.id = i.trip_id join public.cities c on c.id = t.city_id where t.owner_id = auth.uid()),
    'your_reviews', (select coalesce(jsonb_agg(jsonb_build_object('city', c.name, 'rating', r.rating, 'review', r.body, 'updated_at', r.updated_at) order by r.updated_at), '[]') from public.city_reviews r join public.cities c on c.id = r.city_id where r.profile_id = auth.uid()),
    'nice_to_know_tips', (select coalesce(jsonb_agg(jsonb_build_object('city', c.name, 'kind', t.category, 'place', t.place, 'tip', t.body, 'stars', t.rating, 'added_at', t.created_at) order by t.created_at), '[]') from public.city_tips t join public.cities c on c.id = t.city_id where t.profile_id = auth.uid()),
    'people_you_skipped', (select coalesce(jsonb_agg(jsonb_build_object('name', o.display_name, 'skipped_at', s.skipped_at)), '[]') from public.skipped_members s join public.profiles o on o.id = s.skipped_id where s.profile_id = auth.uid())
  )
$$;
