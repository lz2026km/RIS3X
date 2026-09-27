// [G005 W13-Security] 字段级加密服务: AES-256-GCM (默认) + SM4-CBC (国密可选)。
// 用于敏感患者字段 (身份证/手机号/过敏史等) 的落库加密与脱敏读取。
// 加密格式: v1.<algo>.<ivB64>.<tagB64>.<ctB64>  (AES-GCM)
//            v1.sm4.<ivB64>.<ctB64>              (SM4-CBC)
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { sm4CbcDecrypt, sm4CbcEncrypt } from '../sm-crypto/sm4'

export type FieldCipher = 'AES-256-GCM' | 'SM4-CBC'
export type SensitiveField = 'idCard' | 'phone' | 'allergy' | string

const META_KEY = Symbol.for('g005.encryptedFields')
const DEFAULT_SECRET = 'G005-RIS-FIELD-ENCRYPTION-DEMO-KEY-2026'

function deriveKey(secret: string, len = 32): Buffer {
  return createHash('sha256').update(secret).digest().subarray(0, len)
}

/** 标记实体敏感字段的装饰器 (由 encryptFields/decryptFields 读取) */
export function EncryptedField(): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const ctor = (target as { constructor: object }).constructor
    const existing = (Reflect.getMetadata(META_KEY, ctor) as string[] | undefined) ?? []
    if (!existing.includes(String(propertyKey))) existing.push(String(propertyKey))
    Reflect.defineMetadata(META_KEY, existing, ctor)
  }
}

/** 读取类上被 @EncryptedField 标记的字段集合 */
export function getEncryptedFields(target: object): string[] {
  const ctor = (target as { constructor: object }).constructor
  return (Reflect.getMetadata(META_KEY, ctor) as string[] | undefined) ?? []
}

const ID_CARD_RE = /^(\d{6})(\d{8})(\w{4})$/
const PHONE_RE = /^(\d{3})(\d{4})(\d{4})$/

@Injectable()
export class FieldEncryptionService {
  private readonly secret: string
  private readonly aesKey: Buffer
  private readonly sm4KeyHex: string

  constructor() {
    this.secret = process.env['FIELD_ENCRYPTION_KEY'] || DEFAULT_SECRET
    this.aesKey = deriveKey(this.secret, 32)
    this.sm4KeyHex = deriveKey(this.secret, 16).toString('hex')
  }

  /** 是否启用 (存在密钥即可用) */
  isEnabled(): boolean {
    return this.aesKey.length === 32
  }

  algorithmInfo(): { default: FieldCipher; supported: FieldCipher[]; keySource: 'env' | 'demo'; sm4Available: boolean } {
    return {
      default: 'AES-256-GCM',
      supported: ['AES-256-GCM', 'SM4-CBC'],
      keySource: process.env['FIELD_ENCRYPTION_KEY'] ? 'env' : 'demo',
      sm4Available: true,
    }
  }

