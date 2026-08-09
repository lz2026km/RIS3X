/**
 * [G005 v3.0.6.11-85 Wave 4B (G-17)] Auto-hanging 共享协议预设常量
 * 供 DicomViewerPro (阅片工作流) 与 HangingProtocolPage (协议管理) 复用:
 *   - 布局模板 (1x1 / 1x2 / 2x1 / 2x2)
 *   - 内置协议预设 (布局 + 序列顺序 + 按模态/部位匹配规则)
 *   - 自动匹配: matchHangingProtocols / matchHangingProtocol
 */

export interface HangingLayoutSpec {
  rows: number
  cols: number
  seriesOrder: string[]
}

export interface HangingProtocolPreset {
  id: string
  name: string
  description: string
  modality?: string
  bodyPart?: string
  layout: HangingLayoutSpec
  priority: number
  ww?: number
  wl?: number
}

/** 布局模板: 与 HangingProtocolPage 原有 LAYOUT_PRESETS 结构一致 */
export const LAYOUT_PRESETS: { label: string; layout: HangingLayoutSpec }[] = [
  { label: '1 × 1', layout: { rows: 1, cols: 1, seriesOrder: [] } },
  { label: '1 × 2', layout: { rows: 1, cols: 2, seriesOrder: [] } },
  { label: '2 × 1', layout: { rows: 2, cols: 1, seriesOrder: [] } },
  { label: '2 × 2', layout: { rows: 2, cols: 2, seriesOrder: [] } },
]

/** 内置挂片协议预设 (布局 + 序列顺序 + 匹配规则) */
export const HANGING_PROTOCOL_PRESETS: HangingProtocolPreset[] = [
  {
    id: 'hp-ct-chest', name: 'CT 胸部标准', description: '肺窗/纵隔窗 + 冠状面/矢状面 2×2',
    modality: 'CT', bodyPart: 'CHEST', priority: 200,
    layout: { rows: 2, cols: 2, seriesOrder: ['横断面-肺窗', '横断面-纵隔窗', '冠状面', '矢状面'] },
    ww: 1500, wl: -600,
  },
  {
    id: 'hp-ct-head', name: 'CT 头颅', description: '脑窗 1×1 主序列',
    modality: 'CT', bodyPart: 'HEAD', priority: 150,
    layout: { rows: 1, cols: 1, seriesOrder: [] },
    ww: 80, wl: 40,
  },
  {
    id: 'hp-ct-cardiac', name: '心脏 CTA', description: '轴位 + 冠脉重建 1×2',
    modality: 'CT', bodyPart: 'CARDIAC', priority: 190,
    layout: { rows: 1, cols: 2, seriesOrder: ['轴位', '冠状面'] },
    ww: 600, wl: 200,
  },
  {
    id: 'hp-ct-ortho', name: 'CT 骨关节', description: '骨窗轴位 + 矢状位 1×2',
    modality: 'CT', bodyPart: 'EXTREMITY', priority: 140,
    layout: { rows: 1, cols: 2, seriesOrder: ['横断面', '矢状面'] },
    ww: 2000, wl: 500,
  },
  {
    id: 'hp-ct-default', name: 'CT 常规', description: '轴位 1×1',
    modality: 'CT', priority: 100,
    layout: { rows: 1, cols: 1, seriesOrder: [] },
    ww: 400, wl: 40,
  },
  {
    id: 'hp-mr-brain', name: 'MR 头颅常规', description: 'T1/T2/FLAIR/DWI 2×2',
    modality: 'MR', bodyPart: 'HEAD', priority: 200,
    layout: { rows: 2, cols: 2, seriesOrder: ['T1WI', 'T2WI', 'FLAIR', 'DWI'] },
    ww: 80, wl: 40,
  },
  {
    id: 'hp-mr-spine', name: 'MR 脊柱', description: '矢状 T1/T2 1×2',
    modality: 'MR', bodyPart: 'SPINE', priority: 160,
    layout: { rows: 1, cols: 2, seriesOrder: ['T1WI', 'T2WI'] },
    ww: 80, wl: 40,
  },
  {
    id: 'hp-mr-default', name: 'MR 常规', description: '主序列 1×1',
    modality: 'MR', priority: 100,
    layout: { rows: 1, cols: 1, seriesOrder: [] },
    ww: 80, wl: 40,
  },
  {
    id: 'hp-dr-extremity', name: 'DR 四肢', description: '正位/侧位 1×2',
    modality: 'DR', bodyPart: 'EXTREMITY', priority: 180,
    layout: { rows: 1, cols: 2, seriesOrder: ['正位', '侧位'] },
    ww: 400, wl: 40,
  },
  {
    id: 'hp-dr-default', name: 'DR 常规', description: '单幅 1×1',
    modality: 'DR', priority: 100,
    layout: { rows: 1, cols: 1, seriesOrder: [] },
    ww: 400, wl: 40,
  },
  {
    id: 'hp-mg-default', name: 'MG 乳腺钼靶', description: 'CC/MLO 1×1',
    modality: 'MG', bodyPart: 'BREAST', priority: 150,
    layout: { rows: 1, cols: 1, seriesOrder: [] },
    ww: 400, wl: 300,
  },
]

export const layoutKey = (l: { rows: number; cols: number }): string => `${l.rows}x${l.cols}`

/** 按模态/部位匹配协议 (bodyPart 优先, 再按优先级), 返回按分排序列表 */
export function matchHangingProtocols(modality?: string, bodyPart?: string): HangingProtocolPreset[] {
  const m = modality?.toUpperCase()
  const b = bodyPart?.toUpperCase()
  const candidates = HANGING_PROTOCOL_PRESETS.filter((p) => {
    const modOk = !p.modality || p.modality === m
    const bodyOk = !p.bodyPart || (b != null && p.bodyPart === b)
    return modOk && bodyOk
  })
  return candidates.sort((a, c) => {
    const aBody = b != null && a.bodyPart === b ? 1 : 0
    const cBody = b != null && c.bodyPart === b ? 1 : 0
    if (aBody !== cBody) return cBody - aBody
    return (c.priority ?? 0) - (a.priority ?? 0)
  })
}

/** 最优匹配协议 (自动挂片入口) */
export function matchHangingProtocol(modality?: string, bodyPart?: string): HangingProtocolPreset | null {
  return matchHangingProtocols(modality, bodyPart)[0] ?? null
}

/** 从检查描述猜测部位 (用于 study → bodyPart 自动匹配) */
export function guessBodyPartFromDescription(studyDescription?: string): string | undefined {
  const d = studyDescription ?? ''
  if (d.includes('心脏') || d.includes('冠') || d.includes('CTA')) return 'CARDIAC'
  if (d.includes('胸') || d.includes('肺')) return 'CHEST'
  if (d.includes('头') || d.includes('脑')) return 'HEAD'
  if (d.includes('腹') || d.includes('肝') || d.includes('肾') || d.includes('盆')) return 'ABDOMEN'
  if (d.includes('乳') || d.includes('钼靶')) return 'BREAST'
  if (d.includes('颈')) return 'NECK'
  if (d.includes('四肢') || d.includes('骨') || d.includes('关节') || d.includes('腕') || d.includes('踝')) return 'EXTREMITY'
  return undefined
}
