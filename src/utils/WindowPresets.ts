/**
 * WindowPresets.ts
 * DICOM窗宽窗位预设表 - 按检查类型+部位分类
 */

// 窗宽窗位预设类型
export interface WindowPreset {
  name: string
  ww: number // Window Width
  wl: number // Window Level
  category: string
  description?: string
}

// 检查部位类型
export type BodyPart = 'HEAD' | 'CHEST' | 'ABDOMEN' | 'SPINE' | 'LIMB' | 'PELVIS' | 'MAMMOGRAPHY' | 'CARDIAC' | 'ANGIO' | 'UNKNOWN'

// 所有窗宽窗位预设
export const WINDOW_PRESETS: WindowPreset[] = [
  // ========== 头部 (HEAD) ==========
  {
    name: '脑窗',
    ww: 80,
    wl: 40,
    category: 'HEAD',
    description: '脑组织窗',
  },
  {
    name: '骨窗',
    ww: 2000,
    wl: 500,
    category: 'HEAD',
    description: '颅骨骨窗',
  },
  {
    name: '软组织窗',
    ww: 400,
    wl: 40,
    category: 'HEAD',
    description: '头部软组织',
  },

  // ========== 胸部 (CHEST) ==========
  {
    name: '肺窗',
    ww: 1500,
    wl: -600,
    category: 'CHEST',
    description: '肺部纵隔窗',
  },
  {
    name: '纵隔窗',
    ww: 400,
    wl: 40,
    category: 'CHEST',
    description: '纵隔软组织窗',
  },
  {
    name: '骨窗',
    ww: 2000,
    wl: 400,
    category: 'CHEST',
    description: '胸部骨骼',
  },

  // ========== 腹部 (ABDOMEN) ==========
  {
    name: '肝窗',
    ww: 150,
    wl: 50,
    category: 'ABDOMEN',
    description: '肝脏窗',
  },
  {
    name: '腹窗',
    ww: 350,
    wl: 50,
    category: 'ABDOMEN',
    description: '腹部常规窗',
  },
  {
    name: '骨窗',
    ww: 2000,
    wl: 400,
    category: 'ABDOMEN',
    description: '腹部骨骼',
  },

  // ========== 脊柱 (SPINE) ==========
  {
    name: '脊柱窗',
    ww: 1800,
    wl: 400,
    category: 'SPINE',
    description: '脊柱椎体窗',
  },

  // ========== 四肢 (LIMB) ==========
  {
    name: '四肢窗',
    ww: 2000,
    wl: 500,
    category: 'LIMB',
    description: '四肢骨窗',
  },

  // ========== 骨盆 (PELVIS) ==========
  {
    name: '骨盆窗',
    ww: 1800,
    wl: 400,
    category: 'PELVIS',
    description: '骨盆窗',
  },

  // ========== 乳腺 (MAMMOGRAPHY) ==========
  {
    name: '乳腺窗',
    ww: 400,
    wl: 300,
    category: 'MAMMOGRAPHY',
    description: '乳腺钼靶窗',
  },

  // ========== 心脏 (CARDIAC) ==========
  {
    name: '心脏窗',
    ww: 350,
    wl: 50,
    category: 'CARDIAC',
    description: '心脏增强窗',
  },

  // ========== 肝脏增强 (LIVER CONTRAST) ==========
  {
    name: '肝脏增强窗',
    ww: 200,
    wl: 60,
    category: 'ABDOMEN',
    description: '肝脏增强扫描窗',
  },

  // ========== 血管 (ANGIO) ==========
  {
    name: '血管窗',
    ww: 600,
    wl: 200,
    category: 'ANGIO',
    description: '血管造影窗',
  },

  // ========== 眼眶 (ORBIT) ==========
  {
    name: '眼眶窗',
    ww: 300,
    wl: 50,
    category: 'HEAD',
    description: '眼眶软组织窗',
  },
]

// 根据部位获取预设
export function getPresetsByBodyPart(bodyPart: string): WindowPreset[] {
  const normalized = bodyPart.toUpperCase()
  return WINDOW_PRESETS.filter(
    (p) => p.category.toUpperCase() === normalized || normalized.includes(p.category)
  )
}

