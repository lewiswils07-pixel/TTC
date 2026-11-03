import { BackIcon, CloseIcon } from '../components/Icons'
import { Camera, Check, Plus, SlidersHorizontal, UsersRound } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { CityPicker } from '../components/CityPicker'
import { Field, FieldError, TextField } from '../components/Field'
import { InterestPicker } from '../components/InterestPicker'
import { Layout, Loading, Monogram } from '../components/Layout'
import { ActionBar, SaveError } from '../components/Form'
import { QuestionPicker } from '../components/QuestionPicker'
import { Dropdown } from '../components/Dropdown'
import { ChipChoice } from '../components/ChipChoice'
import { brand } from '../lib/brand'
import { ANSWER_MAX_CHARS, ANSWER_MAX_WORDS, ANSWERS_TO_PICK, checkAnswer, questionText, saveCard, wordCount, type CardAnswer } from '../lib/card'
import { cityLabel, searchCities, searchPlaces, type City } from '../lib/cities'
import { addToWishlist, listWishlist, popularDestinations, removeFromWishlist, type PopularPlace, type WishlistItem } from '../lib/trips'
import { clearDrafts, useDraft } from '../lib/draft'
import { messageOf } from '../lib/errors'
import { clearMyLocation, locateMe } from '../lib/location'
import { saveMeetPreferences } from '../lib/filters'
import { firstUnfinishedStep, STEP } from '../lib/onboarding'
import { rules } from '../lib/rules'
import {
  DIETS,
  GENDERS,
  MAX_PREF_AGE,
  MIN_AGE,
  ageFromDate,
  PHOTO_BOOK_MAX,
  INTERESTS_MIN,
  INTERESTS_TO_PICK,
  MONTHS,
  HOLIDAY_QUESTIONS,
  PERSONAL_FIELDS,
  ROOM_SHARING,
  STYLE_QUESTIONS,
  type Gender,
  type HolidayPrefs,
  type PersonalField,
} from '../lib/options'
import { addBookPhoto, photoUrl, preparePhoto, removeBookPhoto, uploadPhoto, usePhotoUrl } from '../lib/photo'
import { forgetExtras } from '../lib/member'
import { useConfirm } from '../lib/useConfirm'
import { finishOnboarding, listInterests, myDiet, saveAboutMe, saveBasics, saveDiet, saveInterests, saveMore, saveStyleAndPreferences, type Interest, type More, type MyProfile } from '../lib/profile'
import { useSession } from '../lib/session-context'
import { useChecks } from '../lib/useChecks'
import { useMyProfile } from '../lib/useMyProfile'
import { birthDate, checkBirthDate, checkChosen, checkInterests, checkName } from '../lib/validation'

const STEPS = [
  { title: 'About you', heading: 'About you', intro: 'Other members see your first name, age and home town. Your date of birth and email always stay private.' },
  { title: 'How you travel', heading: 'How do you like to travel?', intro: 'This helps you find people who’d enjoy the same trip. Change it any time.' },
  { title: 'Your wish list', heading: 'Where would you love to go?', intro: 'Add a few places. Members who dream of the same ones will see you share them.' },
] as const satisfies readonly { title: string; heading: string; intro: string }[]
/** Sign-up is 2 short screens (round 8 testers, 23 Oct: "let me in first, ask the rest later"). The same screens edit the
 *  profile afterwards with the extras added in (a few words, the rest of the travel style, holiday preferences), and the wish
 *  list and card are a third screen, opened from the profile. */
const TOTAL = STEPS.length
export const SIGNUP_STEPS = 2

export function Onboarding() {
  const { session } = useSession()
  const userId = session!.user.id
  const { data, error, reload } = useMyProfile(userId)
  const [interests, setInterests] = useState<Interest[] | null>(null)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    listInterests().then(setInterests, () => setInterests([]))
  }, [])

  if (error) {
    return (
      <Layout>
        <p className="error" role="alert">
          {error}
        </p>
        <button className="btn btn-primary" onClick={() => reload()}>
          Try again
        </button>
      </Layout>
    )
  }
  if (!data || !interests) return <Loading />

  const requested = Number(params.get('step'))
  const firstTime = !data.profile.onboarded_at
  // A new member can't skip ahead to the wish list: sign-up ends after step 2.
  const step = requested >= 1 && requested <= (firstTime ? SIGNUP_STEPS : TOTAL) ? requested : firstUnfinishedStep(data)
  const goTo = (n: number) => setParams({ step: String(n) })
  const next = async () => {
    if (firstTime && step >= SIGNUP_STEPS) {
      await finishOnboarding()
      await reload()
      return navigate('/welcome', { replace: true })
    }
    await reload()
    // Opened from elsewhere (like Connect asking for a photo): go back there.
    const returnTo = params.get('return')
    if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) return navigate(returnTo, { replace: true })
    if (firstTime) goTo(step + 1)
    else navigate('/profile', { replace: true })
  }
  const back = firstTime ? (step > 1 ? () => goTo(step - 1) : undefined) : () => navigate('/profile')

  return (
    <Layout>
      <StepFrame step={step} key={step} signingUp={firstTime} onBack={back}>
        {step === STEP.basics && <BasicsStep userId={userId} data={data} onDone={next} />}
        {step === STEP.travel && <TravelStep userId={userId} data={data} interests={interests} onDone={next} />}
        {step === STEP.wishlist && <WishStep userId={userId} data={data} onDone={next} />}
      </StepFrame>
    </Layout>
  )
}

