-- profiles: a longer interests list, grouped into categories (Lewis's
-- feedback, 4 Oct). Every interest sits in exactly one category.
-- The 44 original interests are renamed in place, keeping their ids, so
-- members' existing picks carry over. Safe to run more than once.

alter table public.interests
  add column if not exists category       text,
  add column if not exists category_label text,
  add column if not exists category_sort  smallint;

update public.interests set slug = 'museums', label = 'Museums', sort = 1, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug in ('museums', 'museums');
update public.interests set slug = 'art-galleries', label = 'Art galleries', sort = 2, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug in ('art-galleries', 'art-galleries');
update public.interests set slug = 'architecture', label = 'Architecture', sort = 3, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug in ('architecture', 'architecture');
update public.interests set slug = 'theatre', label = 'Theatre', sort = 4, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug in ('theatre', 'theatre');
update public.interests set slug = 'classical-concerts', label = 'Classical concerts', sort = 6, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug in ('classical', 'classical-concerts');
update public.interests set slug = 'live-music', label = 'Live music and gigs', sort = 7, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug in ('live-music', 'live-music');
update public.interests set slug = 'film', label = 'Cinema and film', sort = 9, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug in ('film', 'film');
update public.interests set slug = 'literature', label = 'Books and literary places', sort = 11, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug in ('books', 'literature');
update public.interests set slug = 'history', label = 'History', sort = 13, category = 'heritage', category_label = 'History and heritage', category_sort = 2 where slug in ('history', 'history');
update public.interests set slug = 'castles-stately-homes', label = 'Castles and stately homes', sort = 14, category = 'heritage', category_label = 'History and heritage', category_sort = 2 where slug in ('heritage-sites', 'castles-stately-homes');
update public.interests set slug = 'local-cuisine', label = 'Local cuisine', sort = 21, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug in ('food', 'local-cuisine');
update public.interests set slug = 'food-markets', label = 'Food markets', sort = 24, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug in ('markets', 'food-markets');
update public.interests set slug = 'cooking-classes', label = 'Cooking classes', sort = 25, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug in ('cooking', 'cooking-classes');
update public.interests set slug = 'wine', label = 'Wine and vineyards', sort = 26, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug in ('wine', 'wine');
update public.interests set slug = 'traditional-pubs', label = 'Traditional pubs', sort = 28, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug in ('pubs', 'traditional-pubs');
update public.interests set slug = 'coffee', label = 'Coffee and cafés', sort = 30, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug in ('coffee', 'coffee');
update public.interests set slug = 'walking', label = 'Walking and rambling', sort = 33, category = 'nature', category_label = 'Nature and outdoors', category_sort = 4 where slug in ('walking', 'walking');
update public.interests set slug = 'hiking', label = 'Hiking and trekking', sort = 34, category = 'nature', category_label = 'Nature and outdoors', category_sort = 4 where slug in ('hiking', 'hiking');
update public.interests set slug = 'gardens', label = 'Gardens', sort = 39, category = 'nature', category_label = 'Nature and outdoors', category_sort = 4 where slug in ('gardens', 'gardens');
update public.interests set slug = 'wildlife', label = 'Wildlife', sort = 40, category = 'nature', category_label = 'Nature and outdoors', category_sort = 4 where slug in ('nature', 'wildlife');
update public.interests set slug = 'birdwatching', label = 'Birdwatching', sort = 41, category = 'nature', category_label = 'Nature and outdoors', category_sort = 4 where slug in ('birdwatching', 'birdwatching');
update public.interests set slug = 'beaches', label = 'Beaches', sort = 43, category = 'nature', category_label = 'Nature and outdoors', category_sort = 4 where slug in ('beaches', 'beaches');
update public.interests set slug = 'islands', label = 'Islands', sort = 44, category = 'nature', category_label = 'Nature and outdoors', category_sort = 4 where slug in ('islands', 'islands');
update public.interests set slug = 'cycling', label = 'Cycling', sort = 45, category = 'sport', category_label = 'Sport and fitness', category_sort = 5 where slug in ('cycling', 'cycling');
update public.interests set slug = 'swimming', label = 'Swimming', sort = 46, category = 'sport', category_label = 'Sport and fitness', category_sort = 5 where slug in ('swimming', 'swimming');
update public.interests set slug = 'golf', label = 'Golf', sort = 49, category = 'sport', category_label = 'Sport and fitness', category_sort = 5 where slug in ('golf', 'golf');
update public.interests set slug = 'skiing', label = 'Skiing and snow sports', sort = 51, category = 'sport', category_label = 'Sport and fitness', category_sort = 5 where slug in ('skiing', 'skiing');
update public.interests set slug = 'watching-sport', label = 'Watching live sport', sort = 55, category = 'sport', category_label = 'Sport and fitness', category_sort = 5 where slug in ('watching-sport', 'watching-sport');
update public.interests set slug = 'spa', label = 'Spa and thermal baths', sort = 56, category = 'wellness', category_label = 'Wellbeing', category_sort = 6 where slug in ('spa', 'spa');
update public.interests set slug = 'yoga', label = 'Yoga and pilates', sort = 57, category = 'wellness', category_label = 'Wellbeing', category_sort = 6 where slug in ('yoga', 'yoga');
update public.interests set slug = 'city-breaks', label = 'City breaks', sort = 61, category = 'trips', category_label = 'Ways to travel', category_sort = 7 where slug in ('city-breaks', 'city-breaks');
update public.interests set slug = 'road-trips', label = 'Road trips', sort = 63, category = 'trips', category_label = 'Ways to travel', category_sort = 7 where slug in ('road-trips', 'road-trips');
update public.interests set slug = 'rail-journeys', label = 'Rail journeys', sort = 64, category = 'trips', category_label = 'Ways to travel', category_sort = 7 where slug in ('rail-journeys', 'rail-journeys');
update public.interests set slug = 'boat-trips', label = 'Boat trips', sort = 65, category = 'trips', category_label = 'Ways to travel', category_sort = 7 where slug in ('boat-trips', 'boat-trips');
update public.interests set slug = 'ocean-cruises', label = 'Ocean cruises', sort = 67, category = 'trips', category_label = 'Ways to travel', category_sort = 7 where slug in ('cruises', 'ocean-cruises');
update public.interests set slug = 'photography', label = 'Photography', sort = 73, category = 'hobbies', category_label = 'Hobbies and learning', category_sort = 8 where slug in ('photography', 'photography');
update public.interests set slug = 'painting', label = 'Painting and sketching', sort = 74, category = 'hobbies', category_label = 'Hobbies and learning', category_sort = 8 where slug in ('painting', 'painting');
update public.interests set slug = 'languages', label = 'Learning languages', sort = 75, category = 'hobbies', category_label = 'Hobbies and learning', category_sort = 8 where slug in ('languages', 'languages');
update public.interests set slug = 'antiques', label = 'Antiques and vintage', sort = 78, category = 'hobbies', category_label = 'Hobbies and learning', category_sort = 8 where slug in ('antiques', 'antiques');
update public.interests set slug = 'shopping', label = 'Shopping and boutiques', sort = 79, category = 'hobbies', category_label = 'Hobbies and learning', category_sort = 8 where slug in ('shopping', 'shopping');
update public.interests set slug = 'meeting-locals', label = 'Meeting locals', sort = 82, category = 'social', category_label = 'Social and events', category_sort = 9 where slug in ('local-culture', 'meeting-locals');
update public.interests set slug = 'festivals', label = 'Festivals', sort = 83, category = 'social', category_label = 'Social and events', category_sort = 9 where slug in ('festivals', 'festivals');
update public.interests set slug = 'dancing', label = 'Dancing', sort = 85, category = 'social', category_label = 'Social and events', category_sort = 9 where slug in ('dancing', 'dancing');
update public.interests set slug = 'volunteering', label = 'Volunteering', sort = 88, category = 'social', category_label = 'Social and events', category_sort = 9 where slug in ('volunteering', 'volunteering');

