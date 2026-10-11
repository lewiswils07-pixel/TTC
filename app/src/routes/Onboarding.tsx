import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AgeRange } from '../components/AgeRange'
import { CityPicker } from '../components/CityPicker'
import { DistanceSlider } from '../components/DistanceSlider'
import { InterestedIn } from '../components/InterestedIn'
import { Field, FieldError, TextField } from '../components/Field'
import { InterestPicker } from '../components/InterestPicker'
import { Layout, Loading } from '../components/Layout'
import { ActionBar, SaveError } from '../components/Form'
import { QuestionPicker } from '../components/QuestionPicker'
import { Dropdown } from '../components/Dropdown'
import { ChipChoice } from '../components/ChipChoice'
import { Segmented } from '../components/Segmented'
import { brand } from '../lib/brand'
import { ANSWER_MAX_CHARS, ANSWER_MAX_WORDS, ANSWERS_TO_PICK, checkAnswer, questionText, saveCard, wordCount, type CardAnswer } from '../lib/card'
import { cityLabel, type City } from '../lib/cities'
import { clearDrafts, useDraft } from '../lib/draft'
import { messageOf } from '../lib/errors'
import { clearMyLocation, locateMe } from '../lib/location'
import { saveMeetPreferences } from '../lib/filters'
import { firstUnfinishedStep, STEP } from '../lib/onboarding'
import { rules } from '../lib/rules'
import {
  BUDGETS,
  DAY_RHYTHMS,
  DIETS,
  GENDERS,
  LANGUAGES,
  MAX_LANGUAGES,
  MAX_PREF_AGE,
  MIN_AGE,
  PHOTO_BOOK_MAX,
  INTERESTS_TO_PICK,
  MONTHS,
  HOLIDAY_QUESTIONS,
  PACES,
  PERSONAL_FIELDS,
  ROOM_SHARING,
  WALKING,
  type Budget,
  type DayRhythm,
  type Gender,
  type HolidayPrefs,
  type Pace,
  type PersonalField,
  type RoomSharing,
  type Walking,
} from '../lib/options'
import { addBookPhoto, photoUrl, preparePhoto, removeBookPhoto, uploadPhoto, usePhotoUrl } from '../lib/photo'
import { forgetExtras } from '../lib/member'
import { useConfirm } from '../lib/useConfirm'
import { finishOnboarding, listInterests, myDiet, saveAboutMe, saveBasics, saveDiet, saveInterests, saveMore, saveStyleAndPreferences, type Interest, type More, type MyProfile } from '../lib/profile'
import { useSession } from '../lib/session-context'
import { useChecks } from '../lib/useChecks'
import { useMyProfile } from '../lib/useMyProfile'
import { birthDate, checkAgeRange, checkBirthDate, checkChosen, checkInterests, checkName } from '../lib/validation'

const STEPS = [
  { title: 'About you', intro: 'Other members see your first name, age and home town. Your date of birth and email always stay private.' },
  { title: 'Your photo', intro: null },
  { title: 'Your interests', intro: `Pick the ${INTERESTS_TO_PICK} you love most, and meet people who love them too.` },
  {
    title: 'The back of your card',
    intro: `Optional. Pick up to ${ANSWERS_TO_PICK} questions and answer each in a sentence or two. People see them when they turn your card over.`,
  },
  {
    title: 'How you travel',
    intro: 'All optional, and there are no wrong answers. Add as much as you like to meet people who travel the way you do.',
  },
] as const satisfies readonly { title: string; intro: string | null }[]
/** Sign-up is the first 4 steps (Lewis, 5 Oct: keep it quick; 6 Oct: add
 *  the back of the card). "How you travel" comes after, from the profile
 *  page. Until the card is live in the database, sign-up is 3 steps. */
