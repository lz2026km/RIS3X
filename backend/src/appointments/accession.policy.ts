/**
 * G005 放射RIS系统 - 检查号 (Accession Number) 编号策略
 * 格式: {MODALITY}{YYYY}{SEQ:5}{CHECK}
 *   MODALITY: 模态 (CT/MR/DR/US/...)
 *   YYYY    : 年份
 *   SEQ     : 该模态+年度内自增序列 (5 位补零)
 *   CHECK   : 校验位 (加权 mod 10)
 * 线程内内存自增; 生产可替换为 DB sequence, 接口保持不变。
 */

export class AccessionPolicy {
  private readonly counters = new Map<string, number>()

  constructor(private readonly defaultYear: number = new Date().getFullYear()) {}

  private static checkDigit(body: string): string {
    let sum = 0
    for (let i = 0; i < body.length; i += 1) {
      const char = body[i]!
      const value = /[0-9]/.test(char) ? Number(char) : (char.charCodeAt(0) % 10)
      sum += value * ((i % 2) + 1)
    }
    return String(sum % 10)
  }

  /** 生成下一个检查号; opts.year 可覆盖年度 (跨年/补录场景) */
  next(modality: string, opts?: { year?: number }): string {
    const mod = (modality || 'XX').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'XX'
    const year = opts?.year ?? this.defaultYear
    const key = `${mod}-${year}`
    const seq = (this.counters.get(key) ?? 0) + 1
    this.counters.set(key, seq)
    const body = `${mod}${year}${String(seq).padStart(5, '0')}`
    return `${body}${AccessionPolicy.checkDigit(body)}`
  }

  /** 当前已分配序列 (测试/审计用) */
  peek(modality: string, opts?: { year?: number }): number {
    const mod = (modality || 'XX').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'XX'
    const year = opts?.year ?? this.defaultYear
    return this.counters.get(`${mod}-${year}`) ?? 0
  }

  /** 解析检查号 → 结构化字段 (校验失败返回 valid=false) */
  parse(accession: string): { valid: boolean; modality?: string; year?: number; seq?: number; check?: string } {
    const m = /^([A-Z]{2,4})(\d{4})(\d{5})(\d)$/.exec(accession)
    if (!m) return { valid: false }
    const [, modality, yearStr, seqStr, check] = m
    const body = `${modality}${yearStr}${seqStr}`
    return {
      valid: AccessionPolicy.checkDigit(body) === check,
      modality,
      year: Number(yearStr),
      seq: Number(seqStr),
      check,
    }
  }
}

export const accessionPolicy = new AccessionPolicy()
