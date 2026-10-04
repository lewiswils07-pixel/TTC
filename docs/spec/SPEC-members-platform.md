# Spec: Together Travel Club members platform

Status: **DRAFT, awaiting Lewis's approval.** It is built from `docs/intent/members-platform.md`.
Target: launch-ready by **Friday 13 November 2026**.

---

## 0. Capability map

One request covers several capabilities that can each be tested on their own. Module ids are
fixed: tasks, tests, migrations and commits refer to them by these names.

| Module id | Responsibility | Depends on |
|---|---|---|
| `app-shell` | App codebase: routing, design tokens, Capacitor wrapper, CI | — |
| `identity` | Sign-in (email code), phone check, sessions, account deletion and export | app-shell |
| `profiles` | Profile, photo, interests, preferences, home city | identity |
| `trips` | Trips (destination and dates), wishlist destinations | profiles |
| `matching` | Suggestions in trip mode and interest mode, filters, scoring | trips |
| `connections` | Requests, accept and decline, weekly limits | matching |
| `chat` | One-to-one messages, live updates, unread counts | connections |
| `groups` | Small trip groups, invites, group chat | chat |
| `safety` | Block, report, scam warnings, moderation queue, trusted contact, "Did you meet?" | identity (cuts across chat, groups, matching) |
| `billing` | Club+ entitlement: Stripe (web) and RevenueCat (apps) | identity |
| `verification` | ID and selfie check for Club+, verified badge | billing |
| `trip-planner` | AI agent that builds and edits day-by-day plans and the shared plan board | connections, groups, billing |
| `notifications` | Email (launch), push in the apps, in-app badges | chat, connections |

Build order: `app-shell` → `identity` → `profiles` → `trips` → `matching` → `connections` → `chat` +
`safety` → `groups` → `trip-planner` → `billing` → `verification` → `notifications` (push).

This spec keeps every module as a section of one document, not one file per module. It is
6 weeks of work for one team, and one document is easier for Lewis to review. If any module
grows past about a page, it gets split out as `SPEC-<module-id>.md`.

---

## 1. Assumptions (correct any of these now)

1. **The members' app is separate from the marketing site.** The marketing site stays static at
   the root domain. The app is a new folder, `app/`, in this repo, deployed as a second Netlify
   site at `app.<your-domain>`. "Join" and "Sign in" on the marketing site link there.
2. **Stack:** Vite + React + TypeScript, packaged as iPhone and Android apps with Capacitor. React has
   the widest support for chat, forms and Capacitor plugins. It reuses the Duke Street tokens from
   `styles.css` and needs no new visual design system.
3. **Backend:** Supabase on the Pro plan, which never pauses and has daily backups. It runs
   Postgres with row-level security, Auth, Realtime (for chat), Storage (for photos) and Edge
   Functions (for anything that needs a secret key).
4. **Sign-in uses a 6-digit email code, not a password.** It is simpler for an older audience and
   there's no password to forget. A **phone check** (SMS code through Twilio Verify) is required
   before a member can send a connection request.
5. **Payments:** Club+ on the web goes through Stripe Checkout. In the apps it goes through Apple and
   Google in-app purchase, which the store rules require for digital memberships. **RevenueCat** joins
   both into one "is this member Club+?" answer, written into our database.
6. **ID check:** Stripe Identity (photo ID plus live selfie), about $1.50 a check, paid only when a
   Club+ member verifies.
7. **Trip planner:** an AI agent run from a Supabase Edge Function, calling the Claude API with web
   search. The model is chosen at build time from current documentation. The API key never leaves
   the server.
8. **Minimum age is 18.** No upper limit.
9. **Lewis is the only moderator at launch.** An "admin" role gives access to the review list.
10. **Emails** (codes, connection requests, new messages) are sent through Supabase Auth plus Resend.
    Push notifications ship with the apps.
11. **Cities come from a fixed list**, the GeoNames cities with population over 15,000 (CC-BY
    licence, credited in the footer). Home city and destinations are picked from it, not typed
    freely, so matching and distance calculations are reliable.

---

## 2. Objective and user stories

**Who:** solo travellers, mostly 50 and over, UK-first. Many are less confident with apps than
average. Every screen must be readable, forgiving and calm.

### Must have at launch
- **Join and sign in:** As a new member, I enter my email and a 6-digit code, then complete a short
  profile in 4 steps or fewer:
  - name, age and home city;
  - photo;
  - interests (pick 3–10 from a set list);
  - travel preferences.
- **Add trips:** As a member, I add a trip (destination, dates and whether my dates are flexible)
  and see it on my dashboard.
