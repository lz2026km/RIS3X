/**
 * G005 v3.0.6.11-70 - 确定性哈希工具
 * FNV-1a: 同输入恒定输出, 用于替换业务随机数 (Math.random)
 */

export function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** 取第 n 个 0-31 位哈希切片 (同一 hash 派生多个独立确定性值) */
export function hashSlice(hash: number, n: number): number {
  return (hash >>> ((n % 8) * 4)) & 0xffff
}

/** 确定性整数: [min, max] 闭区间 */
export function intInRange(input: string, min: number, max: number, salt = 0): number {
  const h = hashString(`${salt}:${input}`)
  return min + (h % (max - min + 1))
}

/** 确定性浮点: [min, max) 区间, 保留 precision 位小数 */
export function floatInRange(input: string, min: number, max: number, salt = 0, precision = 2): number {
  const h = hashString(`${salt}:${input}`)
  const value = min + (h / 0xffffffff) * (max - min)
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

/** 确定性抖动系数: 围绕 1.0 的 ±maxJitter 比例 */
export function jitterFactor(input: string, maxJitter = 0.1, salt = 0): number {
  const h = hashString(`${salt}:${input}`)
  const pct = (h / 0xffffffff) * 2 * maxJitter - maxJitter
  return 1 + pct
}
