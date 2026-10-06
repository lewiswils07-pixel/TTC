import { useCallback, useEffect, useState } from 'react'
import { peek, remember } from './cache'
import { messageOf } from './errors'
import { getMyProfile, type MyProfile } from './profile'

export function useMyProfile(userId: string) {
  const [data, setData] = useState<MyProfile | null>(() => peek(`profile:${userId}`) ?? null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setData(await remember(`profile:${userId}`, getMyProfile(userId)))
      setError(null)
    } catch (e) {
      setError(messageOf(e))
    }
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, reload }
}
