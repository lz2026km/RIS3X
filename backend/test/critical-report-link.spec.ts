/**
 * G005 RIS v3.0.6.11-100 (Wave 8 流程闭环: 危急值→报告反向引用)
 * 端点:
 *   - POST /criticals            { examId, description, severity, method, reportId } → 记录内存链接
 *   - GET  /criticals/for-report/:reportId    按报告查关联危急值 (内存链接 + DB examId 合并去重)
 *   - POST /critical-alert       { ..., reportId } → extras 记录 reportId
 *   - GET  /critical-alert/for-report/:reportId 按报告查关联危急值告警
 */
import { NotFoundException } from '@nestjs/common'
import { CriticalsService, criticalReportLinks } from '../src/criticals/criticals.service'
import { CriticalAlertService } from '../src/modules/critical-alert/critical-alert.service'
import { createNoopGateway } from '../src/notifications/notifications.gateway'

const mockSystemConfig = {
  getNumber: jest.fn().mockResolvedValue(20),
  getString: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  invalidate: jest.fn(),
}

const makeCriticalsPrisma = (overrides: Record<string, unknown> = {}): any => ({
  exam: { findUnique: jest.fn() },
  criticalValue: {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  report: { findUnique: jest.fn() },
  ...overrides,
})

const makeCriticalAlertPrisma = () => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  return {
    criticalValue: { findMany: reject, findUnique: reject, create: reject, update: reject },
    report: { findUnique: reject },
  } as never
}

describe('CriticalsService - 报告→危急值反向引用', () => {
  beforeEach(() => criticalReportLinks.clear())

  it('create 携带 reportId → 内存链接表记录 (DB 不可用时仍记录)', async () => {
    const prisma = makeCriticalsPrisma({
      exam: { findUnique: jest.fn().mockResolvedValue({ id: 'EX-1', patientId: 'P-1' }) },
      criticalValue: {
        create: jest.fn().mockResolvedValue({
          id: 'CV-LINK-1',
          description: '主动脉夹层可能',
          severity: 'URGENT',
          state: 'FOUND',
          method: 'PHONE',
          createdAt: new Date(),
          examId: 'EX-1',
          patientId: 'P-1',
        }),
      },
    })
    const svc = new CriticalsService(prisma, mockSystemConfig as never, createNoopGateway())
    const created = await svc.create({ examId: 'EX-1', description: '主动脉夹层可能', severity: 'URGENT', method: 'PHONE', reportId: 'RPT-100' })
    expect(created.id).toBe('CV-LINK-1')
    expect(criticalReportLinks.get('RPT-100')?.length).toBe(1)
    expect(criticalReportLinks.get('RPT-100')?.[0]?.id).toBe('CV-LINK-1')
  })

  it('forReport 返回内存链接的危急值 (DB 不可用 → 内存兜底, 不抛错)', async () => {
    criticalReportLinks.set('RPT-100', [
      { id: 'CV-MEM-1', description: '肝破裂出血', severity: 'CRITICAL', state: 'FOUND', createdAt: '2026-08-10T08:00:00.000Z' },
    ])
    const prisma = makeCriticalsPrisma({
      exam: { findUnique: jest.fn().mockRejectedValue(new Error('no db')) },
      report: { findUnique: jest.fn().mockRejectedValue(new Error('no db')) },
      criticalValue: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    })
    const svc = new CriticalsService(prisma, mockSystemConfig as never, createNoopGateway())
    const res = await svc.forReport('RPT-100')
    expect(res.reportId).toBe('RPT-100')
    expect(res.total).toBe(1)
    expect(res.items[0]?.id).toBe('CV-MEM-1')
    expect(res.items[0]?.linkedByReport).toBe(true)
    expect(res.items[0]?.severity).toBe('CRITICAL')
  })

  it('forReport 合并 DB(examId 匹配) + 内存链接, 同 id 去重', async () => {
    criticalReportLinks.set('RPT-100', [
      { id: 'CV-DUP', description: '重复项', severity: 'HIGH', state: 'FOUND', createdAt: '2026-08-10T08:00:00.000Z' },
      { id: 'CV-MEM-2', description: '仅内存', severity: 'URGENT', state: 'ACKNOWLEDGED', createdAt: '2026-08-10T09:00:00.000Z' },
    ])
    const prisma = makeCriticalsPrisma({
      report: { findUnique: jest.fn().mockResolvedValue({ id: 'RPT-100', examId: 'EX-1', patientId: 'P-1' }) },
      criticalValue: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'CV-DUP', examId: 'EX-1', description: '重复项', severity: 'HIGH', state: 'FOUND', createdAt: new Date('2026-08-10T08:00:00Z') },
        ]),
      },
    })
    const svc = new CriticalsService(prisma, mockSystemConfig as never, createNoopGateway())
    const res = await svc.forReport('RPT-100')
    expect(res.total).toBe(2)
    expect(res.items.map((i) => i.id).sort()).toEqual(['CV-DUP', 'CV-MEM-2'])
    expect(prisma.criticalValue.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ examId: 'EX-1' }) }))
  })

  it('forReport 无链接无匹配 → 空列表', async () => {
    const prisma = makeCriticalsPrisma({
      report: { findUnique: jest.fn().mockResolvedValue({ id: 'RPT-999', examId: 'EX-9', patientId: 'P-9' }) },
    })
    const svc = new CriticalsService(prisma, mockSystemConfig as never, createNoopGateway())
    const res = await svc.forReport('RPT-999')
    expect(res.total).toBe(0)
    expect(res.items).toEqual([])
  })

  it('create 未携带 reportId → 不写链接表', async () => {
    const prisma = makeCriticalsPrisma({
      criticalValue: {
        create: jest.fn().mockResolvedValue({ id: 'CV-NO', description: 'x', severity: 'HIGH', state: 'FOUND', createdAt: new Date() }),
      },
    })
    const svc = new CriticalsService(prisma, mockSystemConfig as never, createNoopGateway())
    await svc.create({ description: 'x', severity: 'HIGH', method: 'SYSTEM' })
    expect(criticalReportLinks.size).toBe(0)
  })
})