const CARD_STEP = STEP.card
const TOTAL = STEPS.length

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

  const signUpSteps = data.card ? CARD_STEP : CARD_STEP - 1
  const requested = Number(params.get('step'))
  let step = requested >= 1 && requested <= TOTAL ? requested : firstUnfinishedStep(data)
  if (step === CARD_STEP && !data.card) step = CARD_STEP + 1
  const goTo = (n: number) => setParams({ step: String(n) })
  const firstTime = !data.profile.onboarded_at
  // Straight after sign-up: "How you travel" as an optional last step (testers: sign-up never asked).
  const justJoined = params.get('new') === '1' && step === STEP.travel
  const welcome = () => navigate('/welcome', { replace: true })
  const next = async () => {
    if (firstTime && step >= signUpSteps) {
      await finishOnboarding()
      await reload()
      setParams({ step: String(STEP.travel), new: '1' }, { replace: true })
      return
    }
    if (justJoined) return welcome()
    await reload()
    if (step < TOTAL) goTo(step + 1 === CARD_STEP && !data.card ? step + 2 : step + 1)
    else navigate('/profile', { replace: true })
  }
  const back = step > 1 ? () => goTo(step - 1 === CARD_STEP && !data.card ? step - 2 : step - 1) : undefined

  return (
    <Layout>
      <StepFrame step={step} key={step} signingUp={firstTime} signUpSteps={signUpSteps} justJoined={justJoined}>
        {step === STEP.basics && <BasicsStep userId={userId} data={data} onDone={next} />}
        {step === STEP.photo && <PhotoStep userId={userId} data={data} onDone={next} onBack={back} />}
        {step === STEP.interests && <InterestsStep data={data} interests={interests} onDone={next} onBack={back} lastStep={signUpSteps === 3} />}
        {step === STEP.card && <CardStep userId={userId} data={data} onDone={next} onBack={back} />}
        {step === STEP.travel && <PreferencesStep userId={userId} data={data} onDone={next} onBack={justJoined ? undefined : back} onSkip={justJoined ? welcome : undefined} />}
      </StepFrame>
    </Layout>
  )
}

