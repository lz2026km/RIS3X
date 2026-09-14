/**
 * G005 放射RIS系统 v3.0.6.11-104 Wave 3B - 对比剂安全闭环服务
 *
 * P0 临床安全闭环: 过敏试验 → 注射前核查 (同意书/过敏/eGFR/妊娠) → 增强注射 → 注射后留观 → 离院。
 *
 * 孤儿模块模式 (orphan module pattern):
 *   - 不强制依赖 DB: PrismaService 为可选注入 (@Optional), 记录以内存 overlay 存储,
 *     无 DB 时审计落库静默跳过, 模块可独立挂载启动。
 *   - seed 回退: 无任何真实记录时返回内置确定性示例, 保证前端不空窗; 同输入恒同输出。
 *
 * eGFR 阈值默认 30 mL/min/1.73m² (对比剂肾病高危阻断线), 可请求覆盖。
 * 留观默认 30 分钟, 未满时长需医生放行 (doctorRelease=true) 方可离院。
 */
import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'
import {
  DEFAULT_EGFR_THRESHOLD,
  DEFAULT_EXTRAVASATION_PAGE_SIZE,
  DEFAULT_OBSERVATION_MINUTES,
  SEED_INJECTION_TOTAL,
  type AllergyResult,
  type AllergyTestListResult,
  type AllergyTestRecord,
  type ExtravasationEvent,
  type ExtravasationListFilter,
  type ExtravasationListResult,
  type ExtravasationSeverity,
  type ExtravasationStats,
  type HandleExtravasationInput,
  type ObservationDto,
  type ObservationRecord,
  type PreInjectionCheckInput,
  type PreInjectionCheckItem,
  type PreInjectionCheckResult,
} from './contrast-safety.types'

interface ObservationDischargeInput {
  doctorRelease?: boolean
  dischargedBy?: string
  notes?: string
}

interface ObservationRecordInput {
  symptoms: string
  action?: string
  at?: string
  recordedBy?: string
  reactionId?: string
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

@Injectable()
export class ContrastSafetyService {
  private readonly logger = new Logger(ContrastSafetyService.name)

  private readonly allergyTests = new Map<string, AllergyTestRecord>()
  private readonly observations = new Map<string, ObservationRecord>()
  // [v3.0.6.11-105 Wave 1B] 对比剂外渗事件 (内存 overlay)
  private readonly extravasations = new Map<string, ExtravasationEvent>()
  private allergySeq = 0
  private observationSeq = 0
  private injectionSeq = 0
  private extravasationSeq = 0

  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!prisma) this.logger.log('ContrastSafetyService: no Prisma injected (orphan mode, memory overlay + seed fallback)')
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 过敏试验
  // ────────────────────────────────────────────────────────────────────────────

  /** POST /contrast/allergy-test — 记录对比剂过敏试验, 落内存 + 审计旁路 */
  async recordAllergyTest(input: {
    patientId: string
    contrastType: string
    result: AllergyResult
    testedAt?: string
    testedBy: string
    notes?: string
  }): Promise<AllergyTestRecord> {
    const now = new Date().toISOString()
    const record: AllergyTestRecord = {
      id: this.nextAllergyId(),
      patientId: input.patientId,
      contrastType: input.contrastType,
      result: input.result,
      testedAt: input.testedAt ?? now,
      testedBy: input.testedBy,
      notes: input.notes,
      createdAt: now,
    }
    this.allergyTests.set(record.id, record)
    await this.recordAudit('contrast-allergy-test', record.id, record)
    return record
  }

  /** GET /contrast/allergy-test/:patientId — 患者过敏试验历史 (按时间倒序) */
  listAllergyTests(patientId: string): AllergyTestListResult {
    const stored = [...this.allergyTests.values()]
      .filter((t) => t.patientId === patientId)
      .sort((a, b) => b.testedAt.localeCompare(a.testedAt))
    if (stored.length > 0) {
      return { items: stored, total: stored.length, source: 'memory', latest: stored[0]! }
    }
    const seeded = this.seedAllergyTests()
      .filter((t) => t.patientId === patientId)
      .sort((a, b) => b.testedAt.localeCompare(a.testedAt))
    if (seeded.length > 0) {
      return { items: seeded, total: seeded.length, source: 'seed', latest: seeded[0]! }
    }
    return { items: [], total: 0, source: 'memory', latest: null }
  }

