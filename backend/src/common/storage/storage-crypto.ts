/**
 * G005 RIS v3.0.6.11-72 - S3 secretKey 加密存储工具
 * AES-256-GCM, 密钥由环境变量 STORAGE_CONFIG_KEY 经 SHA-256 派生 (32 字节)。
 * 未配置 STORAGE_CONFIG_KEY 时回退开发用派生密钥并打 warning (生产部署必须配置)。
 * 存储格式: enc:v1:<base64(iv + authTag + ciphertext)>; 旧版明文值解密时原样返回。
 */
import { Logger } from '@nestjs/common'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ENC_PREFIX = 'enc:v1:'
export const SECRET_MASK_PREFIX = '****'

const DEV_FALLBACK_KEY = 'g005-ris-dev-only-storage-config-key-change-in-prod'

const logger = new Logger('StorageCrypto')

let warnedMissingKey = false

export function storageCryptoKey(): Buffer {
  const raw = process.env['STORAGE_CONFIG_KEY']?.trim()
  if (!raw && !warnedMissingKey) {
    warnedMissingKey = true
    logger.warn('STORAGE_CONFIG_KEY 未配置, 使用开发回退密钥 (生产环境必须设置)')
  }
  return createHash('sha256').update(raw || DEV_FALLBACK_KEY).digest()
}

export function encryptSecret(plain: string): string {
  if (!plain) return ''
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', storageCryptoKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${ENC_PREFIX}${Buffer.concat([iv, tag, enc]).toString('base64')}`
}

export function decryptSecret(stored: string): string {
  if (!stored || !stored.startsWith(ENC_PREFIX)) return stored
  try {
    const buf = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64')
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const data = buf.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', storageCryptoKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch (err) {
    logger.error(`S3 secretKey 解密失败: ${(err as Error).message}`)
    return ''
  }
}

/** 掩码: 只保留后 4 位, 前缀 **** (如 ****Abcd) */
export function maskSecret(secret: string): string {
  if (!secret) return ''
  if (secret.length <= 4) return SECRET_MASK_PREFIX
  return `${SECRET_MASK_PREFIX}${secret.slice(-4)}`
}

/** 判断前端回传的是否为掩码值 (含 **** 前缀) */
export function isMaskedSecret(value: string): boolean {
  return value.startsWith(SECRET_MASK_PREFIX)
}
