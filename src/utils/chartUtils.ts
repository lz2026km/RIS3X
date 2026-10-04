/**
 * G005 Radiology RIS - chart helpers (CH-1)
 * Small, pure utilities shared by chart pages to keep rendering deterministic
 * and free of NaN / rounding drift.
 */

/** Percentage of `part` over `total`; 0 for non-finite input or total <= 0. */
export function safePercent(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0
  const pct = (part / total) * 100
  return Number.isFinite(pct) ? pct : 0
}

/**
 * Scale pie values so they sum to exactly 100 (percent).
 * Values are rounded to 2 decimals and the last slice absorbs the remainder
 * so rounding never produces a 99.9% / 100.1% pie.
 */
export function normalizePie<T extends Record<string, unknown>>(
  items: T[],
  valueKey: keyof T & string,
): Array<T & { percent: number }> {
  if (items.length === 0) return []
  const values = items.map((item) => {
    const raw = Number(item[valueKey])
    return Number.isFinite(raw) && raw > 0 ? raw : 0
  })
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total <= 0) {
    return items.map((item) => {
      const next = { ...item, [valueKey]: 0, percent: 0 } as unknown as T & { percent: number }
      return next
    })
  }
  let consumed = 0
  return items.map((item, index) => {
    const isLast = index === items.length - 1
    const percent = isLast
      ? Math.round((100 - consumed) * 100) / 100
      : Math.round((values[index]! / total) * 100 * 100) / 100
    consumed += percent
    return { ...item, [valueKey]: percent, percent } as unknown as T & { percent: number }
  })
}

/** Chronological (ascending) copy of `arr` by Date, optionally on `key`. */
export function dateSort<T>(arr: T[], key?: keyof T): T[] {
  const toTime = (item: T): number => {
    const raw = key ? (item as Record<string, unknown>)[key as string] : item
    const date = raw instanceof Date ? raw : new Date(String(raw))
    const time = date.getTime()
    return Number.isFinite(time) ? time : 0
  }
  return [...arr].sort((a, b) => toTime(a) - toTime(b))
}

/** Integer count with thousands separators (tabular display). */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString('en-US')
}

/** Convert 元 to 万, keeping at most 2 decimals (e.g. 123456 -> "12.35万"). */
export function formatWan(yuan: number): string {
  if (!Number.isFinite(yuan)) return '0万'
  const wan = yuan / 10000
  const text = Number.isInteger(wan) ? String(wan) : wan.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `${text}万`
}

export type AxisInterval = number | 'preserveStartEnd'

/** XAxis interval: 0 for <= 8 ticks, otherwise preserve start & end. */
export function autoInterval(count: number): AxisInterval {
  return count <= 8 ? 0 : 'preserveStartEnd'
}

export interface PieLabelLayout {
  outerRadius: number
  useExternalLabels: boolean
}

/** Recommended pie geometry for a given container height. */
export function pieLabelLayout(containerHeight: number): PieLabelLayout {
  const height = Number.isFinite(containerHeight) && containerHeight > 0 ? containerHeight : 240
  const outerRadius = Math.max(0, Math.min(height / 2 - 24, 110))
  return { outerRadius, useExternalLabels: height >= 260 }
}
