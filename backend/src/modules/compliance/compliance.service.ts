// [G005 W13-Security] 等保 2.0 实时评估服务。
// 取代原硬编码评分: 基于 SecuritySignalsService 采集的真实信号, 对控制项目录自动评估。
import { Injectable } from '@nestjs/common'
import { SecuritySignalsService } from '../security-center/security-signals.service'
import { CONTROL_CATALOG, DOMAIN_NAMES, evaluateControl, type ControlDomain, type ControlEvaluation } from './compliance.controls'

export interface DomainScore {
  domain: ControlDomain
  domainName: string
  controlCount: number
  implementedCount: number
  requiredCount: number
  averageScore: number
  weight: number
  weightedScore: number
}

export interface GapItem {
  id: string
  domain: ControlDomain
  domainName: string
  name: string
  level: string
  score: number
  gap: string
  remediation: string
  priority: 'high' | 'medium' | 'low'
}

export interface ComplianceAssessment {
  assessedAt: string
  version: number
  standard: string
  overallScore: number
  overallCompliance: number
  level: '优秀' | '良好' | '基本符合' | '不符合'
  totals: { controls: number; implemented: number; required: number; requiredImplemented: number; gaps: number; domains: number }
  domains: DomainScore[]
  gaps: GapItem[]
  remediation: Array<{ controlId: string; name: string; suggestion: string; priority: string }>
  signals: Record<string, unknown>
}

const STANDARD = '等保 2.0 · GB/T 22239-2019 信息安全技术 网络安全等级保护基本要求 (三级)'

function round(n: number, d = 1): number {
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}

@Injectable()
export class ComplianceService {
  private version = 0
  private lastAssessment: ComplianceAssessment | null = null
  private lastEvaluations: ControlEvaluation[] = []

  constructor(private readonly signals: SecuritySignalsService) {}

  /** 实时评估 (可强制重算) */
  async getAssessment(force = false): Promise<ComplianceAssessment> {
    if (this.lastAssessment && !force) return this.lastAssessment
    const s = await this.signals.collect()
    const evaluations = CONTROL_CATALOG.map((c) => evaluateControl(c, s))
    this.lastEvaluations = evaluations
    this.version += 1

    const totalWeight = evaluations.reduce((a, e) => a + e.weight, 0) || 1
    const overallScore = round(evaluations.reduce((a, e) => a + e.score * e.weight, 0) / totalWeight)
    const required = evaluations.filter((e) => e.required)
    const requiredImplemented = required.filter((e) => e.implemented).length
    const overallCompliance = required.length > 0 ? round((requiredImplemented / required.length) * 100) : 100
    const level: ComplianceAssessment['level'] =
      overallScore >= 90 ? '优秀' : overallScore >= 80 ? '良好' : overallScore >= 70 ? '基本符合' : '不符合'

    const domains: DomainScore[] = (Object.keys(DOMAIN_NAMES) as ControlDomain[]).map((domain) => {
      const items = evaluations.filter((e) => e.domain === domain)
      const w = items.reduce((a, e) => a + e.weight, 0) || 1
      return {
        domain,
        domainName: DOMAIN_NAMES[domain],
        controlCount: items.length,
        implementedCount: items.filter((e) => e.implemented).length,
        requiredCount: items.filter((e) => e.required).length,
        averageScore: round(items.reduce((a, e) => a + e.score, 0) / (items.length || 1)),
        weight: round(w, 2),
        weightedScore: round(items.reduce((a, e) => a + e.score * e.weight, 0) / totalWeight),
      }
    })

    const gaps: GapItem[] = evaluations
      .filter((e) => !e.implemented)
      .map((e) => ({
        id: e.id,
        domain: e.domain,
        domainName: e.domainName,
        name: e.name,
        level: e.level,
        score: e.score,
        gap: e.gap ?? '未满足要求',
        remediation: e.remediation ?? '请补充控制措施',
        priority: (e.required ? (e.score < 60 ? 'high' : 'medium') : 'low') as GapItem['priority'],
      }))
      .sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 }
        return order[a.priority] - order[b.priority] || a.score - b.score
      })

    this.lastAssessment = {
      assessedAt: new Date().toISOString(),
      version: this.version,
      standard: STANDARD,
      overallScore,
      overallCompliance,
      level,
      totals: {
        controls: evaluations.length,
        implemented: evaluations.filter((e) => e.implemented).length,
        required: required.length,
        requiredImplemented,
        gaps: gaps.length,
        domains: domains.length,
      },
      domains,
      gaps,
      remediation: gaps.map((g) => ({ controlId: g.id, name: g.name, suggestion: g.remediation, priority: g.priority })),
      signals: s as unknown as Record<string, unknown>,
    }
    return this.lastAssessment
  }

  /** 控制项目录 + 最近一次评估结果 */
  async getControls(): Promise<{
    standard: string
    assessedAt: string | null
    domains: Array<{ domain: ControlDomain; domainName: string; controls: ControlEvaluation[] }>
    controls: ControlEvaluation[]
  }> {
    if (this.lastEvaluations.length === 0) await this.getAssessment(true)
    const domains = (Object.keys(DOMAIN_NAMES) as ControlDomain[]).map((domain) => ({
      domain,
      domainName: DOMAIN_NAMES[domain],
      controls: this.lastEvaluations.filter((e) => e.domain === domain),
    }))
    return {
      standard: STANDARD,
      assessedAt: this.lastAssessment?.assessedAt ?? null,
      domains,
      controls: this.lastEvaluations,
    }
  }

  /** 强制重新评估 */
  reassess(): Promise<ComplianceAssessment> {
    return this.getAssessment(true)
  }

  /** 兼容旧端点 GET /compliance/report: 同时返回等保评估与旧版报表字段。 */
  async getReport(): Promise<Record<string, unknown>> {
    const a = await this.getAssessment()
    const categories = a.domains.map((d) => ({
      category: d.domain,
      name: d.domainName,
      itemCount: d.controlCount,
      implementedCount: d.implementedCount,
      averageScore: d.averageScore,
    }))
    const items = this.lastEvaluations.map((e) => ({
      id: e.id,
      category: e.domain,
      name: e.name,
      required: e.required,
      implemented: e.implemented,
      score: e.score,
      evidence: e.evidence,
      gap: e.gap,
      remediation: e.remediation,
    }))
    return {
      // 等保 2.0 实时评估字段
      overallScore: a.overallScore,
      overallCompliance: a.overallCompliance,
      level: a.level,
      standard: a.standard,
      lastAssessedAt: a.assessedAt,
      categories,
      items,
      domains: a.domains,
      gaps: a.gaps,
      // 旧版报表兼容字段
      summary: {
        totalAudits: a.totals.controls,
        passed: a.totals.implemented,
        failed: a.totals.controls - a.totals.implemented,
        complianceRate: a.overallCompliance,
      },
      details: this.lastEvaluations.map((e) => ({
        id: e.id,
        module: e.domainName,
        checkItem: e.name,
        status: e.implemented ? 'PASS' : e.score >= 60 ? 'WARN' : 'FAIL',
        severity: e.required ? 'MAJOR' : 'MINOR',
        description: e.evidence,
        checkedAt: a.assessedAt,
      })),
      generatedAt: a.assessedAt,
    }
  }
}
