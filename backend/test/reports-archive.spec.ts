/**
 * G005 RIS v3.0.6.11-100 (Wave 8 流程闭环: 报告冷归档策略)
 * 端点:
 *   - GET  /reports/archive-policy   归档策略 { enabled, archiveAfterDays, targetTier, deleteSourceAfterDays, ... }
 *   - PUT  /reports/archive-policy   更新策略 (内存 + seed)
 *   - POST /reports/:id/archive      归档报告 (PUBLISHED → ARCHIVED + 归档任务记录)
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ReportsService, REPORT_TRANSITIONS } from '../src/reports/reports.service'

const makePrisma = (overrides: Record<string, unknown> = {}): any => {
  const prisma: Record<string, unknown> = {
    report: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    reportRevision: { create: jest.fn().mockResolvedValue({}) },
    auditLog: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((cb: (tx: Record<string, unknown>) => unknown) => cb({ report: prisma.report, reportRevision: prisma.reportRevision })),
    ...overrides,
  }
  return prisma
}

const makeQueue = () => ({ addReportExport: jest.fn().mockResolvedValue({}) }) as never
const makeSystemConfig = () => ({ getNumber: jest.fn().mockResolvedValue(20), getString: jest.fn().mockResolvedValue(''), get: jest.fn(), invalidate: jest.fn() }) as never
const makeService = (prisma: Record<string, unknown>) => new ReportsService(prisma as never, makeQueue(), makeSystemConfig())

describe('ReportsService - 报告冷归档策略 (archive-policy)', () => {
  it('getArchivePolicy 返回 seed 默认值 (enabled/365/archive/deleteSourceAfterDays)', () => {
    const svc = makeService(makePrisma())
    const policy = svc.getArchivePolicy()
    expect(policy.enabled).toBe(true)
    expect(policy.archiveAfterDays).toBe(365)
    expect(policy.targetTier).toBe('archive')
    expect(policy.deleteSourceAfterDays).toBe(90)
    expect(policy.updatedAt).toBeTruthy()
  })

  it('getArchivePolicy 统计字段: archivedCount/pendingCount 为数字', () => {
    const svc = makeService(makePrisma())
    const policy = svc.getArchivePolicy()
    expect(typeof policy.archivedCount).toBe('number')
    expect(typeof policy.pendingCount).toBe('number')
    expect(policy.archivedCount).toBeGreaterThanOrEqual(2)
  })

  it('updateArchivePolicy 更新 enabled=false + targetTier=cold 持久化', () => {
    const svc = makeService(makePrisma())
    const updated = svc.updateArchivePolicy({ enabled: false, targetTier: 'cold' })
    expect(updated.enabled).toBe(false)
    expect(updated.targetTier).toBe('cold')
    expect(svc.getArchivePolicy().enabled).toBe(false)
  })

  it('updateArchivePolicy 非法 targetTier → BadRequestException', () => {
    const svc = makeService(makePrisma())
    expect(() => svc.updateArchivePolicy({ targetTier: 'hot' as never })).toThrow(BadRequestException)
  })

  it('updateArchivePolicy 非法 archiveAfterDays → BadRequestException', () => {
    const svc = makeService(makePrisma())
    expect(() => svc.updateArchivePolicy({ archiveAfterDays: 0 })).toThrow(BadRequestException)
    expect(() => svc.updateArchivePolicy({ archiveAfterDays: 999999 })).toThrow(BadRequestException)
  })

  it('updateArchivePolicy deleteSourceAfterDays 置 null 清除源副本删除', () => {
    const svc = makeService(makePrisma())
    expect(svc.updateArchivePolicy({ deleteSourceAfterDays: null }).deleteSourceAfterDays).toBeNull()
  })

  it('archive 报告不存在 → NotFoundException', async () => {
    const prisma = makePrisma()
    const svc = makeService(prisma)
    await expect(svc.archive('RPT-NOPE')).rejects.toThrow(NotFoundException)
  })

  it('archive 非已发布报告 → BadRequestException (INVALID_TRANSITION)', async () => {
    const prisma = makePrisma()
    prisma.report.findUnique = jest.fn().mockResolvedValue({ id: 'RPT-W', state: 'WRITING', updatedAt: new Date() })
    const svc = makeService(prisma)
    await expect(svc.archive('RPT-W')).rejects.toThrow(BadRequestException)
    await expect(svc.archive('RPT-W')).rejects.toThrow(/INVALID_TRANSITION/)
  })

  it('archive 已发布报告 → state=ARCHIVED + revision + 归档任务记录 (policy 使用目标层级)', async () => {
    const prisma = makePrisma()
    prisma.report.findUnique = jest.fn().mockResolvedValue({ id: 'RPT-PUB', state: 'PUBLISHED', updatedAt: new Date() })
    const revisionCreate = prisma.reportRevision.create as jest.Mock
    const auditCreate = prisma.auditLog.create as jest.Mock
    const svc = makeService(prisma)
    const before = svc.getArchivePolicy().archivedCount
    const res = await svc.archive('RPT-PUB', 'U-1')
    expect(res.state).toBe('ARCHIVED')
    expect(res.archivedAt).toBeTruthy()
    expect(res.task.reportId).toBe('RPT-PUB')
    expect(res.task.targetTier).toBe('archive')
    expect(prisma.report.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'RPT-PUB' }, data: expect.objectContaining({ state: 'ARCHIVED' }) }))
    expect(revisionCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reportId: 'RPT-PUB', toState: 'ARCHIVED', actorId: 'U-1' }) }))
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'REPORT_ARCHIVED' }) }))
    expect(svc.getArchivePolicy().archivedCount).toBe(before + 1)
  })

  it('archive 已归档报告 → 幂等返回 alreadyArchived', async () => {
    const prisma = makePrisma()
    prisma.report.findUnique = jest.fn().mockResolvedValue({ id: 'RPT-ARC', state: 'ARCHIVED', updatedAt: new Date() })
    const svc = makeService(prisma)
    const res = await svc.archive('RPT-ARC')
    expect(res.alreadyArchived).toBe(true)
    expect(res.state).toBe('ARCHIVED')
    expect(prisma.report.update).not.toHaveBeenCalled()
  })

  it('archiveMany 部分失败不阻断其余 (成功+失败分开计数)', async () => {
    const prisma = makePrisma()
    prisma.report.findUnique = jest.fn((arg: { where: { id: string } }) => {
      if (arg.where.id === 'RPT-OK') return Promise.resolve({ id: 'RPT-OK', state: 'PUBLISHED', updatedAt: new Date() })
      if (arg.where.id === 'RPT-BAD') return Promise.resolve({ id: 'RPT-BAD', state: 'WRITING', updatedAt: new Date() })
      return Promise.resolve(null)
    })
    const svc = makeService(prisma)
    const res = await svc.archiveMany(['RPT-OK', 'RPT-BAD', 'RPT-MISSING'], 'U-1')
    expect(res.succeeded.map((s) => s.id)).toEqual(['RPT-OK'])
    expect(res.failed.map((f) => f.id).sort()).toEqual(['RPT-BAD', 'RPT-MISSING'])
  })

  it('REPORT_TRANSITIONS.PUBLISHED 包含 ARCHIVED (状态机允许已发布→归档)', () => {
    expect(REPORT_TRANSITIONS['PUBLISHED']).toContain('ARCHIVED')
    expect(REPORT_TRANSITIONS['ARCHIVED']).toEqual([])
  })
})