- **Trip mode:** As a member with a trip, I see members going to the same destination with
  overlapping dates. The most compatible appear first, and each card shows what we have in common.
- **Interest mode:** As a member without a trip, I see members with similar interests and wishlist
  destinations, so we can plan one together.
- **Filters:** Basic filters are free. Advanced filters are Club+, shown with a lock and an upgrade
  prompt.
- **Connect:** As a member, I send a connection request with an optional short note. The other
  person accepts or declines. Nothing else is shared until they accept. Free members can send
  **5 requests a week**; Club+ is unlimited, with a fair-use cap of **50 a week** to stop spam.
  Because free members have so few requests, suggestions must be precise enough that each one
  is worth sending.
- **Chat:** Once connected, we chat one to one, with live updates, unread counts and an email
  nudge if a message goes unread for 30 minutes.
- **Groups:** A member can create a group of up to **6** from their connections, tied to a trip
  (destination and dates). The group has its own chat and a shared plan. Anyone can leave. The
  creator can remove people.
- **Trip planner:** From a chat or group, any member can ask the planner for a day-by-day plan. It
  uses the destination, dates, shared interests, pace, budget and mobility needs. Members can ask
  for changes in plain English ("something quieter on day 2"). Activities can be added to the
  shared plan board, where members can vote and tick things off. Free members get **2 plans a
  month**; Club+ is unlimited, with a fair-use cap of **40 a month**.
- **Club+:** Upgrade on the web (Stripe) or in the apps (in-app purchase). Membership is
  recognised everywhere. Cancel any time.
- **Verification:** Club+ members complete an ID and selfie check and receive a verified badge.
  Members can filter to verified people only (a Club+ filter).
- **Safety:** see §6.
- **My data:** Members can download their data and delete their account from inside the app.
  Apple requires in-app account deletion, and UK GDPR gives members these rights.

### Not at launch
Video calls, photo swap, calendar export, "Meet for a day", web push notifications,
languages other than English, and a **deal finder** for flights, hotels and packages. The deal
finder comes after launch, built on official partner feeds and APIs, not scraping (see §7a).

---

## 3. Data model (Postgres, all tables protected by row-level security)

```
profiles        id (= auth user), display_name, birth_year, gender, home_city_id,
                bio (≤500), photo_path, travel_style, pace, budget, mobility_note,
                phone_verified_at, id_verified_at, role ('member'|'admin'),
                status ('active'|'suspended'|'deleted'), created_at, last_active_at
interests       id, slug, label                       -- fixed list (~40)
profile_interests profile_id, interest_id
preferences     profile_id, age_min, age_max, genders[], max_distance_km,
                verified_only, styles[], budgets[], paces[]   -- the last 4 are honoured only for Club+
cities          id, name, country_code, lat, lng, population   -- GeoNames >15k
trips           id, owner_id, city_id, start_date, end_date, flexible_days (0–7),
                note (≤280), visibility ('members'|'hidden'), created_at
wishlist        profile_id, city_id
connections     id, requester_id, addressee_id, note (≤280), status
                ('pending'|'accepted'|'declined'|'withdrawn'), trip_id?, created_at, responded_at
conversations   id, kind ('direct'|'group'), group_id?, created_at
conversation_members conversation_id, profile_id, last_read_at
messages        id, conversation_id, sender_id, body (≤2000), flagged (bool), created_at
groups          id, name, owner_id, city_id, start_date, end_date, created_at
group_members   group_id, profile_id, role ('owner'|'member'), joined_at
plans           id, conversation_id, city_id, start_date, end_date, request jsonb,
                result jsonb (days → activities with source links), created_by, created_at
plan_items      id, plan_id, title, day, source_url, added_by, votes int, done bool
blocks          blocker_id, blocked_id, created_at
reports         id, reporter_id, subject_profile_id, message_id?, group_id?, reason,
                details, status ('open'|'actioned'|'dismissed'), created_at
trusted_shares  id, profile_id, trip_id, contact_email, token, created_at
meet_feedback   id, from_id, about_id, trip_id?, met bool, would_travel_again bool?, created_at
entitlements    profile_id, plan ('free'|'club_plus'), source ('stripe'|'apple'|'google'),
                expires_at, updated_at                  -- written only by webhook functions
usage_counters  profile_id, week_start, connection_requests      -- weekly, resets Monday 00:00 UK
planner_usage   profile_id, month, planner_runs
```

**Key rules, enforced in the database and not only in the screens:**
- A member can never read another member's email, phone, birth date (only age), exact location,
  or anything else private.
- Members see each other only through `suggest_*` functions, which return a fixed set of public
  fields.