function StepFrame({ step, signingUp, onBack, children }: { step: number; signingUp: boolean; onBack?: () => void; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  const { title, heading: h1, intro } = STEPS[step - 1]
  // The first screen of sign-up welcomes them and says plainly what the Collective is for (Claude Design, 15 Oct).
  const welcome = signingUp && step === STEP.basics
  return (
    <div className="step">
      <div className="step-top">
        {onBack ? (
          <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
            <BackIcon />
          </button>
        ) : (
          <span className="step-top-space" />
        )}
        <p className="step-label">{signingUp ? `Step ${step} of ${SIGNUP_STEPS} · ${title}` : 'Edit your profile'}</p>
        <Monogram size={40} />
      </div>
      {signingUp && (
        <div className="step-progress" aria-hidden="true">
          {Array.from({ length: SIGNUP_STEPS }, (_, i) => (
            <span key={i} className={i < step ? 'is-done' : undefined} />
          ))}
        </div>
      )}
      {welcome && (
        <p className="friend-pill">
          <UsersRound size={16} strokeWidth={2} aria-hidden="true" />
          Friendship and travel · not dating
        </p>
      )}
      <h1 ref={heading} tabIndex={-1}>
        {welcome ? 'Welcome to the Collective' : h1}
      </h1>
      <p className="lede">{welcome ? 'Meet people going where you’re going, and find good company for the trip. Let’s start with the basics.' : intro}</p>
      {children}
    </div>
  )
}

/** Shared submit handling: busy state, friendly error, then move on. */
function useStepSubmit(save: () => Promise<void>, onDone: () => Promise<void>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await save()
      await onDone()
    } catch (err) {
      setError(messageOf(err))
      setBusy(false)
    }
  }
  return { busy, error, setError, submit }
}

type StepProps = { userId: string; data: MyProfile; onDone: () => Promise<void>; onBack?: () => void }

