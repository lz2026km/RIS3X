// [G005 W13-Security] 灾难恢复 (DR) 服务: 备份集 (全量/增量) + 恢复点 + RPO/RTO 配置
//   + 演练 (模拟故障切换, 分步日志 + 结果) + 故障切换。
// DB-less-safe: 备份集/恢复点/演练记录在内存中维护; 可读取真实 BackupRecord (void)。
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { createHash } from 'node:crypto'

export type BackupSetType = 'full' | 'incremental'
export type BackupSetStatus = 'completed' | 'running' | 'failed'
export type DrillResult = 'pass' | 'warn' | 'fail'

export interface BackupSet {
  id: string
  type: BackupSetType
  status: BackupSetStatus
  sizeBytes: number
  checksum: string
  baseSetId?: string
  createdAt: string
  durationSec: number
  location: string
}

export interface RestorePoint {
  id: string
  backupSetId: string
  createdAt: string
  label: string
  rpoCompliant: boolean
  ageMinutes: number
}

export interface DrConfig {
  rpoMinutes: number
  rtoMinutes: number
  schedule: string
  retentionDays: number
  targetSite: string
  offsiteEnabled: boolean
  autoFailover: boolean
  updatedAt: string
}

export interface DrillStep {
  name: string
  status: 'ok' | 'warn' | 'fail'
  durationSec: number
  detail: string
}

export interface DrillRecord {
  id: string
  startedAt: string
  finishedAt: string
  durationSec: number
  scenario: 'site-failover' | 'db-restore' | 'ransomware-recovery'
  rtoTargetMin: number
  rtoActualMin: number
  rpoTargetMin: number
  rpoActualMin: number
  result: DrillResult
  steps: DrillStep[]
  executedBy?: string
}

const h = (s: string) => createHash('sha256').update(s).digest('hex')
const iso = (offsetMin: number) => new Date(Date.now() + offsetMin * 60_000).toISOString()

@Injectable()
export class DisasterRecoveryService {
  private readonly logger = new Logger(DisasterRecoveryService.name)
  private readonly backupSets: BackupSet[] = []
  private readonly restorePoints: RestorePoint[] = []
  private readonly drills: DrillRecord[] = []
  private seq = 0
  private drillSeq = 0
  private config: DrConfig

  constructor() {
    this.config = {
      rpoMinutes: 15,
      rtoMinutes: 30,
      schedule: '每日 02:00 全量 + 每 4 小时增量',
      retentionDays: 30,
      targetSite: '同城灾备中心 (DCC-02)',
      offsiteEnabled: true,
      autoFailover: false,
      updatedAt: new Date().toISOString(),
    }
    // 种子备份集 (确定性): 1 全量 + 3 增量
    const full = this.createBackupSet({ type: 'full', sizeBytes: 18_420_000, createdAt: iso(-1440) })
    this.createBackupSet({ type: 'incremental', baseSetId: full.id, sizeBytes: 1_820_000, createdAt: iso(-240) })
    this.createBackupSet({ type: 'incremental', baseSetId: full.id, sizeBytes: 2_110_000, createdAt: iso(-120) })
    this.createBackupSet({ type: 'incremental', baseSetId: full.id, sizeBytes: 1_640_000, createdAt: iso(-15) })
    // 种子演练记录
    this.drills.unshift({
      id: 'drill-0001',
      startedAt: iso(-10080),
      finishedAt: iso(-10075),
      durationSec: 300,
      scenario: 'site-failover',
      rtoTargetMin: this.config.rtoMinutes,
      rtoActualMin: 28,
      rpoTargetMin: this.config.rpoMinutes,
      rpoActualMin: 12,
      result: 'pass',
      steps: [
        { name: '备份完整性校验', status: 'ok', durationSec: 45, detail: '校验和一致' },
        { name: '切换到灾备站点', status: 'ok', durationSec: 120, detail: 'DCC-02 服务已就绪' },
        { name: '业务连通性验证', status: 'ok', durationSec: 90, detail: 'DICOM/RIS 接口正常' },
        { name: '回切主站', status: 'ok', durationSec: 45, detail: '主站恢复' },
      ],
      executedBy: 'DR-Auto',
    })
  }

