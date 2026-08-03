/**
 * v3.0.6.11-60: 多 RADS 评分 MSW handlers
 * 与后端 backend/src/modules/cad/cad-rads.controller.ts 对齐 (/api/v1/ai/cad/rads/*)
 * 覆盖 lung / breast / prostate / pi-rads / li-rads / ti-rads + history
 */
import { http, HttpResponse, delay } from 'msw'

const API_BASE = '/api/v1'

const PI_DICTS: Record<string, { category: string; description: string; findings: string[]; recommendations: string }> = {
  '1': { category: 'PI-RADS 1', description: '极低概率', findings: ['无明确病变'], recommendations: '常规随访' },
  '2': { category: 'PI-RADS 2', description: '低概率', findings: ['T2WI 低信号病变', 'DWI 无高信号'], recommendations: '常规随访' },
  '3': { category: 'PI-RADS 3', description: '中等概率', findings: ['DWI 轻度高信号', '边界不清'], recommendations: '6-12个月随访MRI' },
  '4': { category: 'PI-RADS 4', description: '高概率', findings: ['DWI 明显高信号', 'ADC 低信号'], recommendations: '建议MRI引导活检' },
  '5': { category: 'PI-RADS 5', description: '极高概率', findings: ['T2WI 低信号实性病变 > 1.5cm', 'DWI 明显受限', 'ADC 显著降低'], recommendations: '立即活检' },
}

const LI_DICTS: Record<string, { category: string; description: string; findings: string[]; recommendations: string }> = {
  'LR-1': { category: 'LI-RADS LR-1', description: '肯定良性', findings: ['无增强的单纯囊肿/血管瘤'], recommendations: '常规随访' },
  'LR-2': { category: 'LI-RADS LR-2', description: '可能良性', findings: ['小病灶无高危特征'], recommendations: '6个月常规随访' },
  'LR-3': { category: 'LI-RADS LR-3', description: 'HCC 中度概率', findings: ['动脉期非环状强化但无廓清'], recommendations: '3-6个月增强MR/CT随访' },
  'LR-4': { category: 'LI-RADS LR-4', description: 'HCC 高度概率', findings: ['≥10mm 动脉期非环状强化+廓清'], recommendations: '多学科会诊，考虑活检' },
  'LR-5': { category: 'LI-RADS LR-5', description: '肯定 HCC', findings: ['≥10mm 动脉期非环状强化+廓清+包膜'], recommendations: '多学科会诊，启动HCC治疗路径' },
  'LR-M': { category: 'LI-RADS LR-M', description: '可能恶性(非HCC)', findings: ['环状动脉强化', '靶样廓清'], recommendations: '建议活检明确病理' },
  'LR-TIV': { category: 'LI-RADS LR-TIV', description: '肿瘤侵犯静脉', findings: ['静脉内软组织充盈缺损'], recommendations: '立即多学科会诊' },
}

const TI_DICTS: Record<string, { category: string; description: string; findings: string[]; recommendations: string }> = {
  'TR1': { category: 'TI-RADS TR1', description: '良性', findings: ['纯囊性/海绵状结节'], recommendations: '无需FNA，常规随访' },
  'TR2': { category: 'TI-RADS TR2', description: '不可疑', findings: ['基本良性特征'], recommendations: '无需FNA，常规随访' },
  'TR3': { category: 'TI-RADS TR3', description: '轻度可疑', findings: ['低风险组合特征'], recommendations: '≥2.5cm 建议FNA' },
  'TR4': { category: 'TI-RADS TR4', description: '中度可疑', findings: ['中等风险组合特征'], recommendations: '≥1.5cm 建议FNA' },
  'TR5': { category: 'TI-RADS TR5', description: '高度可疑', findings: ['实性低回声+毛刺/显著钙化'], recommendations: '≥1cm 建议FNA' },
}

function piRads(fields: Record<string, unknown>) {
  const zone = String(fields.lesionZone ?? 'PZ')
  const size = Number(fields.lesionSizeMm) || 0
  const dwi = String(fields.dwiSignal ?? 'low')
  const t2 = String(fields.t2Signal ?? 'low')
  const adc = Number(fields.adcValue) || 0
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
  const entry = PI_DICTS[score] ?? PI_DICTS['3']
  return { ...entry, score, confidence: 0.88 }
}

