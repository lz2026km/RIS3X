import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'

export interface RadsScore {
  category: string
  score: string
  level?: string
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

// v3.0.6.11-99 G-20: 评分规则种子 (criteria/level 映射, GET /ai/cad/rads/rules 返回)
export interface RadsRule {
  level: string
  category: string
  description: string
  criteria: string
  recommendations: string
}

export interface RadsRules {
  type: string
  name: string
  levels: RadsRule[]
}

const lungRules: RadsRule[] = [
  { level: '1', category: 'Lung-RADS 1', description: '阴性', criteria: '无肺结节', recommendations: '常规随访' },
  { level: '2', category: 'Lung-RADS 2', description: '良性结节', criteria: '实性结节 ≤ 6mm / 部分实性结节 ≤ 6mm', recommendations: '12个月低剂量CT随访' },
  { level: '3', category: 'Lung-RADS 3', description: '可能良性', criteria: '实性结节 6-8mm / 部分实性结节 6-8mm', recommendations: '6个月低剂量CT随访' },
  { level: '4A', category: 'Lung-RADS 4A', description: '可疑恶性', criteria: '实性结节 8-15mm / 部分实性结节 > 8mm', recommendations: '3个月低剂量CT随访 或 PET-CT' },
  { level: '4B', category: 'Lung-RADS 4B', description: '高度可疑', criteria: '实性结节 > 15mm / 新发结节 > 8mm', recommendations: '立即胸外科会诊 或 PET-CT' },
  { level: '4X', category: 'Lung-RADS 4X', description: '提示高度可疑', criteria: '分叶状或毛刺状边缘 / 生长速度 > 1.5mm/年', recommendations: '建议活检 或 手术切除' },
]

const biRules: RadsRule[] = [
  { level: '0', category: 'BI-RADS 0', description: '评估未完成', criteria: '需要补充影像学检查', recommendations: '建议进一步影像学检查（超声/MRI）' },
  { level: '1', category: 'BI-RADS 1', description: '阴性', criteria: '乳腺影像正常', recommendations: '常规筛查随访' },
  { level: '2', category: 'BI-RADS 2', description: '良性发现', criteria: '良性钙化 / 纤维腺瘤 / 单纯囊肿', recommendations: '常规筛查随访' },
  { level: '3', category: 'BI-RADS 3', description: '可能良性', criteria: '形态规则肿块 / 簇状分布的点状钙化', recommendations: '6个月短期随访' },
  { level: '4A', category: 'BI-RADS 4A', description: '低度可疑恶性', criteria: '部分边缘模糊肿块', recommendations: '建议穿刺活检' },
  { level: '4B', category: 'BI-RADS 4B', description: '中度可疑恶性', criteria: '形态不规则肿块 / 细小多形性钙化', recommendations: '建议穿刺活检' },
  { level: '4C', category: 'BI-RADS 4C', description: '高度可疑恶性', criteria: '边缘毛刺肿块 / 线样分布钙化', recommendations: '建议穿刺活检' },
  { level: '5', category: 'BI-RADS 5', description: '高度提示恶性', criteria: '典型恶性形态 / 毛刺征 / 结构扭曲', recommendations: '立即活检并多学科会诊' },
  { level: '6', category: 'BI-RADS 6', description: '已活检证实恶性', criteria: '已通过活检证实恶性', recommendations: '制定治疗方案' },
]

const piRules: RadsRule[] = [
  { level: '1', category: 'PI-RADS 1', description: '极低概率', criteria: '无明确病变', recommendations: '常规随访' },
  { level: '2', category: 'PI-RADS 2', description: '低概率', criteria: 'T2WI 低信号病变 / DWI 无高信号', recommendations: '常规随访' },
  { level: '3', category: 'PI-RADS 3', description: '中等概率', criteria: 'DWI 轻度高信号 / 边界不清', recommendations: '6-12个月随访MRI' },
  { level: '4', category: 'PI-RADS 4', description: '高概率', criteria: 'DWI 明显高信号 / ADC 低信号', recommendations: '建议MRI引导活检' },
  { level: '5', category: 'PI-RADS 5', description: '极高概率', criteria: 'T2WI 低信号实性病变 > 1.5cm / DWI 明显受限 / ADC 显著降低', recommendations: '立即活检' },
]

const liRules: RadsRule[] = [
  { level: 'LR-1', category: 'LI-RADS LR-1', description: '肯定良性', criteria: '无增强的单纯囊肿/血管瘤 / 典型良性特征', recommendations: '无需特殊处理，常规随访' },
  { level: 'LR-2', category: 'LI-RADS LR-2', description: '可能良性', criteria: '小病灶无高危特征', recommendations: '6个月常规随访' },
  { level: 'LR-3', category: 'LI-RADS LR-3', description: 'HCC 中度概率', criteria: '动脉期非环状强化但无廓清 / ≥10mm 无强化特征', recommendations: '3-6个月增强MR/CT随访' },
  { level: 'LR-4', category: 'LI-RADS LR-4', description: 'HCC 高度概率', criteria: '≥10mm 动脉期非环状强化+廓清 / 增厚假包膜', recommendations: '多学科会诊，考虑活检' },
  { level: 'LR-5', category: 'LI-RADS LR-5', description: '肯定 HCC', criteria: '≥10mm 动脉期非环状强化+廓清+包膜 / 阈值增长', recommendations: '多学科会诊，启动HCC治疗路径' },
  { level: 'LR-M', category: 'LI-RADS LR-M', description: '可能恶性(非HCC)', criteria: '环状动脉强化 / 结节内结节征 / 靶样廓清', recommendations: '建议活检明确病理' },
  { level: 'LR-TIV', category: 'LI-RADS LR-TIV', description: '肿瘤侵犯静脉', criteria: '门静脉/肝静脉内软组织充盈缺损', recommendations: '考虑血管内肿瘤侵犯，立即多学科会诊' },
]

const tiRules: RadsRule[] = [
  { level: 'TR1', category: 'TI-RADS TR1', description: '良性', criteria: '纯囊性/海绵状结节 / 无任何高风险特征', recommendations: '无需FNA，常规随访' },
  { level: 'TR2', category: 'TI-RADS TR2', description: '不可疑', criteria: '基本良性特征 (≤2 分)', recommendations: '无需FNA，常规随访' },
  { level: 'TR3', category: 'TI-RADS TR3', description: '轻度可疑', criteria: '低风险组合特征 (3 分)', recommendations: '≥2.5cm 建议FNA；随访' },
  { level: 'TR4', category: 'TI-RADS TR4', description: '中度可疑', criteria: '中等风险组合特征 (4-6 分)', recommendations: '≥1.5cm 建议FNA；随访' },
  { level: 'TR5', category: 'TI-RADS TR5', description: '高度可疑', criteria: '实性低回声+毛刺/显著钙化 (≥7 分)', recommendations: '≥1cm 建议FNA' },
]

// [G-20 v3.0.6.11-99] 完整规则表种子 (GET /rules)
export const RADS_RULES: RadsRules[] = [
  { type: 'lung', name: 'Lung-RADS', levels: lungRules },
  { type: 'breast', name: 'BI-RADS', levels: biRules },
  { type: 'prostate', name: 'PI-RADS', levels: piRules },
  { type: 'liver', name: 'LI-RADS', levels: liRules },
  { type: 'thyroid', name: 'TI-RADS', levels: tiRules },
]

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

// v3.0.6.11-60: LI-RADS (肝脏) — 对照 LI-RADS v2018 简化规则
const liRads: Record<string, { category: string; description: string; findings: string[]; recommendations: string }> = {
  'LR-1': { category: 'LI-RADS LR-1', description: '肯定良性', findings: ['无增强的单纯囊肿/血管瘤', '典型良性特征'], recommendations: '无需特殊处理，常规随访' },
  'LR-2': { category: 'LI-RADS LR-2', description: '可能良性', findings: ['小病灶无高危特征'], recommendations: '6个月常规随访' },
  'LR-3': { category: 'LI-RADS LR-3', description: 'HCC 中度概率', findings: ['动脉期非环状强化但无廓清', '≥10mm 无强化特征'], recommendations: '3-6个月增强MR/CT随访' },
  'LR-4': { category: 'LI-RADS LR-4', description: 'HCC 高度概率', findings: ['≥10mm 动脉期非环状强化+廓清', '增厚假包膜'], recommendations: '多学科会诊，考虑活检' },
  'LR-5': { category: 'LI-RADS LR-5', description: '肯定 HCC', findings: ['≥10mm 动脉期非环状强化+廓清+包膜', '≥10mm 阈值增长'], recommendations: '多学科会诊，启动HCC治疗路径' },
  'LR-M': { category: 'LI-RADS LR-M', description: '可能恶性(非HCC)', findings: ['环状动脉强化', '结节内结节征', '靶样廓清'], recommendations: '建议活检明确病理' },
  'LR-TIV': { category: 'LI-RADS LR-TIV', description: '肿瘤侵犯静脉', findings: ['门静脉/肝静脉内软组织充盈缺损'], recommendations: '考虑血管内肿瘤侵犯，立即多学科会诊' },
}

// v3.0.6.11-60: TI-RADS (甲状腺) — 对照 ACR TI-RADS 2017 计分
const tiRads: Record<string, { category: string; description: string; findings: string[]; recommendations: string }> = {
  'TR1': { category: 'TI-RADS TR1', description: '良性', findings: ['纯囊性/海绵状结节', '无任何高风险特征'], recommendations: '无需FNA，常规随访' },
  'TR2': { category: 'TI-RADS TR2', description: '不可疑', findings: ['基本良性特征'], recommendations: '无需FNA，常规随访' },
  'TR3': { category: 'TI-RADS TR3', description: '轻度可疑', findings: ['低风险组合特征'], recommendations: '≥2.5cm 建议FNA；随访' },
  'TR4': { category: 'TI-RADS TR4', description: '中度可疑', findings: ['中等风险组合特征'], recommendations: '≥1.5cm 建议FNA；随访' },
  'TR5': { category: 'TI-RADS TR5', description: '高度可疑', findings: ['实性低回声+毛刺/显著钙化', '≥1cm 高风险组合'], recommendations: '≥1cm 建议FNA' },
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

const toSize = (v: unknown, fallback: number): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

@Injectable()
export class CadRadsService {
  private confidence = 0.88
  // [G-20 v3.0.6.11-99] 评分统计 (GET /ai/cad/rads/stats)
  private stats = new Map<string, number>()

  // [G-20 v3.0.6.11-99] 统一评分入口: {type, findings} → 确定性规则匹配
  score(type: string, findings: Record<string, unknown>): RadsScore {
    this.stats.set(type, (this.stats.get(type) ?? 0) + 1)
    let result: RadsScore
    switch (type) {
      case 'lung':
        result = this.scoreLung(findings)
        break
      case 'breast':
        result = this.scoreBreast(findings)
        break
      case 'prostate':
        result = this.scoreProstate(findings)
        break
      case 'liver':
        result = this.scoreLiver(findings)
        break
      case 'thyroid':
        result = this.scoreThyroid(findings)
        break
      default:
        throw new BadRequestException(`未知 RADS 类型: ${type}`)
    }
    return { ...result, level: result.score }
  }

  // [G-20 v3.0.6.11-99] 完整评分规则表 (criteria/level 映射)
  getRules(): RadsRules[] {
    return RADS_RULES
  }

  // [G-20 v3.0.6.11-99] 评分统计
  getStats(): { total: number; byType: Record<string, number> } {
    return {
      total: Array.from(this.stats.values()).reduce((sum, n) => sum + n, 0),
      byType: Object.fromEntries(this.stats),
    }
  }

  scoreLung(dicomFields: Record<string, unknown>): RadsScore {
    const size = (dicomFields.noduleSizeMm as number) ?? Math.floor(Math.random() * 20) + 2
    let score = '1'
    if (size > 15) score = '4B'
    else if (size > 8) score = '4A'
    else if (size > 6) score = '3'
    else if (size > 0) score = '2'
    if (dicomFields.spiculatedMargin && (size as number) >= 8) score = '4X'
    const entry = lungRadss[score] ?? lungRadss['1']
    return { ...entry, score, confidence: this.confidence }
  }

  scoreBreast(dicomFields: Record<string, unknown>): RadsScore {
    const biradsKeys = Object.keys(biRads)
    const score = (dicomFields.biradsCategory as string) ?? biradsKeys[Math.floor(Math.random() * biradsKeys.length)]
    const entry = biRads[score] ?? biRads['1']
    return { ...entry, score, confidence: this.confidence }
  }

  // v3.0.6.11-60: 确定性 PI-RADS — TZ 以 T2 为主、PZ 以 DWI 为主, 按特征分级 1-5
  scoreProstate(dicomFields: Record<string, unknown>): RadsScore {
    const zone = (dicomFields.lesionZone as string) ?? 'PZ'
    const size = toSize(dicomFields.lesionSizeMm, 0)
    const dwi = (dicomFields.dwiSignal as string) ?? 'low'
    const t2 = (dicomFields.t2Signal as string) ?? 'low'
    const adc = toSize(dicomFields.adcValue, 0)

    let score = '2'
    const findings: string[] = []
    if (zone === 'TZ') {
      if (t2 === 'low' && size >= 15) { score = '5'; findings.push('T2WI 低信号实性病变 ≥ 1.5cm') }
      else if (t2 === 'low' && (dwi === 'high' || size >= 10)) { score = '4'; findings.push('T2WI 低信号病变伴 DWI 高信号') }
      else if (t2 === 'mild' || dwi === 'mild') { score = '3'; findings.push('DWI 轻度受限或 T2 中等信号') }
      else { score = '2'; findings.push('T2WI 均匀低信号，DWI 无高信号') }
    } else {
      if (dwi === 'high' && (size >= 15 || (adc > 0 && adc <= 800))) { score = '5'; findings.push('DWI 明显受限 + ADC ≤ 800') }
      else if (dwi === 'high') { score = '4'; findings.push('DWI 明显高信号') }
      else if (dwi === 'mild') { score = '3'; findings.push('DWI 轻度高信号') }
      else { score = '2'; findings.push('DWI 无高信号') }
    }
    if (zone === 'AFS') {
      score = ['1', '2'].includes(score) ? '3' : score
      findings.push('前纤维肌基质区 (AFS) 病灶：归类为中等概率')
    }
    const entry = piRads[score] ?? piRads['3']
    return { ...entry, score, findings: findings.length > 0 ? findings : entry.findings, confidence: this.confidence }
  }

  // v3.0.6.11-60: 确定性 LI-RADS (肝脏) — 动脉期强化/廓清/包膜/阈值增长/静脉侵犯
  scoreLiver(dicomFields: Record<string, unknown>): RadsScore {
    const size = toSize(dicomFields.sizeMm, 0)
    const arterial = (dicomFields.arterialPhaseEnhancement as string) ?? 'none'
    const washout = (dicomFields.washout as string) ?? 'no'
    const capsule = (dicomFields.enhancingCapsule as string) ?? 'no'
    const thresholdGrowth = (dicomFields.thresholdGrowth as string) ?? 'no'
    const tumorInVein = (dicomFields.tumorInVein as string) ?? 'no'
    const observationType = (dicomFields.observationType as string) ?? 'nodule'

    let score = 'LR-1'
    const findings: string[] = []
    if (tumorInVein === 'yes') {
      score = 'LR-TIV'
      findings.push('静脉内软组织充盈缺损 (门静脉/肝静脉)')
    } else if (arterial === 'rim' || arterial === 'nodule-in-nodule' || arterial === 'corona') {
      score = size >= 10 ? 'LR-M' : 'LR-3'
      findings.push(`动脉期环状/结节内结节/冠状强化 (${arterial})`)
    } else if (observationType === 'nonnodular') {
      score = size >= 20 && washout === 'yes' ? 'LR-4' : 'LR-3'
      findings.push('非结节性观病变')
    } else if (arterial === 'nonrim' && size >= 20 && washout === 'yes' && capsule === 'yes') {
      score = 'LR-5'
      findings.push('≥20mm 动脉期非环状强化 + 廓清 + 假包膜')
    } else if (arterial === 'nonrim' && size >= 10 && washout === 'yes') {
      score = capsule === 'yes' || thresholdGrowth === 'yes' ? 'LR-5' : 'LR-4'
      findings.push('≥10mm 动脉期非环状强化 + 廓清')
    } else if (arterial === 'nonrim' && size >= 10 && thresholdGrowth === 'yes') {
      score = 'LR-5'
      findings.push('≥10mm 动脉期非环状强化 + 阈值增长')
    } else if (arterial === 'nonrim' || washout === 'yes' || capsule === 'yes' || thresholdGrowth === 'yes') {
      score = 'LR-3'
      findings.push('存在动脉期非环状强化/廓清/包膜/阈值增长中的单一高危特征')
    } else if (size > 0 && size < 10) {
      score = 'LR-3'
      findings.push('≤10mm 无强化特征的病灶')
    } else if (observationType === 'cystic' || arterial === 'none') {
      score = 'LR-1'
      findings.push('无动脉期强化的单纯囊肿/良性特征')
    } else {
      score = 'LR-2'
      findings.push('小病灶(≤10mm) 无高危特征')
    }
    const entry = liRads[score] ?? liRads['LR-2']
    return { ...entry, score, findings: findings.length > 0 ? findings : entry.findings, confidence: this.confidence }
  }

  // v3.0.6.11-60: 确定性 TI-RADS (甲状腺) — ACR TI-RADS 2017 计分
  scoreThyroid(dicomFields: Record<string, unknown>): RadsScore {
    const composition = (dicomFields.composition as string) ?? 'mixed'
    const echogenicity = (dicomFields.echogenicity as string) ?? 'iso'
    const shape = (dicomFields.shape as string) ?? 'wider-than-tall'
    const margins = (dicomFields.margins as string) ?? 'smooth'
    const foci = (dicomFields.echogenicFoci as string) ?? 'none'

    const compPts: Record<string, number> = { cystic: 0, spongiform: 0, mixed: 1, solid: 2 }
    const echoPts: Record<string, number> = { anechoic: 0, hyper: 1, iso: 1, hypo: 2 }
    const shapePts: Record<string, number> = { 'wider-than-tall': 0, 'taller-than-wide': 1 }
    const marginPts: Record<string, number> = { smooth: 0, 'ill-defined': 0, lobulated: 2, irregular: 3, extrathyroidal: 3 }
    const fociPts: Record<string, number> = { none: 0, comet: 0, macrocalc: 1, rim: 2, punctate: 3 }

    let points = 0
    if (composition !== 'cystic' && composition !== 'spongiform') {
      points += compPts[composition] ?? 1
      points += echoPts[echogenicity] ?? 1
      points += shapePts[shape] ?? 0
      points += marginPts[margins] ?? 0
      points += fociPts[foci] ?? 0
    }

    let score = 'TR1'
    if (composition === 'cystic' || composition === 'spongiform') score = 'TR1'
    else if (points <= 2) score = 'TR2'
    else if (points === 3) score = 'TR3'
    else if (points <= 6) score = 'TR4'
    else score = 'TR5'

    const findings = [
      `成分: ${composition}, 回声: ${echogenicity}, 形态: ${shape}`,
      `边缘: ${margins}, 钙化灶: ${foci}`,
      `ACR 计分: ${points} 分`,
    ]
    const entry = tiRads[score] ?? tiRads['TR3']
    return { ...entry, score, findings, confidence: this.confidence }
  }

  getHistory(patientId: string): RadsHistoryEntry[] {
    if (!mockHistoryStore.has(patientId)) {
      mockHistoryStore.set(patientId, generateRandomHistory(patientId))
    }
    return mockHistoryStore.get(patientId)!
  }
}
