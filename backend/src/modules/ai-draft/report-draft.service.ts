import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { getCurrentTenantId } from '../../common/interceptors/tenant-context.interceptor'
import {
  buildReportDraft,
  parseDraftText,
  extractReportFields,
  serializeDraft,
  type DraftSection,
  type ReportStyle,
} from '../../aiplatform/report-templates'

export interface GenerateReportDraftRequest {
  reportId: string
  patientId?: string
  examId?: string
  modality: string
  bodyPart: string
  clinicalInfo?: string
  findings?: string
  keywords?: string[]
  style?: ReportStyle
}

export interface ReportDraftResult {
  id: string
  reportId: string
  draftText: string
  sections: DraftSection[]
  style: string
  status: string
  confidence: number
  modelVersion: string
  createdAt: Date
  updatedAt: Date
}

export const AI_DRAFT_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  MODIFIED: 'MODIFIED',
} as const

let draftCounter = 0

@Injectable()
export class ReportDraftService {
  constructor(private readonly prisma: PrismaService) {}

  /** POST /ai/report-draft — 环境式草稿生成 (模板库 NLG + 临床信息/关键词填充) 并持久化 */
  async generateReportDraft(request: GenerateReportDraftRequest): Promise<ReportDraftResult> {
    if (!request.reportId) throw new BadRequestException('reportId 不能为空')
    const style: ReportStyle = request.style ?? 'standard'
    const built = buildReportDraft({
      modality: request.modality,
      bodyPart: request.bodyPart,
      clinicalInfo: request.clinicalInfo,
      findings: request.findings,
      keywords: request.keywords,
      style,
    })
    const draftText = serializeDraft(built.sections)

    const created = await this.prisma.aiReportDraft.create({
      data: {
        reportId: request.reportId,
        draftText,
        style,
        status: AI_DRAFT_STATUS.PENDING,
        createdBy: getCurrentTenantId(),
      },
    })

    return {
      id: created.id,
      reportId: created.reportId,
      draftText: created.draftText,
      sections: parseDraftText(created.draftText),
      style: created.style,
      status: created.status,
      confidence: 0.9,
      modelVersion: 'deepseek-v3.0',
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    }
  }

  /** GET /ai/report-draft/:reportId — 按报告查最新草稿 */
  async getDraftByReport(reportId: string): Promise<ReportDraftResult | null> {
    const draft = await this.prisma.aiReportDraft.findFirst({
      where: { reportId },
      orderBy: { createdAt: 'desc' },
    })
    if (!draft) return null
    return {
      id: draft.id,
      reportId: draft.reportId,
      draftText: draft.draftText,
      sections: parseDraftText(draft.draftText),
      style: draft.style,
      status: draft.status,
      confidence: 0.9,
      modelVersion: 'deepseek-v3.0',
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    }
  }

  /** POST /ai/report-draft/:id/accept — 医生接受: 草稿 → 正式, 落 reports 表 */
  async acceptDraft(id: string): Promise<ReportDraftResult> {
    const draft = await this.prisma.aiReportDraft.findUnique({ where: { id } })
    if (!draft) throw new NotFoundException(`AI 草稿 ${id} 不存在`)
    if (draft.status === AI_DRAFT_STATUS.ACCEPTED) {
      throw new BadRequestException(`AI 草稿 ${id} 已被接受, 不可重复操作`)
    }

    const fields = extractReportFields(parseDraftText(draft.draftText))
    const existing = await this.prisma.report.findUnique({ where: { id: draft.reportId } })
    if (!existing) {
      throw new NotFoundException(`报告 ${draft.reportId} 不存在, 无法落库`)
    }
    await this.prisma.report.update({
      where: { id: draft.reportId },
      data: {
        findings: fields.findings,
        impression: fields.impression,
        recommendations: fields.recommendations,
        conclusion: fields.conclusion,
      },
    })

    const updated = await this.prisma.aiReportDraft.update({
      where: { id },
      data: { status: AI_DRAFT_STATUS.ACCEPTED, acceptedAt: new Date() },
    })
    await this.audit('ACCEPT', updated)

    return {
      id: updated.id,
      reportId: updated.reportId,
      draftText: updated.draftText,
      sections: parseDraftText(updated.draftText),
      style: updated.style,
      status: updated.status,
      confidence: 0.9,
      modelVersion: 'deepseek-v3.0',
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }
  }

  /** POST /ai/report-draft/:id/modify — 医生修改后保存 */
  async modifyDraft(id: string, draftText: string): Promise<ReportDraftResult> {
    if (!draftText?.trim()) throw new BadRequestException('修改后的草稿内容不能为空')
    const draft = await this.prisma.aiReportDraft.findUnique({ where: { id } })
    if (!draft) throw new NotFoundException(`AI 草稿 ${id} 不存在`)

    const updated = await this.prisma.aiReportDraft.update({
      where: { id },
      data: { draftText, status: AI_DRAFT_STATUS.MODIFIED },
    })
    await this.audit('MODIFY', updated)

    return {
      id: updated.id,
      reportId: updated.reportId,
      draftText: updated.draftText,
      sections: parseDraftText(updated.draftText),
      style: updated.style,
      status: updated.status,
      confidence: 0.9,
      modelVersion: 'deepseek-v3.0',
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }
  }

  private async audit(action: string, draft: { id: string; reportId: string }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          resource: 'ai-report-draft',
          detail: { draftId: draft.id, reportId: draft.reportId } as Prisma.InputJsonValue,
          tenantId: getCurrentTenantId(),
        },
      })
    } catch {
      // 审计失败不阻断主流程
    }
  }
}

/** 供测试/前端透传使用 */
export { buildReportDraft, parseDraftText, extractReportFields, serializeDraft }
