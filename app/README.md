# Members app

The signed-in part of the club: sign-in with an email code, profile set-up,
and (from week 2) trips, suggestions, connections and chat. A Vite + React +
TypeScript web app, wrapped as iPhone and Android apps with Capacitor.

## Renaming the club

Everything brand-related lives in **`brand.json`**: name, short name,
tagline, web addresses, store id and colours (light and dark). Change it,
then:

    npm run cap:sync      # rebuilds and copies the new name into the phone apps

The sign-in email (`../supabase/templates/sign-in-code.html`) also names the
club; update it and paste it into Supabase again. The store id (`appId`)
can't change after the first App Store / Google Play upload.

## Changing a rule

Every limit and answer list (interests to pick, weekly requests, group
sizes, how far ahead trips can be, text lengths...) lives in
**`rules.json`**. Screens, checks and messages all read it. After changing a
value:

    npm run rules         # writes the database change and its test

That adds a migration under `../supabase/migrations/` to paste into the
live database. `npm test` fails if the database files are out of date.
Sign-in settings (code length, shortest password) also need changing in
Supabase's Auth settings.

## Everyday commands

    npm ci                # install
    npm run dev           # app on http://localhost:5173 (uses the live Supabase project)
    npm run lint
    npm test
    npm run build         # type check + production build into dist/
    npm run cap:sync      # build and copy into ios/ and android/
    npx cap open ios      # open in Xcode (Mac)
    npx cap open android  # open in Android Studio

Database (from the repo root, needs Docker):

    npx supabase start    # local database, sign-in and storage
    npx supabase db reset # re-apply migrations and the 200 demo members
    npx supabase test db  # pgTAP security tests

To point the app at the local database, put the URL and anon key that
`npx supabase start` prints into `app/.env.local`.
