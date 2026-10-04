-- profiles: fixed lists members choose from (towns and cities, interests).
-- Members can read these lists once signed in; nobody can change them
-- through the API.

create extension if not exists unaccent with schema extensions;

-- Towns and cities from GeoNames. Rows are loaded by the next migration.
create table public.cities (
  id            integer primary key,            -- GeoNames id
  name          text not null,
  country_code  char(2) not null,
  lat           double precision not null,
  lng           double precision not null,
  population    integer not null,
  search_name   text not null                   -- lower case, accents removed
);
create index cities_search_name_idx on public.cities (search_name text_pattern_ops, population desc);

alter table public.cities enable row level security;
create policy "Signed-in members can read cities" on public.cities
  for select to authenticated using (true);
revoke all on public.cities from anon, authenticated;
grant select on public.cities to authenticated;

-- Up to 8 places whose name starts with what was typed, biggest first.
create function public.search_cities(q text)
returns table (id integer, name text, country_code char(2))
language sql
stable
set search_path = ''
as $$
  select c.id, c.name, c.country_code
  from public.cities c
  where char_length(btrim(q)) >= 2
    and c.search_name like replace(replace(lower(extensions.unaccent(btrim(q))), '%', ''), '_', '\_') || '%'
  order by c.population desc
  limit 8;
$$;
revoke all on function public.search_cities(text) from public, anon;
grant execute on function public.search_cities(text) to authenticated;

-- Interests: the fixed list members pick 3 to 10 from.
create table public.interests (
  id     smallint primary key,
  slug   text not null unique,
  label  text not null,
  sort   smallint not null
);

alter table public.interests enable row level security;
create policy "Signed-in members can read interests" on public.interests
  for select to authenticated using (true);
revoke all on public.interests from anon, authenticated;
grant select on public.interests to authenticated;

insert into public.interests (id, slug, label, sort) values
  (1,  'museums',        'Museums',                 1),
  (2,  'art-galleries',  'Art galleries',           2),
  (3,  'history',        'History',                 3),
  (4,  'architecture',   'Architecture',            4),
  (5,  'heritage-sites', 'Castles and heritage',    5),
  (6,  'theatre',        'Theatre',                 6),
  (7,  'live-music',     'Live music',              7),
  (8,  'classical',      'Classical and opera',     8),
  (9,  'festivals',      'Festivals',               9),
  (10, 'food',           'Food and restaurants',   10),
  (11, 'wine',           'Wine',                   11),
  (12, 'pubs',           'Pubs and craft beer',    12),
  (13, 'coffee',         'Coffee and cafés',       13),
  (14, 'markets',        'Markets',                14),
  (15, 'cooking',        'Cooking classes',        15),
  (16, 'walking',        'Walking',                16),
  (17, 'hiking',         'Hiking',                 17),
  (18, 'cycling',        'Cycling',                18),
  (19, 'gardens',        'Gardens',                19),
  (20, 'nature',         'Nature and wildlife',    20),
  (21, 'birdwatching',   'Birdwatching',           21),
  (22, 'beaches',        'Beaches',                22),
  (23, 'swimming',       'Swimming',               23),
  (24, 'boat-trips',     'Boat trips and sailing', 24),
  (25, 'cruises',        'Cruises',                25),
  (26, 'rail-journeys',  'Rail journeys',          26),
  (27, 'road-trips',     'Road trips',             27),
  (28, 'city-breaks',    'City breaks',            28),
  (29, 'islands',        'Islands',                29),
  (30, 'photography',    'Photography',            30),
  (31, 'painting',       'Painting and sketching', 31),
  (32, 'books',          'Books and literature',   32),
  (33, 'film',           'Film',                   33),
  (34, 'shopping',       'Shopping',               34),
  (35, 'antiques',       'Antiques and vintage',   35),
  (36, 'spa',            'Spa and wellness',       36),
  (37, 'yoga',           'Yoga',                   37),
  (38, 'golf',           'Golf',                   38),
  (39, 'watching-sport', 'Watching sport',         39),
  (40, 'skiing',         'Skiing',                 40),
  (41, 'dancing',        'Dancing',                41),
  (42, 'languages',      'Learning languages',     42),
  (43, 'volunteering',   'Volunteering',           43),
  (44, 'local-culture',  'Meeting locals',         44);