function StepFrame({ step, signingUp, signUpSteps, justJoined, children }: { step: number; signingUp: boolean; signUpSteps: number; justJoined: boolean; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  const { title, intro } = STEPS[step - 1]
  const extra = step > signUpSteps
  return (
    <div className="step">
      {signingUp && !extra && (
        <div className="progress" aria-hidden="true">
          <div className="progress-bar" style={{ width: `${(step / signUpSteps) * 100}%` }} />
        </div>
      )}
      <p className="eyebrow">{justJoined ? 'Last step, optional' : extra ? 'Add more to your profile' : signingUp ? `Step ${step} of ${signUpSteps}` : 'Edit your profile'}</p>
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      {intro && <p className="lede">{intro}</p>}
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
  const [genders, setGenders] = useDraft<Gender[]>('basics.genders', prefs.genders)
  const [ages, setAges] = useDraft<[number, number]>('basics.ages', [prefs.age_min, Math.min(prefs.age_max, MAX_PREF_AGE)])
  const [distance, setDistance] = useDraft<number | null>('basics.distance', prefs.max_distance_km)

  const errors = {
    name: checkName(name),
    birthDate: checkBirthDate(dobDay, dobMonth, dobYear),
    gender: checkChosen('your gender')(gender),
    city: city ? null : 'Please choose your home city from the list.',
    genders: genders.length ? null : 'Choose at least one option.',
    ages: checkAgeRange(ages),
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
        <Field name="gender" label="Gender" error={shown('gender')}>
          {({ id, describedBy, invalid }) => (
            <Dropdown
              id={id}
              placeholder="Choose your gender"
              value={gender[0] ?? ''}
              groups={[{ options: GENDERS.map((g) => ({ value: g.value, label: g.label })) }]}
              describedBy={describedBy}
              invalid={invalid}
              onChange={(v) => {
                setGender([v as Gender])
                touch('gender')
              }}
              onClose={() => touch('gender')}
            />
          )}
        </Field>
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
      </div>
      <section className="card form-card" aria-labelledby="meet-heading">
        <h2 id="meet-heading" className="card-title">
          Who you’d like to meet
        </h2>
        <InterestedIn
          value={genders}
          onChange={(v) => {
            setGenders(v)
            touch('genders')
          }}
          error={shown('genders')}
        />
        <AgeRange legend="Age range" min={MIN_AGE} max={MAX_PREF_AGE} value={ages} onChange={setAges} />
        <FieldError error={shown('ages')} />
        <DistanceSlider km={distance} onChange={setDistance} />
        <p className="hint">You can change these any time in Filters.</p>
      </section>
      <SaveError error={error} />
      <ActionBar busy={busy} />
    </form>
  )
}

function PhotoStep({ userId, data, onDone, onBack }: StepProps) {
  const p = data.profile
  const [preview, setPreview] = useState<string | null>(null)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [bio, setBio] = useDraft('photo.bio', p.bio ?? '')
  const [preparing, setPreparing] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  useEffect(() => {
    if (p.photo_path) photoUrl(p.photo_path).then(setPreview)
  }, [p.photo_path])

  useEffect(() => {
    if (!photo) return
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const { busy, error, submit } = useStepSubmit(async () => {
    if (photo) await uploadPhoto(userId, photo, p.photo_path)
    await saveAboutMe(userId, { bio: bio.trim() || null })
    clearDrafts('photo.')
  }, onDone)

  async function pick(file: File | undefined) {
    if (!file) return
    setPreparing(true)
    setPhotoError(null)
    try {
      setPhoto(await preparePhoto(file))
    } catch (err) {
      setPhotoError(messageOf(err))
    } finally {
      setPreparing(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      noValidate
    >
      <div className="card form-card">
        <div className="photo-picker" data-field="photo">
          {preview ? (
            <img className="avatar avatar-lg" src={preview} alt="Your profile photo" />
          ) : (
            <div className="avatar avatar-lg avatar-empty" aria-hidden="true">
              {(p.display_name ?? '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="photo-actions">
            <label className="btn btn-secondary" htmlFor="photo">
              {preview ? 'Change photo' : 'Choose a photo'}
            </label>
            <input id="photo" className="visually-hidden" type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} />
            <p className="hint" role="status" aria-live="polite">
              {preparing ? 'Getting your photo ready…' : ''}
            </p>
            <FieldError error={photoError} />
          </div>
        </div>
        <ul className="photo-tips" aria-label="What makes a good photo">
          <li>Just you, with your face clearly visible</li>
          <li>Recent, and in good light</li>
          <li>No sunglasses, hats or group shots</li>
        </ul>
        <p className="hint">You’ll need a photo to connect with people.</p>
        {data.more && <PhotoBookEditor userId={userId} start={data.more.photo_book} />}
        <Field
          name="bio"
          label="A few words about you (optional)"
          hint={`Where you’ve been, where you’d love to go, or what makes a good travel companion. ${rules.profile.bioMax - bio.length} characters left.`}
        >
          {({ id, describedBy }) => <textarea id={id} className="textarea" maxLength={rules.profile.bioMax} aria-describedby={describedBy} value={bio} onChange={(e) => setBio(e.target.value)} />}
        </Field>
      </div>
      <SaveError error={error} />
      <ActionBar busy={busy || preparing} onBack={onBack} label={photo || p.photo_path ? 'Continue' : 'Skip photo for now'} />
    </form>
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
              ×
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

function InterestsStep({ data, interests, onDone, onBack, lastStep }: Omit<StepProps, 'userId'> & { interests: Interest[]; lastStep: boolean }) {
  const [selected, setSelected] = useState<number[]>(data.interestIds)
  const errors = { interests: checkInterests(selected) }
  const { shown, validateAll } = useChecks(errors)
  const { busy, error, submit } = useStepSubmit(() => saveInterests(selected), onDone)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (validateAll()) void submit()
      }}
      noValidate
    >
      <InterestPicker interests={interests} selected={selected} onChange={setSelected} max={INTERESTS_TO_PICK} error={shown('interests')} />
      <SaveError error={error} />
      <ActionBar
        busy={busy}
        onBack={onBack}
        label={data.profile.onboarded_at || !lastStep ? undefined : 'Finish sign-up'}
        note={
          <span aria-live="polite">
            <strong>{selected.length}</strong> of {INTERESTS_TO_PICK} picked
          </span>
        }
      />
    </form>
  )
}

function PreferencesStep({ userId, data, onDone, onBack, onSkip }: StepProps & { onSkip?: () => void }) {
  const p = data.profile
  const prefs = data.preferences
  const more = data.more
  const [pace, setPace] = useState<Pace[]>(p.pace ? [p.pace] : [])
  const [budget, setBudget] = useState<Budget[]>(p.budget ? [p.budget] : [])
  const [travellingWith, setTravellingWith] = useState(p.travelling_with ?? '')
  const [room, setRoom] = useState<RoomSharing[]>(p.room_sharing ? [p.room_sharing] : [])
  const [rhythm, setRhythm] = useState<DayRhythm[]>(p.day_rhythm ? [p.day_rhythm] : [])
  const [walking, setWalking] = useState<Walking[]>(p.walking ? [p.walking] : [])
  const [languages, setLanguages] = useState<string[]>(p.languages ?? [])
  // Planning moved into holiday preferences (same answers), so an earlier answer carries over.
  const [holiday, setHoliday] = useState<HolidayPrefs>(() => ({ ...(p.travel_style ? { planning: p.travel_style } : {}), ...(more?.holiday_prefs ?? {}) }))
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

  const { busy, error, submit } = useStepSubmit(async () => {
    await saveStyleAndPreferences(
      userId,
      {
        // Holiday preferences replace the planning question and aren't used for matching (Lewis, 11 Oct).
        ...(more ? { travel_style: null } : {}),
        pace: pace[0] ?? null,
        budget: budget[0] ?? null,
        travelling_with: travellingWith.trim() || null,
        room_sharing: room[0] ?? null,
        day_rhythm: rhythm[0] ?? null,
        walking: walking[0] ?? null,
        languages,
      },
      prefs,
    )
    if (more) await saveMore(userId, { ...personal, shown_fields: personal.shown_fields.filter((f) => personal[f]), holiday_prefs: holiday })
    if (diet) await saveDiet(userId, diet)
  }, onDone)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      noValidate
    >
      {more && (
        <section className="card form-card" aria-labelledby="holiday-heading">
          <div className="section-head">
            <h2 id="holiday-heading" className="card-title">
              Holiday preferences
            </h2>
            <span className="tag tag-plus">{brand.plusName}</span>
          </div>
          <p className="hint">Members with {brand.plusName} can see these on your card. They don’t change who you’re matched with.</p>
          {HOLIDAY_QUESTIONS.map((q) => (
            <ChipChoice
              key={q.key}
              name={`holiday-${q.key}`}
              legend={q.label}
              options={q.options}
              selected={holiday[q.key] ? [holiday[q.key]!] : []}
              onChange={([v]) => setHoliday((h) => ({ ...h, [q.key]: v }))}
            />
          ))}
        </section>
      )}

      <section className="card form-card" aria-labelledby="style-heading">
        <h2 id="style-heading" className="card-title">
          Your travel style
        </h2>
        <Segmented name="pace" legend="Pace" options={PACES} selected={pace} onChange={setPace} describeSelection />
        <Segmented name="budget" legend="Budget" options={BUDGETS} selected={budget} onChange={setBudget} describeSelection />
      </section>

      <section className="card form-card" aria-labelledby="habits-heading">
        <h2 id="habits-heading" className="card-title">
          On the road
        </h2>
        <Segmented name="room" legend="Sharing a room" options={ROOM_SHARING} selected={room} onChange={setRoom} describeSelection />
        <Segmented name="rhythm" legend="Mornings" options={DAY_RHYTHMS} selected={rhythm} onChange={setRhythm} />
        <Segmented name="walking" legend="Walking" options={WALKING} selected={walking} onChange={setWalking} describeSelection />
        <fieldset className="field" data-field="languages">
          <legend>Languages you speak</legend>
          <div className="chips chips-compact chips-light">
            {LANGUAGES.map((lang) => {
              const checked = languages.includes(lang.value)
              return (
                <label className="chip" key={lang.value}>
                  <input
                    type="checkbox"
                    name="languages"
                    value={lang.value}
                    checked={checked}
                    disabled={!checked && languages.length >= MAX_LANGUAGES}
                    onChange={() => setLanguages(checked ? languages.filter((l) => l !== lang.value) : [...languages, lang.value])}
                  />
                  <span>{lang.label}</span>
                </label>
              )
            })}
          </div>
        </fieldset>
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
      </section>

      {more && (
        <section className="card form-card" aria-labelledby="personal-heading">
          <h2 id="personal-heading" className="card-title">
            About you
          </h2>
          <p className="hint">All optional. Each one stays hidden unless you choose to show it on your profile.</p>
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
        </section>
      )}

      <p className="hint section-hint">Choose who you see (gender, age and distance) any time in Filters.</p>
      <SaveError error={error} />
      <ActionBar busy={busy} onBack={onBack} onSkip={onSkip} label={onSkip ? 'Finish' : 'Save'} />
    </form>
  )
}

/** The word limit shows (in red) once an answer gets this long. */
const WORDS_WARNING = ANSWER_MAX_WORDS - 5

const EMPTY_ANSWERS: CardAnswer[] = [
  { q: '', a: '' },
  { q: '', a: '' },
  { q: '', a: '' },
]

function CardStep({ userId, data, onDone, onBack }: StepProps) {
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
      <ActionBar
        busy={busy}
        onBack={data.profile.onboarded_at ? onBack : undefined}
        onSkip={data.profile.onboarded_at || answers.some((x) => x.q) ? undefined : () => void onDone()}
        label={data.profile.onboarded_at ? 'Save' : 'Finish sign-up'}
      />
    </form>
  )
}