- Blocks apply both ways and everywhere: suggestions, requests, chat, groups and search.
- Monthly limits are checked inside the `send_connection_request` and `run_planner` functions, so
  they can't be bypassed from the app.
- `entitlements` and `id_verified_at` are written only by server-side webhook functions.
- Photos sit in a private storage bucket and are shown via short-lived signed links. Location data
  in photo files (EXIF) is removed on upload.

---

## 4. Matching

Matching runs as Postgres functions (`suggest_for_trip(trip_id)` and `suggest_by_interests()`).
Each returns at most 20 cards, ranked.

### 4.1 Who can appear (hard filters, both modes)
- Active, phone-verified, not the viewer, and no block in either direction.
- Not already connected, and no pending request in either direction.
- Not declined in the last 90 days.
- **Both people's** age and gender preferences are satisfied. The filter is mutual: you don't
  appear to someone who wouldn't want to see you.
- The viewer's distance filter (home city to home city).
- Club+ viewer filters, if set: verified only, style, budget, pace.

### 4.2 Trip mode
- **Candidates:** other members' trips to the **same city** (or within 30 km, so Lisbon and Cascais
  count) whose dates overlap by at least 1 day. Each trip's `flexible_days` widens its date window.
- **Score (0–100):**

  | Weight | Factor | How it is measured |
  |---|---|---|
  | 45 | Shared interests | Jaccard overlap of the two interest sets |
  | 20 | Date overlap | Overlapping days ÷ the shorter trip's length |
  | 15 | Travel style | Exact match = 1, neighbouring = 0.5 |
  | 10 | Pace | As travel style |
  | 10 | Budget | As travel style |

  If either person hasn't set a factor, it scores a neutral 0.5.
- Ties are broken by most recently active.
- Each card shows **why**: "Both into Photography and Coffee · overlap 12–15 May".

### 4.3 Interest mode
- **Candidates:** members sharing at least 2 interests, within the distance filter.
- **Score:** 55 interests + 25 wishlist overlap (shared wishlist cities) + 20 travel style, pace
  and budget combined.
- Each card shows shared interests and shared wishlist cities ("You both want to visit Kyoto").

### 4.4 Tests
- Unit tests in pgTAP cover every hard filter, including the mutual age and gender rule, blocks
  both ways, and declined-within-90-days.
- Scoring tests use fixed fixtures, with expected order asserted.
- A performance check: under 300 ms with 10,000 seeded members.

---

## 5. Free vs Club+ (confirmed by Lewis, 4 Oct)

| | Free | Club+ |
|---|---|---|
| Price | £0 | **£7.99/month or £59.99/year**. Founding-member offer: **3 months of Club+ free** for people on the sign-up list, as the website already promises |
| Basic filters | ✓ | ✓ |
| Advanced filters (verified only, style, budget, pace, specific interests) | 🔒 | ✓ |
| Connection requests | 5 a week | Unlimited (fair use 50 a week) |
| Trip plans a month | 2 | Unlimited (fair use 40) |
| Groups | Join any; create 1 active | Create up to 3 active |
| Verified badge (ID + selfie) | — | ✓ |
| Chat, block, report, safety tools | ✓ | ✓ |

---

## 6. Safety

1. **Mutual opt-in:** no message is possible before acceptance. Requests carry an optional note of
   280 characters or fewer.
2. **Phone check** is required before sending requests. One account per phone number.
3. **Block** from any profile, chat or group. It hides both people from each other everywhere,
   immediately.
4. **Report** from any profile, message or group, with a reason (fake profile, asking for money,
   harassment, inappropriate content, feels unsafe, other).
   - Reported messages are kept as evidence even if deleted.
   - 3 open reports against one member automatically pause their ability to send requests until
     Lewis reviews.
5. **Scam guard:** messages are checked on the server for money and contact-moving patterns, such as
   bank details, gift cards, crypto, "send money", WhatsApp or Telegram, or a phone number in the
   first 24 hours of a connection.
   - The **recipient** sees a calm warning card: "Never send money to someone you haven't met.
     Report if this feels wrong."
   - The message is flagged in the review list.
   - Nothing is silently blocked.
6. **New-account limits:** at most 10 messages to people who haven't replied, and requests held back
   for the first 24 hours after the phone check.
7. **Location:** only home city and destination city are ever shown. No GPS.
8. **Meeting-up guidance:** shown once when a connection is accepted, and linked from every chat.
9. **Trusted contact:** a member can email their trip plan, and who they're meeting (first name and
   profile link), to someone they trust. The read-only link expires after the trip ends.