function BasicsStep({ userId, data, onDone }: StepProps) {
  const p = data.profile
  const [name, setName] = useDraft('basics.name', p.display_name ?? '')
  const [dobDay, setDobDay] = useDraft('basics.day', p.birth_date ? String(Number(p.birth_date.slice(8, 10))) : '')
  const [dobMonth, setDobMonth] = useDraft('basics.month', p.birth_date ? String(Number(p.birth_date.slice(5, 7))) : '')
  const [dobYear, setDobYear] = useDraft('basics.year', p.birth_date ? p.birth_date.slice(0, 4) : p.birth_year ? String(p.birth_year) : '')
  const [gender, setGender] = useDraft<Gender[]>('basics.gender', p.gender ? [p.gender] : [])
  const [city, setCity] = useDraft<City | null>('basics.city', p.home_city)
  // "Use my location" (Lewis, 6 Oct): sets the nearest town; can be used again after a move.
  const [locating, setLocating] = useState(false)
  const [located, setLocated] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  async function locate() {
    setLocating(true)
    setLocateError(null)
    try {
      setCity(await locateMe())
      setLocated(true)
    } catch (err) {
      setLocateError(messageOf(err))
    } finally {
      setLocating(false)
    }
  }

  // Who they'd like to meet, asked at sign-up too (Lewis, 11 Oct, like Hinge).
  const prefs = data.preferences
  // Who they see is chosen in Filters now (Claude Design, 15 Oct); until then, people around their own age
  // (round 6 testers: 18 to 99+ mixed students with retirees).
  const genders = prefs.genders
  const chosenAges: [number, number] = [prefs.age_min, Math.min(prefs.age_max, MAX_PREF_AGE)]
  const agesSet = prefs.age_min !== MIN_AGE || prefs.age_max < MAX_PREF_AGE
  const dob = birthDate(dobDay, dobMonth, dobYear)
  const myAge = dob ? ageFromDate(dob) : null
  const suggested = !agesSet && myAge !== null && myAge >= MIN_AGE
  const ages: [number, number] = suggested ? [Math.max(MIN_AGE, myAge - 10), Math.min(MAX_PREF_AGE, myAge + 10)] : chosenAges
  const distance = prefs.max_distance_km
  // The photo and a few words sit on this first screen too (Claude Design, 15 Oct). Both optional.
  const photo = usePhotoPick(p.photo_path)
  const [headline, setHeadline] = useDraft('basics.headline', p.headline ?? '')
  const [bio, setBio] = useDraft('basics.bio', p.bio ?? '')

  const errors = {
    name: checkName(name),
    birthDate: checkBirthDate(dobDay, dobMonth, dobYear),
    gender: checkChosen('your gender')(gender),
    city: city ? null : 'Please choose your home city from the list.',
  }
  const { shown, touch, validateAll } = useChecks(errors)
  // Once the year is in, check the date as soon as a day or month list closes.
  const checkDob = () => {
    if (dobYear.length === 4) touch('birthDate')
  }

  const { busy, error, submit } = useStepSubmit(async () => {
    // A town typed in by hand replaces any exact spot saved before.
    if (!located && city!.id !== p.home_city?.id) await clearMyLocation(userId)
    await saveBasics(userId, { display_name: name.trim(), birth_date: birthDate(dobDay, dobMonth, dobYear), gender: gender[0], home_city_id: city!.id })
    await saveMeetPreferences(userId, { genders, age_min: ages[0], age_max: ages[1], max_distance_km: distance })
    if (photo.blob) await uploadPhoto(userId, photo.blob, p.photo_path)
    if (p.onboarded_at) await saveAboutMe(userId, { headline: headline.trim() || null, bio: bio.trim() || null })
    clearDrafts('basics.')
  }, onDone)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (validateAll()) void submit()
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="card form-card">
        <TextField
          name="name"
          label="First name"
          autoComplete="given-name"
          maxLength={rules.profile.nameMax + 1}
          value={name}
          error={shown('name')}
          valid={!errors.name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => touch('name')}
        />
        <fieldset className="field" data-field="birthDate" aria-describedby="dob-hint">
          <legend>Date of birth</legend>
          <p className="hint" id="dob-hint">
            You must be {MIN_AGE} or over.
          </p>
          <div className="dob">
            <Dropdown
              label="Day"
              placeholder="Day"
              value={dobDay}
              columns={7}
              invalid={!!shown('birthDate')}
              groups={[{ options: Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })) }]}
              onChange={setDobDay}
              onClose={checkDob}
            />
            <Dropdown
              label="Month"
              placeholder="Month"
              value={dobMonth}
              columns={3}
              invalid={!!shown('birthDate')}
              groups={[{ options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })) }]}
              onChange={setDobMonth}
              onClose={checkDob}
            />
            <input
              aria-label="Year"
              className="input"
              inputMode="numeric"
              autoComplete="bday-year"
              placeholder="Year"
              maxLength={4}
              value={dobYear}
              aria-invalid={shown('birthDate') ? true : undefined}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '')
                setDobYear(v)
                if (v.length === 4) touch('birthDate')
              }}
              onBlur={() => touch('birthDate')}
            />
          </div>
          <FieldError error={shown('birthDate')} />
        </fieldset>
        <fieldset className="field" data-field="gender">
          <legend>Gender</legend>
          <div className="radio-cards">
            {GENDERS.map((g) => (
              <label key={g.value} className="radio-card">
                <input
                  type="radio"
                  name="gender"
                  value={g.value}
                  checked={gender[0] === g.value}
                  aria-invalid={shown('gender') ? true : undefined}
                  onChange={() => {
                    setGender([g.value as Gender])
                    touch('gender')
                  }}
                />
                <span>{g.label}</span>
              </label>
            ))}
          </div>
          <FieldError error={shown('gender')} />
        </fieldset>
        <p className="tip-box">
          <SlidersHorizontal size={20} strokeWidth={1.8} aria-hidden="true" />
          <span>
            Prefer to meet only women, or people near your age? Choose who you see any time in <strong>Filters</strong>.
          </span>
        </p>
        <div data-field="city" className="home-city">
          <CityPicker
            label="Home city"
            value={city}
            onChange={(c) => {
              setCity(c)
              setLocated(false)
              if (c) touch('city')
            }}
            onBlur={() => touch('city')}
            error={shown('city')}
          />
          <button type="button" className="btn btn-link locate" onClick={locate} disabled={locating}>
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
              <circle cx="10" cy="10" r="3" fill="currentColor" />
              <path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            {locating ? 'Finding you…' : 'Use my location'}
          </button>
          {located && city && (
            <p className="hint" role="status">
              We’ve set your home to {cityLabel(city)}. Not quite right? Type your town above instead.
            </p>
          )}
          <FieldError error={locateError} />
        </div>
        <PhotoField pick={photo} />
        {p.onboarded_at && data.more && <PhotoBookEditor userId={userId} start={data.more.photo_book} />}
        {p.onboarded_at && (
          <>
            <div className="field" data-field="headline">
              <label htmlFor="headline">
                You in one line <span className="label-quiet">(optional)</span>
              </label>
              <input
                id="headline"
                className="input"
                maxLength={rules.profile.headlineMax}
                placeholder="For example, happiest with a map and a good coffee."
                aria-describedby="headline-hint"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
              <p className="hint" id="headline-hint">
                Shown under your name on your card
              </p>
            </div>
            <div className="field" data-field="bio">
              <label htmlFor="bio">
                A few words about you <span className="label-quiet">(optional)</span>
              </label>
              <textarea
                id="bio"
                className="textarea"
                maxLength={rules.profile.bioMax}
                placeholder="For example, happiest exploring a new city on foot, with a long lunch at the end."
                aria-describedby="bio-count"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
              <p className="char-count" id="bio-count">
                {bio.length} / {rules.profile.bioMax}
              </p>
            </div>
          </>
        )}
      </div>
      <SaveError error={error} />
      <ActionBar busy={busy || photo.preparing} label={p.onboarded_at ? 'Save' : undefined} />
    </form>
  )
}

