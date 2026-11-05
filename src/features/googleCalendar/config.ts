import { downloadJson, findFileByName, upsertJson } from '../drive/driveImageClient'
import { getFolderIds } from '../gallery/upload'

export interface CalendarConfig {
  schema: 1
  rev: number
  updatedAt: string
  calendarId?: string
  calendarMigratedAt?: string
}

const CONFIG_NAME = 'config.json'

export async function loadCalendarConfig(token: string): Promise<CalendarConfig | null> {
  const folders = await getFolderIds(token)
  const file = await findFileByName(token, CONFIG_NAME, folders.datosId)
  if (!file) return null

  try {
    const data = await downloadJson<Partial<CalendarConfig> & Record<string, unknown>>(
      token,
      file.id,
    )
    return {
      ...data,
      schema: 1,
      rev: typeof data.rev === 'number' ? data.rev : 1,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
      calendarId: typeof data.calendarId === 'string' ? data.calendarId : undefined,
      calendarMigratedAt:
        typeof data.calendarMigratedAt === 'string' ? data.calendarMigratedAt : undefined,
    }
  } catch (error) {
    console.warn('Could not read calendar config', error)
    return null
  }
}

export async function saveCalendarConfig(
  token: string,
  patch: Partial<Omit<CalendarConfig, 'schema' | 'updatedAt'>>,
): Promise<CalendarConfig> {
  const folders = await getFolderIds(token)
  const current = await loadCalendarConfig(token)
  const next: CalendarConfig = {
    schema: 1,
    ...current,
    ...patch,
    rev: (current?.rev ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  await upsertJson(token, next, CONFIG_NAME, [folders.datosId], { kind: 'config' })
  return next
}