function liRads(fields: Record<string, unknown>) {
  const size = Number(fields.sizeMm) || 0
  const arterial = String(fields.arterialPhaseEnhancement ?? 'none')
  const washout = String(fields.washout ?? 'no')
  const capsule = String(fields.enhancingCapsule ?? 'no')
  const growth = String(fields.thresholdGrowth ?? 'no')
  const tiv = String(fields.tumorInVein ?? 'no')
  const obsType = String(fields.observationType ?? 'nodule')
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
  const entry = LI_DICTS[score] ?? LI_DICTS['LR-2']
  return { ...entry, score, confidence: 0.88 }
}

function tiRads(fields: Record<string, unknown>) {
  const composition = String(fields.composition ?? 'mixed')
  const echogenicity = String(fields.echogenicity ?? 'iso')
  const shape = String(fields.shape ?? 'wider-than-tall')
  const margins = String(fields.margins ?? 'smooth')
  const foci = String(fields.echogenicFoci ?? 'none')
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
  const entry = TI_DICTS[score] ?? TI_DICTS['TR3']
  return {
    ...entry,
    score,
    confidence: 0.88,
    findings: [`成分: ${composition}, 回声: ${echogenicity}, 形态: ${shape}`, `边缘: ${margins}, 钙化灶: ${foci}`, `ACR 计分: ${points} 分`],
  }
}

export const radsHandlers = [
  http.post(`${API_BASE}/ai/cad/rads/lung`, async ({ request }) => {
    await delay(120)
    const fields = (await request.json()) as Record<string, unknown>
    const size = Number(fields.noduleSizeMm)
    let score = '1'
    if (Number.isFinite(size)) {
      if (size > 15) score = '4B'
      else if (size > 8) score = '4A'
      else if (size > 6) score = '3'
      else if (size > 0) score = '2'
      if (fields.spiculatedMargin && size >= 8) score = '4X'
    }
    const dict: Record<string, string[]> = {
      '1': ['无肺结节'], '2': ['实性结节 ≤ 6mm'], '3': ['实性结节 6-8mm'],
      '4A': ['实性结节 8-15mm'], '4B': ['实性结节 > 15mm'], '4X': ['分叶状或毛刺状边缘'],
    }
    return HttpResponse.json({
      success: true,
      data: {
        category: `Lung-RADS ${score}`,
        score,
        description: '肺部结节分级',
        confidence: 0.88,
        findings: dict[score] ?? [],
        recommendations: score >= '4A' ? '3个月低剂量CT随访或PET-CT' : '12个月低剂量CT随访',
      },
    })
  }),
  http.post(`${API_BASE}/ai/cad/rads/breast`, async ({ request }) => {
    await delay(120)
    const fields = (await request.json()) as Record<string, unknown>
    const score = String(fields.biradsCategory ?? '1')
    return HttpResponse.json({
      success: true,
      data: { category: `BI-RADS ${score}`, score, description: '乳腺影像报告分级', confidence: 0.88, findings: ['乳腺影像评估'], recommendations: '常规筛查随访' },
    })
  }),
  http.post(`${API_BASE}/ai/cad/rads/prostate`, async ({ request }) => {
    await delay(120)
    const result = piRads((await request.json()) as Record<string, unknown>)
    return HttpResponse.json({ success: true, data: result })
  }),
  http.post(`${API_BASE}/ai/cad/rads/pi-rads`, async ({ request }) => {
    await delay(120)
    return HttpResponse.json({ success: true, data: piRads((await request.json()) as Record<string, unknown>) })
  }),
  http.post(`${API_BASE}/ai/cad/rads/li-rads`, async ({ request }) => {
    await delay(120)
    return HttpResponse.json({ success: true, data: liRads((await request.json()) as Record<string, unknown>) })
  }),
  http.post(`${API_BASE}/ai/cad/rads/ti-rads`, async ({ request }) => {
    await delay(120)
    return HttpResponse.json({ success: true, data: tiRads((await request.json()) as Record<string, unknown>) })
  }),
  http.get(`${API_BASE}/ai/cad/rads/history/:patientId`, async ({ params }) => {
    await delay(120)
    const now = Date.now()
    const types = ['Lung-RADS', 'BI-RADS', 'PI-RADS'] as const
    const scores = ['1', '2', '3', '4A', '4B', '4X']
    const history = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now - (5 - i) * 35 * 86400000)
      return {
        date: d.toISOString().slice(0, 10),
        score: scores[(i * 2 + Number(String(params.patientId).slice(-1))) % scores.length]!,
        category: `${types[i % 3]} ${scores[i % scores.length]}`,
        confidence: 0.82 + (i % 3) * 0.05,
      }
    })
    return HttpResponse.json({ success: true, data: history })
  }),
]
