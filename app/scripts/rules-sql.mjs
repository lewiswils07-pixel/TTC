// Keeps the database's copy of the club's rules equal to app/rules.json.
//
//   npm run rules
//
// writes supabase/rules.sql (the values for the private.rules table) and
// supabase/tests/rules.test.sql (a database test that every rule, and every
// length or answer list still written into a table check, matches
// rules.json). When a value has changed it also adds a migration with the new
// values: that file is the one to paste into the live database.
// tests/rules.test.ts fails if these files are out of date.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const supabase = join(app, '..', 'supabase')

/** Table checks that still hold a rule's number, and the text each must contain. */
const LENGTHS = [
  ['profiles', 'profiles_display_name_check', 'profile.nameMax', (v) => `<= ${v}`],
  ['profiles', 'profiles_bio_check', 'profile.bioMax', (v) => `<= ${v}`],
  ['profiles', 'profiles_mobility_note_check', 'profile.mobilityNoteMax', (v) => `<= ${v}`],
  ['profiles', 'profiles_travelling_with_check', 'profile.travellingWithMax', (v) => `<= ${v}`],
  ['profiles', 'profiles_languages_check', 'profile.languagesMax', (v) => `cardinality(languages) <= ${v}`],
  ['preferences', 'preferences_age_min_check', 'age.min', (v) => `age_min >= ${v}`],
  ['connections', 'connections_note_check', 'connections.noteMax', (v) => `<= ${v}`],
  ['messages', 'messages_body_check', 'chat.messageMax', (v) => `<= ${v}`],
  ['trips', 'trips_check1', 'trips.maxNights', (v) => `(end_date - start_date) <= ${v}`],
  ['trips', 'trips_note_check', 'trips.noteMax', (v) => `<= ${v}`],
  ['trips', 'trips_flexible_days_check', 'trips.maxFlexDays', (v) => `flexible_days <= ${v}`],
  ['groups', 'groups_check1', 'trips.maxNights', (v) => `(end_date - start_date) <= ${v}`],
  ['groups', 'groups_name_check', 'groups.nameMax', (v) => `<= ${v}`],
  ['plan_items', 'plan_items_title_check', 'planBoard.ideaMax', (v) => `<= ${v}`],
  ['plan_items', 'plan_items_source_url_check', 'planBoard.linkMax', (v) => `<= ${v}`],
  ['plan_items', 'plan_items_day_check', 'planBoard.maxDay', (v) => `day <= ${v}`],
  ['trip_plan_items', 'trip_plan_items_title_check', 'planBoard.ideaMax', (v) => `<= ${v}`],
  ['trip_plan_items', 'trip_plan_items_source_url_check', 'planBoard.linkMax', (v) => `<= ${v}`],
  ['trip_plan_items', 'trip_plan_items_day_check', 'planBoard.maxDay', (v) => `day <= ${v}`],
  ['city_reviews', 'city_reviews_body_check', 'reviews.textMax', (v) => `<= ${v}`],
  ['reports', 'reports_details_check', 'safety.reportDetailsMax', (v) => `<= ${v}`],
  ['moderation_actions', 'moderation_actions_note_check', 'safety.adminNoteMax', (v) => `<= ${v}`],
  ['member_notices', 'member_notices_body_check', 'safety.adminNoteMax', (v) => `<= ${v}`],
  ['meetup_shares', 'meetup_shares_place_check', 'meetups.placeMax', (v) => `<= ${v}`],
  ['meetup_shares', 'meetup_shares_note_check', 'meetups.noteMax', (v) => `<= ${v}`],
  ['nps_responses', 'nps_responses_comment_check', 'survey.commentMax', (v) => `<= ${v}`],
]

/** Answer lists written into table checks, as Postgres prints them. */
const array = (values) => `ARRAY[${values.map((v) => `'${v}'::text`).join(', ')}]`
const set = (values) => `'{${values.join(',')}}'`
const CHOICES = [
  ['profiles', 'profiles_gender_check', 'gender', array],
  ['profiles', 'profiles_travel_style_check', 'travelStyle', array],
  ['profiles', 'profiles_pace_check', 'pace', array],
  ['profiles', 'profiles_budget_check', 'budget', array],
  ['profiles', 'profiles_room_sharing_check', 'roomSharing', array],
  ['profiles', 'profiles_day_rhythm_check', 'dayRhythm', array],
  ['profiles', 'profiles_walking_check', 'walking', array],
  ['profiles', 'profiles_diet_check', 'diet', array],
  ['profiles', 'profiles_sexuality_check', 'sexuality', array],
  ['profiles', 'profiles_religion_check', 'religion', array],
  ['profiles', 'profiles_ethnicity_check', 'ethnicity', array],
  ['preferences', 'preferences_styles_check', 'travelStyle', set],
  ['preferences', 'preferences_paces_check', 'pace', set],
  ['preferences', 'preferences_budgets_check', 'budget', set],
  // Who to show: "Non-binary" there also covers the other identities.
  ['preferences', 'preferences_genders_check', 'genderShown', set],
]

