import { Injectable } from '@nestjs/common'
import {
  buildReportDraft,
  serializeDraft,
  type ReportStyle,
} from './report-templates'

export interface AiGenerateDto {
  modality: string
  bodyPart: string
  findings: string
  impression?: string
  clinicalHistory?: string
  clinicalInfo?: string
  style?: ReportStyle
}

export interface AiReviewDto {
  reportText: string
  findings: string
  conclusion: string
}

export interface AiScoreDto {
  reportText: string
  findings: string
  conclusion: string
  radsCategory?: string
  hasCritical?: boolean
}

@Injectable()
export class AiService {
  /**
   * v3.0.6.11-61: 环境式报告生成 (对标 Philips Ambient Reporting / Siemens 结构化报告)
   * 输入 临床信息 + 检查(模态/部位) + 发现关键词 → 基于模板库生成完整草稿
   * 支持 ?style=concise|standard|detailed
   */
  async generateReport(dto: AiGenerateDto) {
    const built = buildReportDraft({
      modality: dto.modality,
      bodyPart: dto.bodyPart,
      clinicalInfo: dto.clinicalInfo ?? dto.clinicalHistory,
      findings: dto.findings,
      style: dto.style ?? 'standard',
    })
    const sections = built.sections.map((s) => ({
      heading: s.heading,
      content: s.content,
    }))
    return {
      provider: 'mock',
      style: dto.style ?? 'standard',
      sections,
      draftText: serializeDraft(built.sections),
      findingsText: built.findingsText,
      conclusionText: built.conclusionText,
      recommendation: built.recommendation,
      confidence: 0.9,
    }
  }

  async reviewReport(dto: AiReviewDto) {
    const issues: Array<{ id: string; severity: string; message: string }> = []
    if (dto.findings.length < 20) {
      issues.push({ id: 'len-findings', severity: 'warning', message: '所见过短' })
    }
    if (dto.conclusion.length < 10) {
      issues.push({ id: 'len-conclusion', severity: 'warning', message: '结论过短' })
    }
    return { issues, summary: `发现 ${issues.length} 个问题`, overallScore: Math.max(60, 100 - issues.length * 10) }
  }

  async scoreReport(dto: AiScoreDto) {
    const totalScore = dto.radsCategory ? 85 : 70
    return { totalScore, grade: totalScore >= 80 ? 'B' : 'C', evaluatedAt: new Date().toISOString() }
  }
}
