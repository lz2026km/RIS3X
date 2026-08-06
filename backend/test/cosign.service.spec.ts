import { CosignService } from '../src/cosign/cosign.service'

describe('CosignService (e2e)', () => {
  let svc: CosignService
  let mockPrisma: any
  let mockReports: any

  beforeEach(() => {
    mockPrisma = {
      report: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn(),
        create: jest.fn(),
        groupBy: jest.fn(),
      },
      systemConfig: { findMany: jest.fn(), create: jest.fn() },
    }
    mockReports = { transition: jest.fn() }
    svc = new CosignService(mockPrisma, mockReports)
  })

  it('listPendingCosigns queries Report table state=CO_SIGN_REVIEW', async () => {
    mockPrisma.report.findMany.mockResolvedValue([{ id: 'r1', patientName: 'P', createdAt: new Date(), state: 'CO_SIGN_REVIEW' }])
    const r = await svc.listPendingCosigns()
    expect(mockPrisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ state: 'CO_SIGN_REVIEW' }) }))
    expect(r.data).toHaveLength(1)
    expect(r.data[0].reportId).toBe('r1')
  })

  it('getPendingCosign wraps record or empty', async () => {
    mockPrisma.report.findUnique.mockResolvedValue({ id: 'r1', createdAt: new Date(), state: 'CO_SIGN_REVIEW' })
    await expect(svc.getPendingCosign('r1')).resolves.toMatchObject({ data: [{ reportId: 'r1' }] })
    mockPrisma.report.findUnique.mockResolvedValue(null)
    await expect(svc.getPendingCosign('x')).resolves.toEqual({ data: [] })
  })

  it('approveCosign drives CO_SIGN_REVIEW → REVIEWED and writes audit entry', async () => {
    mockPrisma.report.findUnique.mockResolvedValue({ id: 'r1', state: 'CO_SIGN_REVIEW' })
    mockReports.transition.mockResolvedValue({ id: 'r1', state: 'REVIEWED' })
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' })
    await svc.approveCosign('r1', 'dr-9', { comment: 'ok' })
    expect(mockReports.transition).toHaveBeenCalledWith('r1', 'REVIEWED', 'dr-9', 'ok')
    expect(mockPrisma.report.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ coSignerId: 'dr-9' }) }))
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'APPROVE', success: true }) }))
  })

  it('rejectCosign drives CO_SIGN_REVIEW → REJECTED with reason', async () => {
    mockPrisma.report.findUnique.mockResolvedValue({ id: 'r1', state: 'CO_SIGN_REVIEW' })
    mockReports.transition.mockResolvedValue({ id: 'r1', state: 'REJECTED' })
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' })
    await svc.rejectCosign('r1', 'dr-9', { reason: '不符' })
    expect(mockReports.transition).toHaveBeenCalledWith('r1', 'REJECTED', 'dr-9', '不符')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'REJECT', success: false }) }))
  })

  it('listCosignHistory queries with limit', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'a1', resourceId: 'r1', action: 'APPROVE', createdAt: new Date(), detail: {} }])
    const r = await svc.listCosignHistory()
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }))
    expect(r.data[0].reportId).toBe('r1')
  })

  it('listCosignRules and createCosignRule manage rules', async () => {
    mockPrisma.systemConfig.findMany.mockResolvedValue([{ key: 'cosign_rule_1' }])
    const r = await svc.listCosignRules()
    expect(r.data).toHaveLength(1)
    mockPrisma.systemConfig.create.mockResolvedValue({ key: 'cosign_rule_123' })
    const c = await svc.createCosignRule({ rule: 'x' })
    expect(mockPrisma.systemConfig.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ key: expect.stringMatching(/^cosign_rule_/) }) }))
    expect(c.data).toHaveLength(1)
  })

  it('getCosignStats computes pending from Report count + action groups', async () => {
    mockPrisma.report.count.mockResolvedValue(4)
    mockPrisma.auditLog.groupBy.mockResolvedValue([{ action: 'APPROVE', _count: { id: 3 } }])
    const r = await svc.getCosignStats()
    expect(mockPrisma.report.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ state: 'CO_SIGN_REVIEW' }) }))
    expect(r.data.pending).toBe(4)
    expect(r.data.approved).toBe(3)
  })
})
