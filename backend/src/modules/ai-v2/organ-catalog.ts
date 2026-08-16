/**
 * G005 RIS v3.0.6.11-101 Wave 3C - AI 增强 (多器官自动检出)
 * 器官目录: 8 类器官的灰度统计特征 (CT HU 窗口/对比度期望) + 体积参考 + 解剖区域比
 * 所有值仅用于确定性模拟推理的规则输入, 不读取真实像素。
 */

export type OrganCode =
  | 'lung'
  | 'liver'
  | 'kidney'
  | 'spleen'
  | 'pancreas'
  | 'heart'
  | 'gallbladder'
  | 'thyroid'

export interface OrganDef {
  code: OrganCode
  label: string
  /** 期望灰度均值 (CT: HU) */
  expectedHu: number
  /** 窗口拟合容差: |mean - expectedHu| 在此内视为高分 */
  huTolerance: number
  /** 期望灰度标准差 (软组织对比度) */
  expectedContrast: number
  /** 体积参考范围 (mL) */
  volumeMin: number
  volumeMax: number
  /** 解剖区域中心相对位置 (0-1, 512 归一化) */
  regionX: number
  regionY: number
  regionW: number
  regionH: number
  /** 可见部位 (bodyPart 大小写不敏感) */
  bodyParts: string[]
  /** 无 bodyPart 信息时的默认检出集合 */
  defaultDetectable: boolean
}

export const ORGAN_CATALOG: OrganDef[] = [
  { code: 'lung', label: '肺', expectedHu: -650, huTolerance: 350, expectedContrast: 260, volumeMin: 2800, volumeMax: 6200, regionX: 0.5, regionY: 0.45, regionW: 0.6, regionH: 0.5, bodyParts: ['CHEST', 'WHOLE BODY'], defaultDetectable: true },
  { code: 'liver', label: '肝', expectedHu: 55, huTolerance: 45, expectedContrast: 45, volumeMin: 950, volumeMax: 2100, regionX: 0.42, regionY: 0.58, regionW: 0.38, regionH: 0.3, bodyParts: ['ABDOMEN', 'WHOLE BODY'], defaultDetectable: true },
  { code: 'kidney', label: '肾', expectedHu: 30, huTolerance: 25, expectedContrast: 20, volumeMin: 120, volumeMax: 210, regionX: 0.5, regionY: 0.72, regionW: 0.5, regionH: 0.22, bodyParts: ['ABDOMEN', 'PELVIS', 'WHOLE BODY'], defaultDetectable: true },
  { code: 'spleen', label: '脾', expectedHu: 48, huTolerance: 30, expectedContrast: 25, volumeMin: 110, volumeMax: 260, regionX: 0.28, regionY: 0.6, regionW: 0.22, regionH: 0.24, bodyParts: ['ABDOMEN', 'WHOLE BODY'], defaultDetectable: false },
  { code: 'pancreas', label: '胰', expectedHu: 42, huTolerance: 25, expectedContrast: 22, volumeMin: 55, volumeMax: 120, regionX: 0.45, regionY: 0.63, regionW: 0.3, regionH: 0.12, bodyParts: ['ABDOMEN', 'WHOLE BODY'], defaultDetectable: false },
  { code: 'heart', label: '心脏', expectedHu: 40, huTolerance: 40, expectedContrast: 90, volumeMin: 550, volumeMax: 950, regionX: 0.48, regionY: 0.42, regionW: 0.4, regionH: 0.34, bodyParts: ['CHEST', 'CARDIAC', 'WHOLE BODY'], defaultDetectable: true },
  { code: 'gallbladder', label: '胆囊', expectedHu: 10, huTolerance: 20, expectedContrast: 15, volumeMin: 25, volumeMax: 90, regionX: 0.4, regionY: 0.55, regionW: 0.14, regionH: 0.16, bodyParts: ['ABDOMEN', 'WHOLE BODY'], defaultDetectable: false },
  { code: 'thyroid', label: '甲状腺', expectedHu: 80, huTolerance: 50, expectedContrast: 60, volumeMin: 8, volumeMax: 25, regionX: 0.5, regionY: 0.16, regionW: 0.24, regionH: 0.1, bodyParts: ['NECK', 'CHEST', 'WHOLE BODY'], defaultDetectable: false },
]

export const ORGAN_BY_CODE: Record<OrganCode, OrganDef> = Object.fromEntries(
  ORGAN_CATALOG.map((o) => [o.code, o]),
) as Record<OrganCode, OrganDef>

export const ORGAN_LABELS: Record<OrganCode, string> = Object.fromEntries(
  ORGAN_CATALOG.map((o) => [o.code, o.label]),
) as Record<OrganCode, string>

/** 灰度均值期望区间 (CT): 按部位派生, 用于无像素统计时的确定性回退 */
export function expectedMeanRange(modality: string, bodyPart?: string): { min: number; max: number } {
  const m = modality.toUpperCase()
  const bp = (bodyPart ?? '').toUpperCase()
  if (m === 'MR') return { min: 500, max: 1200 }
  if (m === 'US') return { min: 30, max: 180 }
  if (bp === 'CHEST') return { min: -700, max: -300 }
  if (bp === 'ABDOMEN') return { min: 20, max: 120 }
  if (bp === 'HEAD') return { min: 20, max: 80 }
  return { min: -300, max: 300 }
}

/** 灰度标准差期望区间: 按部位派生 */
export function expectedContrastRange(modality: string, bodyPart?: string): { min: number; max: number } {
  const m = modality.toUpperCase()
  const bp = (bodyPart ?? '').toUpperCase()
  if (m === 'MR') return { min: 150, max: 500 }
  if (bp === 'CHEST') return { min: 120, max: 380 }
  if (bp === 'ABDOMEN') return { min: 40, max: 120 }
  if (bp === 'HEAD') return { min: 40, max: 110 }
  return { min: 60, max: 200 }
}