insert into public.interests (id, slug, label, sort, category, category_label, category_sort) values
  (45, 'opera-ballet', 'Opera and ballet', 5, 'culture', 'Arts and culture', 1),
  (46, 'jazz-blues', 'Jazz and blues', 8, 'culture', 'Arts and culture', 1),
  (47, 'comedy', 'Comedy', 10, 'culture', 'Arts and culture', 1),
  (48, 'street-art', 'Street art', 12, 'culture', 'Arts and culture', 1),
  (49, 'archaeology', 'Archaeology and ancient sites', 15, 'heritage', 'History and heritage', 2),
  (50, 'sacred-sites', 'Cathedrals and sacred sites', 16, 'heritage', 'History and heritage', 2),
  (51, 'military-history', 'Military history', 17, 'heritage', 'History and heritage', 2),
  (52, 'royal-history', 'Royal history', 18, 'heritage', 'History and heritage', 2),
  (53, 'folklore', 'Local traditions and folklore', 19, 'heritage', 'History and heritage', 2),
  (54, 'family-history', 'Family history and ancestry', 20, 'heritage', 'History and heritage', 2),
  (55, 'fine-dining', 'Fine dining', 22, 'food', 'Food and drink', 3),
  (56, 'street-food', 'Street food', 23, 'food', 'Food and drink', 3),
  (57, 'craft-beer', 'Craft beer and breweries', 27, 'food', 'Food and drink', 3),
  (58, 'whisky-spirits', 'Whisky and spirits', 29, 'food', 'Food and drink', 3),
  (59, 'afternoon-tea', 'Afternoon tea', 31, 'food', 'Food and drink', 3),
  (60, 'plant-based', 'Vegetarian and vegan food', 32, 'food', 'Food and drink', 3),
  (61, 'coastal-walks', 'Coastal walks', 35, 'nature', 'Nature and outdoors', 4),
  (62, 'mountains', 'Mountains', 36, 'nature', 'Nature and outdoors', 4),
  (63, 'lakes-rivers', 'Lakes and rivers', 37, 'nature', 'Nature and outdoors', 4),
  (64, 'national-parks', 'National parks', 38, 'nature', 'Nature and outdoors', 4),
  (65, 'stargazing', 'Stargazing', 42, 'nature', 'Nature and outdoors', 4),
  (66, 'sailing', 'Sailing', 47, 'sport', 'Sport and fitness', 5),
  (67, 'kayaking', 'Kayaking and paddleboarding', 48, 'sport', 'Sport and fitness', 5),
  (68, 'racket-sports', 'Tennis and padel', 50, 'sport', 'Sport and fitness', 5),
  (69, 'snorkelling', 'Snorkelling and diving', 52, 'sport', 'Sport and fitness', 5),
  (70, 'running', 'Running', 53, 'sport', 'Sport and fitness', 5),
  (71, 'fitness', 'Gym and fitness', 54, 'sport', 'Sport and fitness', 5),
  (72, 'meditation', 'Meditation and retreats', 58, 'wellness', 'Wellbeing', 6),
  (73, 'hot-springs', 'Hot springs', 59, 'wellness', 'Wellbeing', 6),
  (74, 'slow-travel', 'Slow travel', 60, 'wellness', 'Wellbeing', 6),
  (75, 'countryside', 'Countryside escapes', 62, 'trips', 'Ways to travel', 7),
  (76, 'river-cruises', 'River cruises', 66, 'trips', 'Ways to travel', 7),
  (77, 'guided-tours', 'Guided tours', 68, 'trips', 'Ways to travel', 7),
  (78, 'luxury-travel', 'Luxury travel', 69, 'trips', 'Ways to travel', 7),
  (79, 'budget-travel', 'Travelling on a budget', 70, 'trips', 'Ways to travel', 7),
  (80, 'long-haul', 'Long-haul adventures', 71, 'trips', 'Ways to travel', 7),
  (81, 'weekend-breaks', 'Weekend breaks', 72, 'trips', 'Ways to travel', 7),
  (82, 'writing', 'Writing and journaling', 76, 'hobbies', 'Hobbies and learning', 8),
  (83, 'crafts', 'Crafts and workshops', 77, 'hobbies', 'Hobbies and learning', 8),
  (84, 'fashion', 'Fashion and design', 80, 'hobbies', 'Hobbies and learning', 8),
  (85, 'music-making', 'Playing music', 81, 'hobbies', 'Hobbies and learning', 8),
  (86, 'christmas-markets', 'Christmas markets', 84, 'social', 'Social and events', 9),
  (87, 'nightlife', 'Cocktail bars and nightlife', 86, 'social', 'Social and events', 9),
  (88, 'quizzes-games', 'Quizzes and board games', 87, 'social', 'Social and events', 9)
on conflict (id) do update set slug = excluded.slug, label = excluded.label, sort = excluded.sort,
  category = excluded.category, category_label = excluded.category_label, category_sort = excluded.category_sort;

alter table public.interests
  alter column category set not null,
  alter column category_label set not null,
  alter column category_sort set not null;
