import type { ClinicalPathway, PathwayStep, PathwayInstance, PathwayInstanceStep } from './types'

export interface IPathwayService {
  getPathways(condition: string, modality?: string): Promise<ClinicalPathway[]>
  getPathway(pathwayId: string): Promise<ClinicalPathway | null>
  getAllPathways(): Promise<ClinicalPathway[]>
  createPathway(pathway: Omit<ClinicalPathway, 'id' | 'createdTime' | 'updatedTime'>): Promise<ClinicalPathway>
  updatePathway(pathwayId: string, updates: Partial<ClinicalPathway>): Promise<ClinicalPathway | null>
  togglePathway(pathwayId: string, isActive: boolean): Promise<boolean>
  activatePathway(patientId: string, patientName: string, pathwayId: string, activatedBy: string): Promise<PathwayInstance>
  getPatientPathway(patientId: string): Promise<PathwayInstance | null>
  getAllInstances(): Promise<PathwayInstance[]>
  advanceStep(instanceId: string, stepId: string, performedBy?: string, notes?: string, resultSummary?: string): Promise<boolean>
  discontinuePathway(instanceId: string): Promise<boolean>
}

const MOCK_STEPS_A: PathwayStep[] = [
  { id: 'ps-a-1', order: 1, type: 'exam', name: '胸部CT平扫', description: '初诊肺结节CT检查', modality: 'CT', bodyPart: '胸部', defaultTimingDays: 0, isOptional: false },
  { id: 'ps-a-2', order: 2, type: 'exam', name: '胸部CT增强', description: '增强扫描进一步评估', modality: 'CT', bodyPart: '胸部', defaultTimingDays: 7, isOptional: true, dependsOnStepIds: ['ps-a-1'] },
  { id: 'ps-a-3', order: 3, type: 'consultation', name: '胸外科会诊', description: '评估手术指征', defaultTimingDays: 14, isOptional: false, dependsOnStepIds: ['ps-a-2'] },
  { id: 'ps-a-4', order: 4, type: 'procedure', name: 'CT引导下穿刺活检', description: '病理确诊', modality: 'CT', bodyPart: '胸部', defaultTimingDays: 21, isOptional: true, dependsOnStepIds: ['ps-a-3'] },
  { id: 'ps-a-5', order: 5, type: 'follow_up', name: '术后3个月随访', description: '复查CT评估疗效', modality: 'CT', bodyPart: '胸部', defaultTimingDays: 90, isOptional: false, dependsOnStepIds: ['ps-a-3'] },
]

const MOCK_STEPS_B: PathwayStep[] = [
  { id: 'ps-b-1', order: 1, type: 'exam', name: '头颅CT平扫', description: '急性期排除出血', modality: 'CT', bodyPart: '头颅', defaultTimingDays: 0, isOptional: false },
  { id: 'ps-b-2', order: 2, type: 'exam', name: '头颅MRI平扫+弥散', description: '评估梗死范围', modality: 'MR', bodyPart: '头颅', defaultTimingDays: 3, isOptional: false, dependsOnStepIds: ['ps-b-1'] },
  { id: 'ps-b-3', order: 3, type: 'exam', name: '头颈CTA', description: '评估血管狭窄/闭塞', modality: 'CT', bodyPart: '头颅', defaultTimingDays: 3, isOptional: true, dependsOnStepIds: ['ps-b-1'] },
  { id: 'ps-b-4', order: 4, type: 'consultation', name: '神经内科会诊', description: '制定治疗方案', defaultTimingDays: 7, isOptional: false, dependsOnStepIds: ['ps-b-2'] },
  { id: 'ps-b-5', order: 5, type: 'follow_up', name: '3个月随访MRI', description: '评估恢复情况', modality: 'MR', bodyPart: '头颅', defaultTimingDays: 90, isOptional: true, dependsOnStepIds: ['ps-b-4'] },
]

const MOCK_PATHWAYS: ClinicalPathway[] = [
  { id: 'pw-001', name: '肺结节评估路径', condition: '肺结节', icdCode: 'R91.1', modality: 'CT', steps: MOCK_STEPS_A, estimatedDurationDays: 90, isActive: true, version: '1.0', createdTime: '2025-01-15T00:00:00Z', updatedTime: '2025-06-01T00:00:00Z' },
  { id: 'pw-002', name: '急性缺血性脑卒中路径', condition: '脑卒中', icdCode: 'I63.9', steps: MOCK_STEPS_B, estimatedDurationDays: 90, isActive: true, version: '1.0', createdTime: '2025-02-01T00:00:00Z', updatedTime: '2025-05-15T00:00:00Z' },
]

