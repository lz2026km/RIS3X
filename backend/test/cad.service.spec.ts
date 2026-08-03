import { NotFoundException } from '@nestjs/common'
import { CadService } from '../src/modules/cad/cad.service'

describe('CadService', () => {
  let svc: CadService

  beforeEach(() => {
    svc = new CadService()
  })

  it('detect returns findings and caches result', async () => {
    jest.useFakeTimers()
    try {
      const p = svc.detect('inst-1')
      jest.advanceTimersByTime(250)
      const result = await p
      expect(result.findings).toHaveLength(4)
      expect(result.instanceId).toBe('inst-1')
      expect(result.heatmapUrl).toContain('inst-1')
      const cachedP = svc.detect('inst-1')
      jest.advanceTimersByTime(250)
      const cached = await cachedP
      expect(cached.detectedAt).toBe(result.detectedAt)
    } finally {
      jest.useRealTimers()
    }
  })

  it('getResult throws for unknown instance', async () => {
    await expect(svc.getResult('unknown')).rejects.toThrow(NotFoundException)
  })

  it('getResult returns previously detected result', async () => {
    jest.useFakeTimers()
    try {
      const p = svc.detect('inst-2')
      jest.advanceTimersByTime(250)
      await p
      const r = await svc.getResult('inst-2')
      expect(r.instanceId).toBe('inst-2')
    } finally {
      jest.useRealTimers()
    }
  })
})
