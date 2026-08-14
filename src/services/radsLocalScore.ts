/**
 * v3.0.6.11-99 G-20: 多 RADS 本地规则回退
 * 与后端 cad-rads.service.ts 确定性评分保持一致; 仅当 /ai/cad/rads/score 失败时兜底
 */
import type { RadsScore } from './api/radsApi'

export type RadsType = 'lung' | 'breast' | 'prostate' | 'liver' | 'thyroid'

const DICTS: Record<string, Record<string, { category: string; description: string; findings: string[]; recommendations: string }>> = {
  lung: {
    '1': { category: 'Lung-RADS 1', description: '阴性', findings: ['无肺结节'], recommendations: '常规随访' },
    '2': { category: 'Lung-RADS 2', description: '良性结节', findings: ['实性结节 ≤ 6mm'], recommendations: '12个月低剂量CT随访' },
    '3': { category: 'Lung-RADS 3', description: '可能良性', findings: ['实性结节 6-8mm'], recommendations: '6个月低剂量CT随访' },
    '4A': { category: 'Lung-RADS 4A', description: '可疑恶性', findings: ['实性结节 8-15mm'], recommendations: '3个月低剂量CT随访 或 PET-CT' },
    '4B': { category: 'Lung-RADS 4B', description: '高度可疑', findings: ['实性结节 > 15mm'], recommendations: '立即胸外科会诊 或 PET-CT' },
    '4X': { category: 'Lung-RADS 4X', description: '提示高度可疑', findings: ['分叶状或毛刺状边缘'], recommendations: '建议活检 或 手术切除' },
  },
  breast: {
    '0': { category: 'BI-RADS 0', description: '评估未完成', findings: ['需要补充影像学检查'], recommendations: '建议进一步影像学检查（超声/MRI）' },
    '1': { category: 'BI-RADS 1', description: '阴性', findings: ['乳腺影像正常'], recommendations: '常规筛查随访' },
    '2': { category: 'BI-RADS 2', description: '良性发现', findings: ['良性钙化', '纤维腺瘤', '单纯囊肿'], recommendations: '常规筛查随访' },
    '3': { category: 'BI-RADS 3', description: '可能良性', findings: ['形态规则肿块'], recommendations: '6个月短期随访' },
    '4A': { category: 'BI-RADS 4A', description: '低度可疑恶性', findings: ['部分边缘模糊肿块'], recommendations: '建议穿刺活检' },
    '4B': { category: 'BI-RADS 4B', description: '中度可疑恶性', findings: ['形态不规则肿块'], recommendations: '建议穿刺活检' },
    '4C': { category: 'BI-RADS 4C', description: '高度可疑恶性', findings: ['边缘毛刺肿块'], recommendations: '建议穿刺活检' },
    '5': { category: 'BI-RADS 5', description: '高度提示恶性', findings: ['典型恶性形态', '毛刺征'], recommendations: '立即活检并多学科会诊' },
    '6': { category: 'BI-RADS 6', description: '已活检证实恶性', findings: ['已通过活检证实恶性'], recommendations: '制定治疗方案' },
  },
  prostate: {
    '1': { category: 'PI-RADS 1', description: '极低概率', findings: ['无明确病变'], recommendations: '常规随访' },
    '2': { category: 'PI-RADS 2', description: '低概率', findings: ['T2WI 低信号病变', 'DWI 无高信号'], recommendations: '常规随访' },
    '3': { category: 'PI-RADS 3', description: '中等概率', findings: ['DWI 轻度高信号'], recommendations: '6-12个月随访MRI' },
    '4': { category: 'PI-RADS 4', description: '高概率', findings: ['DWI 明显高信号', 'ADC 低信号'], recommendations: '建议MRI引导活检' },
    '5': { category: 'PI-RADS 5', description: '极高概率', findings: ['T2WI 低信号实性病变 > 1.5cm', 'DWI 明显受限'], recommendations: '立即活检' },
  },
  liver: {
    'LR-1': { category: 'LI-RADS LR-1', description: '肯定良性', findings: ['无增强的单纯囊肿/血管瘤'], recommendations: '常规随访' },
    'LR-2': { category: 'LI-RADS LR-2', description: '可能良性', findings: ['小病灶无高危特征'], recommendations: '6个月常规随访' },
    'LR-3': { category: 'LI-RADS LR-3', description: 'HCC 中度概率', findings: ['动脉期非环状强化但无廓清'], recommendations: '3-6个月增强MR/CT随访' },
    'LR-4': { category: 'LI-RADS LR-4', description: 'HCC 高度概率', findings: ['≥10mm 动脉期非环状强化+廓清'], recommendations: '多学科会诊，考虑活检' },
    'LR-5': { category: 'LI-RADS LR-5', description: '肯定 HCC', findings: ['≥10mm 动脉期非环状强化+廓清+包膜'], recommendations: '多学科会诊，启动HCC治疗路径' },
    'LR-M': { category: 'LI-RADS LR-M', description: '可能恶性(非HCC)', findings: ['环状动脉强化'], recommendations: '建议活检明确病理' },
    'LR-TIV': { category: 'LI-RADS LR-TIV', description: '肿瘤侵犯静脉', findings: ['静脉内软组织充盈缺损'], recommendations: '立即多学科会诊' },
  },
  thyroid: {
    'TR1': { category: 'TI-RADS TR1', description: '良性', findings: ['纯囊性/海绵状结节'], recommendations: '无需FNA，常规随访' },
    'TR2': { category: 'TI-RADS TR2', description: '不可疑', findings: ['基本良性特征'], recommendations: '无需FNA，常规随访' },
    'TR3': { category: 'TI-RADS TR3', description: '轻度可疑', findings: ['低风险组合特征'], recommendations: '≥2.5cm 建议FNA' },
    'TR4': { category: 'TI-RADS TR4', description: '中度可疑', findings: ['中等风险组合特征'], recommendations: '≥1.5cm 建议FNA' },
    'TR5': { category: 'TI-RADS TR5', description: '高度可疑', findings: ['实性低回声+毛刺/显著钙化'], recommendations: '≥1cm 建议FNA' },
  },
}

