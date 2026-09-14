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
  DEFAULT_OBSERVATION_MINUTES,
  type AllergyResult,
  type AllergyTestListResult,
  type AllergyTestRecord,
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
  private allergySeq = 0
  private observationSeq = 0
  private injectionSeq = 0

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
