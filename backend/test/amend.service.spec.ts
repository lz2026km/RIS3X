import { AmendService } from '../src/amend/amend.service'

describe('AmendService (G005-P1 在用孤儿补齐)', () => {
  let svc: AmendService

  beforeAll(() => {
    svc = new AmendService()
  })

  it('listAmendments returns seeded amendments and filters by reportId', async () => {
    const all = await svc.listAmendments({})
    expect(all.success).toBe(true)
    expect(all.data.length).toBeGreaterThan(0)
    const byReport = await svc.listAmendments({ reportId: 'RP20260601001' })
    expect(byReport.data.every((a: any) => a.reportId === 'RP20260601001')).toBe(true)
  })

  it('getAmendment returns amendment by id', async () => {
    const r = await svc.getAmendment('amend-001')
    expect(r.success).toBe(true)
    expect(r.data?.status).toBe('in_progress')
  })

  it('startAmendment creates in-progress amendment', async () => {
    const r = await svc.startAmendment({ reportId: 'RP-NEW-01', reason: '补充病理回报' })
    expect(r.success).toBe(true)
    expect(r.data.status).toBe('in_progress')
    expect(r.data.reportId).toBe('RP-NEW-01')
  })

  it('completeAmendment marks completed with reviewer', async () => {
    const r = await svc.completeAmendment('amend-002', { finalReason: '病理回报修正', changes: '补充病理结论' })
    expect(r.data?.status).toBe('completed')
    expect(r.data?.reviewerId).toBeTruthy()
    expect(r.data?.completedTime).toBeTruthy()
  })

  it('approveAmendment / rejectAmendment update status', async () => {
    const approved = await svc.approveAmendment('amend-003', { comment: '同意' })
    expect(approved.data.status).toBe('completed')
    const rejected = await svc.rejectAmendment('amend-004', { reason: '证据不足' })
    expect(rejected.data.status).toBe('rejected')
  })

  it('updateAmendment patches changes and status', async () => {
    const r = await svc.updateAmendment('amend-001', { changes: '补充右侧结节' })
    expect(r.data?.changes).toBe('补充右侧结节')
  })
})
