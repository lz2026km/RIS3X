import { Injectable, NotFoundException } from '@nestjs/common'

export interface RadsScore {
  category: string
  score: string
  description: string
  confidence: number
  findings: string[]
  recommendations: string
}

export interface RadsHistoryEntry {
  date: string
  score: string
  category: string
  confidence: number
}

const lungRadss: Record<string, { category: string; description: string; findings: string[]; recommendations: string }> = {
  '1': { category: 'Lung-RADS 1', description: '阴性', findings: ['无肺结节'], recommendations: '常规随访' },
  '2': { category: 'Lung-RADS 2', description: '良性结节', findings: ['实性结节 ≤ 6mm', '部分实性结节 ≤ 6mm'], recommendations: '12个月低剂量CT随访' },
  '3': { category: 'Lung-RADS 3', description: '可能良性', findings: ['实性结节 6-8mm', '部分实性结节 6-8mm'], recommendations: '6个月低剂量CT随访' },
  '4A': { category: 'Lung-RADS 4A', description: '可疑恶性', findings: ['实性结节 8-15mm', '部分实性结节 > 8mm'], recommendations: '3个月低剂量CT随访 或 PET-CT' },
  '4B': { category: 'Lung-RADS 4B', description: '高度可疑', findings: ['实性结节 > 15mm', '新发结节 > 8mm'], recommendations: '立即胸外科会诊 或 PET-CT' },
  '4X': { category: 'Lung-RADS 4X', description: '提示高度可疑', findings: ['分叶状或毛刺状边缘', '生长速度 > 1.5mm/年'], recommendations: '建议活检 或 手术切除' },
}

const biRads: Record<string, { category: string; description: string; findings: string[]; recommendations: string }> = {
  '0': { category: 'BI-RADS 0', description: '评估未完成', findings: ['需要补充影像学检查'], recommendations: '建议进一步影像学检查（超声/MRI）' },
  '1': { category: 'BI-RADS 1', description: '阴性', findings: ['乳腺影像正常'], recommendations: '常规筛查随访' },
  '2': { category: 'BI-RADS 2', description: '良性发现', findings: ['良性钙化', '纤维腺瘤', '单纯囊肿'], recommendations: '常规筛查随访' },
  '3': { category: 'BI-RADS 3', description: '可能良性', findings: ['形态规则肿块', '簇状分布的点状钙化'], recommendations: '6个月短期随访' },
  '4A': { category: 'BI-RADS 4A', description: '低度可疑恶性', findings: ['部分边缘模糊肿块'], recommendations: '建议穿刺活检' },
  '4B': { category: 'BI-RADS 4B', description: '中度可疑恶性', findings: ['形态不规则肿块', '细小多形性钙化'], recommendations: '建议穿刺活检' },
  '4C': { category: 'BI-RADS 4C', description: '高度可疑恶性', findings: ['边缘毛刺肿块', '线样分布钙化'], recommendations: '建议穿刺活检' },
  '5': { category: 'BI-RADS 5', description: '高度提示恶性', findings: ['典型恶性形态', '毛刺征', '结构扭曲'], recommendations: '立即活检并多学科会诊' },
  '6': { category: 'BI-RADS 6', description: '已活检证实恶性', findings: ['已通过活检证实恶性'], recommendations: '制定治疗方案' },
}

const piRads: Record<string, { category: string; description: string; findings: string[]; recommendations: string }> = {
  '1': { category: 'PI-RADS 1', description: '极低概率', findings: ['无明确病变'], recommendations: '常规随访' },
  '2': { category: 'PI-RADS 2', description: '低概率', findings: ['T2WI 低信号病变', 'DWI 无高信号'], recommendations: '常规随访' },
  '3': { category: 'PI-RADS 3', description: '中等概率', findings: ['DWI 轻度高信号', '边界不清'], recommendations: '6-12个月随访MRI' },
  '4': { category: 'PI-RADS 4', description: '高概率', findings: ['DWI 明显高信号', 'ADC 低信号'], recommendations: '建议MRI引导活检' },
  '5': { category: 'PI-RADS 5', description: '极高概率', findings: ['T2WI 低信号实性病变 > 1.5cm', 'DWI 明显受限', 'ADC 显著降低'], recommendations: '立即活检' },
}

const mockHistoryStore = new Map<string, RadsHistoryEntry[]>()

function generateRandomHistory(patientId: string): RadsHistoryEntry[] {
  const now = Date.now()
  const types = ['Lung-RADS', 'BI-RADS', 'PI-RADS'] as const
  const scores = { 'Lung-RADS': ['1', '2', '3', '4A', '4B', '4X'], 'BI-RADS': ['0', '1', '2', '3', '4A', '4B', '4C', '5', '6'], 'PI-RADS': ['1', '2', '3', '4', '5'] }
  const result: RadsHistoryEntry[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now - i * 35 * 86400000 + Math.floor(Math.random() * 5 * 86400000))
    const type = types[i % 3]
    const s = scores[type]
    const sc = s[Math.min(Math.floor(Math.random() * s.length), s.length - 1)]
    result.push({ date: d.toISOString().slice(0, 10), score: sc, category: `${type} ${sc}`, confidence: +(0.75 + Math.random() * 0.2).toFixed(2) })
  }
  return result
}

@Injectable()
export class CadRadsService {
  private confidence = 0.88

  scoreLung(dicomFields: Record<string, unknown>): RadsScore {
    const size = dicomFields.noduleSizeMm ?? Math.floor(Math.random() * 20) + 2
    let score = '1'
    if (size > 15) score = '4B'
    else if (size > 8) score = '4A'
    else if (size > 6) score = '3'
    else if (size > 0) score = '2'
    if (dicomFields.spiculatedMargin && size >= 8) score = '4X'
    const entry = lungRadss[score] ?? lungRadss['1']
    return { ...entry, score, confidence: this.confidence }
  }

  scoreBreast(dicomFields: Record<string, unknown>): RadsScore {
    const biradsKeys = Object.keys(biRads)
    const score = dicomFields.biradsCategory ?? biradsKeys[Math.floor(Math.random() * biradsKeys.length)]
    const entry = biRads[score] ?? biRads['1']
    return { ...entry, score, confidence: this.confidence }
  }

  scoreProstate(dicomFields: Record<string, unknown>): RadsScore {
    const p = Math.random()
    let score = '1'
    if (p > 0.95) score = '5'
    else if (p > 0.85) score = '4'
    else if (p > 0.7) score = '3'
    else if (p > 0.5) score = '2'
    const entry = piRads[score] ?? piRads['1']
    return { ...entry, score, confidence: this.confidence }
  }

  getHistory(patientId: string): RadsHistoryEntry[] {
    if (!mockHistoryStore.has(patientId)) {
      mockHistoryStore.set(patientId, generateRandomHistory(patientId))
    }
    return mockHistoryStore.get(patientId)!
  }
}
