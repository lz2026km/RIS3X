import { CosignService } from '../src/cosign/cosign.service'

describe('CosignService', () => {
  let svc: CosignService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        groupBy: jest.fn(),
      },
      systemConfig: { findMany: jest.fn(), create: jest.fn() },
    }
    svc = new CosignService(mockPrisma)
  })

  it('listPendingCosigns queries failed cosign audits', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'a1' }])
    const r = await svc.listPendingCosigns()
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { resource: 'cosign', success: false } }))
    expect(r.data).toHaveLength(1)
  })

  it('getPendingCosign wraps record or empty', async () => {
    mockPrisma.auditLog.findUnique.mockResolvedValue({ id: 'a1' })
    await expect(svc.getPendingCosign('a1')).resolves.toMatchObject({ data: [{ id: 'a1' }] })
    mockPrisma.auditLog.findUnique.mockResolvedValue(null)
    await expect(svc.getPendingCosign('x')).resolves.toEqual({ data: [] })
  })

  it('approveCosign and rejectCosign create audit entries', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' })
    await svc.approveCosign({ reportId: 'r1' })
    expect(mockPrisma.auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'APPROVE', success: true }) }))
    await svc.rejectCosign({ reportId: 'r1' })
    expect(mockPrisma.auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'REJECT', success: false }) }))
  })

  it('listCosignHistory queries with limit', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([])
    await svc.listCosignHistory()
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }))
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

  it('getCosignStats groups by action', async () => {
    mockPrisma.auditLog.groupBy.mockResolvedValue([{ action: 'APPROVE', _count: { id: 3 } }])
    const r = await svc.getCosignStats()
    expect(mockPrisma.auditLog.groupBy).toHaveBeenCalled()
    expect(r.data[0].action).toBe('APPROVE')
  })
})
