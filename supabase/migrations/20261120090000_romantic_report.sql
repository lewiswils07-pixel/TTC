-- "Unwanted romantic approach" as a report reason: Sodalis is for travel
-- friendships, and members promise as much when they join (Lewis, 12 Oct).
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check
  check (reason in ('fake_profile', 'asking_for_money', 'harassment', 'inappropriate', 'feels_unsafe', 'romantic_approach', 'other'));
