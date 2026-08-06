import type { ReportSuggestion, CompletenessCheckResult, TerminologyValidationResult } from './types'

export interface IReportDecisionSupportService {
  getSuggestions(reportDraft: { findings?: string; diagnosis?: string; impression?: string; modality?: string; bodyPart?: string }): Promise<ReportSuggestion[]>
  checkCompleteness(reportDraft: { findings?: string; diagnosis?: string; impression?: string; recommendations?: string; comparisonWithPrior?: string }): Promise<CompletenessCheckResult>
  validateTerminology(text: string): Promise<TerminologyValidationResult[]>
  acceptSuggestion(suggestionId: string): Promise<boolean>
  dismissSuggestion(suggestionId: string): Promise<boolean>
}

const MOCK_SUGGESTIONS: ReportSuggestion[] = [
  {
    id: 'rs-001', type: 'differential_diagnosis', severity: 'info',
    title: '考虑鉴别诊断', description: '基于影像表现，建议纳入鉴别诊断：1) 感染性病变 2) 肿瘤性病变 3) 肉芽肿性病变',
    snippet: '需与感染性病变、肿瘤性病变及肉芽肿性病变相鉴别',
    applicableSection: 'diagnosis', source: 'ai', confidence: 0.85,
  },
  {
    id: 'rs-002', type: 'follow_up', severity: 'warning',
    title: '建议随访', description: '该病灶性质不明确，建议3-6个月后复查随访',
    snippet: '建议3-6个月后复查随访', applicableSection: 'recommendations', source: 'guideline', confidence: 0.92,
  },
  {
    id: 'rs-003', type: 'terminology', severity: 'info',
    title: '术语建议', description: '建议使用标准术语"磨玻璃密度影"替代"模糊影"',
    snippet: '磨玻璃密度影（GGO）', applicableSection: 'findings', source: 'library', confidence: 0.95,
  },
  {
    id: 'rs-004', type: 'template', severity: 'info',
    title: '模板建议', description: '当前检查为肺结节随访，建议使用肺结节结构化报告模板',
    applicableSection: 'findings', source: 'rule', confidence: 0.88,
  },
  {
    id: 'rs-005', type: 'critical_value', severity: 'critical',
    title: '危急值提示', description: '影像表现提示气胸可能，请紧急处理',
    snippet: '大量气胸，肺组织压缩约40%', applicableSection: 'impression', source: 'rule', confidence: 0.97,
  },
]

const REQUIRED_SECTIONS = ['findings', 'diagnosis', 'impression']
const QUALITY_FIELDS = ['recommendations', 'comparisonWithPrior']

class MockReportDecisionSupportService implements IReportDecisionSupportService {
  async getSuggestions(_reportDraft: { findings?: string; diagnosis?: string; impression?: string; modality?: string; bodyPart?: string }): Promise<ReportSuggestion[]> {
    return MOCK_SUGGESTIONS
  }

  async checkCompleteness(reportDraft: { findings?: string; diagnosis?: string; impression?: string; recommendations?: string; comparisonWithPrior?: string }): Promise<CompletenessCheckResult> {
    const missingSections: string[] = []
    const missingFields: string[] = []
    for (const section of REQUIRED_SECTIONS) {
      if (!reportDraft[section as keyof typeof reportDraft]) missingSections.push(section)
    }
    for (const field of QUALITY_FIELDS) {
      if (!reportDraft[field as keyof typeof reportDraft]) missingFields.push(field)
    }
    const presentCount = REQUIRED_SECTIONS.filter(s => reportDraft[s as keyof typeof reportDraft]).length
    const overallScore = Math.round((presentCount / REQUIRED_SECTIONS.length) * 100)
    return {
      isComplete: missingSections.length === 0,
      missingSections, missingFields,
      suggestions: missingSections.length > 0 ? MOCK_SUGGESTIONS.slice(0, 1) : [],
      overallScore,
    }
  }

  async validateTerminology(text: string): Promise<TerminologyValidationResult[]> {
    const terms = text.match(/[\u4e00-\u9fa5]{2,10}(?:影|征|位|型|状|性|度|变|灶|化)/g) ?? []
    return terms.slice(0, 5).map(term => ({
      term, found: Math.random() > 0.3,
      standard: 'RadLex' as const,
      mappedCode: Math.random() > 0.3 ? `RID${Math.floor(Math.random() * 50000)}` : undefined,
      preferredTerm: term,
      suggestions: ['建议使用标准术语'],
    }))
  }

  async acceptSuggestion(suggestionId: string): Promise<boolean> {
    const s = MOCK_SUGGESTIONS.find(s => s.id === suggestionId)
    if (!s) return false
    s.isAccepted = true; s.acceptedAt = new Date().toISOString()
    return true
  }

  async dismissSuggestion(suggestionId: string): Promise<boolean> {
    const s = MOCK_SUGGESTIONS.find(s => s.id === suggestionId)
    if (!s) return false
    s.isAccepted = false
    return true
  }
}

let _instance: IReportDecisionSupportService | null = null

export function getReportDecisionSupportService(): IReportDecisionSupportService {
  if (!_instance) _instance = new MockReportDecisionSupportService()
  return _instance
}
