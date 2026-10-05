# Task list: members platform

The order follows the plan in `tasks/plan.md`. Each task names its module id from the spec's
capability map. Sizes: S = 1–2 files · M = 3–5 files. Anything larger gets split before starting.
Unless a task says otherwise, every task is verified with
`npm run lint && npm test && npm run build` (in `app/`) plus `npx supabase test db`.

## Lewis's checklist (week 0: start now, these have outside waits)
- [ ] Supabase: upgrade the project to **Pro**, then send me the project URL and anon key
      (never the service-role key).
- [ ] Apple Developer Program. **If you're using a company, request a D-U-N-S number today.** Then
      sign the paid-apps agreement and fill in the tax and bank forms.
- [ ] Google Play Console account ($25), plus the payments profile.
- [ ] Stripe account: business details, then switch on Stripe Identity.
- [ ] RevenueCat account (free tier).
- [ ] Twilio account, for SMS phone checks.
- [ ] Anthropic API account. Set a monthly spend limit in the console.
- [ ] Resend account, then verify the domain for sending email.
- [ ] Affiliate programmes, once the marketing site is live: GetYourGuide, Viator, Booking.com
      (via Awin), Skyscanner. Approvals take weeks, so apply early.
- [ ] Buy the domain (needed for the Apple company account, email and `app.`), connect it to
      Netlify, then add `app.` as a second Netlify site.
- [x] Answer the open questions in spec §15 (done 4 Oct).

## Week 1: foundation (5–9 Oct)
- [x] **T1 `app-shell`: Scaffold the app.** Vite + React + TS strict, router, Duke Street tokens,
      Figtree, light and dark. Netlify config, plus CI running lint, build and test. Brand name, tagline and colours in one
      `app/brand.json` settings file. (M)
  - Acceptance: the app builds; a placeholder home screen passes axe and fits the phone at 320 px.
