// [G005 W13-Security] 灾难恢复 spec: 备份集/恢复点/RPO-RTO/演练/切换
import { DisasterRecoveryService } from './disaster-recovery.service'

describe('[W13] DisasterRecoveryService', () => {
  let dr: DisasterRecoveryService
  beforeEach(() => {
    dr = new DisasterRecoveryService()
  })

  it('状态: 配置/备份/恢复点/RPO/RTO 结构完整', () => {
    const s = dr.status()
    expect(s.config.rpoMinutes).toBe(15)
    expect(s.config.rtoMinutes).toBe(30)
    expect(s.backup.full).toBeGreaterThanOrEqual(1)
    expect(s.backup.incremental).toBeGreaterThanOrEqual(3)
    expect(s.restorePoints.total).toBeGreaterThanOrEqual(4)
    expect(s.rpo.targetMinutes).toBe(15)
    expect(typeof s.rpo.compliant).toBe('boolean')
  })

  it('创建备份集 + 增量默认引用全量 + 生成恢复点', () => {
    const before = dr.listRestorePoints().length
    const inc = dr.createBackupSet({ type: 'incremental' })
    expect(inc.type).toBe('incremental')
    expect(inc.baseSetId).toBeTruthy()
    expect(dr.listRestorePoints().length).toBe(before + 1)
  })

  it('恢复: 校验和一致 → restored=true', () => {
    const rp = dr.listRestorePoints()[0]!
    const res = dr.restore(rp.id)
    expect(res.checksumOk).toBe(true)
    expect(res.restored).toBe(true)
  })

  it('演练: 分步日志 + 结果 + RTO/RPO 计算', () => {
    const record = dr.runDrill({ scenario: 'site-failover', executedBy: 'tester' })
    expect(record.steps.length).toBeGreaterThanOrEqual(6)
    expect(['pass', 'warn', 'fail']).toContain(record.result)
    expect(record.rtoActualMin).toBeGreaterThan(0)
    expect(dr.listDrills()[0]!.id).toBe(record.id)
    expect(dr.getDrill(record.id).steps).toHaveLength(record.steps.length)
  })

  it('故障切换 dry-run: 成功且标注未真实切换', () => {
    const fo = dr.failover({ mode: 'dry-run' })
    expect(fo.success).toBe(true)
    expect(fo.mode).toBe('dry-run')
    expect(fo.steps.some((s) => s.status === 'warn')).toBe(true)
  })

  it('RPO/RTO 配置更新校验', () => {
    const updated = dr.updateConfig({ rpoMinutes: 10, rtoMinutes: 20 })
    expect(updated.rpoMinutes).toBe(10)
    expect(() => dr.updateConfig({ rpoMinutes: 0 })).toThrow()
    expect(() => dr.updateConfig({ rtoMinutes: 9999 })).toThrow()
  })
})