describe('CriticalAlertService - 报告→危急值告警反向引用', () => {
  it('create 携带 reportId → 告警记录含 reportId (seed 回退路径)', async () => {
    const svc = new CriticalAlertService(makeCriticalAlertPrisma())
    const created = await svc.create({
      level: 'emergency',
      patientName: '测试患者',
      description: '报告转入危急值',
      reportId: 'RPT-100',
    })
    expect(created.reportId).toBe('RPT-100')
    const detail = await svc.getAlert(created.id)
    expect(detail.reportId).toBe('RPT-100')
  })

  it('forReport 按 reportId 精确匹配 (DB 不可用 → 内存 extras)', async () => {
    const svc = new CriticalAlertService(makeCriticalAlertPrisma())
    await svc.create({ level: 'critical', patientName: '测试患者', description: 'A', reportId: 'RPT-100' })
    await new Promise((r) => setTimeout(r, 2))
    await svc.create({ level: 'critical', patientName: '测试患者', description: 'B' })
    const linked = await svc.forReport('RPT-100')
    expect(linked.length).toBe(1)
    expect(linked[0]?.description).toContain('A')
  })

  it('forReport 未知报告 → 空列表', async () => {
    const svc = new CriticalAlertService(makeCriticalAlertPrisma())
    const linked = await svc.forReport('RPT-NOPE')
    expect(Array.isArray(linked)).toBe(true)
    expect(linked.length).toBe(0)
  })

  it('forReport 返回项字段齐全 (级别/状态/时间/报告ID)', async () => {
    const svc = new CriticalAlertService(makeCriticalAlertPrisma())
    await svc.create({ level: 'warning', patientName: '测试患者', description: 'C', reportId: 'RPT-200' })
    const linked = await svc.forReport('RPT-200')
    expect(linked[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      severity: 'warning',
      status: 'active',
      reportId: 'RPT-200',
      createdAt: expect.any(String),
    }))
  })
})
