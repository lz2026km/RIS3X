import { describe, it, expect, vi, afterEach } from 'vitest'
import { useCriticalStore } from '../criticalStore'

describe('PERF1 dispose', () => {
  afterEach(() => {
    useCriticalStore.getState().dispose?.()
    vi.restoreAllMocks()
  })

  it('clears values and stops escalation watcher', () => {
    const store = useCriticalStore.getState()
    const stopSpy = vi.spyOn(store, 'stopEscalationWatcher')
    store.startEscalationWatcher()
    expect(useCriticalStore.getState().dispose).toBeTypeOf('function')
    useCriticalStore.getState().dispose()
    expect(useCriticalStore.getState().values.length).toBe(0)
    expect(useCriticalStore.getState().actors.size).toBe(0)
    expect(stopSpy).toHaveBeenCalled()
  })

  it('is re-exported from store index', async () => {
    const { useCriticalStore: idxStore } = await import('../index')
    expect(typeof idxStore.getState().dispose).toBe('function')
  })
})
