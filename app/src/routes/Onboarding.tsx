import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { CityPicker } from '../components/CityPicker'
import { Field, FieldError, TextField } from '../components/Field'
import { InterestPicker } from '../components/InterestPicker'
import { Layout, Loading } from '../components/Layout'
import { ActionBar, SaveError } from '../components/Form'
import { Segmented } from '../components/Segmented'
import type { City } from '../lib/cities'
import { messageOf } from '../lib/errors'
import { firstUnfinishedStep } from '../lib/onboarding'
import {
  BUDGETS,
  DAY_RHYTHMS,
  GENDERS,
  LANGUAGES,
  MAX_INTERESTS,
  MAX_LANGUAGES,
  MIN_AGE,
  MIN_INTERESTS,
  MONTHS,
  PACES,
  ROOM_SHARING,
  TRAVEL_STYLES,
  WALKING,
  type Budget,
  type DayRhythm,
  type Gender,
  type Pace,
  type RoomSharing,
  type TravelStyle,
  type Walking,
} from '../lib/options'
import { photoUrl, preparePhoto, uploadPhoto } from '../lib/photo'
import {
  finishOnboarding,
  listInterests,
  saveAboutMe,
  saveBasics,
  saveInterests,
  saveStyleAndPreferences,
  type Interest,
  type MyProfile,
} from '../lib/profile'
import { useSession } from '../lib/session-context'
import { useChecks } from '../lib/useChecks'
import { useMyProfile } from '../lib/useMyProfile'
import { birthDate, checkBirthDate, checkChosen, checkInterests, checkName } from '../lib/validation'

const STEPS = [
  { title: 'About you', intro: 'Only your first name, age and home town are shown to other members.' },
  { title: 'Your photo', intro: 'A clear, smiling photo helps other members feel comfortable. Only signed-in members can see it.' },
  { title: 'Your interests', intro: `Pick ${MIN_INTERESTS} to ${MAX_INTERESTS}. We use them to suggest people you’ll get on with.` },
  { title: 'How you travel', intro: 'There are no wrong answers. These help us suggest people who travel the way you do.' },
] as const
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

  const requested = Number(params.get('step'))
  const step = requested >= 1 && requested <= TOTAL ? requested : firstUnfinishedStep(data)
  const goTo = (n: number) => setParams({ step: String(n) })
  const firstTime = !data.profile.onboarded_at
  const next = async () => {
    await reload()
    if (step < TOTAL) goTo(step + 1)
    else navigate(firstTime ? '/welcome' : '/dashboard', { replace: true })
  }
  const back = step > 1 ? () => goTo(step - 1) : undefined

  return (
    <Layout>
      <StepFrame step={step} key={step}>
        {step === 1 && <BasicsStep userId={userId} data={data} onDone={next} />}
        {step === 2 && <PhotoStep userId={userId} data={data} onDone={next} onBack={back} />}
        {step === 3 && <InterestsStep data={data} interests={interests} onDone={next} onBack={back} />}
        {step === 4 && <PreferencesStep userId={userId} data={data} onDone={next} onBack={back} />}
      </StepFrame>
    </Layout>
  )
}

