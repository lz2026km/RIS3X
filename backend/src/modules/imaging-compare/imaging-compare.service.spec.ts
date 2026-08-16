/**
 * [G005 v3.0.6.11-101 Wave 2A (imaging-compare)] 差异指标计算正确性 spec
 * 纯函数验证:
 * - computeDifferenceMetrics: 完全一致 → meanDiff/histogramDiff/hotRegionRatio = 0
 * - 恒定偏移 → hotRegionRatio 全像素, meanDiff = 偏移值, histogramDiff = 0
 * - 混入噪声 → 热区占比 > 0 且 < 1, 方差差异符合预期
 * - generatePixelMatrix: 确定性 (同 seed 两次调用结果一致, 不同 seed 结果不同)
 */
import { computeDifferenceMetrics, generatePixelMatrix } from './imaging-compare.service'

describe('ImagingCompareService 差异指标计算正确性', () => {
  const size = 32
  const base = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => (x * 7 + y * 13) % 256),
  )

  it('完全一致的两张图: 均值差/方差差/直方图差/热区占比均为 0', () => {
    const identical = base.map((row) => [...row])
    const m = computeDifferenceMetrics(base, identical)
    expect(m.meanDiff).toBe(0)
    expect(m.varianceDiff).toBe(0)
    expect(m.histogramDiff).toBe(0)
    expect(m.hotRegionRatio).toBe(0)
    expect(m.changedPixelCount).toBe(0)
    expect(m.pixelCount).toBe(size * size)
    expect(m.meanA).toBe(m.meanB)
    expect(m.stdDevA).toBe(m.stdDevB)
  })

  it('恒定偏移 Δ=64: meanDiff=-64 (B 整体上移), 全部像素超过阈值 → 热区占比 1.0, 方差不变 (平移不变)', () => {
    const shifted = base.map((row) => row.map((v) => Math.min(4095, v + 64)))
    const m = computeDifferenceMetrics(base, shifted, 24)
    expect(m.meanDiff).toBe(-64)
    expect(m.hotRegionRatio).toBe(1)
    expect(m.changedPixelCount).toBe(size * size)
    expect(m.varianceA).toBe(m.varianceB)
    expect(m.stdDevA).toBe(m.stdDevB)
    // 固定 bin 直方图非平移不变: 边界 bin 有少量像素迁移, 但远未到完全不相交 (1.0)
    expect(m.histogramDiff).toBeGreaterThan(0)
    expect(m.histogramDiff).toBeLessThan(1)
  })

  it('阈值提高后恒定小偏移不再计入热区', () => {
    const shifted = base.map((row) => row.map((v) => v + 10))
    const strict = computeDifferenceMetrics(base, shifted, 5)
    const loose = computeDifferenceMetrics(base, shifted, 32)
    expect(strict.changedPixelCount).toBe(size * size)
    expect(loose.changedPixelCount).toBe(0)
    expect(loose.hotRegionRatio).toBe(0)
  })

  it('混入局部热区: 热区占比 0 < r < 1 且直方图差异 > 0', () => {
    const noisy = base.map((row, y) =>
      row.map((v, x) => (y >= size / 2 && x >= size / 2 ? v + 300 : v)),
    )
    const m = computeDifferenceMetrics(base, noisy, 24)
    expect(m.changedPixelCount).toBe((size / 2) * (size / 2))
    expect(m.hotRegionRatio).toBeCloseTo(0.25, 4)
    expect(m.histogramDiff).toBeGreaterThan(0)
    expect(m.meanDiff).toBeLessThan(0)
    expect(m.varianceB).toBeGreaterThan(m.varianceA)
  })

  it('generatePixelMatrix 确定性: 同 seed 一致, 不同 seed/模态不同', () => {
    const a1 = generatePixelMatrix('uid-a:slice-0', size, 'CT')
    const a2 = generatePixelMatrix('uid-a:slice-0', size, 'CT')
    const b = generatePixelMatrix('uid-b:slice-0', size, 'CT')
    expect(a1).toEqual(a2)
    expect(JSON.stringify(a1)).not.toBe(JSON.stringify(b))
    const pt = generatePixelMatrix('uid-a:slice-0', size, 'PT')
    expect(JSON.stringify(pt)).not.toBe(JSON.stringify(a1))
    expect(a1.length).toBe(size)
    expect(a1[0]!.length).toBe(size)
    for (const row of a1) {
      for (const v of row) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(4095)
      }
    }
  })

  it('尺寸不匹配抛 BadRequestException', () => {
    const bad = base.map((row) => [...row, 1])
    expect(() => computeDifferenceMetrics(base, bad)).toThrow()
  })
})
