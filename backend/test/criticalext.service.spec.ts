import { CriticalExtService } from '../src/criticalext/criticalext.service'

describe('CriticalExtService', () => {
  let svc: CriticalExtService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      systemConfig: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      criticalValue: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      criticalValueNotification: { findMany: jest.fn() },
    }
    svc = new CriticalExtService(mockPrisma)
  })

  it('listCriticalRules queries rule configs', async () => {
    mockPrisma.systemConfig.findMany.mockResolvedValue([{ key: 'critical_rule_1' }])
    const r = await svc.listCriticalRules()
    expect(mockPrisma.systemConfig.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { key: { startsWith: 'critical_rule_' } } }))
    expect(r.items).toHaveLength(1)
    expect(r.total).toBe(1)
  })

  it('createCriticalRule validates and creates', async () => {
    mockPrisma.systemConfig.create.mockResolvedValue({ id: 'c1' })
    const r = await svc.createCriticalRule({ name: '高钾血症', triggerCondition: 'K > 6.5', severity: 'CRITICAL', channels: ['SMS', 'APP'], recipients: ['值班医师'] })
    expect(mockPrisma.systemConfig.create).toHaveBeenCalled()
    expect((r as unknown as { id: string }).id).toBe('c1')
  })

  it('createCriticalRule passes body through to config', async () => {
    mockPrisma.systemConfig.create.mockResolvedValue({ id: 'c2' })
    const r = await svc.createCriticalRule({ name: '低血糖', triggerCondition: 'GLU < 2.8', severity: 'HIGH', channels: ['APP'], recipients: ['护士站'] })
    expect(mockPrisma.systemConfig.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ key: expect.stringMatching(/^critical_rule_/) }) }))
    expect((r as unknown as { id: string }).id).toBe('c2')
  })

  it('updateCriticalRule and deleteCriticalRule mutate config', async () => {
    mockPrisma.systemConfig.update.mockResolvedValue({ key: 'critical_rule_1' })
    await svc.updateCriticalRule('critical_rule_1', { name: 'x', enabled: false })
    expect(mockPrisma.systemConfig.update).toHaveBeenCalledWith(expect.objectContaining({ where: { key: 'critical_rule_1' } }))
    mockPrisma.systemConfig.delete.mockResolvedValue({})
    await expect(svc.deleteCriticalRule('critical_rule_1')).resolves.toEqual({ deleted: true })
  })

  it('getCriticalStats counts values by state and severity', async () => {
    mockPrisma.criticalValue.count.mockResolvedValue(5)
    mockPrisma.criticalValue.groupBy.mockResolvedValue([])
    const r = await svc.getCriticalStats()
    expect(r.total).toBe(5)
    expect(mockPrisma.criticalValue.groupBy).toHaveBeenCalledTimes(2)
  })

  it('getCriticalSummary and listCriticalCenter list values', async () => {
    mockPrisma.criticalValue.findMany.mockResolvedValue([{ id: 'v1' }])
    await expect(svc.getCriticalSummary()).resolves.toMatchObject({ items: [{ id: 'v1' }] })
    await expect(svc.listCriticalCenter()).resolves.toMatchObject({ items: [{ id: 'v1' }] })
  })

  it('getCriticalTimeline and getReceiverPortal list notifications', async () => {
    mockPrisma.criticalValueNotification.findMany.mockResolvedValue([{ id: 'n1' }])
    await expect(svc.getCriticalTimeline()).resolves.toMatchObject({ items: [{ id: 'n1' }] })
    await svc.getReceiverPortal()
    expect(mockPrisma.criticalValueNotification.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { status: 'PENDING' } }))
  })

  it('getFollowUpRecords lists recent notifications', async () => {
    mockPrisma.criticalValueNotification.findMany.mockResolvedValue([{ id: 'n1' }, { id: 'n2' }])
    const r = await svc.getFollowUpRecords()
    expect(r.items).toHaveLength(2)
    expect(mockPrisma.criticalValueNotification.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { triggeredAt: 'desc' }, take: 100 }))
  })

  it('getCriticalCenterItem wraps value or empty', async () => {
    mockPrisma.criticalValue.findUnique.mockResolvedValue({ id: 'v1' })
    await expect(svc.getCriticalCenterItem('v1')).resolves.toMatchObject({ id: 'v1' })
    mockPrisma.criticalValue.findUnique.mockResolvedValue(null)
    await expect(svc.getCriticalCenterItem('x')).resolves.toBeNull()
  })

  it('autoDetectCritical validates and creates', async () => {
    mockPrisma.criticalValue.create.mockResolvedValue({ id: 'v1' })
    const r = await svc.autoDetectCritical({ examId: 'e1', reportContent: '患者血钾明显升高，提示高钾血症', radiologistId: 'r1' })
    expect(r.id).toBe('v1')
  })

  it('closeCriticalLoop drives CLOSED_LOOP 终态 (closedAt/closedBy)', async () => {
    mockPrisma.criticalValue.update.mockResolvedValue({ id: 'v1' })
    const r = await svc.closeCriticalLoop({ criticalId: 'v1', resolution: '已处理', resolvedBy: 'dr-1' })
    expect(mockPrisma.criticalValue.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ state: 'CLOSED_LOOP', closedBy: 'dr-1', closedAt: expect.any(Date) }),
    }))
    expect(r.id).toBe('v1')
  })
})
