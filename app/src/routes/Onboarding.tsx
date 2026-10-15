import { BackIcon, CloseIcon } from '../components/Icons'
import { SlidersHorizontal, UsersRound } from 'lucide-react'
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
import { cityLabel, type City } from '../lib/cities'
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
/** Sign-up is the first 3 steps: about you, photo and interests (testers,
 *  13 Oct: keep it short). The back of the card and "How you travel" come
 *  after, from the "Finish your profile" list on Profile. */
const SIGN_UP_STEPS = STEP.interests
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

  const signUpSteps = SIGN_UP_STEPS
  const requested = Number(params.get('step'))
  let step = requested >= 1 && requested <= TOTAL ? requested : firstUnfinishedStep(data)
  if (step === CARD_STEP && !data.card) step = CARD_STEP + 1
  const goTo = (n: number) => setParams({ step: String(n) })
  const firstTime = !data.profile.onboarded_at
  const next = async () => {
    if (firstTime && step >= signUpSteps) {
      await finishOnboarding()
      await reload()
      return navigate('/welcome', { replace: true })
    }
    await reload()
    // Opened from elsewhere (like Connect asking for a photo): go back there.
    const returnTo = params.get('return')
    if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) return navigate(returnTo, { replace: true })
    if (step < TOTAL) goTo(step + 1 === CARD_STEP && !data.card ? step + 2 : step + 1)
    else navigate('/profile', { replace: true })
  }
  const back = step > 1 ? () => goTo(step - 1 === CARD_STEP && !data.card ? step - 2 : step - 1) : undefined

  return (
    <Layout>
      <StepFrame step={step} key={step} signingUp={firstTime} signUpSteps={signUpSteps} onBack={back ?? (firstTime ? undefined : () => navigate('/profile'))}>
        {step === STEP.basics && <BasicsStep userId={userId} data={data} onDone={next} />}
        {step === STEP.photo && <PhotoStep userId={userId} data={data} onDone={next} onBack={back} />}
        {step === STEP.interests && <InterestsStep data={data} interests={interests} onDone={next} onBack={back} />}
        {step === STEP.card && <CardStep userId={userId} data={data} onDone={next} onBack={back} />}
        {step === STEP.travel && <PreferencesStep userId={userId} data={data} onDone={next} onBack={back} />}
      </StepFrame>
    </Layout>
  )
}

function StepFrame({ step, signingUp, signUpSteps, onBack, children }: { step: number; signingUp: boolean; signUpSteps: number; onBack?: () => void; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  const { title, intro } = STEPS[step - 1]
  const extra = step > signUpSteps
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
        <p className="step-label">{extra ? 'Add more to your profile' : signingUp ? `Step ${step} of ${signUpSteps} · ${title}` : 'Edit your profile'}</p>
        <Monogram size={34} />
      </div>
      {signingUp && !extra && (
        <div className="step-progress" aria-hidden="true">
          {Array.from({ length: signUpSteps }, (_, i) => (
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
        {welcome ? 'Welcome to the Collective' : title}
      </h1>
      {welcome ? <p className="lede">Meet people going where you’re going, and find good company for the trip. Let’s start with the basics.</p> : intro && <p className="lede">{intro}</p>}
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
            Choose who you see (gender, age and distance) any time in <strong>Filters</strong>.
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
      </div>
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
            <label className={preview ? 'btn btn-secondary' : 'btn btn-primary'} htmlFor="photo">
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
      <ActionBar busy={busy || preparing} onBack={onBack} label={photo || p.photo_path ? 'Continue' : 'Skip photo for now'} quiet={!photo && !p.photo_path} />
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

function InterestsStep({ data, interests, onDone, onBack }: Omit<StepProps, 'userId'> & { interests: Interest[] }) {
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
        label={data.profile.onboarded_at ? undefined : 'Finish sign-up'}
        note={
          <span aria-live="polite">
            <strong>{selected.length}</strong> of {INTERESTS_TO_PICK} picked
          </span>
        }
      />
    </form>
  )
}

type StyleAnswers = Record<(typeof STYLE_QUESTIONS)[number]['key'], string[]>

function PreferencesStep({ userId, data, onDone, onBack }: StepProps) {
  const p = data.profile
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
      <section className="card form-card" aria-labelledby="style-heading">
        <h2 id="style-heading" className="card-title">
          Your travel style
        </h2>
        <p className="hint">These help us find people who travel the way you do.</p>
        {STYLE_QUESTIONS.map((q) => (
          <ChipChoice<string> key={q.key} name={q.key} legend={q.label} options={q.options} selected={style[q.key]} onChange={(v) => setStyle((x) => ({ ...x, [q.key]: v }))} />
        ))}
        {/* Survey: sharing a twin room saves the single supplement. Shown on your card. */}
        <ChipChoice<string> name="room_sharing" legend="Sharing a twin room" options={ROOM_SHARING} selected={room} onChange={setRoom} />
      </section>

      {more && (
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

      <p className="hint section-hint">Choose who you see (gender, age and distance) any time in Filters.</p>
      <SaveError error={error} />
      <ActionBar busy={busy} onBack={onBack} label="Save" />
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
