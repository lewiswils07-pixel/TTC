import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ChoiceChips } from '../components/ChoiceChips'
import { CityPicker } from '../components/CityPicker'
import { Layout, Loading } from '../components/Layout'
import type { City } from '../lib/cities'
import { messageOf } from '../lib/errors'
import {
  BUDGETS,
  GENDERS,
  MAX_INTERESTS,
  MIN_AGE,
  MIN_INTERESTS,
  PACES,
  TRAVEL_STYLES,
  latestBirthYear,
  type Gender,
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
import { useMyProfile } from '../lib/useMyProfile'
import { firstUnfinishedStep } from '../lib/onboarding'

const STEP_TITLES = ['About you', 'Your photo', 'Your interests', 'How you like to travel'] as const
const TOTAL = STEP_TITLES.length

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
  return (
    <>
      <ol className="steps" aria-hidden="true">
        {STEP_TITLES.map((title, i) => (
          <li key={title} data-done={i < step} />
        ))}
      </ol>
      <p className="step-label">
        Step {step} of {TOTAL}
      </p>
      <h1 ref={heading} tabIndex={-1}>
        {STEP_TITLES[step - 1]}
      </h1>
      {children}
    </>
  )
}

/** Shared submit handling: busy state, friendly error, then move on. */
function useStepSubmit(save: () => Promise<void>, onDone: () => Promise<void>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(e?: FormEvent) {
    e?.preventDefault()
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

function StepActions({ busy, onBack, label = 'Save and continue' }: { busy: boolean; onBack?: () => void; label?: string }) {
  return (
    <div className="actions">
      {onBack && (
        <button type="button" className="btn btn-secondary" onClick={onBack} disabled={busy}>
          Back
        </button>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : label}
      </button>
    </div>
  )
}

function FormError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="error" role="alert">
      {error}
    </p>
  )
}

type StepProps = { userId: string; data: MyProfile; onDone: () => Promise<void>; onBack?: () => void }

function BasicsStep({ userId, data, onDone }: StepProps) {
  const p = data.profile
  const [name, setName] = useState(p.display_name ?? '')
  const [birthYear, setBirthYear] = useState(p.birth_year ? String(p.birth_year) : '')
  const [gender, setGender] = useState<Gender[]>(p.gender ? [p.gender] : [])
  const [city, setCity] = useState<City | null>(p.home_city)
  const latest = latestBirthYear()

  const { busy, error, setError, submit } = useStepSubmit(async () => {
    await saveBasics(userId, {
      display_name: name.trim(),
      birth_year: Number(birthYear),
      gender: gender[0],
      home_city_id: city!.id,
    })
  }, onDone)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const year = Number(birthYear)
    if (!name.trim()) return setError('Please tell us your first name.')
    if (!Number.isInteger(year) || year < 1900) return setError('Please enter the year you were born, for example 1965.')
    if (year > latest) return setError(`You need to be ${MIN_AGE} or over to join.`)
    if (!gender.length) return setError('Please choose how you describe yourself.')
    if (!city) return setError('Please choose your home town or city from the list.')
    void submit()
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <p>Only your first name, age and home town are shown to other members.</p>
      <div className="field">
        <label htmlFor="name">First name</label>
        <input id="name" className="input" autoComplete="given-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="birth-year">Year you were born</label>
        <p className="hint" id="birth-year-hint">
          Members see your age, never your birthday. You must be {MIN_AGE} or over.
        </p>
        <input
          id="birth-year"
          className="input"
          inputMode="numeric"
          autoComplete="bday-year"
          maxLength={4}
          aria-describedby="birth-year-hint"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <ChoiceChips name="gender" legend="I am a…" options={GENDERS} selected={gender} onChange={setGender} />
      <CityPicker
        label="Home town or city"
        hint="Start typing, then pick from the list. We never show your exact location."
        value={city}
        onChange={setCity}
      />
      <FormError error={error} />
      <StepActions busy={busy} />
    </form>
  )
}