const toSize = (v: unknown, fallback: number): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

type DictEntry = { category: string; description: string; findings: string[]; recommendations: string }

function entryOf(type: keyof typeof DICTS, key: string, fallback: string): DictEntry {
  const dict = DICTS[type]
  return (dict?.[key] ?? dict?.[fallback]) as DictEntry
}

function scoreLungLocal(f: Record<string, unknown>): RadsScore {
  const size = toSize(f.noduleSizeMm, 0)
  let score = '1'
  if (size > 15) score = '4B'
  else if (size > 8) score = '4A'
  else if (size > 6) score = '3'
  else if (size > 0) score = '2'
  if (f.spiculatedMargin && size >= 8) score = '4X'
  const entry = entryOf('lung', score, '1')
  return { ...entry, score, level: score, confidence: 0.88 }
}

function scoreProstateLocal(f: Record<string, unknown>): RadsScore {
  const zone = String(f.lesionZone ?? 'PZ')
  const size = toSize(f.lesionSizeMm, 0)
  const dwi = String(f.dwiSignal ?? 'low')
  const t2 = String(f.t2Signal ?? 'low')
  const adc = toSize(f.adcValue, 0)
  let score = '2'
  if (zone === 'TZ') {
    if (t2 === 'low' && size >= 15) score = '5'
    else if (t2 === 'low' && (dwi === 'high' || size >= 10)) score = '4'
    else if (t2 === 'mild' || dwi === 'mild') score = '3'
    else score = '2'
  } else {
    if (dwi === 'high' && (size >= 15 || (adc > 0 && adc <= 800))) score = '5'
    else if (dwi === 'high') score = '4'
    else if (dwi === 'mild') score = '3'
    else score = '2'
  }
  if (zone === 'AFS' && ['1', '2'].includes(score)) score = '3'
  const entry = entryOf('prostate', score, '3')
  return { ...entry, score, level: score, confidence: 0.88 }
}

function scoreLiverLocal(f: Record<string, unknown>): RadsScore {
  const size = toSize(f.sizeMm, 0)
  const arterial = String(f.arterialPhaseEnhancement ?? 'none')
  const washout = String(f.washout ?? 'no')
  const capsule = String(f.enhancingCapsule ?? 'no')
  const growth = String(f.thresholdGrowth ?? 'no')
  const tiv = String(f.tumorInVein ?? 'no')
  const obsType = String(f.observationType ?? 'nodule')
  let score = 'LR-1'
  if (tiv === 'yes') score = 'LR-TIV'
  else if (arterial === 'rim' || arterial === 'nodule-in-nodule' || arterial === 'corona') score = size >= 10 ? 'LR-M' : 'LR-3'
  else if (obsType === 'nonnodular') score = size >= 20 && washout === 'yes' ? 'LR-4' : 'LR-3'
  else if (arterial === 'nonrim' && size >= 20 && washout === 'yes' && capsule === 'yes') score = 'LR-5'
  else if (arterial === 'nonrim' && size >= 10 && washout === 'yes') score = capsule === 'yes' || growth === 'yes' ? 'LR-5' : 'LR-4'
  else if (arterial === 'nonrim' && size >= 10 && growth === 'yes') score = 'LR-5'
  else if (arterial === 'nonrim' || washout === 'yes' || capsule === 'yes' || growth === 'yes') score = 'LR-3'
  else if (size > 0 && size < 10) score = 'LR-3'
  else if (obsType === 'cystic' || arterial === 'none') score = 'LR-1'
  else score = 'LR-2'
  const entry = entryOf('liver', score, 'LR-2')
  return { ...entry, score, level: score, confidence: 0.88 }
}

function scoreThyroidLocal(f: Record<string, unknown>): RadsScore {
  const composition = String(f.composition ?? 'mixed')
  const echogenicity = String(f.echogenicity ?? 'iso')
  const shape = String(f.shape ?? 'wider-than-tall')
  const margins = String(f.margins ?? 'smooth')
  const foci = String(f.echogenicFoci ?? 'none')
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
  const entry = entryOf('thyroid', score, 'TR3')
  return {
    ...entry,
    score,
    level: score,
    confidence: 0.88,
    findings: [`成分: ${composition}, 回声: ${echogenicity}, 形态: ${shape}`, `边缘: ${margins}, 钙化灶: ${foci}`, `ACR 计分: ${points} 分`],
  }
}

/** 本地确定性评分 (后端不可达时兜底) */
export function scoreRadsLocally(type: RadsType, findings: Record<string, unknown>): RadsScore {
  switch (type) {
    case 'lung': return scoreLungLocal(findings)
    case 'breast': {
      const score = String(findings.biradsCategory ?? '2')
      const entry = entryOf('breast', score, '2')
      return { ...entry, score, level: score, confidence: 0.88 }
    }
    case 'prostate': return scoreProstateLocal(findings)
    case 'liver': return scoreLiverLocal(findings)
    case 'thyroid': return scoreThyroidLocal(findings)
  }
}
