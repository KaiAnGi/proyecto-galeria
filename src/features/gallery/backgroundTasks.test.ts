import { afterEach, describe, expect, it } from 'vitest'
import {
  failBackgroundTask,
  finishBackgroundTask,
  getBackgroundTasksSnapshot,
  startBackgroundTask,
  updateBackgroundTask,
} from './backgroundTasks'

const keys = ['gif:test', 'originals:test']

afterEach(() => {
  for (const key of keys) finishBackgroundTask(key)
})

describe('background tasks', () => {
  it('tracks progress and stage for a gif refresh', () => {
    startBackgroundTask({
      key: 'gif:test',
      kind: 'gif',
      sequenceId: 'sec-1',
      sequenceTitle: 'Olas',
      total: 4,
    })
    updateBackgroundTask('gif:test', { done: 2, stage: 'encoding' })

    expect(getBackgroundTasksSnapshot()).toEqual([
      {
        key: 'gif:test',
        kind: 'gif',
        sequenceId: 'sec-1',
        sequenceTitle: 'Olas',
        done: 2,
        total: 4,
        stage: 'encoding',
        status: 'running',
      },
    ])
  })

  it('marks failures and removes finished tasks', () => {
    startBackgroundTask({
      key: 'originals:test',
      kind: 'originals',
      sequenceId: 'sec-1',
      sequenceTitle: 'Olas',
    })
    failBackgroundTask('originals:test')

    expect(getBackgroundTasksSnapshot()[0].status).toBe('error')
    finishBackgroundTask('originals:test')
    expect(getBackgroundTasksSnapshot()).toEqual([])
  })
})