10. **"Did you meet?"** is asked 2 days after a shared trip ends. "Would travel again" answers build
    a private trust signal, used later for ranking.
11. **Moderation page** at `/admin`, admins only:
    - open reports and flagged messages, with context;
    - actions: dismiss, warn, suspend or delete;
    - every action is logged.

---

## 7. Trip planner agent

- **Where:** Supabase Edge Function `planner`. Called only by signed-in members who belong to the
  chat or group.
- **Input:** destination, dates, members' shared interests, pace, budget, any mobility notes, plus
  an optional free-text request ("we love markets", "quieter day 2").
- **Tools the agent can use:** web search, so opening times and events are current, and a lookup
  of the club's own hand-picked activities for popular cities, which it prefers when it has them.
- **Output:** structured JSON, checked before saving. Each day has 2–4 activities, and each activity
  has title, why it suits this pair or group, rough cost band, walking level, and source link.
- **Display:** shown as cards; "Add to our plan" copies an activity to the shared board.
- **Guardrails:**
  - Never suggests meeting at private addresses.
  - Includes the meeting-up guidance line.
  - The prompt is shielded from message content, so only structured profile fields go in.
- **Cost control:**
  - Results are cached for 7 days by destination, month and interest set.
  - Free and Club+ monthly limits are enforced in the function.
  - A hard monthly spend cap is set in the API console.
- **Tests:** schema validation of agent output, limit enforcement, and a fixed-response mock in CI.
  The real-model check runs manually before launch.

### 7a. Booking links and affiliate income (proposed, small)

- **What:** every outbound booking link in the app goes through one redirect, `/go/<id>`. That
  includes planner activities, plan-board items and hand-picked lists. The redirect adds our
  affiliate tag when we have one for that partner, and records the click: who, which plan, which
  partner, when.
- **Partners to apply to:** GetYourGuide, Viator, Booking.com (via Awin) and Skyscanner. Apply once
  the marketing site is live; approval can take weeks. Without an approved tag, links simply go to
  the partner without it.
- **Disclosure:** UK advertising rules (CAP code) require it. A short line by every booking link
  reads: "We may earn a small commission if you book, at no extra cost to you." A fuller
  explanation goes in the terms. Booking links never change what the planner recommends.
- **Data:** a `link_clicks` table (profile_id, plan_id, partner, target_url, created_at). Admins
  only can read it.
- **Later (after launch):** a deal finder for a member's saved trip, built from partners' official
  APIs or feeds (e.g. Skyscanner, Booking.com, GetYourGuide). Scraping travel sites is against their
  terms, breaks often and shows stale prices, so we won't build it that way. It could be a Club+
  perk.

---

## 8. Tech stack

| Layer | Choice |
|---|---|
| App | Vite 6, React 19, TypeScript (strict), React Router |
| Data and auth | `@supabase/supabase-js` v2. The anon key is the only key in the app. |
| Mobile | Capacitor (iOS and Android) and its Push Notifications plugin |
| Server | Supabase Postgres 15+, row-level security, SQL functions, Edge Functions (Deno) |
| Payments | Stripe Checkout and Customer Portal (web), RevenueCat (apps and entitlement sync) |
| Identity | Supabase Auth email OTP; Twilio Verify for SMS; Stripe Identity |
| AI | Claude API (server-side, with the web search tool) |
| Email | Resend (via Supabase SMTP and functions) |
| Error tracking | Sentry (free tier), for web and apps |
| Hosting | Netlify (app site) + Supabase Pro |

Exact package versions are pinned in `app/package.json` when the code scaffold is created.

---

## 9. Commands

```
cd app
npm ci                         # install
npm run dev                    # local app on http://localhost:5173
npm run build                  # typecheck + production build to app/dist
npm run lint                   # eslint
npm test                       # vitest unit tests
npm run e2e                    # playwright end-to-end against local Supabase
npx supabase start             # local Postgres/Auth/Realtime (needs Docker)
npx supabase db reset          # apply migrations + seed
npx supabase test db           # pgTAP tests (RLS, matching, limits)
npx cap sync                   # copy web build into iOS/Android projects
```

---

## 10. Project structure

```
app/                     members' app (new; separate Netlify site)
  src/
    routes/              screens: onboarding, dashboard, trips, connect, chat, groups, plan, settings, admin
    components/          shared UI (cards, chips, sheets, buttons)
    lib/                 supabase client, auth, entitlements, formatting
    styles/              tokens.css (copied from the root styles.css tokens), app.css
  tests/                 vitest unit tests
  e2e/                   playwright tests
  ios/ android/          Capacitor native projects
supabase/
  migrations/            SQL migrations (one per module change, named <timestamp>_<module-id>_<what>.sql)
  functions/             edge functions: planner, stripe-webhook, revenuecat-webhook,
                         identity-webhook, notify, export-data, delete-account, keepalive
  tests/                 pgTAP tests
  seed.sql               interests, cities subset, demo members (local only)
docs/intent, docs/spec   intent and this spec
tasks/                   plan.md, todo.md
```

