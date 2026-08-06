import type { AppropriatenessRule, ExamRecommendation, GuidelineSource, PatientCdsData, AppropriateOverride } from './types'

export interface IExamAppropriatenessService {
  getRecommendations(indication: string, patientData?: PatientCdsData): Promise<ExamRecommendation[]>
  getGuidelineSource(ruleId: string): Promise<GuidelineSource | null>
  getAllRules(): Promise<AppropriatenessRule[]>
  getRule(ruleId: string): Promise<AppropriatenessRule | null>
  createRule(rule: Omit<AppropriatenessRule, 'id' | 'createdTime' | 'updatedTime'>): Promise<AppropriatenessRule>
  updateRule(ruleId: string, updates: Partial<AppropriatenessRule>): Promise<AppropriatenessRule | null>
  toggleRule(ruleId: string, isActive: boolean): Promise<boolean>
  overrideRule(ruleId: string, override: Omit<AppropriateOverride, 'ruleId' | 'overriddenAt'>): Promise<boolean>
}

const MOCK_RULES: AppropriatenessRule[] = [
  {
    id: 'ar-001', indication: '头痛伴神经系统阳性体征', icdCode: 'R51',
    recommendedExams: [
      { examName: '颅脑CT平扫', examCode: 'CT-PLAIN-HEAD', modality: 'CT', bodyPart: '头颅', level: 'appropriate', rationale: '急性头痛伴神经系统阳性体征首选CT排除出血', radiationExposure: '2 mSv' },
      { examName: '颅脑MRI平扫', examCode: 'MR-PLAIN-BRAIN', modality: 'MR', bodyPart: '头颅', level: 'maybe_appropriate', rationale: '亚急性/慢性头痛MRI更佳', alternativeExams: ['CT-PLAIN-HEAD'] },
    ],
    guidelineSource: { organization: 'ACR', guidelineName: 'ACR Appropriateness Criteria Headache', publicationYear: 2023 },
    version: '1.0', isActive: true, createdTime: '2025-01-01T00:00:00Z', updatedTime: '2025-06-01T00:00:00Z',
  },
  {
    id: 'ar-002', indication: '胸痛', icdCode: 'R07.4',
    recommendedExams: [
      { examName: '胸部CT平扫', examCode: 'CT-PLAIN-CHEST', modality: 'CT', bodyPart: '胸部', level: 'appropriate', rationale: '可疑主动脉夹层/肺栓塞需CT', radiationExposure: '4 mSv' },
      { examName: '胸部正侧位', examCode: 'DR-CHEST', modality: 'DR', bodyPart: '胸部', level: 'maybe_appropriate', rationale: '胸痛初筛首选', radiationExposure: '0.1 mSv' },
    ],
    guidelineSource: { organization: 'ESR', guidelineName: 'ESR Guidelines for Chest Pain', publicationYear: 2022 },
    version: '2.0', isActive: true, createdTime: '2025-01-01T00:00:00Z', updatedTime: '2025-05-15T00:00:00Z',
  },
  {
    id: 'ar-003', indication: '腰痛无红牌征', icdCode: 'M54.5',
    recommendedExams: [
      { examName: '腰椎正侧位', examCode: 'DR-LUMBAR', modality: 'DR', bodyPart: '脊柱', level: 'appropriate', rationale: '无红牌征的急性腰痛首选DR', radiationExposure: '1.5 mSv' },
    ],
    guidelineSource: { organization: 'NICE', guidelineName: 'NICE Guideline NG59 Low Back Pain', publicationYear: 2020 },
    version: '1.1', isActive: true, createdTime: '2025-02-01T00:00:00Z', updatedTime: '2025-04-10T00:00:00Z',
  },
  {
    id: 'ar-004', indication: '肺癌筛查（高危）', icdCode: 'Z12.2',
    recommendedExams: [
      { examName: 'CT低剂量肺筛查', examCode: 'CT-LUNG-LOWDOSE', modality: 'CT', bodyPart: '胸部', level: 'appropriate', rationale: '高危人群年度低剂量CT筛查推荐', radiationExposure: '1.5 mSv', preparation: '无需特殊准备' },
    ],
    guidelineSource: { organization: 'ACR', guidelineName: 'ACR Appropriateness Criteria Lung Cancer Screening', publicationYear: 2023 },
    version: '1.0', isActive: true, createdTime: '2025-03-01T00:00:00Z', updatedTime: '2025-06-01T00:00:00Z',
  },
]

const MOCK_OVERRIDES: AppropriateOverride[] = []

class MockExamAppropriatenessService implements IExamAppropriatenessService {
  async getRecommendations(indication: string, _patientData?: PatientCdsData): Promise<ExamRecommendation[]> {
    const matched = MOCK_RULES.filter(
      r => r.isActive && (indication.includes(r.indication) || r.indication.includes(indication) || (r.icdCode && indication.includes(r.icdCode)))
    )
    if (matched.length === 0) return MOCK_RULES[0].recommendedExams
    return matched.flatMap(r => r.recommendedExams)
  }

  async getGuidelineSource(ruleId: string): Promise<GuidelineSource | null> {
    const rule = MOCK_RULES.find(r => r.id === ruleId)
    return rule?.guidelineSource ?? null
  }

  async getAllRules(): Promise<AppropriatenessRule[]> { return MOCK_RULES }

  async getRule(ruleId: string): Promise<AppropriatenessRule | null> {
    return MOCK_RULES.find(r => r.id === ruleId) ?? null
  }

  async createRule(rule: Omit<AppropriatenessRule, 'id' | 'createdTime' | 'updatedTime'>): Promise<AppropriatenessRule> {
    const newRule: AppropriatenessRule = {
      ...rule, id: `ar-${Date.now()}`,
      createdTime: new Date().toISOString(), updatedTime: new Date().toISOString(),
    }
    MOCK_RULES.push(newRule)
    return newRule
  }

  async updateRule(ruleId: string, updates: Partial<AppropriatenessRule>): Promise<AppropriatenessRule | null> {
    const idx = MOCK_RULES.findIndex(r => r.id === ruleId)
    if (idx === -1) return null
    MOCK_RULES[idx] = { ...MOCK_RULES[idx], ...updates, updatedTime: new Date().toISOString() }
    return MOCK_RULES[idx]
  }

  async toggleRule(ruleId: string, isActive: boolean): Promise<boolean> {
    const rule = MOCK_RULES.find(r => r.id === ruleId)
    if (!rule) return false
    rule.isActive = isActive
    rule.updatedTime = new Date().toISOString()
    return true
  }

  async overrideRule(ruleId: string, override: Omit<AppropriateOverride, 'ruleId' | 'overriddenAt'>): Promise<boolean> {
    const rule = MOCK_RULES.find(r => r.id === ruleId)
    if (!rule) return false
    const entry: AppropriateOverride = {
      ruleId, overriddenBy: override.overriddenBy, overriddenAt: new Date().toISOString(),
      previousLevel: override.previousLevel, newLevel: override.newLevel, reason: override.reason,
    }
    MOCK_OVERRIDES.push(entry)
    rule.updatedTime = new Date().toISOString()
    return true
  }
}

let _instance: IExamAppropriatenessService | null = null

export function getExamAppropriatenessService(): IExamAppropriatenessService {
  if (!_instance) _instance = new MockExamAppropriatenessService()
  return _instance
}
