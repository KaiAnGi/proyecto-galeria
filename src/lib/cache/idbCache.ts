import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'kuromi-cache'
const DB_VERSION = 1

export interface CacheState {
  obras: any[]
  colecciones: any[]
  secuencias: any[]
  lastSyncedAt?: string
}

interface StoreMap {
  state: CacheState
}

async function getDb(): Promise<IDBPDatabase<StoreMap>> {
  return openDB<StoreMap>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('state')) {
        db.createObjectStore('state')
      }
    },
  })
}

export async function saveCache(state: CacheState): Promise<void> {
  const db = await getDb()
  await db.put('state', state, 'cache')
}

export async function loadCache(): Promise<CacheState | undefined> {
  const db = await getDb()
  return await db.get('state', 'cache')
}

export async function clearCache(): Promise<void> {
  const db = await getDb()
  await db.delete('state', 'cache')
}
