/**
 * G005 放射RIS系统 v3.0.6.13 - CDS Hooks (最小实现)
 * 规范: https://cds-hooks.hl7.org/
 *   GET  /cds-services                    发现 (discovery)
 *   POST /cds-services/:serviceId         调用 (order-select / order-sign)
 *   POST /cds-services/feedback           反馈
 *   GET  /cds-services/feedback           反馈列表
 *
 * 卡片刻 (contrast / eGFR 适用性) 确定性生成, 无外部依赖。
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'

export type CdsHookName = 'order-select' | 'order-sign'

export interface CdsServiceDescriptor {
  hook: CdsHookName
  id: string
  title: string
  description: string
  prefetch?: Record<string, string>
}

export interface CdsCardSuggestion {
  label: string
  uuid?: string
  actions?: Array<{ type: 'create' | 'update' | 'delete'; description: string; resource?: unknown }>
}

export interface CdsCard {
  uuid: string
  summary: string
  indicator: 'info' | 'warning' | 'critical'
  detail: string
  source: { label: string; url?: string }
  overrideReasons?: Array<{ code: string; display: string }>
  suggestions?: CdsCardSuggestion[]
  selectionBehavior?: 'at-most-one' | 'any'
  links?: Array<{ label: string; url: string; type: 'absolute' | 'smart' }>
}

export interface CdsRequestContext {
  patientId?: string
  userId?: string
  encounterId?: string
  modality?: string
  examType?: string
  egfr?: number
  age?: number
  gender?: string
  allergies?: string[]
  pregnancy?: boolean
  draftOrders?: unknown[]
  orders?: unknown[]
  [key: string]: unknown
}

export interface CdsHookRequest {
  hook?: CdsHookName
  hookInstance?: string
  context?: CdsRequestContext
  prefetch?: Record<string, unknown>
}

export interface CdsHookResponse {
  cards: CdsCard[]
  systemActions?: unknown[]
}

export interface CdsFeedbackRecord {
  id: string
  serviceId: string
  hook?: CdsHookName
  cardUuid?: string
  outcome: string
  overrideReason?: { code?: string; display?: string } | string
  createdAt: string
}

export const CDS_SERVICES: CdsServiceDescriptor[] = [
  {
    hook: 'order-select',
    id: 'contrast-appropriateness',
    title: '造影剂适用性审查',
    description: '在开具增强检查时评估肾功能 (eGFR) / 儿童剂量 / 过敏史, 返回适用性卡片。',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
      observations: 'Observation?patient={{context.patientId}}&code=egfr',
    },
  },
  {
    hook: 'order-sign',
    id: 'contrast-sign-check',
    title: '报告/医嘱签署前造影剂核查',
    description: '签署前再次核查 eGFR / 过敏 / 妊娠, 避免高风险对比剂使用。',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
      allergyIntolerances: 'AllergyIntolerance?patient={{context.patientId}}',
    },
  },
]

const ISO = (): string => new Date().toISOString()

@Injectable()
export class CdsHooksService {
  private readonly logger = new Logger(CdsHooksService.name)
  private readonly feedback: CdsFeedbackRecord[] = []

  discovery(): { services: CdsServiceDescriptor[] } {
    return { services: CDS_SERVICES.map((s) => ({ ...s })) }
  }

  invoke(serviceId: string, request: CdsHookRequest): CdsHookResponse {
    const service = CDS_SERVICES.find((s) => s.id === serviceId)
    if (!service) throw new NotFoundException(`CDS service ${serviceId} not found`)
    const cards = this.buildCards(service, request)
    this.logger.log(`CDS Hooks ${service.hook}/${serviceId} → ${cards.length} card(s)`)
    return { cards }
  }

  private isContrast(req: CdsHookRequest): boolean {
    const ctx = req.context ?? {}
    const orderText = JSON.stringify(ctx.draftOrders ?? ctx.orders ?? []).toLowerCase()
    const exam = `${ctx.examType ?? ''} ${ctx.modality ?? ''}`.toLowerCase()
    return (
      /contrast|增强|造影|ce-|c\+/.test(orderText) ||
      /增强|造影/.test(exam) ||
      orderText.includes('with contrast') ||
      ['cta', 'mra', 'dsa'].includes(exam.trim())
    )
  }

  private eGfrOf(req: CdsHookRequest): number | undefined {
    const ctx = req.context ?? {}
    if (typeof ctx.egfr === 'number') return ctx.egfr
    const observations = (req.prefetch?.observations ?? []) as unknown
    if (Array.isArray(observations)) {
      for (const obs of observations as any[]) {
        const v = obs?.valueQuantity?.value ?? obs?.value
        if (typeof v === 'number') return v
      }
    }
    return undefined
  }

  private buildCards(service: CdsServiceDescriptor, req: CdsHookRequest): CdsCard[] {
    const cards: CdsCard[] = []
    const ctx = req.context ?? {}

    if (this.isContrast(req)) {
      const egfr = this.eGfrOf(req)
      if (egfr !== undefined && egfr < 30) {
        cards.push({
          uuid: randomUUID(),
          summary: '⚠ eGFR 显著降低 — 慎用碘对比剂',
          indicator: 'critical',
          detail: `患者 eGFR=${egfr} mL/min/1.73m² (<30)。依据 ACR Manual on Contrast Media, 此类患者造影剂肾病 (CIN) 风险显著升高, 建议改用非增强检查或充分评估收益/风险并做好水化。`,
          source: { label: 'ACR Manual on Contrast Media', url: 'https://www.acr.org/Clinical-Resources/Contrast-Manual' },
          overrideReasons: [
            { code: 'benefit-outweighs-risk', display: '临床收益大于风险' },
            { code: 'already-dialyzed', display: '患者已行透析' },
            { code: 'alternate-imaging-unavailable', display: '无替代影像方案' },
          ],
          suggestions: [
            {
              label: '改用非增强检查 (如平扫 / 超声 / 非增强 MR)',
              actions: [{ type: 'update', description: 'Switch to non-contrast protocol' }],
            },
            {
              label: '开具血清肌酐/eGFR 复查',
              actions: [{ type: 'create', description: 'Order serum creatinine / eGFR', resource: { resourceType: 'ServiceRequest', code: { text: 'eGFR' } } }],
            },
            {
              label: '检查前水化 + 最小化对比剂剂量',
              actions: [{ type: 'create', description: 'Pre-hydration protocol' }],
            },
          ],
          selectionBehavior: 'at-most-one',
        })
      } else if (egfr !== undefined && egfr < 45) {
        cards.push({
          uuid: randomUUID(),
          summary: 'eGFR 轻中度降低 — 建议对比剂减量并水化',
          indicator: 'warning',
          detail: `患者 eGFR=${egfr} mL/min/1.73m² (<45)。建议使用低渗/等渗对比剂、最小化剂量, 检查前后充分水化并复查肾功能。`,
          source: { label: 'ACR Manual on Contrast Media' },
          overrideReasons: [{ code: 'clinically-indicated', display: '临床确需增强检查' }],
          suggestions: [
            { label: '使用低渗对比剂并控制剂量', actions: [{ type: 'update', description: 'Use low-osmolar contrast at minimum dose' }] },
          ],
        })
      } else {
        cards.push({
          uuid: randomUUID(),
          summary: '增强检查适用性通过',
          indicator: 'info',
          detail: egfr !== undefined
            ? `患者 eGFR=${egfr} mL/min/1.73m², 无明确禁忌。请确认无碘对比剂过敏史并完成注射前核查。`
            : '未提供 eGFR。建议在注射前核查肾功能与过敏史 (参见造影剂安全闭环)。',
          source: { label: 'G005 造影剂安全闭环' },
          suggestions: [
            { label: '完成注射前核查 (Time-Out)', actions: [{ type: 'create', description: 'Run pre-injection safety checklist' }] },
          ],
        })
      }

      if (typeof ctx.age === 'number' && ctx.age < 18) {
        cards.push({
          uuid: randomUUID(),
          summary: '儿童增强检查 — 使用儿童剂量协议',
          indicator: 'warning',
          detail: `患者 ${ctx.age} 岁。建议按体重调整对比剂剂量, 采用儿童低剂量扫描协议 (Image Gently)。`,
          source: { label: 'Image Gently Campaign' },
          suggestions: [{ label: '启用儿童低剂量 + 体重调整剂量', actions: [{ type: 'update', description: 'Apply pediatric protocol' }] }],
        })
      }

      const allergies = (ctx.allergies ?? []).map((a) => String(a).toLowerCase())
      if (allergies.some((a) => /碘|iodine|contrast|对比剂/.test(a))) {
        cards.push({
          uuid: randomUUID(),
          summary: '对比剂过敏史 — 需预处理或替代方案',
          indicator: 'critical',
          detail: `记录到对比剂过敏: ${ctx.allergies!.join(', ')}。建议改用替代影像或按指南进行糖皮质激素/抗组胺预处理。`,
          source: { label: 'ACR Manual on Contrast Media' },
          overrideReasons: [{ code: 'premedicated', display: '已完成过敏预处理' }],
        })
      }
    }

    if (service.hook === 'order-sign' && ctx.pregnancy === true && this.isContrast(req)) {
      cards.push({
        uuid: randomUUID(),
        summary: '妊娠期 — 谨慎使用碘对比剂',
        indicator: 'warning',
        detail: '患者处于妊娠期。碘对比剂可透过胎盘, 需权衡胎儿风险, 优先考虑超声/MRI (钆对比剂亦需评估)。',
        source: { label: 'ACR Committee on Drugs and Contrast Media' },
      })
    }

    return cards
  }

  recordFeedback(input: { serviceId: string; hook?: CdsHookName; cardUuid?: string; outcome: string; overrideReason?: CdsFeedbackRecord['overrideReason'] }): CdsFeedbackRecord {
    const record: CdsFeedbackRecord = {
      id: `CDSFB-${randomUUID().slice(0, 8)}`,
      serviceId: input.serviceId,
      hook: input.hook,
      cardUuid: input.cardUuid,
      outcome: input.outcome,
      overrideReason: input.overrideReason,
      createdAt: ISO(),
    }
    this.feedback.unshift(record)
    if (this.feedback.length > 2000) this.feedback.pop()
    return record
  }

  listFeedback(): { total: number; entries: CdsFeedbackRecord[] } {
    return { total: this.feedback.length, entries: [...this.feedback] }
  }

  resetForTest(): void {
    this.feedback.length = 0
  }
}
