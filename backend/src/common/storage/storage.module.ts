/**
 * G005 RIS v3.0.6.11-60 - Storage Module (全局)
 * 通过 STORAGE_DRIVER 令牌注入 StorageDriver:
 *   - 环境变量 STORAGE_DRIVER=s3  → S3StorageDriver (S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY/S3_REGION)
 *   - STORAGE_DRIVER 未设置      → 优先读 SystemConfig(storage_config) 保存的配置, 否则 undefined
 *   - undefined                  → 各使用方回退各自的本地存储目录 (DICOM_STORAGE_DIR / VNA_STORAGE_DIR),
 *                                  行为与 v3.0.6.11-60 之前完全一致
 */
import { Global, Injectable, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { S3StorageDriver, type S3StorageDriverOptions } from './s3-storage.driver'
import { decryptSecret, encryptSecret, isMaskedSecret } from './storage-crypto'
import type { StorageDriver } from './storage.interface'

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER')

export type StorageDriverType = 'local' | 's3'

export interface StorageConfigDto {
  driver: StorageDriverType
  endpoint?: string
  bucket?: string
  region?: string
  accessKey?: string
  secretKey?: string
}

export const STORAGE_CONFIG_KEY = 'storage_config'

export const S3_ENV_DEFAULTS: Pick<StorageConfigDto, 'endpoint' | 'region'> = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
}

/** 从环境变量构建 S3 配置 (StorageModule 工厂与连接测试共用) */
export function s3ConfigFromEnv(config: ConfigService, overrides?: Partial<StorageConfigDto>): StorageConfigDto {
  const driver = (config.get<string>('STORAGE_DRIVER') ?? '').trim().toLowerCase()
  if (driver && driver !== 's3' && driver !== 'local') {
    throw new Error(`STORAGE_DRIVER must be 'local' or 's3', got "${driver}"`)
  }
  const endpoint = (overrides?.endpoint ?? config.get<string>('S3_ENDPOINT', '')).trim() || S3_ENV_DEFAULTS.endpoint!
  const bucket = (overrides?.bucket ?? config.get<string>('S3_BUCKET', '')).trim()
  const accessKey = (overrides?.accessKey ?? config.get<string>('S3_ACCESS_KEY', '')).trim()
  const secretKey = (overrides?.secretKey ?? config.get<string>('S3_SECRET_KEY', '')).trim()
  const region = (overrides?.region ?? config.get<string>('S3_REGION', '')).trim() || S3_ENV_DEFAULTS.region!
  return { driver: 's3', endpoint, bucket, region, accessKey, secretKey }
}

export function buildS3DriverOptions(cfg: StorageConfigDto, timeoutMs?: number): S3StorageDriverOptions {
  if (!cfg.endpoint || !cfg.bucket || !cfg.accessKey || !cfg.secretKey) {
    throw new Error('S3 配置不完整: endpoint / bucket / accessKey / secretKey 必填')
  }
  return {
    endpoint: cfg.endpoint,
    bucket: cfg.bucket,
    accessKey: cfg.accessKey,
    secretKey: cfg.secretKey,
    region: cfg.region ?? S3_ENV_DEFAULTS.region,
    timeoutMs,
  }
}

@Injectable()
export class StorageConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** 运行时生效的驱动类型 (env 优先, 其次 SystemConfig, 默认 local) */
  async effectiveDriver(): Promise<StorageConfigDto | null> {
    const envDriver = (this.config.get<string>('STORAGE_DRIVER') ?? '').trim().toLowerCase()
    if (envDriver === 's3') return s3ConfigFromEnv(this.config)
    if (envDriver === 'local') return { driver: 'local' }
    const saved = await this.getSaved().catch(() => null)
    if (saved?.driver === 's3') {
      return {
        driver: 's3',
        endpoint: saved.endpoint?.trim() || S3_ENV_DEFAULTS.endpoint,
        bucket: saved.bucket?.trim() ?? '',
        region: saved.region?.trim() || S3_ENV_DEFAULTS.region,
        accessKey: saved.accessKey?.trim() ?? '',
        secretKey: saved.secretKey?.trim() ?? '',
      }
    }
    if (saved?.driver === 'local') return { driver: 'local' }
    return null
  }

  async getSaved(): Promise<StorageConfigDto | null> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: STORAGE_CONFIG_KEY } })
    if (!row?.value) return null
    let value = row.value as unknown as StorageConfigDto
    if (value?.driver !== 's3' && value?.driver !== 'local') return null
    // 解密存储的 secretKey (旧版明文值原样返回)
    if (value.driver === 's3' && value.secretKey) {
      value = { ...value, secretKey: decryptSecret(value.secretKey) }
    }
    return value
  }

  async save(cfg: StorageConfigDto): Promise<StorageConfigDto> {
    const existing = await this.getSaved().catch(() => null)
    let secretKey = cfg.driver === 's3' ? cfg.secretKey?.trim() : undefined
    if (cfg.driver === 's3' && secretKey) {
      if (isMaskedSecret(secretKey)) {
        // 前端回传掩码值: 保留已存 secretKey 不覆盖
        secretKey = existing?.secretKey ? encryptSecret(existing.secretKey) : undefined
      } else {
        secretKey = encryptSecret(secretKey)
      }
    }
    const value: StorageConfigDto = {
      driver: cfg.driver === 's3' ? 's3' : 'local',
      endpoint: cfg.driver === 's3' ? cfg.endpoint?.trim() : undefined,
      bucket: cfg.driver === 's3' ? cfg.bucket?.trim() : undefined,
      region: cfg.driver === 's3' ? (cfg.region?.trim() || S3_ENV_DEFAULTS.region) : undefined,
      accessKey: cfg.driver === 's3' ? cfg.accessKey?.trim() : undefined,
      secretKey,
    }
    if (value.driver === 's3') {
      if (!value.endpoint || !value.bucket || !value.accessKey || !value.secretKey) {
        throw new Error('S3 配置不完整: endpoint / bucket / accessKey / secretKey 必填')
      }
    }
    await this.prisma.systemConfig.upsert({
      where: { key: STORAGE_CONFIG_KEY },
      update: { value: value as unknown as object },
      create: { key: STORAGE_CONFIG_KEY, value: value as unknown as object },
    })
    return value
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_DRIVER,
      inject: [ConfigService, StorageConfigService],
      useFactory: async (config: ConfigService, configService: StorageConfigService): Promise<StorageDriver | undefined> => {
        const envDriver = (config.get<string>('STORAGE_DRIVER') ?? '').trim().toLowerCase()
        if (envDriver === 's3') {
          const cfg = s3ConfigFromEnv(config)
          return new S3StorageDriver(buildS3DriverOptions(cfg))
        }
        if (envDriver === 'local') return undefined
        try {
          const saved = await configService.getSaved()
          if (saved?.driver === 's3' && saved.endpoint && saved.bucket && saved.accessKey && saved.secretKey) {
            return new S3StorageDriver(buildS3DriverOptions(saved))
          }
        } catch {
          /* DB 不可用时回退本地存储 */
        }
        return undefined
      },
    },
    StorageConfigService,
  ],
  exports: [STORAGE_DRIVER, StorageConfigService],
})
export class StorageModule {}
