-- profiles: trim the interests list (Lewis, 5 Oct). Drops options nobody
-- would naturally pick, and ones the profile already asks about (budget and
-- pace are their own questions), and makes a few labels sound like
-- something a person would say. Safe to run more than once.

-- Removed: picks of these go too.
delete from public.profile_interests
where interest_id in (select id from public.interests where slug in
  ('long-haul', 'weekend-breaks', 'budget-travel', 'luxury-travel', 'slow-travel', 'fitness', 'plant-based'));
delete from public.interests where slug in
  ('long-haul', 'weekend-breaks', 'budget-travel', 'luxury-travel', 'slow-travel', 'fitness', 'plant-based');

-- More natural wording.
update public.interests set label = 'Books' where slug = 'literature';
update public.interests set label = 'Whisky' where slug = 'whisky-spirits';
update public.interests set label = 'Kayaking' where slug = 'kayaking';
update public.interests set label = 'Tennis' where slug = 'racket-sports';
update public.interests set label = 'Learning languages' where slug = 'languages';
