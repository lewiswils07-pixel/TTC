-- profiles: interests list v3 (Lewis, 5 Oct). Short, distinct labels that
-- fit on a chip and match people well: one idea per interest, and "and"
-- only where two things really differ. Slugs and ids stay, so members keep
-- their picks.
--   Split: Opera and ballet, Castles and stately homes, Yoga and pilates.
--     Members who had the old one also get the new half (up to 10 picks).
--   Merged: Coastal walks into Walking, Hot springs into Spas.
--   Moved: Slow travel to Travel style.
-- Runs after the v2 list (20261005100000). Safe to run more than once.

insert into public.interests (id, slug, label, sort, category, category_label, category_sort) values
  (89, 'ballet', 'Ballet', 0, 'culture', 'Arts and culture', 1),
  (90, 'stately-homes', 'Stately homes', 0, 'heritage', 'Heritage', 2),
  (91, 'pilates', 'Pilates', 0, 'wellness', 'Wellbeing', 6)
on conflict (id) do nothing;

-- Members who picked the old combined interest also get the new half.
insert into public.profile_interests (profile_id, interest_id)
select pi.profile_id, (select id from public.interests where slug = 'ballet')
from public.profile_interests pi
where pi.interest_id = (select id from public.interests where slug = 'opera-ballet')
  and (select count(*) from public.profile_interests x where x.profile_id = pi.profile_id) < 10
on conflict do nothing;
insert into public.profile_interests (profile_id, interest_id)
select pi.profile_id, (select id from public.interests where slug = 'stately-homes')
from public.profile_interests pi
where pi.interest_id = (select id from public.interests where slug = 'castles-stately-homes')
  and (select count(*) from public.profile_interests x where x.profile_id = pi.profile_id) < 10
on conflict do nothing;
insert into public.profile_interests (profile_id, interest_id)
select pi.profile_id, (select id from public.interests where slug = 'pilates')
from public.profile_interests pi
where pi.interest_id = (select id from public.interests where slug = 'yoga')
  and (select count(*) from public.profile_interests x where x.profile_id = pi.profile_id) < 10
on conflict do nothing;

-- Overlapping interests fold into the broader one.
insert into public.profile_interests (profile_id, interest_id)
select profile_id, (select id from public.interests where slug = 'walking')
from public.profile_interests
where interest_id = (select id from public.interests where slug = 'coastal-walks')
on conflict do nothing;
delete from public.profile_interests where interest_id = (select id from public.interests where slug = 'coastal-walks');
delete from public.interests where slug = 'coastal-walks';
insert into public.profile_interests (profile_id, interest_id)
select profile_id, (select id from public.interests where slug = 'spa')
from public.profile_interests
where interest_id = (select id from public.interests where slug = 'hot-springs')
on conflict do nothing;
delete from public.profile_interests where interest_id = (select id from public.interests where slug = 'hot-springs');
delete from public.interests where slug = 'hot-springs';

