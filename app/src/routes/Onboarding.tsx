import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AgeRange } from '../components/AgeRange'
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
  GENDERS,
  MAX_INTERESTS,
  MAX_PREF_AGE,
  MIN_AGE,
  MIN_INTERESTS,
  PACES,
  TRAVEL_STYLES,
  type Budget,
  type Gender,
  type Pace,
  type TravelStyle,
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
import { checkAgeRange, checkBirthYear, checkChosen, checkInterests, checkName } from '../lib/validation'

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
  const next = async () => {
    await reload()
    if (step < TOTAL) goTo(step + 1)
    else navigate('/dashboard', { replace: true })
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
  const [birthYear, setBirthYear] = useState(p.birth_year ? String(p.birth_year) : '')
  const [gender, setGender] = useState<Gender[]>(p.gender ? [p.gender] : [])
  const [city, setCity] = useState<City | null>(p.home_city)

  const errors = {
    name: checkName(name),
    birthYear: checkBirthYear(birthYear),
    gender: checkChosen('how you describe yourself')(gender),
    city: city ? null : 'Please choose your home town or city from the list.',
  }
  const { shown, touch, validateAll } = useChecks(errors)

  const { busy, error, submit } = useStepSubmit(async () => {
    await saveBasics(userId, { display_name: name.trim(), birth_year: Number(birthYear), gender: gender[0], home_city_id: city!.id })
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
        <TextField
          name="birthYear"
          label="Year you were born"
          hint={`Members see your age, never your birthday. You must be ${MIN_AGE} or over.`}
          inputMode="numeric"
          autoComplete="bday-year"
          placeholder="YYYY"
          maxLength={4}
          className="input input-short"
          value={birthYear}
          error={shown('birthYear')}
          valid={!errors.birthYear}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '')
            setBirthYear(v)
            if (v.length === 4) touch('birthYear')
          }}
          onBlur={() => touch('birthYear')}
        />
        <Segmented
          name="gender"
          legend="I am a"
          options={GENDERS}
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

const DISTANCES = [
  { value: 'any', label: 'Any' },
  { value: '50', label: '50 km' },
  { value: '150', label: '150 km' },
  { value: '500', label: '500 km' },
] as const
type Distance = (typeof DISTANCES)[number]['value']

function PreferencesStep({ userId, data, onDone, onBack }: StepProps) {
  const p = data.profile
  const prefs = data.preferences
  const [style, setStyle] = useState<TravelStyle[]>(p.travel_style ? [p.travel_style] : [])
  const [pace, setPace] = useState<Pace[]>(p.pace ? [p.pace] : [])
  const [budget, setBudget] = useState<Budget[]>(p.budget ? [p.budget] : [])
  const [mobility, setMobility] = useState(p.mobility_note ?? '')
  const [genders, setGenders] = useState<Gender[]>(prefs.genders)
  const [ages, setAges] = useState<[number, number]>([prefs.age_min, Math.min(prefs.age_max, MAX_PREF_AGE)])
  const initialDistance = (DISTANCES.find((d) => d.value === String(prefs.max_distance_km))?.value ?? 'any') as Distance
  const [distance, setDistance] = useState<Distance[]>([initialDistance])

  const errors = {
    genders: genders.length ? null : 'Choose at least one option.',
    ages: checkAgeRange(ages),
  }
  const { shown, touch, validateAll } = useChecks(errors)

  const { busy, error, submit } = useStepSubmit(async () => {
    await saveStyleAndPreferences(
      userId,
      { travel_style: style[0] ?? null, pace: pace[0] ?? null, budget: budget[0] ?? null, mobility_note: mobility.trim() || null },
      {
        genders,
        age_min: ages[0],
        age_max: ages[1],
        max_distance_km: distance[0] === 'any' ? null : Number(distance[0]),
      },
    )
    await finishOnboarding()
  }, onDone)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (validateAll()) void submit()
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

      <section className="card form-card" aria-labelledby="who-heading">
        <h2 id="who-heading" className="card-title">
          Who you’d like to travel with
        </h2>
        <Segmented
          name="genders"
          legend="Show me"
          hint="Pick all that apply."
          options={GENDERS}
          selected={genders}
          onChange={(v) => {
            setGenders(v)
            touch('genders')
          }}
          multiple
          error={shown('genders')}
        />
        <AgeRange legend="Aged" min={MIN_AGE} max={MAX_PREF_AGE} value={ages} onChange={setAges} />
        <FieldError error={shown('ages')} />
        <Segmented
          name="distance"
          legend="How far from home should we look?"
          hint="Used when you’re looking for someone to plan a new trip with."
          options={DISTANCES}
          selected={distance}
          onChange={setDistance}
        />
      </section>
      <SaveError error={error} />
      <ActionBar busy={busy} onBack={onBack} label="Finish my profile" />
    </form>
  )
}