---

## 11. Code style

TypeScript strict mode. Data access goes through small typed functions in `src/lib`, never
inline in screens. Every database error becomes a message a person can understand.

```ts
// src/lib/connections.ts
export async function sendConnectionRequest(toId: string, note?: string) {
  const { data, error } = await supabase.rpc('send_connection_request', {
    to_id: toId,
    note: note?.trim().slice(0, 280) ?? null,
  });
  if (error) throw friendlyError(error); // e.g. "You've used your 5 requests this week."
  return data as Connection;
}
```

- Plain, kind wording in the interface, at reading age 12. Use "connection", never "match".
- Tap targets are at least 44 px, body text at least 17 px, and contrast is WCAG AA in light and
  dark mode.
- SQL: snake_case. Every table enables row-level security in the same migration that creates it.

---

## 12. Testing strategy

| Level | Tool | Covers |
|---|---|---|
| Database | pgTAP (`supabase test db`) | Every RLS policy (as each role), matching filters and scoring, limits, blocks |
| Unit | Vitest | lib functions, form validation, scam-pattern checker, planner output schema |
| End-to-end | Playwright against local Supabase | Join → profile → trip → suggestions → request → accept → chat → group → plan → block/report; Club+ upgrade with Stripe test mode |
| Launch audits | Existing scratchpad tools | axe accessibility, phone fit 320–430 px, contrast, CSP, performance (LCP < 2.5 s, CLS < 0.1) |
| Devices | TestFlight and Play internal testing | Real phones, including one older Android and a large-text setting |

Every pull request runs lint, build, unit and pgTAP tests in GitHub Actions. End-to-end tests run
before each merge to `main`.

---

## 13. Boundaries

- **Always:**
  - row-level security on every table;
  - limits and permissions checked in the database;
  - run tests before every commit;
  - only the anon key in client code;
  - keep this spec updated when a decision changes.
- **Ask Lewis first:**
  - prices and limits;
  - adding a paid service or dependency not listed here;
  - changing the data model in a way that drops data;
  - anything that changes what other members can see about a member;
  - store listing text.
- **Never:**
  - put a secret key (service role, Stripe secret, Claude, Twilio) in the app or repo;
  - store passwords;
  - show exact location;
  - skip or delete a failing test to get green;
  - message members without their consent.

---

## 14. Success criteria (launch gate)

1. The full end-to-end path in §12 passes in CI, and passes by hand on iPhone, Android and desktop.
2. pgTAP proves a member cannot read another member's private fields, cannot message without an
   accepted connection, cannot exceed limits, and cannot see anyone who blocked them.
3. axe reports no violations on any app screen, light and dark. No horizontal scroll from 320 px up.
4. Club+ purchase, renewal and cancellation work in Stripe test mode and in Apple and Google sandbox.
   Membership shows within 60 seconds on every device.
5. The planner returns a valid plan in under 30 seconds for 10 sample city and interest pairs.
6. Sentry shows no unhandled errors during a 1-week beta with at least 15 founding members.
7. Both apps are submitted to the App Store and Google Play by **6 November**.
8. Privacy policy, terms and cookie notice are final. In-app account deletion and data export work.

---

## 15. Decisions (answered by Lewis, 4 Oct)

1. **Domain:** for now the site is `togethertravelclub.netlify.app`. Lewis will buy a domain before
   launch; the members' app then goes on `app.<domain>`. Until then it runs as a second Netlify
   site (for example `togethertravelclub-app.netlify.app`).
2. **Prices and limits:** as in §5. Free: 5 connection requests a week and 2 trip plans a month.
   Club+: unlimited for both (fair-use caps only). Founding-member offer approved.
3. **Apple developer account:** a **company** account. Lewis has no D-U-N-S number yet and requests
   one now.
4. **Building the iPhone app:** Lewis has a Mac laptop, so builds and TestFlight uploads can run
   from it. GitHub's Mac machines stay as the backup.
5. **Beta group:** yes, 15–25 founding members from about 30 October, invited from the sign-up list.
6. **Reviewing reports:** Lewis alone at launch, to a `safety@<domain>` address once the domain is
   bought.
7. **Minimum age:** 18.
