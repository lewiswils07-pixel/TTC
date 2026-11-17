-- Part 34 (Lewis, 17 Nov): the app no longer asks for or shows sexual orientation, religion
-- or ethnicity. Clear any answers already saved, and stop members' apps writing them again.
-- The columns stay for now so older database functions keep working; nothing reads them.

update public.profiles
   set sexuality = null, religion = null, ethnicity = null, shown_fields = '{}'
 where sexuality is not null or religion is not null or ethnicity is not null or shown_fields <> '{}';

revoke update (sexuality, religion, ethnicity, shown_fields) on public.profiles from authenticated;
