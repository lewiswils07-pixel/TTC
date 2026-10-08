import { useEffect, useState } from 'react'
import { peek } from '../lib/cache'
import type { MyProfile } from '../lib/profile'
import { useSession } from '../lib/session-context'
import { supabase } from '../lib/supabase'

type Numbers = { emergency: string; talk?: { text: string; number: string } }

// Where members live (testers: 999 and Samaritans shown to someone in Spain).
const BY_COUNTRY: Record<string, Numbers> = {
  GB: { emergency: '999', talk: { text: 'To talk to someone, Samaritans are free any time on', number: '116 123' } },
  IE: { emergency: '112', talk: { text: 'To talk to someone, Samaritans are free any time on', number: '116 123' } },
  US: { emergency: '911', talk: { text: 'To talk to someone, call or text the 988 Lifeline on', number: '988' } },
  CA: { emergency: '911', talk: { text: 'To talk to someone, call or text', number: '988' } },
  AU: { emergency: '000', talk: { text: 'To talk to someone, Lifeline is there any time on', number: '13 11 14' } },
  NZ: { emergency: '111', talk: { text: 'To talk to someone, call or text', number: '1737' } },
}
const EUROPE = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IT LV LT LU MT NL PL PT RO SK SI ES SE IS NO CH LI'.split(' '))

/** The member's home country, from their saved profile. Null when signed out or not known yet. */
function useHomeCountry(): string | null {
  const { session } = useSession()
  const id = session?.user.id
  const [country, setCountry] = useState<string | null>(() => (id ? (peek<MyProfile>(`profile:${id}`)?.profile.home_city?.country_code ?? null) : null))
  useEffect(() => {
    if (!id || country) return
    supabase
      .from('profiles')
      .select('home_city:cities!profiles_home_city_id_fkey(country_code)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setCountry((data?.home_city as { country_code?: string } | null)?.country_code ?? null), () => undefined)
  }, [id, country])
  return country
}

const tel = (n: string) => `tel:${n.replace(/\s/g, '')}`

/** Who to call in an emergency, for the country the member lives in. 112 works across Europe and in many other countries. */
export function EmergencyNumbers() {
  const country = useHomeCountry()
  const local = country ? BY_COUNTRY[country] : undefined
  const europe = country ? EUROPE.has(country) : false
  return (
    <p>
      In an emergency, call{' '}
      {local ? (
        <>
          <a href={tel(local.emergency)}>{local.emergency}</a>
          {local.emergency !== '112' && (
            <>
              {' '}
              where you live, or <a href={tel('112')}>112</a> anywhere in Europe
            </>
          )}
          .
        </>
      ) : europe ? (
        <>
          <a href={tel('112')}>112</a>, anywhere in Europe.
        </>
      ) : (
        <>
          <a href={tel('112')}>112</a> anywhere in Europe, <a href={tel('999')}>999</a> in the UK or <a href={tel('911')}>911</a> in North America.
        </>
      )}
      {local?.talk && (
        <>
          {' '}
          {local.talk.text} <a href={tel(local.talk.number)}>{local.talk.number}</a>.
        </>
      )}
    </p>
  )
}
