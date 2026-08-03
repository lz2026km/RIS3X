import { NotFoundException } from '@nestjs/common'
import { TeleSignService } from '../src/modules/tele-sign/tele-sign.service'

describe('TeleSignService', () => {
  let svc: TeleSignService

  beforeEach(() => {
    svc = new TeleSignService()
  })

  it('creates a pending sign session and appends to list', () => {
    const s = svc.create('RPT099', 'Chest CT Report', 'Zhang San', 'dr-001', 'Dr. Wang')
    expect(s.status).toBe('pending')
    expect(s.reportId).toBe('RPT099')
    expect(s.id).toMatch(/^ts-/)
    expect(svc.list()).toHaveLength(4)
    expect(svc.list().find(x => x.id === s.id)).toBe(s)
  })

  it('approves an existing session with signature data and comment', () => {
    const s = svc.approve('ts-001', 'data:image/png;base64,AAA', '同意')
    expect(s.status).toBe('approved')
    expect(s.signatureData).toBe('data:image/png;base64,AAA')
    expect(s.comment).toBe('同意')
    expect(s.updatedAt).toBeDefined()
  })

  it('throws NotFoundException when approving an unknown session', () => {
    expect(() => svc.approve('nope', 'sig')).toThrow(NotFoundException)
  })

  it('rejects an existing session with comment', () => {
    const s = svc.reject('ts-002', '需要补充影像学描述')
    expect(s.status).toBe('rejected')
    expect(s.comment).toBe('需要补充影像学描述')
    expect(s.updatedAt).toBeDefined()
  })

  it('throws NotFoundException when rejecting an unknown session', () => {
    expect(() => svc.reject('nope', 'x')).toThrow(NotFoundException)
  })

  it('lists all seeded sessions', () => {
    const all = svc.list()
    expect(all).toHaveLength(3)
    expect(all.map(x => x.id)).toEqual(['ts-001', 'ts-002', 'ts-003'])
  })
})