function StepFrame({ step, children }: { step: number; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  const { title, intro } = STEPS[step - 1]
  return (
    <div className="step">
      <div className="progress" aria-hidden="true">
        <div className="progress-bar" style={{ width: `${(step / TOTAL) * 100}%` }} />
      </div>
      <p className="eyebrow">
        Step {step} of {TOTAL}
      </p>
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      <p className="lede">{intro}</p>
      <p className="hint saved-note">Each step is saved when you continue, so you can stop and come back any time.</p>
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
  const [name, setName] = useState(p.display_name ?? '')
  const [dobDay, setDobDay] = useState(p.birth_date ? String(Number(p.birth_date.slice(8, 10))) : '')
  const [dobMonth, setDobMonth] = useState(p.birth_date ? String(Number(p.birth_date.slice(5, 7))) : '')
  const [dobYear, setDobYear] = useState(p.birth_date ? p.birth_date.slice(0, 4) : p.birth_year ? String(p.birth_year) : '')
  const [gender, setGender] = useState<Gender[]>(p.gender ? [p.gender] : [])
  const [city, setCity] = useState<City | null>(p.home_city)

  const errors = {
    name: checkName(name),
    birthDate: checkBirthDate(dobDay, dobMonth, dobYear),
    gender: checkChosen('how you describe yourself')(gender),
    city: city ? null : 'Please choose your home town or city from the list.',
  }
  const { shown, touch, validateAll } = useChecks(errors)

  const { busy, error, submit } = useStepSubmit(async () => {
    await saveBasics(userId, { display_name: name.trim(), birth_date: birthDate(dobDay, dobMonth, dobYear), gender: gender[0], home_city_id: city!.id })
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
          maxLength={41}
          value={name}
          error={shown('name')}
          valid={!errors.name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => touch('name')}
        />
        <fieldset className="field" data-field="birthDate" aria-describedby="dob-hint">
          <legend>Date of birth</legend>
          <p className="hint" id="dob-hint">
            Members see your age, never your birthday. You must be {MIN_AGE} or over.
          </p>
          <div className="dob">
            <select
              aria-label="Day"
              className="input"
              autoComplete="bday-day"
              value={dobDay}
              aria-invalid={shown('birthDate') ? true : undefined}
              onChange={(e) => setDobDay(e.target.value)}
              onBlur={() => dobDay && dobMonth && dobYear.length === 4 && touch('birthDate')}
            >
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <select
              aria-label="Month"
              className="input"
              autoComplete="bday-month"
              value={dobMonth}
              aria-invalid={shown('birthDate') ? true : undefined}
              onChange={(e) => setDobMonth(e.target.value)}
              onBlur={() => dobDay && dobMonth && dobYear.length === 4 && touch('birthDate')}
            >
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
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
        <Segmented
          name="gender"
          legend="Gender"
          options={GENDERS}
          columns={2}
          selected={gender}
          onChange={(v) => {
            setGender(v)
            touch('gender')
          }}
          error={shown('gender')}
        />
        <div data-field="city">
          <CityPicker
            label="Home town or city"
            hint="Start typing, then pick from the list. We never show your exact location."
            value={city}
            onChange={(c) => {
              setCity(c)
              if (c) touch('city')
            }}
            onBlur={() => touch('city')}
            error={shown('city')}
          />
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
  const [bio, setBio] = useState(p.bio ?? '')
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
              {preparing ? 'Getting your photo ready…' : 'We remove location details from your photo before it’s saved.'}
            </p>
            <FieldError error={photoError} />
          </div>
        </div>
        <ul className="photo-tips" aria-label="What makes a good photo">
          <li>Just you, with your face clearly visible</li>
          <li>Recent, and in good light</li>
          <li>No sunglasses, hats or group shots</li>
        </ul>
        <p className="hint">We crop it to a square around the middle. You’ll need a photo before asking to connect with anyone.</p>
        <Field name="bio" label="A few words about you (optional)" hint={`Where you’ve been, where you’d love to go, or what makes a good travel companion. ${500 - bio.length} characters left.`}>
          {({ id, describedBy }) => (
            <textarea id={id} className="textarea" maxLength={500} aria-describedby={describedBy} value={bio} onChange={(e) => setBio(e.target.value)} />
          )}
        </Field>
      </div>
      <SaveError error={error} />
      <ActionBar busy={busy || preparing} onBack={onBack} label={photo || p.photo_path ? 'Continue' : 'Skip photo for now'} />
    </form>
  )
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
      <InterestPicker interests={interests} selected={selected} onChange={setSelected} max={MAX_INTERESTS} error={shown('interests')} />
      <SaveError error={error} />
      <ActionBar
        busy={busy}
        onBack={onBack}
        note={
          <span aria-live="polite">
            <strong>{selected.length}</strong> of {MAX_INTERESTS} picked
            {selected.length < MIN_INTERESTS ? ` · pick at least ${MIN_INTERESTS}` : ''}
          </span>
        }
      />
    </form>
  )
}

function PreferencesStep({ userId, data, onDone, onBack }: StepProps) {
  const p = data.profile
  const prefs = data.preferences
  const [style, setStyle] = useState<TravelStyle[]>(p.travel_style ? [p.travel_style] : [])
  const [pace, setPace] = useState<Pace[]>(p.pace ? [p.pace] : [])
  const [budget, setBudget] = useState<Budget[]>(p.budget ? [p.budget] : [])
  const [mobility, setMobility] = useState(p.mobility_note ?? '')
  const [travellingWith, setTravellingWith] = useState(p.travelling_with ?? '')
  const [room, setRoom] = useState<RoomSharing[]>(p.room_sharing ? [p.room_sharing] : [])
  const [rhythm, setRhythm] = useState<DayRhythm[]>(p.day_rhythm ? [p.day_rhythm] : [])
  const [walking, setWalking] = useState<Walking[]>(p.walking ? [p.walking] : [])
  const [languages, setLanguages] = useState<string[]>(p.languages ?? [])

  const { busy, error, submit } = useStepSubmit(async () => {
    await saveStyleAndPreferences(
      userId,
      {
        travel_style: style[0] ?? null,
        pace: pace[0] ?? null,
        budget: budget[0] ?? null,
        mobility_note: mobility.trim() || null,
        travelling_with: travellingWith.trim() || null,
        room_sharing: room[0] ?? null,
        day_rhythm: rhythm[0] ?? null,
        walking: walking[0] ?? null,
        languages,
      },
      prefs,
    )
    await finishOnboarding()
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
        <Segmented name="style" legend="Planning" options={TRAVEL_STYLES} selected={style} onChange={setStyle} describeSelection />
        <Segmented name="pace" legend="Pace" options={PACES} selected={pace} onChange={setPace} describeSelection />
        <Segmented name="budget" legend="Budget" options={BUDGETS} selected={budget} onChange={setBudget} describeSelection />
        <TextField
          name="mobility"
          label="Anything about getting around? (optional)"
          hint="For example, “I avoid lots of stairs”. Only used to plan trips, never shown on your profile."
          maxLength={200}
          value={mobility}
          onChange={(e) => setMobility(e.target.value)}
        />
      </section>

      <section className="card form-card" aria-labelledby="habits-heading">
        <h2 id="habits-heading" className="card-title">
          On the road
        </h2>
        <p className="hint section-hint">All optional. They help us suggest people you’d be comfortable travelling with.</p>
        <Segmented name="room" legend="Sharing a room" options={ROOM_SHARING} selected={room} onChange={setRoom} describeSelection />
        <Segmented name="rhythm" legend="Mornings" options={DAY_RHYTHMS} selected={rhythm} onChange={setRhythm} />
        <Segmented name="walking" legend="Walking" options={WALKING} selected={walking} onChange={setWalking} describeSelection />
        <fieldset className="field" data-field="languages">
          <legend>Languages you speak</legend>
          <div className="chips chips-compact">
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
        <TextField
          name="travelling-with"
          label="Travelling with someone? (optional)"
          hint="For example, “usually with my sister Jo”. Shown on your card. Each profile is for one person."
          maxLength={80}
          value={travellingWith}
          onChange={(e) => setTravellingWith(e.target.value)}
        />
      </section>

      <p className="hint section-hint">
        Everyone is shown to you to start with. You can choose who you’d like to see (gender, age and distance) any time in Filters.
      </p>
      <SaveError error={error} />
      <ActionBar busy={busy} onBack={onBack} label="Finish my profile" />
    </form>
  )
}