const MOCK_INSTANCES: PathwayInstance[] = [
  {
    id: 'pi-001', pathwayId: 'pw-001', pathwayName: '肺结节评估路径', patientId: 'P001', patientName: '张三',
    activatedAt: '2025-04-01T10:00:00Z', activatedBy: 'dr-li', currentStepIndex: 2,
    steps: [
      { stepId: 'ps-a-1', status: 'completed', startedAt: '2025-04-01T10:00:00Z', completedAt: '2025-04-01T10:30:00Z', performedBy: 'tech-wang' },
      { stepId: 'ps-a-2', status: 'completed', startedAt: '2025-04-08T09:00:00Z', completedAt: '2025-04-08T09:45:00Z', performedBy: 'tech-wang', resultSummary: '右肺上叶8mm磨玻璃结节，增强轻度强化' },
      { stepId: 'ps-a-3', status: 'in_progress', startedAt: '2025-04-15T14:00:00Z', performedBy: 'dr-zhao' },
    ],
    status: 'active',
  },
]

class MockPathwayService implements IPathwayService {
  async getPathways(condition: string, _modality?: string): Promise<ClinicalPathway[]> {
    return MOCK_PATHWAYS.filter(p => p.isActive && (condition.includes(p.condition) || p.condition.includes(condition)))
  }

  async getPathway(pathwayId: string): Promise<ClinicalPathway | null> {
    return MOCK_PATHWAYS.find(p => p.id === pathwayId) ?? null
  }

  async getAllPathways(): Promise<ClinicalPathway[]> { return MOCK_PATHWAYS }

  async createPathway(pathway: Omit<ClinicalPathway, 'id' | 'createdTime' | 'updatedTime'>): Promise<ClinicalPathway> {
    const newPw: ClinicalPathway = {
      ...pathway, id: `pw-${Date.now()}`,
      createdTime: new Date().toISOString(), updatedTime: new Date().toISOString(),
    }
    MOCK_PATHWAYS.push(newPw)
    return newPw
  }

  async updatePathway(pathwayId: string, updates: Partial<ClinicalPathway>): Promise<ClinicalPathway | null> {
    const idx = MOCK_PATHWAYS.findIndex(p => p.id === pathwayId)
    if (idx === -1) return null
    MOCK_PATHWAYS[idx] = { ...MOCK_PATHWAYS[idx]!, ...updates, updatedTime: new Date().toISOString() }
    return MOCK_PATHWAYS[idx]!
  }

  async togglePathway(pathwayId: string, isActive: boolean): Promise<boolean> {
    const pw = MOCK_PATHWAYS.find(p => p.id === pathwayId)
    if (!pw) return false
    pw.isActive = isActive; pw.updatedTime = new Date().toISOString()
    return true
  }

  async activatePathway(patientId: string, patientName: string, pathwayId: string, activatedBy: string): Promise<PathwayInstance> {
    const pw = MOCK_PATHWAYS.find(p => p.id === pathwayId)!
    const steps: PathwayInstanceStep[] = pw.steps.map(s => ({ stepId: s.id, status: 'pending' as const }))
    steps[0]!.status = 'in_progress'; steps[0]!.startedAt = new Date().toISOString()
    const instance: PathwayInstance = {
      id: `pi-${Date.now()}`, pathwayId, pathwayName: pw.name,
      patientId, patientName, activatedAt: new Date().toISOString(),
      activatedBy, currentStepIndex: 0, steps, status: 'active',
    }
    MOCK_INSTANCES.push(instance)
    return instance
  }

  async getPatientPathway(patientId: string): Promise<PathwayInstance | null> {
    return MOCK_INSTANCES.find(i => i.patientId === patientId && i.status === 'active') ?? null
  }

  async getAllInstances(): Promise<PathwayInstance[]> { return MOCK_INSTANCES }

  async advanceStep(instanceId: string, stepId: string, performedBy?: string, notes?: string, resultSummary?: string): Promise<boolean> {
    const inst = MOCK_INSTANCES.find(i => i.id === instanceId)
    if (!inst) return false
    const step = inst.steps.find(s => s.stepId === stepId)
    if (!step) return false
    step.status = 'completed'; step.completedAt = new Date().toISOString()
    step.performedBy = performedBy; step.notes = notes; step.resultSummary = resultSummary
    const nextIdx = inst.currentStepIndex + 1
    if (nextIdx < inst.steps.length) {
      inst.steps[nextIdx]!.status = 'in_progress'
      inst.steps[nextIdx]!.startedAt = new Date().toISOString()
      inst.currentStepIndex = nextIdx
    } else {
      inst.status = 'completed'; inst.completedAt = new Date().toISOString()
    }
    return true
  }

  async discontinuePathway(instanceId: string): Promise<boolean> {
    const inst = MOCK_INSTANCES.find(i => i.id === instanceId)
    if (!inst) return false
    inst.status = 'discontinued'; inst.completedAt = new Date().toISOString()
    return true
  }
}

let _instance: IPathwayService | null = null

export function getPathwayService(): IPathwayService {
  if (!_instance) _instance = new MockPathwayService()
  return _instance
}
