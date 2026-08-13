// [G005 v3.0.6.11-91 Wave 4A (PACS P0-3)] GSOF 灰阶标准显示函数 (DICOM PS3.14)
// 实现: 用 JND (Just Noticeable Difference) 索引表逼近标准灰度标准显示函数曲线。
//   - jND(L): Barten 模型多项式 (PS3.14 正向公式)
//   - L(j):   二分法求逆 (避免记忆/编码逆系数, 数值稳定)
//   - GSOF LUT: 显示器 DDL (0..1023) 按感知线性 (Lmin→Lmax 指数) 展开,
//     映射到 JND 归一化区间 [0,1] → 校准后显示值
// 对比度档位: standard (标准) / enhanced (增强) / soft (柔和)

export type GsofMode = 'standard' | 'enhanced' | 'soft'

export interface GsofOptions {
  minLuminance: number
  maxLuminance: number
  lutSteps: number
}

export const GSOF_DEFAULT_OPTIONS: GsofOptions = {
  minLuminance: 0.05, // cd/m² (DICOM 标准显示函数推荐最低亮度)
  maxLuminance: 4000, // cd/m² (高亮度诊断显示器)
  lutSteps: 1024,
}

/** DICOM PS3.14 Barten 模型正向系数 (j = f(log10 L)) */
const JND_COEFFS = [
  71.498068,
  94.593053,
  41.912053,
  9.8247004,
  0.28175407,
  -1.1878455,
  -0.18014349,
  0.14710899,
  -0.017046845,
]

/** 对比度档位 → 输出 gamma (对 GSOF 曲线后的显示值施加) */
const MODE_GAMMA: Record<GsofMode, number> = {
  standard: 1,
  enhanced: 0.8, // 提升中低灰度对比度 (观片更"硬")
  soft: 1.25,    // 压低对比度, 更柔和 (轻微提亮阴影)
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** DICOM PS3.14: JND 索引 = f(亮度 cd/m²) (Barten 模型) */
export function jndIndexOfLuminance(luminance: number): number {
  const l = Math.max(1e-6, luminance)
  const x = Math.log10(l)
  let j = 0
  for (let i = JND_COEFFS.length - 1; i >= 0; i--) j = j * x + JND_COEFFS[i]!
  return j
}

/** 逆函数: 给定 JND 索引求亮度 (在 [minL, maxL] 对数空间二分) */
export function luminanceOfJnd(jnd: number, minL = GSOF_DEFAULT_OPTIONS.minLuminance, maxL = GSOF_DEFAULT_OPTIONS.maxLuminance): number {
  const target = Math.max(0, jnd)
  let lo = Math.log10(minL)
  let hi = Math.log10(maxL)
  for (let iter = 0; iter < 64; iter++) {
    const mid = (lo + hi) / 2
    const j = jndIndexOfLuminance(Math.pow(10, mid))
    if (j < target) lo = mid
    else hi = mid
  }
  return Math.pow(10, (lo + hi) / 2)
}

/**
 * 构建 GSOF LUT: 输入 DDL 归一化值 (0..1, 感知线性) → 校准后显示值 (0..1)
 * DDL 按亮度感知线性展开 (L = Lmin*(Lmax/Lmin)^ddl), 经 JND 表映射归一化。
 */
export function buildGsofLut(options: Partial<GsofOptions> = {}): Float64Array {
  const { minLuminance, maxLuminance, lutSteps } = { ...GSOF_DEFAULT_OPTIONS, ...options }
  const lut = new Float64Array(lutSteps)
  const jMin = jndIndexOfLuminance(minLuminance)
  const jMax = jndIndexOfLuminance(maxLuminance)
  const ratio = maxLuminance / minLuminance
  for (let i = 0; i < lutSteps; i++) {
    const ddl = i / (lutSteps - 1)
    const L = minLuminance * Math.pow(ratio, ddl)
    const j = clamp01((jndIndexOfLuminance(L) - jMin) / (jMax - jMin))
    lut[i] = j
  }
  return lut
}

const lutCache = new Map<string, Float64Array>()

function getGsofLut(options: Partial<GsofOptions> = {}): Float64Array {
  const key = `${options.lutSteps ?? GSOF_DEFAULT_OPTIONS.lutSteps}:${options.minLuminance ?? GSOF_DEFAULT_OPTIONS.minLuminance}:${options.maxLuminance ?? GSOF_DEFAULT_OPTIONS.maxLuminance}`
  const hit = lutCache.get(key)
  if (hit) return hit
  const lut = buildGsofLut(options)
  lutCache.set(key, lut)
  return lut
}

/** 线性插值查询 LUT */
function sampleLut(lut: Float64Array, x: number): number {
  const n = lut.length - 1
  const scaled = clamp01(x) * n
  const idx = Math.floor(scaled)
  const frac = scaled - idx
  const a = lut[idx]!
  const b = lut[Math.min(idx + 1, n)]!
  return a + (b - a) * frac
}

/**
 * 核心: 对已窗宽窗位归一化后的灰度 (0..1) 施加 GSOF 校准
 * @param gray01 窗宽窗位映射后的显示值 (0..1)
 * @param mode 对比度档位 (standard/enhanced/soft)
 * @returns 校准后显示值 (0..1)
 */
export function applyGSOFToGray(gray01: number, mode: GsofMode = 'standard'): number {
  const lut = getGsofLut()
  const gamma = MODE_GAMMA[mode] ?? 1
  return clamp01(Math.pow(sampleLut(lut, clamp01(gray01)), gamma))
}

/**
 * 核心入口: 对原始像素值施加 窗宽窗位 + GSOF 校准
 * @param pixelValue 原始像素值 (如 CT HU 或原始灰度)
 * @param ww 窗宽
 * @param wl 窗位
 * @param mode 对比度档位
 * @returns 校准后显示值 (0..1)
 */
export function applyGSOF(pixelValue: number, ww: number, wl: number, mode: GsofMode = 'standard'): number {
  const width = Math.max(1, ww)
  const norm = clamp01((pixelValue - (wl - width / 2)) / width)
  return applyGSOFToGray(norm, mode)
}

/** 档位中文标签 */
export const GSOF_MODE_LABELS: Record<GsofMode, string> = {
  standard: '标准',
  enhanced: '增强',
  soft: '柔和',
}

export const GSOF_DOC_TEXT = 'GSOF 灰阶标准显示函数 (DICOM PS3.14): 以 JND 索引表逼近标准显示函数曲线, 保证不同显示器上灰阶感知一致。在窗宽窗位预设基础上叠加校准。'
