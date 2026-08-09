// [W1-B] 心脏 AI 真实数据适配器: cardiacAiApi (/ai-diagnosis/cardiac-ai) → 演示页数据模型 (CardiacAnalysis)
// 供 CardiacSpecialtyPage / CvDatabasePage 复用; 真实接口不可用时页面回退 cardiacSpecialtyApi (MOCK_ONLY 演示)
import type { CardiacAiResult } from '../../services/api/cardiacAiApi'
import type { CardiacAnalysis, CoronarySegment, CalciumScore, VentricularFunction } from '../../services/api/cardiacSpecialtyApi'

export function mapCardiacAiToAnalysis(r: CardiacAiResult): CardiacAnalysis {
  const modality = (r.modality === 'MR' ? 'CMR' : 'CCTA') as CardiacAnalysis['modality']
  const segments: CoronarySegment[] = (r.stenosis ?? []).map(s => ({
    segment: (`${s.vessel} ${s.segment}`) as CoronarySegment['segment'],
    stenosisPercent: s.stenosisPercent,
    stenosisSeverity: s.severity,
    plaqueType: s.calcified ? 'calcified' : 'non-calcified',
    lengthMm: 0,
  }))
  const calciumMeas = (r.measurements ?? []).find(m => m.parameter.includes('钙化'))
  const calciumScore: CalciumScore | undefined = calciumMeas
    ? { totalAgatston: calciumMeas.value, lm: 0, lad: 0, lcx: 0, rca: 0, percentile: 0 }
    : undefined
  const lvFunction: VentricularFunction | undefined = r.ejectionFraction != null
    ? { chamber: 'LV', edvMl: r.lvVolume ?? 0, esvMl: 0, efPercent: r.ejectionFraction, strokeVolumeMl: 0 }
    : undefined
  const status = r.status === 'confirmed' || r.status === 'reviewed'
    ? 'reviewed' as const
    : r.status === 'auto'
      ? 'analyzing' as const
      : 'scheduled' as const
  return {
    id: r.id,
    patientId: r.studyId,
    patientName: r.patientName,
    modality,
    studyDate: (r.createdAt ?? '').slice(0, 10),
    coronarySegments: segments,
    calciumScore,
    lvFunction,
    valves: [],
    cadRads: (r.cadRads ?? 'N') as CardiacAnalysis['cadRads'],
    status,
  }
}

/** 尝试加载真实 cardiacAiApi 结果, 失败/为空返回 null (调用方回退演示数据) */
export async function loadCardiacAiAnalyses(): Promise<CardiacAnalysis[] | null> {
  try {
    const res = await import('../../services/api/cardiacAiApi').then(m => m.cardiacAiApi.listResults())
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      return res.data.map(mapCardiacAiToAnalysis)
    }
  } catch {
    /* 真实接口不可用 → null, 页面回退演示数据 */
  }
  return null
}
