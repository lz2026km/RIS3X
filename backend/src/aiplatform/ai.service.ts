import { Injectable } from '@nestjs/common'

export interface AiGenerateDto {
  modality: string
  bodyPart: string
  findings: string
  impression?: string
  clinicalHistory?: string
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
  async generateReport(dto: AiGenerateDto) {
    return {
      provider: 'mock',
      sections: [
        { heading: '检查技术', content: `${dto.modality} 平扫+增强扫描` },
        { heading: '影像所见', content: dto.findings || `${dto.bodyPart} 未见异常` },
        { heading: '影像诊断', content: dto.impression || '未见明确异常' },
        { heading: '建议', content: '定期随访' },
      ],
      confidence: 0.85,
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
