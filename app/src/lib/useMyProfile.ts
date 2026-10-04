import { useCallback, useEffect, useState } from 'react'
import { messageOf } from './errors'
import { getMyProfile, type MyProfile } from './profile'

export function useMyProfile(userId: string) {
  const [data, setData] = useState<MyProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setData(await getMyProfile(userId))
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
