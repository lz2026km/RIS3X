/**
 * G005 RIS v3.0.6.11-101 Wave 3C - AI 增强 (智能挂片协议)
 * 确定性规则表: 检查类型/序列 → 挂片布局 (行列 + 每格窗宽/窗位 + 序列键)。
 * 规则静态可测: 同 (modality, bodyPart) 恒定输出同一布局。
 */

export interface HangingCellDef {
  label: string
  seriesKey: string
  windowWidth?: number
  windowCenter?: number
}

export interface HangingRuleDef {
  id: string
  modality: string
  bodyPart: string
  name: string
  rows: number
  cols: number
  cells: HangingCellDef[]
  priority: number
  description: string
}

export const HANGING_RULES: HangingRuleDef[] = [
  {
    id: 'hp-ct-chest',
    modality: 'CT',
    bodyPart: 'CHEST',
    name: 'CT 胸部 肺窗+纵隔窗',
    rows: 2,
    cols: 2,
    cells: [
      { label: '轴位-肺窗', seriesKey: '肺窗', windowWidth: 1500, windowCenter: -600 },
      { label: '轴位-纵隔窗', seriesKey: '纵隔窗', windowWidth: 350, windowCenter: 40 },
      { label: '冠状位-肺窗', seriesKey: '冠状位', windowWidth: 1500, windowCenter: -600 },
      { label: '矢状位-纵隔窗', seriesKey: '矢状位', windowWidth: 350, windowCenter: 40 },
    ],
    priority: 100,
    description: 'CT 胸部常规: 肺窗/纵隔窗双窗 2×2 同层对比',
  },
  {
    id: 'hp-mr-head',
    modality: 'MR',
    bodyPart: 'HEAD',
    name: 'MR 头颅 多序列',
    rows: 2,
    cols: 3,
    cells: [
      { label: 'T1WI', seriesKey: 'T1', windowWidth: 900, windowCenter: 500 },
      { label: 'T2WI', seriesKey: 'T2', windowWidth: 1200, windowCenter: 600 },
      { label: 'FLAIR', seriesKey: 'FLAIR', windowWidth: 1200, windowCenter: 600 },
      { label: 'DWI', seriesKey: 'DWI', windowWidth: 1400, windowCenter: 700 },
      { label: 'T1WI增强', seriesKey: 'T1增强', windowWidth: 900, windowCenter: 500 },
      { label: 'SWI', seriesKey: 'SWI', windowWidth: 1100, windowCenter: 500 },
    ],
    priority: 100,
    description: 'MR 头颅: T1/T2/FLAIR/DWI/T1增强/SWI 六序列 2×3',
  },
  {
    id: 'hp-ct-head',
    modality: 'CT',
    bodyPart: 'HEAD',
    name: 'CT 头颅 脑窗+骨窗',
    rows: 1,
    cols: 2,
    cells: [
      { label: '脑窗', seriesKey: '脑窗', windowWidth: 80, windowCenter: 40 },
      { label: '骨窗', seriesKey: '骨窗', windowWidth: 4000, windowCenter: 700 },
    ],
    priority: 95,
    description: 'CT 头颅常规: 脑窗+骨窗双窗 1×2',
  },
  {
    id: 'hp-dr-chest',
    modality: 'DR',
    bodyPart: 'CHEST',
    name: 'DR 胸部 正侧位',
    rows: 1,
    cols: 2,
    cells: [
      { label: '胸部正位', seriesKey: '正位', windowWidth: 2600, windowCenter: 1400 },
      { label: '胸部侧位', seriesKey: '侧位', windowWidth: 2600, windowCenter: 1400 },
    ],
    priority: 95,
    description: 'DR 胸部: 正位+侧位 1×2',
  },
  {
    id: 'hp-ct-abdomen',
    modality: 'CT',
    bodyPart: 'ABDOMEN',
    name: 'CT 腹部 平扫+增强四期',
    rows: 2,
    cols: 2,
    cells: [
      { label: '平扫', seriesKey: '平扫', windowWidth: 350, windowCenter: 40 },
      { label: '动脉期', seriesKey: '动脉期', windowWidth: 350, windowCenter: 40 },
      { label: '门脉期', seriesKey: '门脉期', windowWidth: 350, windowCenter: 40 },
      { label: '延迟期', seriesKey: '延迟期', windowWidth: 350, windowCenter: 40 },
    ],
    priority: 90,
    description: 'CT 腹部: 平扫+动脉/门脉/延迟三期 2×2 四期对比',
  },
  {
    id: 'hp-mr-spine',
    modality: 'MR',
    bodyPart: 'SPINE',
    name: 'MR 脊柱 矢冠轴',
    rows: 1,
    cols: 3,
    cells: [
      { label: '矢状位', seriesKey: '矢状位', windowWidth: 1100, windowCenter: 550 },
      { label: '冠状位', seriesKey: '冠状位', windowWidth: 1100, windowCenter: 550 },
      { label: '轴位', seriesKey: '轴位', windowWidth: 1100, windowCenter: 550 },
    ],
    priority: 90,
    description: 'MR 脊柱: 矢状+冠状+轴位 1×3',
  },
  {
    id: 'hp-ct-cardiac',
    modality: 'CT',
    bodyPart: 'CARDIAC',
    name: 'CT 冠脉 CTA 工作站布局',
    rows: 2,
    cols: 2,
    cells: [
      { label: '冠脉CTA-MIP', seriesKey: 'CTA', windowWidth: 800, windowCenter: 200 },
      { label: '轴位冠脉', seriesKey: '冠脉', windowWidth: 800, windowCenter: 200 },
      { label: '心功能重建', seriesKey: '心功能', windowWidth: 700, windowCenter: 150 },
      { label: '钙化积分', seriesKey: '钙化', windowWidth: 400, windowCenter: 40 },
    ],
    priority: 85,
    description: 'CT 冠脉: MIP/轴位/心功能/钙化积分 2×2',
  },
  {
    id: 'hp-mr-knee',
    modality: 'MR',
    bodyPart: 'KNEE',
    name: 'MR 膝关节 多序列',
    rows: 2,
    cols: 2,
    cells: [
      { label: '矢状位 PD', seriesKey: '矢状位', windowWidth: 1200, windowCenter: 550 },
      { label: '矢状位 T1', seriesKey: 'T1', windowWidth: 900, windowCenter: 500 },
      { label: '冠状位 PD', seriesKey: '冠状位', windowWidth: 1200, windowCenter: 550 },
      { label: '轴位 PD', seriesKey: '轴位', windowWidth: 1200, windowCenter: 550 },
    ],
    priority: 80,
    description: 'MR 膝关节: 矢冠轴四序列 2×2',
  },
  {
    id: 'hp-ct-neck',
    modality: 'CT',
    bodyPart: 'NECK',
    name: 'CT 颈部 软组织窗+骨窗',
    rows: 1,
    cols: 2,
    cells: [
      { label: '软组织窗', seriesKey: '软组织窗', windowWidth: 350, windowCenter: 40 },
      { label: '骨窗', seriesKey: '骨窗', windowWidth: 4000, windowCenter: 700 },
    ],
    priority: 80,
    description: 'CT 颈部: 软组织窗+骨窗 1×2',
  },
  {
    id: 'hp-us-abdomen',
    modality: 'US',
    bodyPart: 'ABDOMEN',
    name: 'US 腹部 双区扫查',
    rows: 1,
    cols: 2,
    cells: [
      { label: '肝右叶', seriesKey: '肝', windowWidth: 255, windowCenter: 127 },
      { label: '胰脾区', seriesKey: '胰', windowWidth: 255, windowCenter: 127 },
    ],
    priority: 70,
    description: 'US 腹部: 肝右叶 + 胰脾区 1×2',
  },
  {
    id: 'hp-fallback',
    modality: '*',
    bodyPart: '*',
    name: '默认 单视野',
    rows: 1,
    cols: 1,
    cells: [{ label: '首序列', seriesKey: '' }],
    priority: 0,
    description: '兜底布局: 无匹配规则时的单视野',
  },
]

export function findHangingRule(modality: string, bodyPart?: string): HangingRuleDef {
  const m = modality.toUpperCase()
  const bp = (bodyPart ?? '').toUpperCase()
  const exact = HANGING_RULES.find(
    (r) => r.modality === m && r.bodyPart === bp && r.id !== 'hp-fallback',
  )
  if (exact) return exact
  const modalityOnly = HANGING_RULES.find(
    (r) => r.modality === m && r.bodyPart === '*' && r.id !== 'hp-fallback',
  )
  if (modalityOnly) return modalityOnly
  const fallback = HANGING_RULES.find((r) => r.id === 'hp-fallback')
  return fallback ?? HANGING_RULES[0]!
}
