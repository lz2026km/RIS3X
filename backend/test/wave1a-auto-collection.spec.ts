/**
 * [G005 Wave1A] Auto Collection 模块 spec — 规则 CRUD + 任务生命周期 + 统计
 */
import { AutoCollectionService } from '../src/modules/auto-collection/auto-collection.service'

describe('Wave1A Auto Collection', () => {
  it('rules: seed 列表 + CRUD', () => {
    const svc = new AutoCollectionService()
    const before = svc.listRules()
    expect(before.length).toBeGreaterThan(0)
    expect(before.every((r) => r.triggerType && r.action)).toBe(true)

    const created = svc.createRule({ name: 'FTP 自动传输', description: '定时传输至分院', triggerType: 'schedule', triggerConfig: { cron: '0 2 * * *' }, action: 'transfer', actionConfig: { target: 'branch' }, enabled: true })
    expect(svc.listRules()).toHaveLength(before.length + 1)

    const updated = svc.updateRule(created.id, { enabled: false })
    expect(updated.enabled).toBe(false)

    expect(svc.deleteRule(created.id).deleted).toBe(true)
    expect(() => svc.getRule('ghost')).toThrow(/不存在/)
  })

  it('tasks: seed 任务 (DICOM/HL7/FTP) + start/stop/run/rerun 生命周期', () => {
    const svc = new AutoCollectionService()
    const tasks = svc.listTasks()
    expect(tasks.length).toBeGreaterThan(0)
    const sourceTypes = new Set(tasks.map((t) => t.sourceType))
    expect(sourceTypes.has('DICOM')).toBe(true)
    expect(sourceTypes.has('HL7')).toBe(true)
    expect(sourceTypes.has('FTP')).toBe(true)

    const created = svc.createTask({ ruleId: 'ac-001', sourceType: 'DICOM' })
    expect(created.status).toBe('pending')

    const running = svc.startTask(created.id)
    expect(running.status).toBe('running')

    const done = svc.runTask(created.id)
    expect(done.status).toBe('completed')
    expect(done.completedAt).toBeDefined()

    const rerun = svc.rerunTask(created.id)
    expect(rerun.status).toBe('completed')

    const stopped = svc.stopTask(svc.createTask({ sourceType: 'FTP' }).id)
    expect(stopped.status).toBe('completed')

    expect(() => svc.getTask('ghost')).toThrow(/不存在/)
  })

  it('filter: tasks 按 ruleId/status 过滤', () => {
    const svc = new AutoCollectionService()
    const failed = svc.listTasks({ status: 'failed' })
    expect(failed.length).toBeGreaterThan(0)
    expect(failed.every((t) => t.status === 'failed')).toBe(true)
    const byRule = svc.listTasks({ ruleId: 'ac-001' })
    expect(byRule.every((t) => t.ruleId === 'ac-001')).toBe(true)
  })

  it('config: seed + 更新; logs: 可列出; stats: 聚合正确', () => {
    const svc = new AutoCollectionService()
    const cfg = svc.updateConfig('poll_interval_sec', '60')
    expect(cfg.value).toBe('60')
    expect(svc.listConfig().find((c) => c.key === 'poll_interval_sec')!.value).toBe('60')

    const logs = svc.listLogs(10)
    expect(logs.length).toBeGreaterThan(0)
    expect(logs.every((l) => l.message)).toBe(true)

    const stats = svc.getStats()
    expect(stats.totalRules).toBeGreaterThan(0)
    expect(stats.activeRules).toBeGreaterThan(0)
    expect(stats.dailyExecutions).toHaveLength(7)
  })
})