  // ── 配置 ──
  getConfig(): DrConfig {
    return { ...this.config }
  }

  updateConfig(input: Partial<DrConfig>): DrConfig {
    if (input.rpoMinutes !== undefined && (input.rpoMinutes < 1 || input.rpoMinutes > 1440)) {
      throw new BadRequestException('rpoMinutes 必须在 1-1440 之间')
    }
    if (input.rtoMinutes !== undefined && (input.rtoMinutes < 1 || input.rtoMinutes > 1440)) {
      throw new BadRequestException('rtoMinutes 必须在 1-1440 之间')
    }
    this.config = { ...this.config, ...input, updatedAt: new Date().toISOString() }
    return { ...this.config }
  }

  // ── 备份集 ──
  createBackupSet(input: { type: BackupSetType; sizeBytes?: number; baseSetId?: string; createdAt?: string; location?: string; status?: BackupSetStatus }): BackupSet {
    const type: BackupSetType = input.type
    if (type !== 'full' && type !== 'incremental') throw new BadRequestException('type 必须为 full 或 incremental')
    if (type === 'incremental' && !input.baseSetId && this.backupSets.length > 0) {
      input.baseSetId = this.backupSets.find((b) => b.type === 'full')?.id
    }
    const id = `bs-${(++this.seq).toString().padStart(4, '0')}`
    const createdAt = input.createdAt ?? new Date().toISOString()
    const sizeBytes = input.sizeBytes ?? 1_500_000 + (this.seq % 7) * 90_000
    const set: BackupSet = {
      id,
      type,
      status: input.status ?? 'completed',
      sizeBytes,
      checksum: h(`${id}:${type}:${sizeBytes}:${createdAt}`),
      baseSetId: type === 'incremental' ? input.baseSetId : undefined,
      createdAt,
      durationSec: type === 'full' ? 300 : 45,
      location: input.location ?? (this.config.offsiteEnabled && type === 'full' ? 'DCC-02 异地' : '主站本地'),
    }
    this.backupSets.unshift(set)
    if (set.status === 'completed') {
      const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60_000))
      this.restorePoints.unshift({
        id: `rp-${id}`,
        backupSetId: id,
        createdAt,
        label: `${type === 'full' ? '全量' : '增量'}恢复点 ${createdAt.slice(0, 16).replace('T', ' ')}`,
        rpoCompliant: ageMinutes <= this.config.rpoMinutes,
        ageMinutes,
      })
    }
    return { ...set }
  }

  listBackupSets(filter?: { type?: BackupSetType }): BackupSet[] {
    return this.backupSets.filter((b) => !filter?.type || b.type === filter.type).map((b) => ({ ...b }))
  }

  listRestorePoints(): RestorePoint[] {
    return this.restorePoints.map((r) => ({ ...r }))
  }

  getBackupSet(id: string): BackupSet {
    const b = this.backupSets.find((x) => x.id === id)
    if (!b) throw new NotFoundException(`备份集 ${id} 不存在`)
    return { ...b }
  }

  /** 恢复 (模拟): 校验校验和 + 返回恢复结果 */
  restore(restorePointId: string): { restored: boolean; restorePointId: string; backupSetId: string; checksumOk: boolean; durationSec: number; verifiedAt: string } {
    const rp = this.restorePoints.find((r) => r.id === restorePointId)
    if (!rp) throw new NotFoundException(`恢复点 ${restorePointId} 不存在`)
    const set = this.getBackupSet(rp.backupSetId)
    const checksumOk = set.checksum === h(`${set.id}:${set.type}:${set.sizeBytes}:${set.createdAt}`)
    return {
      restored: checksumOk,
      restorePointId,
      backupSetId: set.id,
      checksumOk,
      durationSec: set.type === 'full' ? 240 : 30,
      verifiedAt: new Date().toISOString(),
    }
  }

  // ── 演练 ──
  /** 执行灾难恢复演练 (确定性模拟故障切换, 分步日志 + 结果) */
  runDrill(input: { scenario?: DrillRecord['scenario']; executedBy?: string; rtoTargetMin?: number; rpoTargetMin?: number } = {}): DrillRecord {
    const scenario = input.scenario ?? 'site-failover'
    const rtoTargetMin = input.rtoTargetMin ?? this.config.rtoMinutes
    const rpoTargetMin = input.rpoTargetMin ?? this.config.rpoMinutes
    const latest = this.backupSets[0]
    const latestAgeMin = latest ? Math.max(0, Math.round((Date.now() - new Date(latest.createdAt).getTime()) / 60_000)) : 9999
    const failNext = latest?.status === 'failed'
    const steps: DrillStep[] = [
      { name: '备份完整性校验', status: latest ? (latest.type === 'full' ? 'ok' : 'warn') : 'fail', durationSec: 40, detail: latest ? `最新备份集 ${latest.id} (${latest.type}) 校验和 ${latest.checksum.slice(0, 12)}…` : '无可用备份集' },
      { name: '恢复点就绪检查', status: latestAgeMin <= rpoTargetMin ? 'ok' : 'warn', durationSec: 25, detail: `最新恢复点 ${latestAgeMin} 分钟前 (RPO 目标 ${rpoTargetMin} 分钟)` },
      { name: '模拟站点故障注入', status: 'ok', durationSec: 20, detail: `注入场景: ${scenario}` },
      { name: '自动切换到灾备站点', status: failNext ? 'fail' : 'ok', durationSec: 150, detail: `${this.config.targetSite} 切换${failNext ? '失败' : '完成'}` },
      { name: '业务连通性验证', status: failNext ? 'fail' : 'ok', durationSec: 80, detail: failNext ? '接口探测超时' : 'DICOM/RIS/HIS 接口正常' },
      { name: '数据一致性校验', status: latestAgeMin <= rpoTargetMin ? 'ok' : 'warn', durationSec: 35, detail: `数据年龄 ${latestAgeMin} 分钟` },
      { name: '回切主站', status: failNext ? 'warn' : 'ok', durationSec: 60, detail: failNext ? '演练失败后回切受限' : '主站服务恢复' },
    ]
    const rtoActualMin = Math.round(steps.reduce((a, s) => a + s.durationSec, 0) / 60)
    const rpoActualMin = latestAgeMin
    const hasFail = steps.some((s) => s.status === 'fail')
    const hasWarn = steps.some((s) => s.status === 'warn')
    const result: DrillResult = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass'
    const record: DrillRecord = {
      id: `drill-${(++this.drillSeq + 1).toString().padStart(4, '0')}`,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationSec: steps.reduce((a, s) => a + s.durationSec, 0),
      scenario,
      rtoTargetMin,
      rtoActualMin,
      rpoTargetMin,
      rpoActualMin,
      result,
      steps,
      executedBy: input.executedBy ?? 'DR-Operator',
    }
    this.drills.unshift(record)
    this.logger.log(`DR drill ${record.id} (${scenario}) result=${result} rto=${rtoActualMin}/${rtoTargetMin} rpo=${rpoActualMin}/${rpoTargetMin}`)
    return { ...record, steps: record.steps.map((s) => ({ ...s })) }
  }

  listDrills(): DrillRecord[] {
    return this.drills.map((d) => ({ ...d, steps: d.steps.map((s) => ({ ...s })) }))
  }

  getDrill(id: string): DrillRecord {
    const d = this.drills.find((x) => x.id === id)
    if (!d) throw new NotFoundException(`演练记录 ${id} 不存在`)
    return { ...d, steps: d.steps.map((s) => ({ ...s })) }
  }

  /** 故障切换 (dry-run / live) */
  failover(input: { targetSite?: string; mode?: 'dry-run' | 'live' } = {}): {
    id: string
    mode: 'dry-run' | 'live'
    targetSite: string
    startedAt: string
    finishedAt: string
    durationSec: number
    success: boolean
    steps: DrillStep[]
  } {
    const mode = input.mode ?? 'dry-run'
    const targetSite = input.targetSite ?? this.config.targetSite
    const steps: DrillStep[] = [
      { name: '主站健康检查', status: 'ok', durationSec: 10, detail: '主站无响应 (模拟故障)' },
      { name: '提升灾备站点为主', status: 'ok', durationSec: 120, detail: `${targetSite} 已激活` },
      { name: mode === 'live' ? 'DNS/负载切换' : 'DNS/负载切换 (演练)', status: mode === 'live' ? 'ok' : 'warn', durationSec: 60, detail: mode === 'live' ? '流量已切换' : '仅模拟, 未真实切换' },
      { name: '事务一致性确认', status: 'ok', durationSec: 30, detail: '关键表校验通过' },
    ]
    return {
      id: `fo-${Date.now().toString(36)}`,
      mode,
      targetSite,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationSec: steps.reduce((a, s) => a + s.durationSec, 0),
      success: steps.every((s) => s.status !== 'fail'),
      steps,
    }
  }

  /** DR 状态仪表板 */
  status(): {
    config: DrConfig
    backup: { total: number; full: number; incremental: number; lastBackupAt: string | null; lastBackupAgeMinutes: number | null; totalSizeBytes: number; offsite: boolean }
    restorePoints: { total: number; compliant: number; latest: RestorePoint | null }
    drills: { total: number; lastResult: DrillResult | null; lastAt: string | null; passRate: number }
    rpo: { targetMinutes: number; actualMinutes: number | null; compliant: boolean }
    rto: { targetMinutes: number; lastActualMinutes: number | null; compliant: boolean }
  } {
    const full = this.backupSets.filter((b) => b.type === 'full').length
    const incremental = this.backupSets.filter((b) => b.type === 'incremental').length
    const lastBackupAt = this.backupSets[0]?.createdAt ?? null
    const lastBackupAgeMinutes = lastBackupAt ? Math.max(0, Math.round((Date.now() - new Date(lastBackupAt).getTime()) / 60_000)) : null
    const lastDrill = this.drills[0] ?? null
    const passCount = this.drills.filter((d) => d.result === 'pass').length
    const latestRp = this.restorePoints[0] ?? null
    return {
      config: this.getConfig(),
      backup: {
        total: this.backupSets.length,
        full,
        incremental,
        lastBackupAt,
        lastBackupAgeMinutes,
        totalSizeBytes: this.backupSets.reduce((a, b) => a + b.sizeBytes, 0),
        offsite: this.config.offsiteEnabled,
      },
      restorePoints: {
        total: this.restorePoints.length,
        compliant: this.restorePoints.filter((r) => r.rpoCompliant).length,
        latest: latestRp ? { ...latestRp } : null,
      },
      drills: {
        total: this.drills.length,
        lastResult: lastDrill?.result ?? null,
        lastAt: lastDrill?.finishedAt ?? null,
        passRate: this.drills.length > 0 ? Math.round((passCount / this.drills.length) * 100) : 0,
      },
      rpo: {
        targetMinutes: this.config.rpoMinutes,
        actualMinutes: lastBackupAgeMinutes,
        compliant: lastBackupAgeMinutes !== null && lastBackupAgeMinutes <= this.config.rpoMinutes,
      },
      rto: {
        targetMinutes: this.config.rtoMinutes,
        lastActualMinutes: lastDrill?.rtoActualMin ?? null,
        compliant: lastDrill ? lastDrill.rtoActualMin <= this.config.rtoMinutes : false,
      },
    }
  }
}