function PhotoStep({ userId, data, onDone, onBack }: StepProps) {
  const p = data.profile
  const [preview, setPreview] = useState<string | null>(null)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [bio, setBio] = useState(p.bio ?? '')
  const [preparing, setPreparing] = useState(false)

  useEffect(() => {
    if (p.photo_path) photoUrl(p.photo_path).then(setPreview)
  }, [p.photo_path])

  useEffect(() => {
    if (!photo) return
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const { busy, error, setError, submit } = useStepSubmit(async () => {
    if (photo) await uploadPhoto(userId, photo, p.photo_path)
    await saveAboutMe(userId, { bio: bio.trim() || null })
  }, onDone)

  async function pick(file: File | undefined) {
    if (!file) return
    setPreparing(true)
    setError(null)
    try {
      setPhoto(await preparePhoto(file))
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setPreparing(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <p>A clear, smiling photo of your face helps other members feel comfortable. Only signed-in members can see it.</p>
      <div className="field">
        {preview ? (
          <img className="avatar" src={preview} alt="Your profile photo" />
        ) : (
          <div className="avatar avatar-empty" aria-hidden="true">
            {(p.display_name ?? '?').slice(0, 1).toUpperCase()}
          </div>
        )}
        <label className="btn btn-secondary btn-start" htmlFor="photo">
          {preview ? 'Choose a different photo' : 'Choose a photo'}
        </label>
        <input id="photo" className="visually-hidden" type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} />
        <p className="hint" role="status" aria-live="polite">
          {preparing ? 'Getting your photo ready…' : 'We remove location details from your photo before it is saved.'}
        </p>
      </div>
      <div className="field">
        <label htmlFor="bio">A few words about you (optional)</label>
        <p className="hint" id="bio-hint">
          For example, where you've been, where you'd love to go, or what makes a good travel companion. {500 - bio.length}{' '}
          characters left.
        </p>
        <textarea id="bio" className="textarea" maxLength={500} aria-describedby="bio-hint" value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>
      <FormError error={error} />
      <StepActions busy={busy || preparing} onBack={onBack} label={photo || p.photo_path ? 'Save and continue' : 'Continue without a photo'} />
    </form>
  )
}

function InterestsStep({ data, interests, onDone, onBack }: Omit<StepProps, 'userId'> & { interests: Interest[] }) {
  const options = interests.map((i) => ({ value: String(i.id), label: i.label }))
  const [selected, setSelected] = useState<string[]>(data.interestIds.map(String))
  const { busy, error, setError, submit } = useStepSubmit(() => saveInterests(selected.map(Number)), onDone)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (selected.length < MIN_INTERESTS) return setError(`Please pick at least ${MIN_INTERESTS} interests.`)
    void submit()
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <ChoiceChips
        name="interests"
        legend="What do you enjoy on a trip?"
        hint={`Pick ${MIN_INTERESTS} to ${MAX_INTERESTS}. We use these to find people you'll get on with. ${selected.length} picked.`}
        options={options}
        selected={selected}
        onChange={setSelected}
        multiple
        max={MAX_INTERESTS}
      />
      <FormError error={error} />
      <StepActions busy={busy} onBack={onBack} />
    </form>
  )
}

const DISTANCES = [
  { value: 'any', label: 'Anywhere' },
  { value: '50', label: 'Within 50 km' },
  { value: '150', label: 'Within 150 km' },
  { value: '500', label: 'Within 500 km' },
] as const

function PreferencesStep({ userId, data, onDone, onBack }: StepProps) {
  const p = data.profile
  const prefs = data.preferences
  const [style, setStyle] = useState(p.travel_style ? [p.travel_style] : [])
  const [pace, setPace] = useState(p.pace ? [p.pace] : [])
  const [budget, setBudget] = useState(p.budget ? [p.budget] : [])
  const [mobility, setMobility] = useState(p.mobility_note ?? '')
  const [genders, setGenders] = useState<Gender[]>(prefs.genders)
  const [ageMin, setAgeMin] = useState(String(prefs.age_min))
  const [ageMax, setAgeMax] = useState(String(prefs.age_max))
  const [distance, setDistance] = useState(prefs.max_distance_km ? String(prefs.max_distance_km) : 'any')

  const { busy, error, setError, submit } = useStepSubmit(async () => {
    await saveStyleAndPreferences(
      userId,
      { travel_style: style[0] ?? null, pace: pace[0] ?? null, budget: budget[0] ?? null, mobility_note: mobility.trim() || null },
      { genders, age_min: Number(ageMin), age_max: Number(ageMax), max_distance_km: distance === 'any' ? null : Number(distance) },
    )
    await finishOnboarding()
  }, onDone)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const min = Number(ageMin)
    const max = Number(ageMax)
    if (!genders.length) return setError('Please choose at least one option for who you would like to travel with.')
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < MIN_AGE || max > 120 || min > max)
      return setError(`Please check the ages: the youngest can be ${MIN_AGE}, and it must be lower than the oldest.`)
    void submit()
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <p>There are no wrong answers. These help us suggest people who travel the way you do.</p>
      <ChoiceChips name="style" legend="Planning" options={TRAVEL_STYLES} selected={style} onChange={setStyle} />
      <ChoiceChips name="pace" legend="Pace" options={PACES} selected={pace} onChange={setPace} />
      <ChoiceChips name="budget" legend="Budget" options={BUDGETS} selected={budget} onChange={setBudget} />
      <div className="field">
        <label htmlFor="mobility">Anything about getting around we should know? (optional)</label>
        <p className="hint" id="mobility-hint">
          For example, "I avoid lots of stairs". This is only used to plan trips, never shown on your profile.
        </p>
        <input id="mobility" className="input" maxLength={200} aria-describedby="mobility-hint" value={mobility} onChange={(e) => setMobility(e.target.value)} />
      </div>
      <h2>Who you'd like to travel with</h2>
      <ChoiceChips name="genders" legend="Show me" hint="Pick all that apply." options={GENDERS} selected={genders} onChange={setGenders} multiple />
      <fieldset className="field">
        <legend>Aged between</legend>
        <div className="chips chips-inline">
          <label className="visually-hidden" htmlFor="age-min">
            Youngest age
          </label>
          <input id="age-min" className="input input-age" inputMode="numeric" maxLength={3} value={ageMin} onChange={(e) => setAgeMin(e.target.value.replace(/\D/g, ''))} />
          <span aria-hidden="true">and</span>
          <label className="visually-hidden" htmlFor="age-max">
            Oldest age
          </label>
          <input id="age-max" className="input input-age" inputMode="numeric" maxLength={3} value={ageMax} onChange={(e) => setAgeMax(e.target.value.replace(/\D/g, ''))} />
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="distance">How far from home should we look?</label>
        <p className="hint" id="distance-hint">
          Used when you're looking for someone to plan a new trip with.
        </p>
        <select id="distance" className="select" aria-describedby="distance-hint" value={distance} onChange={(e) => setDistance(e.target.value)}>
          {DISTANCES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <FormError error={error} />
      <StepActions busy={busy} onBack={onBack} label="Finish my profile" />
    </form>
  )
}