// 根据Modality+BodyPart智能推荐预设
export function getRecommendedPresets(modality: string, bodyPart: string): WindowPreset[] {
  const normalizedBodyPart = bodyPart.toUpperCase()

  // CT 默认推荐
  if (modality === 'CT') {
    if (normalizedBodyPart.includes('HEAD') || normalizedBodyPart.includes('脑')) {
      return WINDOW_PRESETS.filter((p) => p.category === 'HEAD')
    }
    if (normalizedBodyPart.includes('CHEST') || normalizedBodyPart.includes('胸')) {
      return WINDOW_PRESETS.filter((p) => p.category === 'CHEST')
    }
    if (normalizedBodyPart.includes('ABDOMEN') || normalizedBodyPart.includes('腹')) {
      return WINDOW_PRESETS.filter((p) => p.category === 'ABDOMEN')
    }
    if (normalizedBodyPart.includes('SPINE') || normalizedBodyPart.includes('脊柱')) {
      return WINDOW_PRESETS.filter((p) => p.category === 'SPINE')
    }
    if (normalizedBodyPart.includes('LIMB') || normalizedBodyPart.includes('四肢')) {
      return WINDOW_PRESETS.filter((p) => p.category === 'LIMB')
    }
    if (normalizedBodyPart.includes('PELVIS') || normalizedBodyPart.includes('骨盆')) {
      return WINDOW_PRESETS.filter((p) => p.category === 'PELVIS')
    }
    if (normalizedBodyPart.includes('MAMMO') || normalizedBodyPart.includes('乳腺')) {
      return WINDOW_PRESETS.filter((p) => p.category === 'MAMMOGRAPHY')
    }
    if (normalizedBodyPart.includes('CARDIAC') || normalizedBodyPart.includes('心脏')) {
      return WINDOW_PRESETS.filter((p) => p.category === 'CARDIAC' || p.name === '心脏窗')
    }
    if (normalizedBodyPart.includes('ANGIO') || normalizedBodyPart.includes('血管')) {
      return WINDOW_PRESETS.filter((p) => p.category === 'ANGIO' || p.name === '血管窗')
    }
    if (normalizedBodyPart.includes('ORBIT') || normalizedBodyPart.includes('眼眶')) {
      return WINDOW_PRESETS.filter((p) => p.name === '眼眶窗')
    }
  }

  // MR 默认推荐
  if (modality === 'MR') {
    return WINDOW_PRESETS.filter(
      (p) => p.name === '软组织窗' || p.name === '脑窗'
    )
  }

  // DR/XR 默认推荐骨窗
  if (modality === 'DR' || modality === 'XR') {
    return WINDOW_PRESETS.filter((p) => p.name === '骨窗')
  }

  // 默认返回常用预设
  return WINDOW_PRESETS.slice(0, 3)
}

// 获取默认窗宽窗位
export function getDefaultWindowPreset(modality: string, bodyPart: string): WindowPreset {
  const presets = getRecommendedPresets(modality, bodyPart)
  return presets[0] ?? { name: '默认', ww: 400, wl: 40, category: 'UNKNOWN' }
}

// 标准化BodyPart
export function normalizeBodyPart(bodyPart: string): BodyPart {
  const normalized = bodyPart.toUpperCase()
  if (normalized.includes('HEAD') || normalized.includes('脑') || normalized.includes('ORBIT')) return 'HEAD'
  if (normalized.includes('CHEST') || normalized.includes('胸') || normalized.includes('CARDIAC')) return 'CHEST'
  if (normalized.includes('ABDOMEN') || normalized.includes('腹') || normalized.includes('LIVER')) return 'ABDOMEN'
  if (normalized.includes('SPINE') || normalized.includes('脊柱')) return 'SPINE'
  if (normalized.includes('LIMB') || normalized.includes('四肢')) return 'LIMB'
  if (normalized.includes('PELVIS') || normalized.includes('骨盆')) return 'PELVIS'
  if (normalized.includes('MAMMO') || normalized.includes('乳腺')) return 'MAMMOGRAPHY'
  if (normalized.includes('ANGIO') || normalized.includes('血管')) return 'ANGIO'
  return 'UNKNOWN'
}
