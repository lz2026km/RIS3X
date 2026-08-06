import type { RenalFunctionAssessment, EgfrFormula, CINRiskLevel, HydrationProtocol } from './types'

export interface IRenalFunctionService {
  calculateEgfr(creatinineUmoll: number, age: number, gender: 'male' | 'female', race?: string, formula?: EgfrFormula): Promise<{ eGFR: number; formula: EgfrFormula; riskLevel: CINRiskLevel }>
  assessContrastRisk(egfrValue: number, contrastType: string): Promise<CINRiskLevel>
  getHydrationProtocol(riskLevel: CINRiskLevel): Promise<HydrationProtocol>
  saveAssessment(assessment: Omit<RenalFunctionAssessment, 'id'>): Promise<RenalFunctionAssessment>
  getPatientRenalHistory(patientId: string): Promise<RenalFunctionAssessment[]>
}

function computeEgfrMDRD(creatinineUmoll: number, age: number, gender: 'male' | 'female', race?: string): number {
  const scr = creatinineUmoll / 88.4
  let eGFR = 186 * Math.pow(scr, -1.154) * Math.pow(age, -0.203)
  if (gender === 'female') eGFR *= 0.742
  if (race === 'black') eGFR *= 1.212
  return Math.round(eGFR)
}

function computeEgfrCKDEPI(creatinineUmoll: number, age: number, gender: 'male' | 'female', race?: string): number {
  const scr = creatinineUmoll / 88.4
  const kappa = gender === 'female' ? 0.7 : 0.9
  const alpha = gender === 'female' ? -0.329 : -0.411
  const mult = gender === 'female' ? 1.018 : 1
  const raceMult = race === 'black' ? 1.159 : 1
  const eGFR = 141 * Math.pow(Math.min(scr / kappa, 1), alpha) * Math.pow(Math.max(scr / kappa, 1), -1.209) * Math.pow(0.993, age) * mult * raceMult
  return Math.round(eGFR)
}

function computeEgfrCockcroft(creatinineUmoll: number, age: number, gender: 'male' | 'female', _race?: string, weightKg?: number): number {
  const scr = creatinineUmoll / 88.4
  const weight = weightKg ?? 70
  let crcl = ((140 - age) * weight) / (72 * scr)
  if (gender === 'female') crcl *= 0.85
  return Math.round(crcl)
}

function computeRiskLevel(eGFR: number): CINRiskLevel {
  if (eGFR >= 60) return 'low'
  if (eGFR >= 45) return 'moderate'
  if (eGFR >= 30) return 'high'
  return 'very_high'
}

const MOCK_HYDRATION_PROTOCOLS: Record<CINRiskLevel, HydrationProtocol> = {
  low: { riskLevel: 'low', description: '常规水化', regimen: '检查前3小时起口服水500mL', duration: '3小时', rate: '口服', totalVolume: '500mL', notes: '无需特殊处理' },
  moderate: { riskLevel: 'moderate', description: '静脉水化', regimen: '0.9%氯化钠注射液 1mL/kg/h', duration: '检查前6-12小时', rate: '1mL/kg/h', totalVolume: '1000mL', notes: '监测尿量' },
  high: { riskLevel: 'high', description: '强化水化+药物', regimen: '0.9%氯化钠注射液 1.5mL/kg/h + N-乙酰半胱氨酸', duration: '检查前12-24小时', rate: '1.5mL/kg/h', totalVolume: '2000mL', notes: '肾内科会诊，考虑替代检查' },
  very_high: { riskLevel: 'very_high', description: '禁忌使用/严格评估', regimen: '充分水化+血液透析（如已透析）', duration: '检查前24小时', rate: '个体化', totalVolume: '个体化', notes: '强烈建议使用替代检查（非增强CT/MR/超声），如需使用必须肾内科会诊' },
}

const MOCK_HISTORY: RenalFunctionAssessment[] = [
  { id: 'rf-001', patientId: 'P001', serumCreatinineUmoll: 78, eGFR: 92, formula: 'CKD-EPI', riskLevel: 'low', assessedAt: '2025-05-01T08:00:00Z', age: 45, gender: 'male' },
  { id: 'rf-002', patientId: 'P003', serumCreatinineUmoll: 145, eGFR: 42, formula: 'CKD-EPI', riskLevel: 'high', assessedAt: '2025-05-15T08:00:00Z', age: 65, gender: 'female', contrastType: '碘海醇' },
  { id: 'rf-003', patientId: 'P003', serumCreatinineUmoll: 160, eGFR: 38, formula: 'CKD-EPI', riskLevel: 'very_high', assessedAt: '2025-06-01T08:00:00Z', age: 65, gender: 'female', contrastType: '碘海醇' },
]

class MockRenalFunctionService implements IRenalFunctionService {
  async calculateEgfr(creatinineUmoll: number, age: number, gender: 'male' | 'female', race?: string, formula: EgfrFormula = 'CKD-EPI'): Promise<{ eGFR: number; formula: EgfrFormula; riskLevel: CINRiskLevel }> {
    let eGFR: number
    switch (formula) {
      case 'MDRD': eGFR = computeEgfrMDRD(creatinineUmoll, age, gender, race); break
      case 'CKD-EPI': eGFR = computeEgfrCKDEPI(creatinineUmoll, age, gender, race); break
      case 'Cockcroft-Gault': eGFR = computeEgfrCockcroft(creatinineUmoll, age, gender, race); break
    }
    return { eGFR, formula, riskLevel: computeRiskLevel(eGFR) }
  }

  async assessContrastRisk(egfrValue: number, contrastType: string): Promise<CINRiskLevel> {
    const base = computeRiskLevel(egfrValue)
    if (base === 'low' || base === 'moderate') return base
    if (contrastType.includes('钆') && base === 'high') return 'very_high'
    return base
  }

  async getHydrationProtocol(riskLevel: CINRiskLevel): Promise<HydrationProtocol> {
    return MOCK_HYDRATION_PROTOCOLS[riskLevel]
  }

  async saveAssessment(assessment: Omit<RenalFunctionAssessment, 'id'>): Promise<RenalFunctionAssessment> {
    const newAssessment: RenalFunctionAssessment = { ...assessment, id: `rf-${Date.now()}` }
    MOCK_HISTORY.push(newAssessment)
    return newAssessment
  }

  async getPatientRenalHistory(patientId: string): Promise<RenalFunctionAssessment[]> {
    return MOCK_HISTORY.filter(a => a.patientId === patientId)
  }
}

let _instance: IRenalFunctionService | null = null

export function getRenalFunctionService(): IRenalFunctionService {
  if (!_instance) _instance = new MockRenalFunctionService()
  return _instance
}