- [ ] **T2 `app-shell`: Capacitor wrapper.** iOS and Android projects, safe areas, status bar,
      keyboard handling. iPhone builds on Lewis's Mac, with GitHub's Mac machines as backup. (M)
  - Acceptance: the app runs in the Android emulator and the iPhone simulator.
  - Status 4 Oct: projects created; CI builds the Android APK; still to run on a simulator (Lewis's Mac).
- [x] **T3 `identity`: Supabase project setup, migrations folder, and the `profiles` table with row-level security.** Email-code sign-in. (M)
  - Acceptance: sign in with an email code on the web; pgTAP proves a member reads only their own private fields.
- [ ] **T4 `identity`: Phone check** (Twilio Verify) and one account per number. (S)
  - Waiting on a Twilio account. A free Twilio trial (texts only to numbers you verify) is enough for testing.
- [x] **T5 `profiles`: Profile onboarding**, 4 steps: name, birth year and home city; photo (private storage bucket, location data removed); interests; preferences. (M)
  - Acceptance: a new member gets from email to finished profile in under 3 minutes; works with a screen reader.
- [x] **T6 `profiles`: Seed data.** The ~40 interests, GeoNames cities (UK and Europe first), and 200 demo members for local testing. (S)
- [ ] **Checkpoint 9 Oct:** Lewis signs in on his phone and builds a profile.

## Week 2: trips, matching, connections (12–16 Oct)
- [x] **T7 `trips`: Add, edit and delete trips**, plus wishlist cities, shown on the dashboard. (M)
  - Status 5 Oct: done in the app; the live database needs `20261012090000_trips.sql` pasted after the app is merged.
- [x] **T8 `matching`: `suggest_for_trip`**: hard filters, the mutual age and gender rule, scoring, and "why you'd get on" reasons. pgTAP fixtures check the order. (M)
  - Status 5 Oct: first draft done (Lewis expects to change the rules after a Q&A). Blocks, connection history, the phone check and Sodalis+ filters are added by T14, T11, T4 and T10. Live database needs `20261013090000_matching_trip.sql` pasted after the trips file.
- [x] **T9 `matching`: `suggest_by_interests`**, plus the dashboard switch between "For my trip" and "Plan something new". (M)
  - Status 5 Oct: done in `20261016090000_matching_interests.sql` (9 pgTAP tests). The switch sits on a new Find people page, linked from the top of the dashboard.
- [x] **T10 `matching`: Filters.** Basic filters for everyone. Sodalis+ filters are locked unless the member has Sodalis+ (checked on the server). (S)
  - Status 5 Oct: done in `20261017090000_plus_filters.sql` (10 pgTAP tests), which also adds the `entitlements` table and the 50-a-week Sodalis+ limit. Members can save Sodalis+ filters any time; the server ignores them unless the plan is active. Testers can be given Sodalis+ by adding a row in the table editor (source `manual`).
- [x] **T11 `connections`: Send, accept, decline and withdraw requests**, with weekly limits (5 free, fair-use 50 for Sodalis+) enforced in SQL and a "requests" inbox. (M)
  - Status 5 Oct: done in `20261014090000_connections.sql` (24 pgTAP tests). Everyone gets 5 a week until Sodalis+ entitlements exist (T10). Withdrawn requests still count; a decline keeps the pair apart for 90 days. Live database needs it pasted after the matching file.
- [x] **T12 `matching`: Performance check.** 10,000 seeded members; suggestions return in under 300 ms. (S)
  - Status 5 Oct: `supabase/scripts/perf-10k.sql` (local only, rolled back). Suggestions for a trip take about 10 ms (slowest 21 ms) and by interests about 60 ms (slowest 140 ms). Getting there meant working out blocks, connections and nearby towns once per search instead of once per member.
- [ ] **Checkpoint 16 Oct:** two test accounts with overlapping trips see each other in the right order and connect.

## Week 3: chat and safety (19–23 Oct)
- [x] **T13 `chat`: Conversations, messages and live updates**, unread counts and the chat screen; pgTAP proves you can't message without an accepted connection. (M)
  - Done 5 Oct: `20261018090000_chat.sql` (16 pgTAP tests). A conversation opens when a request is accepted; blocking ends it and hides it. Messages page with unread counts, a chat screen with live updates (Supabase Realtime), and "Message …" on Connections. Tested in a browser with two members at 320 px dark and 390 px light, axe clean. Group chats come with T18.
- [x] **T14 `safety`: Block** (applies both ways, everywhere) **and report**, from profiles and messages. (M)
  - Status 5 Oct: blocking and reporting members is done in `20261015090000_safety.sql` (22 pgTAP tests), from suggestion cards and the Connections page, with an unblock list. Reports from 3 different members pause requests. Reporting a message, blocking from chat and the /admin review page followed (T15, T16); blocks in groups come with groups.
- [x] **T15 `safety`: Scam guard.** Pattern checker on the server, flagged messages, and a warning card for the recipient. Unit tests on 30+ example messages. (S)
  - Done 5 Oct: `20261019090000_scam_guard.sql`. `scam_reasons()` looks for money, bank details, gift cards, crypto, moving off the app, and a phone number in the first 24 hours. The checker lives only on the server, so its 36 example messages are pgTAP tests (48 in all). Flagged messages are still sent; the reader sees the warning card with "Report this message", the sender can't see the flag, and a copy goes to `message_flags` for review. Members can also report any message, and block or report from the chat.
- [x] **T16 `safety`: `/admin` moderation page** (admins only): actions, an action log, and the 3-report automatic pause. (M)
  - Done 5 Oct: `20261020090000_admin.sql` (25 pgTAP tests). Open reports and flagged messages with context; dismiss, warn, suspend, remove, and reinstate; every action logged. Warnings and suspensions show as a notice on the member's dashboard (email waits for T18). Suspended or removed members can't send requests or messages. "Remove" closes the account; deleting the sign-in itself comes with T19. Lewis is made an admin with one line of SQL (in the paste steps).
- [ ] **T17 `safety`: Meeting-up guidance, trusted-contact share link, and the "Did you meet?" prompt.** (M)
  - Status 5 Oct: meeting-up guidance and "Did you meet?" are done (`20261021090000_meet_feedback.sql`, 11 pgTAP tests). The guide is a page at /meeting-safely, shown once as a short card in the first chat and linked from every chat and from Connections. "Did you meet?" appears on the dashboard 2 to 60 days after the trip a connection was about, and the answers are private. Still to do: the trusted-contact link, which needs email sending (an email domain or Resend).
- [ ] **T18 `notifications`: Email nudges** (new request, accepted, unread message after 30 min), with unsubscribe settings. (S)
- [ ] **T19 `identity`: Delete account and download my data** (Edge Functions). (S)
- [ ] **Checkpoint 23 Oct:** a full conversation, including a scam warning and a report visible on `/admin`.

## Week 4: groups and trip planner (26–30 Oct)
- [x] **T20 `groups`: Create a group from connections** (max 6), invite, leave, remove a member, group chat; blocks respected. (M)
  - Done 5 Oct: `20261022090000_groups.sql` (30 pgTAP tests). Groups page, start-a-group form, group page (members, invite more, remove, leave, block or report), and group chats in Messages with each sender's name. Invited people choose to join. Free members can have 1 active group of their own, Sodalis+ 3. Blocked members can't be invited, and inside a group they don't see each other's messages. When the creator leaves, the longest-standing member takes over.
- [ ] **T21 `trip-planner`: `planner` Edge Function.** Claude API with web search, structured output checked before saving, caching, limits, spend cap. (M)
- [ ] **T22 `trip-planner`: Planner screens.** Request form, day-by-day cards, "change something" follow-ups. (M)
- [ ] **T23 `trip-planner`: Shared plan board.** Add, vote, tick off; works in one-to-one chats and groups. (S)
- [ ] **T24 `trip-planner`: Hand-picked activity lists** for the top 15 destinations, so the agent prefers our own picks. (S)
- [ ] **T24b `trip-planner`: Booking links via `/go/<id>`.** Affiliate tag added when available,
      click recorded, disclosure line shown next to the link (spec §7a). (S)
- [ ] **T25: Full end-to-end Playwright path** (join → … → plan → block/report) in CI. (M)
- [ ] **Checkpoint 30 Oct:** a group of 3 plans a trip. **Beta invites go out** (web, TestFlight, Play internal testing).

## Week 5: Sodalis+, verification, apps (2–6 Nov)
- [ ] **T26 `billing`: Stripe Checkout, Customer Portal and `stripe-webhook`** writing to `entitlements`. (M)
- [ ] **T27 `billing`: RevenueCat**: Apple and Google products, `revenuecat-webhook`, restore purchases. (M)
- [ ] **T28 `verification`: Stripe Identity flow, `identity-webhook`, verified badge**, and the verified-only filter working. (M)
- [ ] **T29 `notifications`: Push notifications in the apps** (requests, messages). (M)
- [ ] **T30 `app-shell`: Store listings**: icons, splash screens, screenshots, privacy labels. **Submit both apps.** (M)
- [ ] **Checkpoint 6 Nov:** Sodalis+ works on web, iPhone and Android sandbox; apps submitted.

## Week 6: launch (9–13 Nov)
- [ ] **T31: Security review** (security-and-hardening skill), plus a re-check of all row-level-security policies. (S)
- [ ] **T32: Launch check**: axe, phone fit, contrast, CSP, performance across all app screens. (S)
- [ ] **T33: Beta fixes**: work through the beta feedback list. (varies)
- [ ] **T34: Marketing site links** to `app.<domain>`, "App coming soon" or store badges, final legal pages. (S)
- [ ] **T35: Go live.** Production keys, Sentry alerts, rollback plan tested, keep-awake check removed (Pro doesn't pause). (S)
- [ ] **Checkpoint 13 Nov:** spec §14 all green → launch.