-- New labels, groups and order.
update public.interests set label = 'Museums', sort = 1, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug = 'museums';
update public.interests set label = 'Art galleries', sort = 2, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug = 'art-galleries';
update public.interests set label = 'Architecture', sort = 3, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug = 'architecture';
update public.interests set label = 'Theatre', sort = 4, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug = 'theatre';
update public.interests set label = 'Opera', sort = 5, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug = 'opera-ballet';
update public.interests set label = 'Ballet', sort = 6, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug = 'ballet';
update public.interests set label = 'Classical music', sort = 7, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug = 'classical-concerts';
update public.interests set label = 'Live music', sort = 8, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug = 'live-music';
update public.interests set label = 'Jazz', sort = 9, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug = 'jazz-blues';
update public.interests set label = 'Film', sort = 10, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug = 'film';
update public.interests set label = 'Comedy', sort = 11, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug = 'comedy';
update public.interests set label = 'Literature', sort = 12, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug = 'literature';
update public.interests set label = 'Street art', sort = 13, category = 'culture', category_label = 'Arts and culture', category_sort = 1 where slug = 'street-art';
update public.interests set label = 'Historic towns', sort = 14, category = 'heritage', category_label = 'Heritage', category_sort = 2 where slug = 'history';
update public.interests set label = 'Castles', sort = 15, category = 'heritage', category_label = 'Heritage', category_sort = 2 where slug = 'castles-stately-homes';
update public.interests set label = 'Stately homes', sort = 16, category = 'heritage', category_label = 'Heritage', category_sort = 2 where slug = 'stately-homes';
update public.interests set label = 'Ancient sites', sort = 17, category = 'heritage', category_label = 'Heritage', category_sort = 2 where slug = 'archaeology';
update public.interests set label = 'Cathedrals', sort = 18, category = 'heritage', category_label = 'Heritage', category_sort = 2 where slug = 'sacred-sites';
update public.interests set label = 'Military history', sort = 19, category = 'heritage', category_label = 'Heritage', category_sort = 2 where slug = 'military-history';
update public.interests set label = 'Royal history', sort = 20, category = 'heritage', category_label = 'Heritage', category_sort = 2 where slug = 'royal-history';
update public.interests set label = 'Local traditions', sort = 21, category = 'heritage', category_label = 'Heritage', category_sort = 2 where slug = 'folklore';
update public.interests set label = 'Family history', sort = 22, category = 'heritage', category_label = 'Heritage', category_sort = 2 where slug = 'family-history';
update public.interests set label = 'Local cuisine', sort = 23, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug = 'local-cuisine';
update public.interests set label = 'Fine dining', sort = 24, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug = 'fine-dining';
update public.interests set label = 'Street food', sort = 25, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug = 'street-food';
update public.interests set label = 'Food markets', sort = 26, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug = 'food-markets';
update public.interests set label = 'Cooking classes', sort = 27, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug = 'cooking-classes';
update public.interests set label = 'Wine', sort = 28, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug = 'wine';
update public.interests set label = 'Craft beer', sort = 29, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug = 'craft-beer';
update public.interests set label = 'Pubs', sort = 30, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug = 'traditional-pubs';
update public.interests set label = 'Spirits', sort = 31, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug = 'whisky-spirits';
update public.interests set label = 'Coffee', sort = 32, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug = 'coffee';
update public.interests set label = 'Afternoon tea', sort = 33, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug = 'afternoon-tea';
update public.interests set label = 'Plant-based food', sort = 34, category = 'food', category_label = 'Food and drink', category_sort = 3 where slug = 'plant-based';
update public.interests set label = 'Walking', sort = 35, category = 'nature', category_label = 'Outdoors', category_sort = 4 where slug = 'walking';
update public.interests set label = 'Hiking', sort = 36, category = 'nature', category_label = 'Outdoors', category_sort = 4 where slug = 'hiking';
update public.interests set label = 'Mountains', sort = 37, category = 'nature', category_label = 'Outdoors', category_sort = 4 where slug = 'mountains';
update public.interests set label = 'Lakes', sort = 38, category = 'nature', category_label = 'Outdoors', category_sort = 4 where slug = 'lakes-rivers';
update public.interests set label = 'National parks', sort = 39, category = 'nature', category_label = 'Outdoors', category_sort = 4 where slug = 'national-parks';
update public.interests set label = 'Gardens', sort = 40, category = 'nature', category_label = 'Outdoors', category_sort = 4 where slug = 'gardens';
update public.interests set label = 'Wildlife', sort = 41, category = 'nature', category_label = 'Outdoors', category_sort = 4 where slug = 'wildlife';
update public.interests set label = 'Birdwatching', sort = 42, category = 'nature', category_label = 'Outdoors', category_sort = 4 where slug = 'birdwatching';
update public.interests set label = 'Stargazing', sort = 43, category = 'nature', category_label = 'Outdoors', category_sort = 4 where slug = 'stargazing';
update public.interests set label = 'Beaches', sort = 44, category = 'nature', category_label = 'Outdoors', category_sort = 4 where slug = 'beaches';
update public.interests set label = 'Islands', sort = 45, category = 'nature', category_label = 'Outdoors', category_sort = 4 where slug = 'islands';
update public.interests set label = 'Cycling', sort = 46, category = 'sport', category_label = 'Sport', category_sort = 5 where slug = 'cycling';
update public.interests set label = 'Swimming', sort = 47, category = 'sport', category_label = 'Sport', category_sort = 5 where slug = 'swimming';
update public.interests set label = 'Sailing', sort = 48, category = 'sport', category_label = 'Sport', category_sort = 5 where slug = 'sailing';
update public.interests set label = 'Paddle sports', sort = 49, category = 'sport', category_label = 'Sport', category_sort = 5 where slug = 'kayaking';
update public.interests set label = 'Golf', sort = 50, category = 'sport', category_label = 'Sport', category_sort = 5 where slug = 'golf';
update public.interests set label = 'Racket sports', sort = 51, category = 'sport', category_label = 'Sport', category_sort = 5 where slug = 'racket-sports';
update public.interests set label = 'Skiing', sort = 52, category = 'sport', category_label = 'Sport', category_sort = 5 where slug = 'skiing';
update public.interests set label = 'Snorkelling', sort = 53, category = 'sport', category_label = 'Sport', category_sort = 5 where slug = 'snorkelling';
update public.interests set label = 'Running', sort = 54, category = 'sport', category_label = 'Sport', category_sort = 5 where slug = 'running';
update public.interests set label = 'Fitness', sort = 55, category = 'sport', category_label = 'Sport', category_sort = 5 where slug = 'fitness';
update public.interests set label = 'Watching sport', sort = 56, category = 'sport', category_label = 'Sport', category_sort = 5 where slug = 'watching-sport';
update public.interests set label = 'Spas', sort = 57, category = 'wellness', category_label = 'Wellbeing', category_sort = 6 where slug = 'spa';
update public.interests set label = 'Yoga', sort = 58, category = 'wellness', category_label = 'Wellbeing', category_sort = 6 where slug = 'yoga';
update public.interests set label = 'Pilates', sort = 59, category = 'wellness', category_label = 'Wellbeing', category_sort = 6 where slug = 'pilates';
update public.interests set label = 'Meditation', sort = 60, category = 'wellness', category_label = 'Wellbeing', category_sort = 6 where slug = 'meditation';
update public.interests set label = 'City breaks', sort = 61, category = 'trips', category_label = 'Travel style', category_sort = 7 where slug = 'city-breaks';
update public.interests set label = 'Countryside', sort = 62, category = 'trips', category_label = 'Travel style', category_sort = 7 where slug = 'countryside';
update public.interests set label = 'Road trips', sort = 63, category = 'trips', category_label = 'Travel style', category_sort = 7 where slug = 'road-trips';
update public.interests set label = 'Train journeys', sort = 64, category = 'trips', category_label = 'Travel style', category_sort = 7 where slug = 'rail-journeys';
update public.interests set label = 'Boat trips', sort = 65, category = 'trips', category_label = 'Travel style', category_sort = 7 where slug = 'boat-trips';
update public.interests set label = 'River cruises', sort = 66, category = 'trips', category_label = 'Travel style', category_sort = 7 where slug = 'river-cruises';
update public.interests set label = 'Ocean cruises', sort = 67, category = 'trips', category_label = 'Travel style', category_sort = 7 where slug = 'ocean-cruises';
update public.interests set label = 'Guided tours', sort = 68, category = 'trips', category_label = 'Travel style', category_sort = 7 where slug = 'guided-tours';
update public.interests set label = 'Luxury travel', sort = 69, category = 'trips', category_label = 'Travel style', category_sort = 7 where slug = 'luxury-travel';
update public.interests set label = 'Budget travel', sort = 70, category = 'trips', category_label = 'Travel style', category_sort = 7 where slug = 'budget-travel';
update public.interests set label = 'Long-haul trips', sort = 71, category = 'trips', category_label = 'Travel style', category_sort = 7 where slug = 'long-haul';
update public.interests set label = 'Weekend breaks', sort = 72, category = 'trips', category_label = 'Travel style', category_sort = 7 where slug = 'weekend-breaks';
update public.interests set label = 'Slow travel', sort = 73, category = 'trips', category_label = 'Travel style', category_sort = 7 where slug = 'slow-travel';
update public.interests set label = 'Photography', sort = 74, category = 'hobbies', category_label = 'Hobbies', category_sort = 8 where slug = 'photography';
update public.interests set label = 'Painting', sort = 75, category = 'hobbies', category_label = 'Hobbies', category_sort = 8 where slug = 'painting';
update public.interests set label = 'Languages', sort = 76, category = 'hobbies', category_label = 'Hobbies', category_sort = 8 where slug = 'languages';
update public.interests set label = 'Writing', sort = 77, category = 'hobbies', category_label = 'Hobbies', category_sort = 8 where slug = 'writing';
update public.interests set label = 'Crafts', sort = 78, category = 'hobbies', category_label = 'Hobbies', category_sort = 8 where slug = 'crafts';
update public.interests set label = 'Antiques', sort = 79, category = 'hobbies', category_label = 'Hobbies', category_sort = 8 where slug = 'antiques';
update public.interests set label = 'Shopping', sort = 80, category = 'hobbies', category_label = 'Hobbies', category_sort = 8 where slug = 'shopping';
update public.interests set label = 'Fashion', sort = 81, category = 'hobbies', category_label = 'Hobbies', category_sort = 8 where slug = 'fashion';
update public.interests set label = 'Playing music', sort = 82, category = 'hobbies', category_label = 'Hobbies', category_sort = 8 where slug = 'music-making';
update public.interests set label = 'Meeting locals', sort = 83, category = 'social', category_label = 'Social', category_sort = 9 where slug = 'meeting-locals';
update public.interests set label = 'Festivals', sort = 84, category = 'social', category_label = 'Social', category_sort = 9 where slug = 'festivals';
update public.interests set label = 'Christmas markets', sort = 85, category = 'social', category_label = 'Social', category_sort = 9 where slug = 'christmas-markets';
update public.interests set label = 'Dancing', sort = 86, category = 'social', category_label = 'Social', category_sort = 9 where slug = 'dancing';
update public.interests set label = 'Nightlife', sort = 87, category = 'social', category_label = 'Social', category_sort = 9 where slug = 'nightlife';
update public.interests set label = 'Board games', sort = 88, category = 'social', category_label = 'Social', category_sort = 9 where slug = 'quizzes-games';
update public.interests set label = 'Volunteering', sort = 89, category = 'social', category_label = 'Social', category_sort = 9 where slug = 'volunteering';
