/**
 * [G005 v3.0.6.11-85 Wave 4B (G-12)] AI 浜屾妫€鍑哄彔鍔? 妫€鍑虹粨鏋滃綊涓€鍖?+ 鍔犺浇
 * 缁熶竴 lung-cad / breast-cad / fracture-cad / cardiac-ai 鍥涙ā鍨嬫鍑轰负 AiFinding:
 *   - 绌洪棿妫€鍑?(鑲虹粨鑺?涔宠吅鐥呭彉/楠ㄦ姌) 鈫?box 鐧惧垎姣斿潗鏍?(512脳512 褰卞儚绌洪棿)
 *   - 闈炵┖闂存鍑?(蹇冭剰鐙獎) 鈫?鏍囨敞鐐?(鍗犱綅妗?
 * 鎸夊綋鍓?study/patient 鍖归厤; 鏈懡涓椂鍥為€€棣栦釜缁撴灉骞舵爣璁?demo (淇濊瘉瑙嗚闂幆)
 */
import { aiDiagnosisApi, type AiDiagnosisModelKey } from '../../services/api/aiDiagnosisApi'
import type { DicomWebStudy } from '../../services/api/dicomApi'

export interface AiFindingBox {
  /** 0-100 鐧惧垎姣斿潗鏍?*/
  x: number
  y: number
  width: number
  height: number
}

export interface AiFinding {
  id: string
  model: AiDiagnosisModelKey
  modelLabel: string
  resultId: string
  /** 鐥呯伓绫诲瀷 */
  label: string
  /** 鐥呯伓缁嗚妭 (灏哄/瀵嗗害/閮ㄤ綅绛? */
  detail: string
  /** 缃俊搴?0-1 */
  confidence: number
  risk: string
  suggestion: string
  box?: AiFindingBox
  sliceLocation?: number
  /** 闈炲綋鍓?study 鐨勬紨绀哄洖閫€鏁版嵁 */
  demo: boolean
}

const IMG_SIZE = 512
const pct = (v: number): number => Math.max(0, Math.min(100, (Number.isFinite(v) ? v : 0) / IMG_SIZE) * 100)
const conf = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0
}

/** 妯℃€?鈫?鍊欓€?AI 妯″瀷 */
export const MODALITY_AI_MODELS: Record<string, AiDiagnosisModelKey[]> = {
  CT: ['lung-cad', 'cardiac-ai'],
  MR: ['cardiac-ai'],
  MG: ['breast-cad'],
  DR: ['fracture-cad'],
  DX: ['fracture-cad'],
}

const MODEL_LABELS: Record<AiDiagnosisModelKey, string> = {
  'lung-cad': '鑲虹粨鑺?CAD',
  'breast-cad': '涔宠吅 CAD',
  'fracture-cad': '楠ㄦ姌 CAD',
  'cardiac-ai': '蹇冭剰 AI',
}

/** 鎸?studyId 鈫?patientName 鈫?棣栦釜缁撴灉 渚濇鍥為€€ */
function pickResult(
  list: any[],
  studyUid?: string,
  patientName?: string,
): { result: any; demo: boolean } | null {
  if (!Array.isArray(list) || list.length === 0) return null
  const byStudy = list.find((r) => r?.studyId && studyUid && String(r.studyId) === String(studyUid))
  if (byStudy) return { result: byStudy, demo: false }
  const byPatient = list.find((r) => r?.patientName && patientName && String(r.patientName) === String(patientName))
  if (byPatient) return { result: byPatient, demo: true }
  return { result: list[0], demo: true }
}

function normalizeLung(r: any): Array<Omit<AiFinding, 'model' | 'modelLabel'>> {
  const nodules: any[] = Array.isArray(r?.nodules) ? r.nodules : []
  return nodules.map((n) => {
    const diameter = Number(n?.diameter) || 0
    const size = Math.max(diameter * 3, 20)
    const cx = Number(n?.x) || 0
    const cy = Number(n?.y) || 0
    return {
      id: String(n?.id ?? `lung-${r.id}-${Math.random().toString(36).slice(2, 8)}`),
      resultId: String(r.id),
      label: `鑲虹粨鑺?(${String(n?.density ?? 'solid')})`,
      detail: `鐩村緞 ${diameter}mm 路 浣撶Н ${Number(n?.volume) || '-'}mm鲁 路 鐗瑰緛: ${(n?.characteristics ?? []).join(' / ') || '-'}`,
      confidence: conf(n?.malignancyRisk),
      risk: String(r?.overallRisk ?? ''),
      suggestion: String(r?.recommendation ?? ''),
      box: { x: pct(cx - size / 2), y: pct(cy - size / 2), width: pct(size), height: pct(size) },
      sliceLocation: Number(n?.sliceLocation) || undefined,
      demo: false,
    }
  })
}

