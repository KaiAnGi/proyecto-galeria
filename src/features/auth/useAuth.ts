import { useSyncExternalStore } from 'react'
import { getAuthSnapshot, subscribeAuth } from './googleAuth'

export function useAuth() {
  return useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthSnapshot)
}
