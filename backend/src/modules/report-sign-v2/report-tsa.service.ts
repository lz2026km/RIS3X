// [G005 W8-Report] 时间戳权威 (TSA) 服务 — 确定性 RFC3161-like token。
// 无真实 TSA 服务: 生成结构化 token = base64(JSON{version,tsaTime,digest,serial,policy,nonce}), 可解析/校验。
import { Injectable } from '@nestjs/common'
import type { DigestAlgorithm } from './report-signing.types'

const TSA_POLICY = '1.2.3.4.1.G005.RIS.TSA.1'

export interface TsaTokenPayload {
  version: 1
  tsaTime: string
  digest: string
  algorithm: DigestAlgorithm
  serial: string
  policy: string
  nonce: string
}

@Injectable()
export class ReportTsaService {
  /** 签发确定性时间戳 token: 同一 (tsaTime,digest,serial) → 同一 token */
  issue(input: { digest: string; serial: string; algorithm: DigestAlgorithm; tsaTime: string }): string {
    const payload: TsaTokenPayload = {
      version: 1,
      tsaTime: input.tsaTime,
      digest: input.digest,
      algorithm: input.algorithm,
      serial: input.serial,
      policy: TSA_POLICY,
      nonce: this.nonceOf(input.digest, input.serial, input.tsaTime),
    }
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  }

  parse(token: string): TsaTokenPayload | null {
    try {
      const raw = Buffer.from(token, 'base64').toString('utf8')
      const parsed = JSON.parse(raw) as TsaTokenPayload
      if (!parsed || parsed.version !== 1 || !parsed.digest || !parsed.serial) return null
      return parsed
    } catch {
      return null
    }
  }

  /** 校验 token 摘要/序列号一致性 (确定性 nonce 复核) */
  verify(token: string, digest: string, serial: string): boolean {
    const parsed = this.parse(token)
    if (!parsed) return false
    if (parsed.digest !== digest || parsed.serial !== serial) return false
    return parsed.nonce === this.nonceOf(parsed.digest, parsed.serial, parsed.tsaTime)
  }

  private nonceOf(digest: string, serial: string, tsaTime: string): string {
    // 简单确定性 nonce (不引入额外依赖): 取各段组合的 base36
    const src = `${digest}|${serial}|${tsaTime}`
    let h = 0x811c9dc5
    for (let i = 0; i < src.length; i++) {
      h ^= src.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, '0')
  }
}