function normalizeBreast(r: any): Array<Omit<AiFinding, 'model' | 'modelLabel'>> {
  const lesions: any[] = Array.isArray(r?.lesions) ? r.lesions : []
  return lesions.map((l) => ({
    id: String(l?.id ?? `breast-${r.id}-${Math.random().toString(36).slice(2, 8)}`),
    resultId: String(r.id),
    label: `涔宠吅鐥呭彉 (${String(l?.type ?? 'mass')})`,
    detail: `${String(l?.view ?? '')} 路 BI-RADS ${String(l?.biRads ?? '-')} 路 ${String(l?.shape ?? '')}/${String(l?.margin ?? '')}`,
    confidence: conf(l?.malignancyRisk),
    risk: `BI-RADS ${String(l?.biRads ?? '-')}`,
    suggestion: String(r?.recommendation ?? ''),
    box: { x: pct(Number(l?.x) || 0), y: pct(Number(l?.y) || 0), width: pct(Number(l?.width) || 24), height: pct(Number(l?.height) || 20) },
    demo: false,
  }))
}

function normalizeFracture(r: any): Array<Omit<AiFinding, 'model' | 'modelLabel'>> {
  const fractures: any[] = Array.isArray(r?.fractures) ? r.fractures : []
  return fractures.map((f) => {
    const bb = f?.boundingBox ?? {}
    return {
      id: String(f?.id ?? `fx-${r.id}-${Math.random().toString(36).slice(2, 8)}`),
      resultId: String(r.id),
      label: `楠ㄦ姌 (${String(f?.fractureType ?? 'simple')})`,
      detail: `${String(f?.bone ?? '')} ${String(f?.location ?? '')} 路 绉讳綅 ${String(f?.displacement ?? '-')}${f?.jointInvolvement ? ' 路 绱強鍏宠妭' : ''}`,
      confidence: conf(f?.confidence),
      risk: String(r?.severity ?? ''),
      suggestion: String(r?.recommendation ?? ''),
      box: { x: pct(Number(bb?.x) || 0), y: pct(Number(bb?.y) || 0), width: pct(Number(bb?.width) || 60), height: pct(Number(bb?.height) || 50) },
      demo: false,
    }
  })
}

function normalizeCardiac(r: any): Array<Omit<AiFinding, 'model' | 'modelLabel'>> {
  const stenosis: any[] = Array.isArray(r?.stenosis) ? r.stenosis : []
  const findings: Array<Omit<AiFinding, 'model' | 'modelLabel'>> = stenosis.map((s, i) => ({
    id: String(s?.id ?? `cardiac-${r.id}-${i + 1}`),
    resultId: String(r.id),
    label: `琛€绠＄嫮绐?(${String(s?.severity ?? 'normal')})`,
    detail: `${String(s?.vessel ?? '')} ${String(s?.segment ?? '')} 路 鐙獎 ${Number(s?.stenosisPercent) || '-'}%${s?.calcified ? ' 路 閽欏寲鏂戝潡' : ''}`,
    confidence: (Number(s?.stenosisPercent) || 0) / 100,
    risk: String(s?.severity ?? ''),
    suggestion: String(r?.recommendation ?? ''),
    box: { x: 36 + (i % 2) * 30, y: 18 + i * 16, width: 24, height: 10 },
    demo: false,
  }))
  if (findings.length === 0 && (r?.ejectionFraction != null || r?.overallAssessment)) {
    findings.push({
      id: `cardiac-${r.id}-summary`,
      resultId: String(r.id),
      label: '蹇冭剰鍔熻兘璇勪及',
      detail: `EF ${Number(r.ejectionFraction) || '-'}%${r?.cadRads ? ` 路 CAD-RADS ${String(r.cadRads)}` : ''} 路 ${String(r?.overallAssessment ?? '')}`,
      confidence: 0,
      risk: '璇勪及',
      suggestion: String(r?.recommendation ?? ''),
      box: { x: 36, y: 18, width: 28, height: 10 },
      demo: false,
    })
  }
  return findings
}

function normalizeForModel(model: AiDiagnosisModelKey, r: any): AiFinding[] {
  const findings =
    model === 'lung-cad'
      ? normalizeLung(r)
      : model === 'breast-cad'
        ? normalizeBreast(r)
        : model === 'fracture-cad'
          ? normalizeFracture(r)
          : normalizeCardiac(r)
  return findings.map((f) => ({ ...f, model, modelLabel: MODEL_LABELS[model] ?? model }))
}

/**
 * 鎸夊綋鍓?study 鎷夊彇鍊欓€夋ā鍨嬬殑妫€鍑虹粨鏋滃苟褰掍竴鍖? * @param study 褰撳墠閫変腑妫€鏌?(studyInstanceUID / patientName 鐢ㄤ簬鍖归厤)
 * @param modality 褰撳墠妯℃€? */
export async function loadAiFindings(study: DicomWebStudy | undefined, modality: string): Promise<AiFinding[]> {
  const models = MODALITY_AI_MODELS[modality?.toUpperCase() ?? ''] ?? []
  const findings: AiFinding[] = []
  for (const model of models) {
    try {
      const res = await aiDiagnosisApi.listResults<any>(model)
      if (!res.success || !Array.isArray(res.data)) continue
      const picked = pickResult(res.data, study?.studyInstanceUID, study?.patientName)
      if (!picked) continue
      const normalized = normalizeForModel(model, picked.result)
      normalized.forEach((f) => { f.demo = f.demo || picked.demo })
      findings.push(...normalized)
    } catch {
      // 妯″瀷涓嶅彲鐢?鍔犺浇澶辫触 鈫?璺宠繃璇ユā鍨? 鍏朵綑妯″瀷缁х画
    }
  }
  return findings
}