  /** 最新过敏试验结果 (请求显式指定优先, 否则查内存 / seed) */
  latestAllergyResult(patientId: string, explicit?: AllergyResult): AllergyResult {
    if (explicit) return explicit
    const res = this.listAllergyTests(patientId)
    return res.latest?.result ?? 'unknown'
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 注射前核查 (同意书 / 过敏 / eGFR / 妊娠)
  // ────────────────────────────────────────────────────────────────────────────

  /** POST /contrast/pre-injection-check — 返回 { passed, blockers, checks } */
  preInjectionCheck(input: PreInjectionCheckInput): PreInjectionCheckResult {
    const threshold = input.threshold && input.threshold > 0 ? input.threshold : DEFAULT_EGFR_THRESHOLD
    const egfr = input.egfr
    const allergyResult = this.latestAllergyResult(input.patientId, input.allergyResult)
    const blockers: string[] = []
    const checks: PreInjectionCheckItem[] = []

    const consentPassed = input.consentSigned === true
    if (!consentPassed) blockers.push('NO_CONSENT')
    checks.push({ key: 'consent', passed: consentPassed, detail: consentPassed ? '知情同意书已签署' : '缺少知情同意书' })

    const allergyPassed = allergyResult !== 'positive'
    if (!allergyPassed) blockers.push('ALLERGY_POSITIVE')
    checks.push({
      key: 'allergy',
      passed: allergyPassed,
      detail:
        allergyResult === 'positive'
          ? '过敏试验阳性, 禁用对比剂'
          : allergyResult === 'unknown'
            ? '无过敏试验记录, 建议先行试验'
            : '过敏试验阴性',
    })

    const egfrPassed = egfr === undefined || egfr >= threshold
    if (!egfrPassed) blockers.push('EGFR_BELOW_THRESHOLD')
    checks.push({
      key: 'egfr',
      passed: egfrPassed,
      detail: egfr === undefined ? '未提供 eGFR, 无法评估肾功能' : `eGFR ${egfr} mL/min/1.73m² (阈值 ${threshold})`,
    })

    const pregnancyPassed = input.pregnant !== true
    if (!pregnancyPassed) blockers.push('PREGNANCY')
    checks.push({ key: 'pregnancy', passed: pregnancyPassed, detail: pregnancyPassed ? '非妊娠状态' : '妊娠期禁用碘对比剂' })

    return {
      passed: blockers.length === 0,
      blockers,
      checks,
      threshold,
      allergyResult,
      evaluatedAt: new Date().toISOString(),
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 增强注射 (前置核查门禁)
  // ────────────────────────────────────────────────────────────────────────────

  /** POST /contrast/injection — 前置核查通过才下发注射指令, 未通过 400 PRE_INJECTION_CHECK_FAILED */
  async runInjection(input: Record<string, unknown>) {
    const patientId = String(input['patientId'] ?? '')
    const check = this.preInjectionCheck({
      patientId,
      contrastType: input['contrastType'] as string | undefined,
      consentSigned: input['consentSigned'] as boolean | undefined,
      allergyResult: input['allergyResult'] as AllergyResult | undefined,
      egfr: (input['egfr'] as number | undefined) ?? (input['eGFR'] as number | undefined),
      pregnant: input['pregnant'] as boolean | undefined,
      threshold: input['threshold'] as number | undefined,
    })
    if (!check.passed) {
      throw new BadRequestException({
        ok: false,
        code: 'PRE_INJECTION_CHECK_FAILED',
        message: '注射前核查未通过, 禁止注射对比剂',
        blockers: check.blockers,
        checks: check.checks,
      })
    }

    this.injectionSeq += 1
    const detail = { ...input, preCheck: check }
    const audit = await this.recordAudit('injection-command', `inj-${this.injectionSeq}`, detail)
    return {
      id: audit?.id ?? `inj-${this.injectionSeq}`,
      action: 'SEND',
      resource: 'injection-command',
      passed: true,
      blockers: [] as string[],
      preCheck: check,
      detail: input,
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 注射后留观
  // ────────────────────────────────────────────────────────────────────────────

  /** POST /contrast/observation/start — 开始留观计时 (默认 30 分钟) */
  async startObservation(input: {
    patientId: string
    examId?: string
    contrastType?: string
    injectionId?: string
    durationMinutes?: number
    startedAt?: string
    operator?: string
  }): Promise<ObservationDto> {
    const now = new Date()
    const durationMinutes = input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : DEFAULT_OBSERVATION_MINUTES
    const startedAt = input.startedAt ? new Date(input.startedAt) : now
    const endsAt = new Date(startedAt.getTime() + durationMinutes * 60_000)
    this.observationSeq += 1
    const record: ObservationRecord = {
      id: `obs-${this.observationSeq}`,
      patientId: input.patientId,
      examId: input.examId,
      contrastType: input.contrastType,
      injectionId: input.injectionId,
      startedAt: startedAt.toISOString(),
      durationMinutes,
      endsAt: endsAt.toISOString(),
      status: 'observing',
      operator: input.operator,
      records: [],
      doctorRelease: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
    this.observations.set(record.id, record)
    await this.recordAudit('contrast-observation', record.id, { action: 'start', ...record })
    return this.toObservationDto(record)
  }

  /** GET /contrast/observation — 留观列表 (可按患者过滤) */
  listObservations(patientId?: string): { items: ObservationDto[]; total: number } {
    const items = [...this.observations.values()]
      .filter((o) => !patientId || o.patientId === patientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((o) => this.toObservationDto(o))
    return { items, total: items.length }
  }

  /** GET /contrast/observation/:id — 留观状态 (剩余时间 + 观察记录) */
  getObservation(id: string): ObservationDto {
    return this.toObservationDto(this.findObservation(id))
  }

  /** POST /contrast/observation/:id/record — 追加观察记录 */
  async addObservationRecord(id: string, input: ObservationRecordInput): Promise<ObservationDto> {
    const record = this.findObservation(id)
    if (record.status === 'discharged') {
      throw new BadRequestException({ ok: false, code: 'OBSERVATION_DISCHARGED', message: '留观已结束, 不可追加记录' })
    }
    record.records.push({
      at: input.at ?? new Date().toISOString(),
      symptoms: input.symptoms,
      action: input.action ?? '',
      recordedBy: input.recordedBy ?? record.operator ?? 'system',
      reactionId: input.reactionId,
    })
    record.updatedAt = new Date().toISOString()
    await this.recordAudit('contrast-observation', record.id, { action: 'record', entry: record.records[record.records.length - 1] })
    return this.toObservationDto(record)
  }

  /** POST /contrast/observation/:id/discharge — 离院确认 (需满时长或医生放行) */
  async dischargeObservation(id: string, input: ObservationDischargeInput): Promise<ObservationDto> {
    const record = this.findObservation(id)
    if (record.status === 'discharged') return this.toObservationDto(record)

    const now = Date.now()
    const elapsedSeconds = Math.max(0, Math.floor((now - new Date(record.startedAt).getTime()) / 1000))
    const requiredSeconds = record.durationMinutes * 60
    if (elapsedSeconds < requiredSeconds && input.doctorRelease !== true) {
      throw new BadRequestException({
        ok: false,
        code: 'OBSERVATION_DURATION_NOT_MET',
        message: '留观时长未满, 需医生放行方可离院',
        requiredSeconds,
        elapsedSeconds,
        remainingSeconds: requiredSeconds - elapsedSeconds,
      })
    }

    record.status = 'discharged'
    record.doctorRelease = input.doctorRelease === true
    record.dischargedAt = new Date(now).toISOString()
    record.dischargedBy = input.dischargedBy ?? record.operator ?? 'system'
    record.dischargeNotes = input.notes
    record.updatedAt = record.dischargedAt
    await this.recordAudit('contrast-observation', record.id, { action: 'discharge', ...record })
    return this.toObservationDto(record)
  }

  // ────────────────────────────────────────────────────────────────────────────
  // [v3.0.6.11-105 Wave 1B] 对比剂外渗事件 (extravasation)
  // ────────────────────────────────────────────────────────────────────────────

  /** POST /contrast/extravasation — 记录外渗事件, 落内存 + 审计旁路 */
  async recordExtravasation(input: {
    patientId: string
    examId?: string
    severity: ExtravasationSeverity
    site: string
    estimatedVolumeMl: number
    management: string
    recordedBy: string
    occurredAt?: string
  }): Promise<ExtravasationEvent> {
    const now = new Date().toISOString()
    this.extravasationSeq += 1
    const record: ExtravasationEvent = {
      id: `exv-${this.extravasationSeq}`,
      patientId: input.patientId,
      examId: input.examId,
      severity: input.severity,
      site: input.site,
      estimatedVolumeMl: input.estimatedVolumeMl,
      management: input.management,
      recordedBy: input.recordedBy,
      occurredAt: input.occurredAt ?? now,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    }
    this.extravasations.set(record.id, record)
    await this.recordAudit('contrast-extravasation', record.id, record)
    return record
  }

  /** GET /contrast/extravasation — 外渗事件列表 (患者/日期/严重度筛选, 分页; 空库 seed 回退) */
  listExtravasations(filter: ExtravasationListFilter = {}): ExtravasationListResult {
    const stored = [...this.extravasations.values()]
    const source: 'memory' | 'seed' = stored.length > 0 ? 'memory' : 'seed'
    const base = stored.length > 0 ? stored : this.seedExtravasations()
    const matched = base
      .filter((e) => !filter.patientId || e.patientId === filter.patientId)
      .filter((e) => !filter.severity || e.severity === filter.severity)
      .filter((e) => !filter.dateFrom || e.occurredAt >= filter.dateFrom)
      .filter((e) => !filter.dateTo || e.occurredAt <= filter.dateTo)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    const page = Math.max(1, filter.page ?? 1)
    const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? DEFAULT_EXTRAVASATION_PAGE_SIZE))
    const start = (page - 1) * pageSize
    return { items: matched.slice(start, start + pageSize), total: matched.length, page, pageSize, source }
  }

  /**
   * GET /contrast/extravasation/stats — 外渗统计。
   * 发生率 = 外渗例数 ÷ 同期增强 CT 总例数 ×1000‰ (分母: injection 累计 + 确定性 seed)。
   */
  extravasationStats(): ExtravasationStats {
    const stored = [...this.extravasations.values()]
    const source: 'memory' | 'seed' = stored.length > 0 ? 'memory' : 'seed'
    const base = stored.length > 0 ? stored : this.seedExtravasations()
    const severityOrder: ExtravasationSeverity[] = ['mild', 'moderate', 'severe']
    const bySeverity = severityOrder.map((severity) => ({ severity, count: base.filter((e) => e.severity === severity).length }))
    const siteMap = new Map<string, number>()
    for (const e of base) siteMap.set(e.site, (siteMap.get(e.site) ?? 0) + 1)
    const monthMap = new Map<string, number>()
    for (const e of base) {
      const month = e.occurredAt.slice(0, 7)
      monthMap.set(month, (monthMap.get(month) ?? 0) + 1)
    }
    const totalInjections = this.injectionTotal()
    return {
      total: base.length,
      totalInjections,
      incidenceRatePerThousand: totalInjections > 0 ? round1((base.length / totalInjections) * 1000) : 0,
      bySeverity,
      bySite: [...siteMap.entries()].map(([site, count]) => ({ site, count })).sort((a, b) => b.count - a.count),
      byMonth: [...monthMap.entries()].map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
      openCount: base.filter((e) => e.status === 'open').length,
      resolvedCount: base.filter((e) => e.status === 'resolved').length,
      source,
    }
  }

  /** POST /contrast/extravasation/:id/handle — 处置闭环 (处置措施/随访/状态 resolved) */
  async handleExtravasation(id: string, input: HandleExtravasationInput = {}): Promise<ExtravasationEvent> {
    const record = this.findExtravasation(id)
    const now = new Date().toISOString()
    if (input.management?.trim()) record.management = input.management.trim()
    if (input.followUp !== undefined) record.followUp = input.followUp
    if (input.note !== undefined) record.handleNote = input.note
    record.handledBy = input.handledBy?.trim() || record.handledBy || 'system'
    record.handledAt = now
    record.status = 'resolved'
    record.updatedAt = now
    this.extravasations.set(record.id, record)
    await this.recordAudit('contrast-extravasation', record.id, { action: 'handle', ...record })
    return record
  }

  /** 同期增强 CT 总例数 (injection 累计 + 确定性 seed 基数) */
  injectionTotal(): number {
    return this.injectionSeq + SEED_INJECTION_TOTAL
  }

  private findExtravasation(id: string): ExtravasationEvent {
    const found = this.extravasations.get(id)
    if (found) return found
    const seeded = this.seedExtravasations().find((e) => e.id === id)
    if (seeded) {
      this.extravasations.set(seeded.id, seeded)
      return seeded
    }
    throw new NotFoundException({ ok: false, code: 'EXTRAVASATION_NOT_FOUND', message: `外渗事件 ${id} 不存在` })
  }

  /** 确定性 seed: 外渗示例 (无真实数据回退) */
  private seedExtravasations(): ExtravasationEvent[] {
    return [
      {
        id: 'exv-seed-1',
        patientId: 'P-DEMO-001',
        examId: 'E-DEMO-001',
        severity: 'mild',
        site: '左上肢前臂',
        estimatedVolumeMl: 15,
        management: '停止注射, 抬高患肢, 冷敷',
        recordedBy: '张技师',
        occurredAt: '2026-07-12T09:20:00.000Z',
        status: 'resolved',
        handledBy: '李医生',
        handledAt: '2026-07-12T09:50:00.000Z',
        followUp: '24h 随访肿胀消退, 无张力性水疱',
        createdAt: '2026-07-12T09:20:00.000Z',
        updatedAt: '2026-07-12T09:50:00.000Z',
      },
      {
        id: 'exv-seed-2',
        patientId: 'P-DEMO-002',
        examId: 'E-DEMO-002',
        severity: 'moderate',
        site: '右前臂',
        estimatedVolumeMl: 35,
        management: '停止注射, 硫酸镁湿敷, 抬高患肢',
        recordedBy: '李护士',
        occurredAt: '2026-08-03T14:05:00.000Z',
        status: 'resolved',
        handledBy: '王医生',
        handledAt: '2026-08-03T15:10:00.000Z',
        followUp: '48h 随访局部肿胀减轻',
        createdAt: '2026-08-03T14:05:00.000Z',
        updatedAt: '2026-08-03T15:10:00.000Z',
      },
      {
        id: 'exv-seed-3',
        patientId: 'P-DEMO-003',
        examId: 'E-DEMO-003',
        severity: 'severe',
        site: '右手背',
        estimatedVolumeMl: 80,
        management: '停止注射, 急诊外科会诊, 评估筋膜切开指征',
        recordedBy: '张技师',
        occurredAt: '2026-09-02T11:30:00.000Z',
        status: 'open',
        createdAt: '2026-09-02T11:30:00.000Z',
        updatedAt: '2026-09-02T11:30:00.000Z',
      },
    ]
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 内部工具
  // ────────────────────────────────────────────────────────────────────────────

  private nextAllergyId(): string {
    this.allergySeq += 1
    return `at-${this.allergySeq}`
  }

  private findObservation(id: string): ObservationRecord {
    const found = this.observations.get(id)
    if (found) return found
    const seeded = this.seedObservations().find((o) => o.id === id)
    if (seeded) {
      this.observations.set(seeded.id, seeded)
      return seeded
    }
    throw new NotFoundException({ ok: false, code: 'OBSERVATION_NOT_FOUND', message: `留观记录 ${id} 不存在` })
  }

  private toObservationDto(o: ObservationRecord): ObservationDto {
    const now = Date.now()
    const started = new Date(o.startedAt).getTime()
    const ends = new Date(o.endsAt).getTime()
    const elapsedSeconds = Math.max(0, Math.floor((now - started) / 1000))
    const remainingSeconds = o.status === 'discharged' ? 0 : Math.max(0, Math.ceil((ends - now) / 1000))
    const elapsedMinutes = round1(elapsedSeconds / 60)
    const progressPercent = o.durationMinutes > 0 ? Math.min(100, round1(((elapsedSeconds / 60) / o.durationMinutes) * 100)) : 100
    const canDischarge = o.status === 'discharged' || elapsedSeconds >= o.durationMinutes * 60
    return {
      ...o,
      records: o.records.map((r) => ({ ...r })),
      elapsedSeconds,
      elapsedMinutes,
      remainingSeconds,
      progressPercent,
      canDischarge,
    }
  }

  /** auditLog 旁路 (DB 不可用时静默跳过), 保留对比剂过敏休克全链路追溯 */
  private async recordAudit(resource: string, resourceId: string, detail: unknown): Promise<{ id: string } | null> {
    try {
      if (!this.prisma?.auditLog?.create) return null
      const row = await this.prisma.auditLog.create({
        data: { action: 'RECORD', resource, resourceId, detail: detail as never, tenantId: currentTenantId() },
      })
      return { id: row.id }
    } catch (err) {
      this.logger.debug(`[ContrastSafety] audit skipped (${resource}): ${(err as Error).message}`)
      return null
    }
  }

  /** 确定性 seed: 过敏试验示例 (无真实数据回退) */
  private seedAllergyTests(): AllergyTestRecord[] {
    return [
      {
        id: 'at-seed-1',
        patientId: 'P-DEMO-001',
        contrastType: '碘海醇',
        result: 'negative',
        testedAt: '2026-08-10T08:30:00.000Z',
        testedBy: '张技师',
        notes: '常规过敏试验阴性',
        createdAt: '2026-08-10T08:30:00.000Z',
      },
      {
        id: 'at-seed-2',
        patientId: 'P-DEMO-002',
        contrastType: '碘克沙醇',
        result: 'positive',
        testedAt: '2026-08-09T09:10:00.000Z',
        testedBy: '李护士',
        notes: '既往碘对比剂过敏史, 试验阳性',
        createdAt: '2026-08-09T09:10:00.000Z',
      },
    ]
  }

  /** 确定性 seed: 留观示例 (无真实数据回退) */
  private seedObservations(): ObservationRecord[] {
    const started = new Date(Date.now() - 10 * 60_000)
    const ends = new Date(started.getTime() + DEFAULT_OBSERVATION_MINUTES * 60_000)
    return [
      {
        id: 'obs-demo-1',
        patientId: 'P-DEMO-001',
        examId: 'E-DEMO-001',
        contrastType: '碘海醇',
        startedAt: started.toISOString(),
        durationMinutes: DEFAULT_OBSERVATION_MINUTES,
        endsAt: ends.toISOString(),
        status: 'observing',
        operator: '张技师',
        records: [{ at: new Date(started.getTime() + 5 * 60_000).toISOString(), symptoms: '无不适', action: '继续观察', recordedBy: '张技师' }],
        doctorRelease: false,
        createdAt: started.toISOString(),
        updatedAt: started.toISOString(),
      },
    ]
  }
}