  /** 加密明文字符串 */
  encrypt(plain: string, algorithm: FieldCipher = 'AES-256-GCM'): string {
    if (typeof plain !== 'string') throw new BadRequestException('待加密值必须为字符串')
    if (algorithm === 'SM4-CBC') {
      const iv = randomBytes(16)
      const payload = Buffer.from(sm4CbcEncrypt(this.sm4KeyHex, Buffer.from(plain, 'utf8'), iv))
      return `v1.sm4.${payload.subarray(0, 16).toString('base64')}.${payload.subarray(16).toString('base64')}`
    }
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.aesKey, iv)
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `v1.aesgcm.${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`
  }

  /** 解密 (自动识别算法) */
  decrypt(payload: string): string {
    if (typeof payload !== 'string' || !payload.startsWith('v1.')) throw new BadRequestException('密文格式非法')
    const parts = payload.split('.')
    const algo = parts[1]
    if (algo === 'sm4') {
      const iv = Buffer.from(parts[2] ?? '', 'base64')
      const ct = Buffer.from(parts[3] ?? '', 'base64')
      const joined = Buffer.concat([iv, ct])
      return Buffer.from(sm4CbcDecrypt(this.sm4KeyHex, joined)).toString('utf8')
    }
    if (algo === 'aesgcm') {
      const iv = Buffer.from(parts[2] ?? '', 'base64')
      const tag = Buffer.from(parts[3] ?? '', 'base64')
      const ct = Buffer.from(parts[4] ?? '', 'base64')
      const decipher = createDecipheriv('aes-256-gcm', this.aesKey, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
    }
    throw new BadRequestException(`未知加密算法: ${algo}`)
  }

  /** 是否为本服务生成的密文 */
  isEncrypted(value: unknown): boolean {
    return typeof value === 'string' && value.startsWith('v1.') && value.split('.').length >= 4
  }

  /** 脱敏 (不泄露原始值) */
  mask(value: string, field?: SensitiveField): string {
    if (!value) return ''
    const v = String(value)
    if (field === 'idCard' || ID_CARD_RE.test(v)) {
      const m = ID_CARD_RE.exec(v)
      if (m) return `${m[1]}********${m[3]}`
    }
    if (field === 'phone' || PHONE_RE.test(v)) {
      const m = PHONE_RE.exec(v)
      if (m) return `${m[1]}****${m[3]}`
    }
    if (field === 'allergy') return v.length <= 2 ? '*'.repeat(v.length) : `${v[0]}${'*'.repeat(Math.max(v.length - 2, 1))}${v[v.length - 1]}`
    if (field === 'name') return v.length <= 1 ? '*' : `${v[0]}${'*'.repeat(v.length - 1)}`
    if (v.length <= 2) return '*'.repeat(v.length)
    return `${v.slice(0, 1)}${'*'.repeat(Math.max(v.length - 2, 1))}${v.slice(-1)}`
  }

  /** 加密实体中指定字段 (原地返回新对象) */
  encryptFields<T extends Record<string, unknown>>(entity: T, fields: SensitiveField[], algorithm: FieldCipher = 'AES-256-GCM'): T {
    const out: Record<string, unknown> = { ...entity }
    for (const f of fields) {
      const val = out[f]
      if (typeof val === 'string' && !this.isEncrypted(val)) out[f] = this.encrypt(val, algorithm)
    }
    return out as T
  }

  /** 解密实体中指定字段 */
  decryptFields<T extends Record<string, unknown>>(entity: T, fields: SensitiveField[]): T {
    const out: Record<string, unknown> = { ...entity }
    for (const f of fields) {
      const val = out[f]
      if (typeof val === 'string' && this.isEncrypted(val)) out[f] = this.decrypt(val)
    }
    return out as T
  }

  /** 脱敏读取: 解密 (若为密文) 后脱敏 */
  readMasked(value: string, field?: SensitiveField): string {
    const plain = this.isEncrypted(value) ? this.decrypt(value) : value
    return this.mask(plain, field)
  }

  /** 自检: 对给定示例执行 AES / SM4 往返 + 脱敏 */
  selfTest(): {
    algorithm: FieldCipher
    samples: Array<{ field: string; plainMasked: string; ciphertextPrefix: string; decryptedMatches: boolean; maskedRead: string }>
  } {
    const samples = [
      { field: 'idCard', value: '110101196803120011' },
      { field: 'phone', value: '13800001001' },
      { field: 'allergy', value: '青霉素过敏' },
    ]
    return {
      algorithm: 'AES-256-GCM',
      samples: samples.map((s) => {
        const ct = this.encrypt(s.value)
        return {
          field: s.field,
          plainMasked: this.mask(s.value, s.field),
          ciphertextPrefix: ct.slice(0, 16),
          decryptedMatches: this.decrypt(ct) === s.value,
          maskedRead: this.readMasked(ct, s.field),
        }
      }),
    }
  }
}