/** Functions that must keep a fixed number (they back a table check or an
 *  index, so can't look it up), and the text their source must contain. */
const FUNCTIONS = [
  ['valid_card_answers(jsonb)', 'card.answers', (v) => `jsonb_array_length(answers) <= ${v}`],
  ['valid_card_answers(jsonb)', 'card.maxChars', (v) => `between 1 and ${v}`],
  ['valid_card_answers(jsonb)', 'card.maxWords', (v) => `'\\s+')) > ${v}`],
  ['meetup_share_ends(public.meetup_shares)', 'meetups.linkDays', (v) => `interval '${v} days'`],
  ['valid_photo_book(uuid, text[])', 'profile.photoBookMax', (v) => `cardinality(book) <= ${v}`],
]

/** Every number in rules.json, as "section.name" keys. */
export function flatten(rules) {
  const out = []
  for (const [section, values] of Object.entries(rules)) {
    if (section.startsWith('$') || section === 'choices') continue
    for (const [name, value] of Object.entries(values)) out.push([`${section}.${name}`, value])
  }
  return out
}

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`

export function rulesSql(rules) {
  const rows = flatten(rules)
  return `-- Written by \`npm run rules\` from app/rules.json. Don't edit by hand.
insert into private.rules (key, value) values
${rows.map(([k, v]) => `  (${lit(k)}, ${v})`).join(',\n')}
on conflict (key) do update set value = excluded.value;
delete from private.rules where key not in (${rows.map(([k]) => lit(k)).join(', ')});
`
}

export function rulesTest(rules) {
  const rows = flatten(rules)
  const get = (key) => {
    const found = rows.find(([k]) => k === key)
    if (!found) throw new Error(`rules.json has no ${key}`)
    return found[1]
  }
  const constraint = (table, name) =>
    `(select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.${table}'::regclass and conname = ${lit(name)})`
  const lines = [
    ...rows.map(([k, v]) => `select is(private.rule(${lit(k)}), ${v}, ${lit(`${k} is ${v}, as in rules.json`)});`),
    `select is((select count(*)::int from private.rules), ${rows.length}, 'no rules beyond rules.json');`,
    ...LENGTHS.map(
      ([table, name, key, text]) =>
        `select ok(strpos(${constraint(table, name)}, ${lit(text(get(key)))}) > 0, ${lit(`${name} uses ${key} (${get(key)})`)});`,
    ),
    ...CHOICES.map(([table, name, key, text]) => {
      if (!rules.choices[key]) throw new Error(`rules.json has no choices.${key}`)
      return `select ok(strpos(${constraint(table, name)}, ${lit(text(rules.choices[key]))}) > 0, ${lit(`${name} lists the ${key} answers in rules.json`)});`
    }),
    // Each holiday question's answers, as valid_holiday_prefs() lists them.
    ...Object.entries(rules.choices.holiday).map(
      ([key, values]) =>
        `select ok(strpos((select prosrc from pg_proc where oid = 'public.valid_holiday_prefs(jsonb)'::regprocedure), ${lit(`when '${key}' then array[${values.map((v) => `'${v}'`).join(', ')}]`)}) > 0, ${lit(`valid_holiday_prefs lists the ${key} answers in rules.json`)});`,
    ),
    ...FUNCTIONS.map(
      ([fn, key, text]) =>
        `select ok(strpos((select prosrc from pg_proc where oid = ${lit(`public.${fn}`)}::regprocedure), ${lit(text(get(key)))}) > 0, ${lit(`${fn.split('(')[0]} uses ${key} (${get(key)})`)});`,
    ),
  ]
  return `-- Written by \`npm run rules\` from app/rules.json. Don't edit by hand.
-- Fails when the database's rules differ from the app's.
begin;
select plan(${lines.length});
${lines.join('\n')}
select * from finish();
rollback;
`
}

/** The name for a new migration, the day after the latest one. */
function nextMigration() {
  const last = readdirSync(join(supabase, 'migrations')).filter((f) => /^\d{14}_/.test(f)).sort().at(-1)
  const y = Number(last.slice(0, 4)), m = Number(last.slice(4, 6)), d = Number(last.slice(6, 8))
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replaceAll('-', '')
  return join(supabase, 'migrations', `${next}090000_rules_update.sql`)
}

const read = (path) => {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rules = JSON.parse(readFileSync(join(app, 'rules.json'), 'utf8'))
  const sqlPath = join(supabase, 'rules.sql')
  const sql = rulesSql(rules)
  if (read(sqlPath) !== sql) {
    writeFileSync(sqlPath, sql)
    if (!process.argv.includes('--no-migration')) {
      const file = nextMigration()
      writeFileSync(file, `-- The club's rules changed in app/rules.json.\n${sql.split('\n').slice(1).join('\n')}`)
      console.log(`New migration: ${file}`)
    }
  }
  writeFileSync(join(supabase, 'tests', 'rules.test.sql'), rulesTest(rules))
  console.log('Database rules and test are up to date.')
}
