// [G005 W7] 确定性伪随机工具 — 让演示/模拟数据在刷新后保持稳定 (不抖动)
// 用途: KPI 图表 / IHE 测试结果 / DICOM 合成噪声等本地演示数据的稳定化。

/** FNV-1a 字符串哈希 (uint32) */
export function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 PRNG — 同一种子产生相同序列 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 由字符串键得到稳定的 [0, 1) 随机数 */
export function seededUnit(key: string): number {
  return mulberry32(hashSeed(key))()
}

/** 由字符串键得到稳定的 [min, max) 浮点数 */
export function seededBetween(key: string, min: number, max: number): number {
  return min + seededUnit(key) * (max - min)
}

/** 由字符串键得到稳定的 [min, max] 整数 */
export function seededInt(key: string, min: number, max: number): number {
  return Math.floor(seededBetween(key, min, max + 1))
}
