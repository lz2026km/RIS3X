import type { AdverseReaction, ReactionType, ReactionSeverity, ReactionOutcome, ReactionStats } from './types'

export interface IAdverseReactionService {
  getReactions(filters?: { patientId?: string; reactionType?: ReactionType; severity?: ReactionSeverity; startDate?: string; endDate?: string }): Promise<AdverseReaction[]>
  getReaction(id: string): Promise<AdverseReaction | null>
  recordReaction(reaction: Omit<AdverseReaction, 'id' | 'createdAt' | 'isReported'>): Promise<AdverseReaction>
  updateReaction(id: string, updates: Partial<AdverseReaction>): Promise<AdverseReaction | null>
  getReactionStats(startDate: string, endDate: string): Promise<ReactionStats>
  getPatientHistory(patientId: string): Promise<AdverseReaction[]>
  reportReaction(id: string): Promise<AdverseReaction>
}

const MOCK_REACTIONS: AdverseReaction[] = [
  {
    id: 'ar-001', patientId: 'P003', patientName: '王五', examId: 'E-20250515-001',
    contrastName: '碘海醇', batchId: 'CT-2025001',
    reactionType: 'allergic', severity: 'moderate',
    symptoms: ['荨麻疹', '呼吸困难', '面部潮红'],
    description: '注射后5分钟出现全身荨麻疹，伴有轻度呼吸困难',
    occurredAt: '2025-05-15T10:30:00Z', reportedBy: 'tech-li',
    action: '立即停药，地塞米松10mg iv，吸氧3L/min',
    medicationGiven: '地塞米松10mg iv，苯海拉明20mg im',
    outcome: 'resolved', resolvedAt: '2025-05-15T11:15:00Z',
    followUpNotes: '留观30分钟后症状缓解，已告知患者及家属',
    isReported: true, createdAt: '2025-05-15T10:35:00Z',
  },
  {
    id: 'ar-002', patientId: 'P005', patientName: '赵六', examId: 'E-20250601-001',
    contrastName: '碘海醇', batchId: 'CT-2025002',
    reactionType: 'extravasation', severity: 'mild',
    symptoms: ['局部肿胀', '疼痛'],
    description: '穿刺部位造影剂外渗约10mL，局部肿胀',
    occurredAt: '2025-06-01T14:20:00Z', reportedBy: 'tech-wang',
    action: '停止注射，抬高患肢，50%硫酸镁冷敷',
    medicationGiven: '',
    outcome: 'resolved', resolvedAt: '2025-06-02T08:00:00Z',
    followUpNotes: '次日复查外渗已基本吸收',
    isReported: true, createdAt: '2025-06-01T14:25:00Z',
  },
  {
    id: 'ar-003', patientId: 'P008', patientName: '钱七', examId: 'E-20250615-001',
    contrastName: '钆布醇', batchId: 'MR-2025001',
    reactionType: 'nephrotoxic', severity: 'moderate',
    symptoms: ['血肌酐升高', '尿量减少'],
    description: '检查后48小时血肌酐由基线85μmol/L升至210μmol/L',
    occurredAt: '2025-06-17T08:00:00Z', reportedBy: 'dr-zhou',
    action: '充分水化，监测肾功能，肾内科会诊',
    medicationGiven: '0.9%氯化钠注射液 500ml iv',
    outcome: 'improving', resolvedAt: undefined,
    followUpNotes: '肾内科随访中，eGFR 45ml/min',
    isReported: true, createdAt: '2025-06-17T09:00:00Z',
  },
]

class MockAdverseReactionService implements IAdverseReactionService {
  async getReactions(filters?: { patientId?: string; reactionType?: ReactionType; severity?: ReactionSeverity; startDate?: string; endDate?: string }): Promise<AdverseReaction[]> {
    let result = [...MOCK_REACTIONS]
    if (filters?.patientId) result = result.filter(r => r.patientId === filters.patientId)
    if (filters?.reactionType) result = result.filter(r => r.reactionType === filters.reactionType)
    if (filters?.severity) result = result.filter(r => r.severity === filters.severity)
    if (filters?.startDate) result = result.filter(r => r.occurredAt >= filters.startDate!)
    if (filters?.endDate) result = result.filter(r => r.occurredAt <= filters.endDate!)
    return result
  }

  async getReaction(id: string): Promise<AdverseReaction | null> {
    return MOCK_REACTIONS.find(r => r.id === id) ?? null
  }

  async recordReaction(reaction: Omit<AdverseReaction, 'id' | 'createdAt' | 'isReported'>): Promise<AdverseReaction> {
    const newReaction: AdverseReaction = {
      ...reaction, id: `ar-${Date.now()}`, createdAt: new Date().toISOString(), isReported: false,
    }
    MOCK_REACTIONS.push(newReaction)
    return newReaction
  }

  async updateReaction(id: string, updates: Partial<AdverseReaction>): Promise<AdverseReaction | null> {
    const idx = MOCK_REACTIONS.findIndex(r => r.id === id)
    if (idx === -1) return null
    MOCK_REACTIONS[idx] = { ...MOCK_REACTIONS[idx]!, ...updates }
    return MOCK_REACTIONS[idx]!
  }

  async getReactionStats(startDate: string, endDate: string): Promise<ReactionStats> {
    const filtered = MOCK_REACTIONS.filter(r => r.occurredAt >= startDate && r.occurredAt <= endDate)
    const byType = { allergic: 0, nephrotoxic: 0, extravasation: 0, vasovagal: 0, other: 0 } as Record<ReactionType, number>
    const bySeverity = { mild: 0, moderate: 0, severe: 0 } as Record<ReactionSeverity, number>
    const byOutcome = { resolved: 0, improving: 0, ongoing: 0, fatal: 0 } as Record<ReactionOutcome, number>
    filtered.forEach(r => { byType[r.reactionType]++; bySeverity[r.severity]++; byOutcome[r.outcome]++ })
    return {
      totalReactions: filtered.length, byType, bySeverity, byOutcome,
      severeReactionRate: filtered.length > 0 ? bySeverity.severe / filtered.length : 0,
      totalExamsWithContrast: 120, periodStart: startDate, periodEnd: endDate,
    }
  }

  async getPatientHistory(patientId: string): Promise<AdverseReaction[]> {
    return MOCK_REACTIONS.filter(r => r.patientId === patientId)
  }

  async reportReaction(id: string): Promise<AdverseReaction> {
    const idx = MOCK_REACTIONS.findIndex(r => r.id === id)
    if (idx === -1) throw new Error('记录不存在')
    MOCK_REACTIONS[idx]!.isReported = true
    return MOCK_REACTIONS[idx]!
  }
}

let _instance: IAdverseReactionService | null = null

export function getAdverseReactionService(): IAdverseReactionService {
  if (!_instance) _instance = new MockAdverseReactionService()
  return _instance
}
