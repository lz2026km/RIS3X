/**
 * [G005 W9-QC] qc-pdca 整改措施 / 问题发现 / 指标 spec
 */
import { QcPdcaService } from './qc-pdca.service'

const prisma = {
  auditLog: { findMany: jest.fn().mockResolvedValue([]) },
} as never

describe('QcPdcaService 持久化扩展 (actions/findings/metrics)', () => {
  it('种子含 4 状态整改措施 + 问题发现', () => {
    const service = new QcPdcaService(prisma)
    const actions = service.listActions('pdca-001')
    expect(actions.length).toBeGreaterThan(0)
    const allStatuses = new Set(service.listActions('pdca-101').map((a) => a.status))
    expect(allStatuses.size).toBeGreaterThanOrEqual(1)
    const findings = service.listFindings('pdca-001')
    expect(findings.length).toBeGreaterThan(0)
  })

  it('addAction 默认 pending + 指派 owner; complete 置 done', () => {
    const service = new QcPdcaService(prisma)
    const action = service.addAction('pdca-001', { description: '新增整改措施', ownerId: 'u-002' })
    expect(action.status).toBe('pending')
    expect(action.ownerName).toBe('李医生')
    const done = service.completeAction(action.id)
    expect(done.status).toBe('done')
    expect(done.completedAt).toBeTruthy()
    expect(() => service.completeAction(action.id)).toThrow()
  })

  it('updateAction 支持改期/状态; 未知 action 404', () => {
    const service = new QcPdcaService(prisma)
    const action = service.addAction('pdca-002', { description: '措施A' })
    const updated = service.updateAction(action.id, { status: 'in_progress', deadline: '2026-09-01' })
    expect(updated.status).toBe('in_progress')
    expect(updated.deadline).toBe('2026-09-01')
    expect(() => service.updateAction('nope', { status: 'done' })).toThrow()
  })

  it('addFinding + 校验 severity', () => {
    const service = new QcPdcaService(prisma)
    const finding = service.addFinding('pdca-003', { title: '新发现', severity: 'high' })
    expect(finding.severity).toBe('high')
    expect(() => service.addFinding('pdca-003', { title: 'x', severity: 'bad' as never })).toThrow()
  })

  it('metrics: 完成率/超期/按 owner/缺陷关联', async () => {
    const service = new QcPdcaService(prisma)
    const res = await service.getMetrics()
    expect(res.data.cycleCount).toBeGreaterThan(0)
    expect(res.data.actionCount).toBeGreaterThan(0)
    expect(res.data.actionCompletionRate).toBeGreaterThanOrEqual(0)
    expect(res.data.byOwner.length).toBeGreaterThan(0)
    expect(res.data.defectCount).toBeGreaterThan(0)
    expect(res.data.linkedDefectCount).toBeGreaterThan(0)
  })

  it('advance 全阶段闭环', async () => {
    const service = new QcPdcaService(prisma)
    const created = await service.createCycle({ title: '闭环测试', category: '报告质控' })
    expect(created.phase).toBe('plan')
    let cur = await service.advanceCycle(created.id)
    expect(cur.phase).toBe('do')
    cur = await service.advanceCycle(created.id)
    expect(cur.phase).toBe('check')
    cur = await service.advanceCycle(created.id)
    expect(cur.phase).toBe('act')
    cur = await service.advanceCycle(created.id)
    expect(cur.phase).toBe('completed')
    await expect(service.advanceCycle(created.id)).rejects.toThrow()
  })
})