/** A chosen photo, made ready (resized) before it's saved. */
function usePhotoPick(savedPath: string | null) {
  const [preview, setPreview] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (savedPath) photoUrl(savedPath).then(setPreview)
  }, [savedPath])

  useEffect(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [blob])

  async function pick(file: File | undefined) {
    if (!file) return
    setPreparing(true)
    setError(null)
    try {
      setBlob(await preparePhoto(file))
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setPreparing(false)
    }
  }
  return { preview, blob, preparing, error, pick }
}

const PHOTO_TIPS = ['Just you', 'Face clearly visible', 'Recent', 'Good light']

function PhotoField({ pick }: { pick: ReturnType<typeof usePhotoPick> }) {
  return (
    <fieldset className="field photo-field" data-field="photo">
      <legend>{pick.preview ? 'Your photo' : 'Add a photo'}</legend>
      <div className="photo-row">
        <label className={pick.preview ? 'photo-drop has-photo' : 'photo-drop'} htmlFor="photo">
          {pick.preview ? (
            <img src={pick.preview} alt="Your profile photo" />
          ) : (
            <span className="photo-drop-icon" aria-hidden="true">
              <Camera size={22} strokeWidth={2} />
            </span>
          )}
          <span className={pick.preview ? 'visually-hidden' : undefined}>{pick.preview ? 'Change photo' : 'Add photo'}</span>
        </label>
        <input id="photo" className="visually-hidden" type="file" accept="image/*" onChange={(e) => pick.pick(e.target.files?.[0])} />
        <div className="photo-good">
          <strong>For a great first impression:</strong>
          <ul>
            {PHOTO_TIPS.map((t) => (
              <li key={t}>
                <Check size={16} strokeWidth={2.4} aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
          {pick.preview && (
            <label className="btn-link" htmlFor="photo">
              Change photo
            </label>
          )}
        </div>
      </div>
      <p className="hint" role="status" aria-live="polite">
        {pick.preparing ? 'Getting your photo ready…' : 'You’ll need a photo to connect with people.'}
      </p>
      <FieldError error={pick.error} />
    </fieldset>
  )
}

/** Up to PHOTO_BOOK_MAX more photos, of you or your trips. Each one saves as soon as it's added. */
function PhotoBookEditor({ userId, start }: { userId: string; start: string[] }) {
  const [book, setBook] = useState(start)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { ask, dialog } = useConfirm()

  async function add(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    let next = book
    try {
      for (const file of [...files].slice(0, PHOTO_BOOK_MAX - book.length)) {
        next = await addBookPhoto(userId, await preparePhoto(file), next)
        setBook(next)
      }
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
      forgetExtras(userId)
    }
  }

  async function remove(path: string) {
    if (!(await ask({ title: 'Remove this photo?', confirmLabel: 'Remove photo' }))) return
    setError(null)
    try {
      setBook(await removeBookPhoto(userId, path, book))
      forgetExtras(userId)
    } catch (err) {
      setError(messageOf(err))
    }
  }

  return (
    <fieldset className="field photo-book" data-field="photo-book">
      <legend>Photo book (optional)</legend>
      <p className="hint">Add up to {PHOTO_BOOK_MAX} more photos, of you or your trips.</p>
      <ul className="photo-book-grid">
        {book.map((path, i) => (
          <li key={path}>
            <BookThumb path={path} />
            <button type="button" className="photo-book-remove" onClick={() => void remove(path)} aria-label={`Remove photo ${i + 1}`}>
              <CloseIcon />
            </button>
          </li>
        ))}
        {book.length < PHOTO_BOOK_MAX && (
          <li>
            <label className="photo-book-add">
              <input type="file" accept="image/*" multiple className="visually-hidden" disabled={busy} onChange={(e) => void add(e.target.files)} />
              <span aria-hidden="true">+</span>
              {busy ? 'Adding…' : 'Add photos'}
            </label>
          </li>
        )}
      </ul>
      <FieldError error={error} />
      {dialog}
    </fieldset>
  )
}

function BookThumb({ path }: { path: string }) {
  const src = usePhotoUrl(path)
  return src ? <img src={src} alt="" decoding="async" /> : <span className="skeleton" aria-hidden="true" />
}

type StyleAnswers = Record<(typeof STYLE_QUESTIONS)[number]['key'], string[]>

/** Interests and travel style on one screen (Claude Design, 15 Oct). After sign-up it also edits holiday preferences and the rest. */
/** The design's order: money and planning first, then how the days feel (Claude Design, 17 Oct). */
const STEP_STYLE_ORDER = ['budget', 'travel_style', 'pace', 'moving', 'travel_often', 'booking', 'group_size'] as const
/** Sign-up asks only these two; the rest come later from the profile (round 8 testers, 23 Oct). */
const SIGNUP_STYLE = ['budget', 'pace'] as const

function TravelStep({ userId, data, interests, onDone }: StepProps & { interests: Interest[] }) {
  const p = data.profile
  const editing = !!p.onboarded_at
  const [selected, setSelected] = useState<number[]>(data.interestIds)
  const errors = { interests: checkInterests(selected) }
  const { shown, validateAll } = useChecks(errors)
  const prefs = data.preferences
  const more = data.more
  // Your travel style (Lewis, 11 Oct): one answer to each, all optional.
  const [style, setStyle] = useState<StyleAnswers>(() => Object.fromEntries(STYLE_QUESTIONS.map((q) => [q.key, p[q.key] ? [p[q.key]!] : []])) as StyleAnswers)
  const [travellingWith, setTravellingWith] = useState(p.travelling_with ?? '')
  const [room, setRoom] = useState<string[]>(p.room_sharing ? [p.room_sharing] : [])
  const [holiday, setHoliday] = useState<HolidayPrefs>(() => more?.holiday_prefs ?? {})
  const [personal, setPersonal] = useState<Pick<More, PersonalField | 'shown_fields'>>(() => ({
    sexuality: more?.sexuality ?? null,
    religion: more?.religion ?? null,
    ethnicity: more?.ethnicity ?? null,
    shown_fields: more?.shown_fields ?? [],
  }))
  const [diet, setDiet] = useState<string[] | null>(null)
  useEffect(() => {
    myDiet(userId).then(setDiet, () => setDiet([]))
  }, [userId])

  // All optional, holiday questions too (Lewis, 13 Oct: testers were stopped by "Please choose at least one").

  const { busy, error, submit } = useStepSubmit(async () => {
    await saveInterests(selected)
    const one = (key: keyof StyleAnswers) => (style[key][0] ?? null) as never
    await saveStyleAndPreferences(
      userId,
      {
        pace: one('pace'),
        budget: one('budget'),
        travel_style: one('travel_style'),
        moving: one('moving'),
        travel_often: one('travel_often'),
        booking: one('booking'),
        group_size: one('group_size'),
        travelling_with: travellingWith.trim() || null,
        room_sharing: (room[0] ?? null) as never,
      },
      prefs,
    )
    if (editing && more) await saveMore(userId, { ...personal, shown_fields: personal.shown_fields.filter((f) => personal[f]), holiday_prefs: holiday })
    if (editing && diet) await saveDiet(userId, diet)
  }, onDone)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (validateAll()) void submit()
      }}
      noValidate
    >
      <section className="step-section" aria-labelledby="interests-heading">
        <h2 id="interests-heading" className="step-section-title">
          Interests
        </h2>
        <p className="hint">
          Pick {INTERESTS_MIN} to {INTERESTS_TO_PICK} you love most, and meet people who love them too.
        </p>
        <InterestPicker interests={interests} selected={selected} onChange={setSelected} max={INTERESTS_TO_PICK} error={shown('interests')} />
      </section>

      {/* All optional, and there are no wrong answers. */}
      <section className="step-section" aria-labelledby="style-heading">
        <h2 id="style-heading" className="step-section-title">
          Your travel style
        </h2>
        {(editing ? STEP_STYLE_ORDER : SIGNUP_STYLE)
          .map((key) => STYLE_QUESTIONS.find((q) => q.key === key)!)
          .map((q) => (
            <ChipChoice<string> key={q.key} name={q.key} legend={q.label} options={q.options} selected={style[q.key]} onChange={(v) => setStyle((x) => ({ ...x, [q.key]: v }))} grid />
          ))}
        {/* Survey: sharing a twin room saves the single supplement. Shown on your card. */}
        {editing && <ChipChoice<string> name="room_sharing" legend="Happy to share a twin room?" options={ROOM_SHARING} selected={room} onChange={setRoom} grid />}
        {!editing && <p className="hint">You can add the rest of your travel style later, from your profile.</p>}
      </section>

      {editing && more && (
        <section className="card form-card" aria-labelledby="holiday-heading">
          <div className="section-head">
            <h2 id="holiday-heading" className="card-title">
              Holiday preferences
            </h2>
            <span className="tag tag-plus">{brand.plusName}</span>
          </div>
          <p className="hint">More information about your travel interests helps us improve the quality of your matches. Pick as many as apply in each.</p>
          {HOLIDAY_QUESTIONS.map((q) => (
            <ChipChoice<string>
              key={q.key}
              name={`holiday-${q.key}`}
              legend={q.label}
              options={q.options}
              selected={holiday[q.key] ?? []}
              onChange={(v) => setHoliday((h) => ({ ...h, [q.key]: v.length ? v : undefined }))}
              multiple
            />
          ))}
        </section>
      )}

      {editing && (
        <section className="card form-card" aria-labelledby="personal-heading">
          <h2 id="personal-heading" className="card-title">
            About you
          </h2>
          <fieldset className="field" data-field="diet">
            <legend>Food (optional)</legend>
            <div className="chips chips-compact chips-light">
              {DIETS.map((d) => {
                const checked = !!diet?.includes(d.value)
                return (
                  <label className="chip" key={d.value}>
                    <input
                      type="checkbox"
                      name="diet"
                      value={d.value}
                      checked={checked}
                      onChange={() => setDiet((list) => (checked ? (list ?? []).filter((x) => x !== d.value) : [...(list ?? []), d.value]))}
                    />
                    <span>{d.label}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          <TextField
            name="travelling-with"
            label="Travelling with someone? (optional)"
            hint="For example, “usually with my sister Jo”. Shown on your card."
            maxLength={rules.profile.travellingWithMax}
            value={travellingWith}
            onChange={(e) => setTravellingWith(e.target.value)}
          />
          {more && (
            <>
              <p className="hint">These three stay hidden unless you choose to show them on your profile.</p>
              {PERSONAL_FIELDS.map((f) => (
                <div className="personal-field" key={f.key}>
                  <Field name={f.key} label={f.label}>
                    {({ id, describedBy }) => (
                      <Dropdown
                        id={id}
                        placeholder="Prefer not to say"
                        value={personal[f.key] ?? ''}
                        describedBy={describedBy}
                        groups={[{ options: [...(personal[f.key] ? [{ value: '', label: 'Prefer not to say' }] : []), ...f.options.map((o) => ({ value: o.value, label: o.label }))] }]}
                        onChange={(v) => setPersonal((x) => ({ ...x, [f.key]: v || null, shown_fields: v ? x.shown_fields : x.shown_fields.filter((k) => k !== f.key) }))}
                      />
                    )}
                  </Field>
                  {personal[f.key] && (
                    <label className="switch-row switch-row-end">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={personal.shown_fields.includes(f.key)}
                        onChange={(e) => setPersonal((x) => ({ ...x, shown_fields: e.target.checked ? [...x.shown_fields, f.key] : x.shown_fields.filter((k) => k !== f.key) }))}
                      />
                      <span>
                        <strong>{personal.shown_fields.includes(f.key) ? 'Shown on your profile' : 'Hidden'}</strong>
                      </span>
                    </label>
                  )}
                </div>
              ))}
            </>
          )}
        </section>
      )}

      <SaveError error={error} />
      <ActionBar
        busy={busy}
        label={editing ? 'Save' : 'Finish'}
        arrow={false}
        note={
          <span aria-live="polite">
            <strong>{selected.length}</strong> picked · {INTERESTS_MIN} to {INTERESTS_TO_PICK}
          </span>
        }
      />
    </form>
  )
}

/** Places they'd love to go, then a line in their own words (Claude Design, 15 Oct). After sign-up it edits all the card answers. */
function WishStep({ userId, data, onDone }: StepProps) {
  const editing = !!data.profile.onboarded_at
  return (
    <>
      <WishlistPicker />
      {!data.card ? <FinishOnly editing={editing} onDone={onDone} /> : editing ? <CardStep userId={userId} data={data} onDone={onDone} /> : <OneAnswer userId={userId} data={data} onDone={onDone} />}
    </>
  )
}

/** On a database without the back of the card yet: just the button. */
function FinishOnly({ editing, onDone }: { editing: boolean; onDone: () => Promise<void> }) {
  const { busy, error, submit } = useStepSubmit(async () => {}, onDone)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <SaveError error={error} />
      <ActionBar busy={busy} label={editing ? 'Done' : 'Finish'} />
    </form>
  )
}

/** Suggested places, when no one has trips planned yet to suggest from. */
const PLACE_IDEAS = ['Seville', 'Vienna', 'Lisbon', 'Kyoto']

/** Places I'd love to go: search, saved chips with ×, and a few ideas to add. Each change saves straight away. */
function WishlistPicker() {
  const [items, setItems] = useState<WishlistItem[] | null | undefined>(undefined)
  const [popular, setPopular] = useState<PopularPlace[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Changing the key resets the picker after each add.
  const [pickerKey, setPickerKey] = useState(0)

  const load = () => listWishlist().then(setItems, (e) => setError(messageOf(e)))
  useEffect(() => {
    void load()
    popularDestinations().then(setPopular)
  }, [])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(false)
    }
  }

  async function add(city: City | null) {
    if (!city) return
    setPickerKey((k) => k + 1)
    if (items?.some((i) => i.city_id === city.id)) return setError(`${city.name} is already on your list.`)
    await run(() => addToWishlist(city))
  }

  async function addIdea(name: string) {
    await run(async () => {
      const city = (await searchCities(name)).find((c) => c.name === name)
      if (city) await addToWishlist(city)
    })
  }

  if (items === null) return null
  const saved = items ?? []
  const savedNames = new Set(saved.map((i) => i.city.name))
  const full = saved.length >= rules.wishlist.max
  const ideas = (popular.length ? popular.map((x) => x.city) : PLACE_IDEAS).filter((n) => !savedNames.has(n)).slice(0, 4)

  return (
    <section className="step-section wish" aria-label="Places you’d love to go">
      {!full && <CityPicker key={pickerKey} label="Places you’d love to go" hint="A country, town or city" value={null} onChange={add} search={searchPlaces} />}
      {saved.length > 0 && (
        <ul className="chip-list wish-chips" aria-label="Saved places">
          {saved.map((item) => (
            <li key={item.city_id}>
              <button type="button" className="chip-remove" aria-label={`Remove ${cityLabel(item.city)}`} disabled={busy} onClick={() => run(() => removeFromWishlist(item.city))}>
                {item.city.name} <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      {full && <p className="hint">Your list is full. Remove a place to add another.</p>}
      {!full && ideas.length > 0 && (
        <>
          <p className="wish-ideas-label">Ideas to add</p>
          <ul className="chip-list wish-ideas">
            {ideas.map((name) => (
              <li key={name}>
                <button type="button" className="chip-idea" disabled={busy} onClick={() => void addIdea(name)}>
                  <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
                  {name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <FieldError error={error} />
    </section>
  )
}

/** The question they start with; "Change question" picks another. */
const FIRST_QUESTION = 'perfect_holiday'

/** One card answer at sign-up, optional. More can be added from Profile. */
function OneAnswer({ userId, data, onDone }: StepProps) {
  const existing = data.card?.card_answers ?? []
  const [answer, setAnswer] = useDraft<CardAnswer>('card.one', existing[0] ?? { q: FIRST_QUESTION, a: '' })
  const [changing, setChanging] = useState(false)
  const errors = { a: answer.a.trim() ? checkAnswer(answer) : null }
  const { shown, touch, validateAll } = useChecks(errors)
  const { busy, error, submit } = useStepSubmit(async () => {
    await saveCard(userId, [answer, ...existing.slice(1, ANSWERS_TO_PICK)])
    clearDrafts('card.')
  }, onDone)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (validateAll()) void submit()
      }}
      noValidate
    >
      <section className="step-section" aria-labelledby="own-words">
        <h2 id="own-words" className="step-section-title">
          In your own words
        </h2>
        <p className="hint">Optional · shown on your card</p>
        <div className="card own-words">
          {changing ? (
            <Field name="q" label="Choose a question">
              {({ id, describedBy }) => (
                <QuestionPicker
                  id={id}
                  value={answer.q}
                  taken={new Set()}
                  describedBy={describedBy}
                  onChange={(q) => {
                    setAnswer({ ...answer, q: q || FIRST_QUESTION })
                    setChanging(false)
                  }}
                />
              )}
            </Field>
          ) : (
            <div className="own-words-head">
              <p className="own-words-q" id="own-words-q">
                {questionText(answer.q)}
              </p>
              <button type="button" className="btn-link" onClick={() => setChanging(true)}>
                Change question
              </button>
            </div>
          )}
          <textarea
            className="input textarea card-answer"
            rows={3}
            maxLength={ANSWER_MAX_CHARS}
            aria-labelledby="own-words-q"
            aria-describedby="own-words-count"
            aria-invalid={shown('a') ? true : undefined}
            value={answer.a}
            onChange={(e) => {
              setAnswer({ ...answer, a: e.target.value })
              if (wordCount(e.target.value) > ANSWER_MAX_WORDS) touch('a')
            }}
            onBlur={() => touch('a')}
          />
          <p className="char-count" id="own-words-count">
            {answer.a.length} / {ANSWER_MAX_CHARS}
          </p>
          <FieldError error={shown('a')} />
        </div>
      </section>
      <SaveError error={error} />
      <div className="action-bar action-bar-stack">
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Saving…' : 'Finish'}
        </button>
        <button type="button" className="btn btn-quiet btn-block" disabled={busy} onClick={() => void onDone()}>
          Skip for now
        </button>
      </div>
    </form>
  )
}

/** The word limit shows (in red) once an answer gets this long. */
const WORDS_WARNING = ANSWER_MAX_WORDS - 5

const EMPTY_ANSWERS: CardAnswer[] = Array.from({ length: ANSWERS_TO_PICK }, () => ({ q: '', a: '' }))

function CardStep({ userId, data, onDone }: StepProps) {
  const [answers, saveAnswers] = useDraft<CardAnswer[]>(
    'card.answers',
    EMPTY_ANSWERS.map((empty, i) => (data.card?.card_answers ?? [])[i] ?? empty),
  )
  const setAnswers = (change: (list: CardAnswer[]) => CardAnswer[]) => saveAnswers(change(answers))
  const errors = Object.fromEntries(
    answers.flatMap((x, i) => [
      // All optional (Lewis, 11 Oct): only a chosen question needs an answer.
      [`q${i}`, null],
      [`a${i}`, x.q ? (x.a.trim() ? checkAnswer(x) : 'Please answer this question, or choose “No question”.') : null],
    ]),
  ) as Record<string, string | null>
  const { shown, touch, validateAll } = useChecks(errors)
  const { busy, error, submit } = useStepSubmit(async () => {
    await saveCard(userId, answers)
    clearDrafts('card.')
  }, onDone)
  const set = (i: number, change: Partial<CardAnswer>) => setAnswers((list) => list.map((x, j) => (j === i ? { ...x, ...change } : x)))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (validateAll()) void submit()
      }}
      noValidate
    >
      {answers.map((answer, i) => {
        const taken = new Set(answers.filter((_, j) => j !== i).map((x) => x.q))
        const words = wordCount(answer.a)
        return (
          <section className="card form-card card-question" key={i} aria-labelledby={`card-q-${i}`}>
            <h2 id={`card-q-${i}`} className="card-title">
              Question {i + 1} of {ANSWERS_TO_PICK}
            </h2>
            <Field name={`q${i}`} label="Choose a question (optional)" error={shown(`q${i}`)}>
              {({ id, describedBy, invalid }) => (
                <QuestionPicker
                  id={id}
                  value={answer.q}
                  taken={taken}
                  invalid={invalid}
                  describedBy={describedBy}
                  onChange={(q) => {
                    set(i, q ? { q } : { q, a: '' })
                    touch(`q${i}`)
                  }}
                />
              )}
            </Field>
            {answer.q && (
              <Field
                name={`a${i}`}
                label={`Your answer to “${questionText(answer.q)}”`}
                hint={
                  // Only once they're close to a limit (Lewis, 6 Oct).
                  words >= WORDS_WARNING || answer.a.length >= ANSWER_MAX_CHARS - 30 ? (
                    <span className="word-limit" aria-live="polite">
                      {words >= WORDS_WARNING ? `Maximum of ${ANSWER_MAX_WORDS} words` : `${ANSWER_MAX_CHARS - answer.a.length} characters left`}
                    </span>
                  ) : undefined
                }
                error={shown(`a${i}`)}
              >
                {({ id, describedBy, invalid }) => (
                  <textarea
                    id={id}
                    className="input textarea card-answer"
                    rows={3}
                    maxLength={ANSWER_MAX_CHARS}
                    value={answer.a}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    onChange={(e) => {
                      set(i, { a: e.target.value })
                      if (wordCount(e.target.value) > ANSWER_MAX_WORDS) touch(`a${i}`)
                    }}
                    onBlur={() => touch(`a${i}`)}
                  />
                )}
              </Field>
            )}
          </section>
        )
      })}
      <SaveError error={error} />
      <ActionBar busy={busy} label="Save" />
    </form>
  )
}
