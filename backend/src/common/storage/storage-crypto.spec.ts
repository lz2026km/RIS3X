/**
 * G005 RIS v3.0.6.11-72 - S3 secretKey 加密存储测试 (SEC1)
 * 1) encryptSecret/decryptSecret AES-256-GCM 往返 + 旧明文兼容
 * 2) maskSecret / isMaskedSecret 掩码规则
 * 3) StorageConfigService.save 落库为密文, getSaved 解密还原, 掩码回传不覆盖
 */
import { ConfigService } from '@nestjs/config'
import { StorageConfigService } from './storage.module'
import { decryptSecret, encryptSecret, isMaskedSecret, maskSecret } from './storage-crypto'

const ENV_KEY = 'test-storage-config-key-0123456789abcdef'

describe('storage-crypto (AES-256-GCM secret encryption)', () => {
  const prevKey = process.env.STORAGE_CONFIG_KEY

  beforeAll(() => {
    process.env.STORAGE_CONFIG_KEY = ENV_KEY
  })

  afterAll(() => {
    if (prevKey === undefined) delete process.env.STORAGE_CONFIG_KEY
    else process.env.STORAGE_CONFIG_KEY = prevKey
  })

  it('encrypt/decrypt roundtrip restores plaintext', () => {
    const enc = encryptSecret('MinIO-Secret-9x8y7z')
    expect(enc).not.toContain('MinIO-Secret-9x8y7z')
    expect(enc).toMatch(/^enc:v1:[A-Za-z0-9+/=]+$/)
    expect(decryptSecret(enc)).toBe('MinIO-Secret-9x8y7z')
  })

  it('produces different ciphertext for same plaintext (random IV)', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'))
  })

  it('returns legacy plaintext unchanged (backward compat)', () => {
    expect(decryptSecret('plaintext-old-key')).toBe('plaintext-old-key')
    expect(decryptSecret('')).toBe('')
  })

  it('returns empty string on tampered ciphertext', () => {
    const enc = encryptSecret('secret-123')
    const tampered = enc.slice(0, -4) + 'AAAA'
    expect(decryptSecret(tampered)).toBe('')
  })

  it('maskSecret keeps only last 4 chars with **** prefix', () => {
    expect(maskSecret('Abcd1234')).toBe('****1234')
    expect(maskSecret('abcd')).toBe('****')
    expect(maskSecret('')).toBe('')
  })

  it('isMaskedSecret detects masked values only', () => {
    expect(isMaskedSecret('****1234')).toBe(true)
    expect(isMaskedSecret('****')).toBe(true)
    expect(isMaskedSecret('real-secret')).toBe(false)
    expect(isMaskedSecret('')).toBe(false)
  })
})

describe('StorageConfigService (encrypt at rest)', () => {
  const prevKey = process.env.STORAGE_CONFIG_KEY
  let upserted: { value: unknown } | null = null
  let svc: StorageConfigService

  const mockPrisma = () => ({
    systemConfig: {
      findUnique: jest.fn(async () => upserted ? { key: 'storage_config', value: upserted!.value } : null),
      upsert: jest.fn(async (args: { update: { value: unknown }; create: { value: unknown } }) => {
        upserted = args.update ?? { value: args.create.value }
        return { key: 'storage_config', value: upserted.value }
      }),
    },
  })

  beforeEach(() => {
    upserted = null
    const config = { get: jest.fn(() => undefined) } as unknown as ConfigService
    svc = new StorageConfigService(mockPrisma() as never, config)
  })

  afterAll(() => {
    if (prevKey === undefined) delete process.env.STORAGE_CONFIG_KEY
    else process.env.STORAGE_CONFIG_KEY = prevKey
  })

  it('save stores encrypted secretKey, getSaved returns plaintext', async () => {
    process.env.STORAGE_CONFIG_KEY = ENV_KEY
    await svc.save({ driver: 's3', endpoint: 'http://minio:9000', bucket: 'ris', accessKey: 'ak', secretKey: 'plain-secret' })
    expect(upserted!.value).toMatchObject({ driver: 's3' })
    const stored = (upserted!.value as { secretKey: string }).secretKey
    expect(stored).toMatch(/^enc:v1:/)
    expect(stored).not.toContain('plain-secret')
    const saved = await svc.getSaved()
    expect(saved).toMatchObject({ driver: 's3', accessKey: 'ak' })
    expect(saved!.secretKey).toBe('plain-secret')
  })

  it('save with masked secretKey preserves existing secret', async () => {
    process.env.STORAGE_CONFIG_KEY = ENV_KEY
    await svc.save({ driver: 's3', endpoint: 'http://minio:9000', bucket: 'ris', accessKey: 'ak', secretKey: 'original-secret' })
    await svc.save({ driver: 's3', endpoint: 'http://minio:9000', bucket: 'ris', accessKey: 'ak2', secretKey: '****cret' })
    const saved = await svc.getSaved()
    expect(saved!.secretKey).toBe('original-secret')
    expect(saved!.accessKey).toBe('ak2')
  })

  it('save without masked/plain secret throws for s3', async () => {
    await expect(svc.save({ driver: 's3', endpoint: 'http://x', bucket: 'b', accessKey: 'a', secretKey: '' })).rejects.toThrow()
  })
})
