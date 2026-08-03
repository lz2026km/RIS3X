import { NotFoundException } from '@nestjs/common'
import { DualReadService } from '../src/modules/dual-read/dual-read.service'

describe('DualReadService', () => {
  let svc: DualReadService

  beforeEach(() => {
    svc = new DualReadService()
  })

  it('assign creates pending assignment with two distinct readers', () => {
    const a = svc.assign('STU-NEW', '赵六', 'P999', 'CT')
    expect(a.status).toBe('pending')
    expect(a.studyId).toBe('STU-NEW')
    expect(a.reader1Id).not.toBe(a.reader2Id)
    expect(a.id).toMatch(/^da-/)
    expect(svc.list()).toHaveLength(4)
  })

  it('arbitrate marks assignment and computes discrepancy score', () => {
    const a = svc.arbitrate('da-003', 'dr-005', 'Dr. Chen', '综合意见:建议随访')
    expect(a.status).toBe('arbitrated')
    expect(a.arbitratorName).toBe('Dr. Chen')
    expect(a.discrepancyScore).toBeGreaterThanOrEqual(0)
    expect(a.discrepancyScore).toBeLessThanOrEqual(0.3)
  })

  it('arbitrate throws for unknown assignment', () => {
    expect(() => svc.arbitrate('nope', 'dr-001', 'Dr. Wang', 'x')).toThrow(NotFoundException)
  })

  it('discrepancyStats aggregates seeded data', () => {
    const stats = svc.discrepancyStats()
    expect(stats.total).toBe(3)
    expect(stats.arbitrated).toBe(1)
    expect(stats.avgDiscrepancy).toBeGreaterThan(0)
  })

  it('list returns all assignments', () => {
    expect(svc.list()).toHaveLength(3)
    expect(svc.list()[0].status).toBe('both_done')
  })
})
