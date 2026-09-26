import type { ContrastCheck, DrugInteractionCheck, ContrastProtocol, AdverseEvent, ContrastRiskLevel, PatientCdsData } from './types'

export interface IDrugContrastCdsService {
  checkContrastSafety(contrastName: string, patientData: PatientCdsData): Promise<ContrastCheck>
  checkDrugInteraction(drugIds: string[], patientId?: string): Promise<DrugInteractionCheck[]>
  getContrastProtocol(contrastName: string, weightKg: number, eGFR: number): Promise<ContrastProtocol>
  getAllProtocols(): Promise<ContrastProtocol[]>
  recordAdverseEvent(event: Omit<AdverseEvent, 'id'>): Promise<AdverseEvent>
  getAdverseEvents(patientId?: string): Promise<AdverseEvent[]>
}

const CONTRAST_DB: Record<string, { genericName: string; risks: string[]; egfrThreshold: number; alternatives: string[] }> = {
  '碘海醇': { genericName: 'Iohexol', risks: ['造影剂肾病', '过敏反应'], egfrThreshold: 30, alternatives: ['碘克沙醇', '钆布醇'] },
  '碘克沙醇': { genericName: 'Iodixanol', risks: ['过敏反应'], egfrThreshold: 15, alternatives: ['碘海醇', '钆布醇'] },
  '钆喷酸葡胺': { genericName: 'Gadopentetate Dimeglumine', risks: ['肾源性系统性纤维化'], egfrThreshold: 30, alternatives: ['钆布醇', '钆塞酸二钠'] },
  '钆布醇': { genericName: 'Gadobutrol', risks: ['过敏反应'], egfrThreshold: 15, alternatives: ['钆喷酸葡胺', '碘克沙醇'] },
}

const MOCK_DRUG_INTERACTIONS: DrugInteractionCheck[] = [
  { drugA: '二甲双胍', drugB: '碘海醇', severity: 'moderate', mechanism: '二甲双胍与造影剂合用增加乳酸酸中毒风险', clinicalEffect: '血乳酸升高，肾功能不全时风险增加', recommendation: '检查前停用二甲双胍48小时', evidenceLevel: 'B' },
  { drugA: '环孢素', drugB: '碘海醇', severity: 'major', mechanism: '环孢素增强造影剂的肾毒性', clinicalEffect: '急性肾功能损伤', recommendation: '监测肾功能，考虑水化治疗', evidenceLevel: 'C' },
  { drugA: '利尿剂', drugB: '碘海醇', severity: 'moderate', mechanism: '利尿剂加重造影剂引起的肾灌注不足', clinicalEffect: '肾前性氮质血症', recommendation: '检查前适当补液', evidenceLevel: 'C' },
]

const MOCK_PROTOCOLS: ContrastProtocol[] = [
  { contrastName: '碘海醇', route: 'IV', dose: '1.5 mL/kg', doseMgIkg: 350, flowRate: '3-4 mL/s', concentration: '350 mgI/mL', maxVolume: '150 mL', premedication: '地塞米松10mg iv', notes: '肾功能不全者减量', weightBased: true, egfrAdjusted: true },
  { contrastName: '碘克沙醇', route: 'IV', dose: '1.0 mL/kg', doseMgIkg: 320, flowRate: '3-5 mL/s', concentration: '320 mgI/mL', maxVolume: '120 mL', notes: '等渗造影剂，肾病患者首选', weightBased: true, egfrAdjusted: true },
  { contrastName: '钆喷酸葡胺', route: 'IV', dose: '0.2 mL/kg', doseMgIkg: 0.1, flowRate: '2 mL/s', concentration: '0.5 mmol/mL', maxVolume: '20 mL', premedication: '无需', notes: '含钆造影剂，NSF高风险患者慎用', weightBased: true, egfrAdjusted: true },
]

const MOCK_ADVERSE_EVENTS: AdverseEvent[] = [
  { id: 'ae-001', patientId: 'P003', patientName: '王五', examId: 'E003', contrastName: '碘海醇', eventType: 'allergic', severity: 'moderate', description: '注射后5分钟出现荨麻疹伴呼吸困难', occurredAt: '2025-05-15T10:30:00Z', reportedBy: 'tech-li', action: '立即停药，地塞米松10mg iv，吸氧', outcome: '症状缓解' },
  { id: 'ae-002', patientId: 'P005', patientName: '赵六', examId: 'E005', contrastName: '碘海醇', eventType: 'extravasation', severity: 'mild', description: '穿刺部位造影剂外渗约10mL', occurredAt: '2025-06-01T14:20:00Z', reportedBy: 'tech-wang', action: '抬高患肢，50%硫酸镁冷敷', outcome: '外渗吸收，局部无坏死' },
]

class MockDrugContrastCdsService implements IDrugContrastCdsService {
  async checkContrastSafety(contrastName: string, patientData: PatientCdsData): Promise<ContrastCheck> {
    const info = Object.entries(CONTRAST_DB).find(([k]) => k.includes(contrastName) || contrastName.includes(k))?.[1]
    const riskFactors: string[] = []
    let riskLevel: ContrastRiskLevel = 'safe'
    if (info) {
      if (patientData.contrastAllergy) { riskFactors.push('既往造影剂过敏史'); riskLevel = 'caution' }
      if (patientData.eGFR !== undefined && patientData.eGFR < info.egfrThreshold) { riskFactors.push(`eGFR=${patientData.eGFR} < ${info.egfrThreshold}`); riskLevel = 'contraindicated' }
      if (patientData.pregnancyWeeks && patientData.pregnancyWeeks > 0) riskFactors.push('妊娠状态')
    }
    return {
      contrastName, genericName: info?.genericName, riskLevel, riskFactors,
      recommendations: riskLevel === 'contraindicated' ? ['换用替代造影剂', '充分水化', '评估利弊'] : ['常规使用'],
      egfrThreshold: info?.egfrThreshold, patientEgfr: patientData.eGFR,
      alternativeContrasts: info?.alternatives,
    }
  }

  async checkDrugInteraction(drugIds: string[], _patientId?: string): Promise<DrugInteractionCheck[]> {
    return MOCK_DRUG_INTERACTIONS.filter(di => drugIds.some(id => di.drugA.includes(id) || di.drugB.includes(id)))
  }

  async getContrastProtocol(contrastName: string, _weightKg: number, eGFR: number): Promise<ContrastProtocol> {
    const proto = MOCK_PROTOCOLS.find(p => p.contrastName.includes(contrastName)) ?? MOCK_PROTOCOLS[0]!
    const adjustedDose = eGFR < 30 ? `0.5 mL/kg (eGFR调整)` : proto.dose
    return { ...proto, dose: adjustedDose }
  }

  async getAllProtocols(): Promise<ContrastProtocol[]> { return MOCK_PROTOCOLS }

  async recordAdverseEvent(event: Omit<AdverseEvent, 'id'>): Promise<AdverseEvent> {
    const newEvent: AdverseEvent = { ...event, id: `ae-${Date.now()}` }
    MOCK_ADVERSE_EVENTS.push(newEvent)
    return newEvent
  }

  async getAdverseEvents(patientId?: string): Promise<AdverseEvent[]> {
    return patientId ? MOCK_ADVERSE_EVENTS.filter(e => e.patientId === patientId) : MOCK_ADVERSE_EVENTS
  }
}

let _instance: IDrugContrastCdsService | null = null

export function getDrugContrastCdsService(): IDrugContrastCdsService {
  if (!_instance) _instance = new MockDrugContrastCdsService()
  return _instance
}
