/**
 * G005 RIS v3.0.6.11-79 (W3-B) - 临床配置持久化
 * GET/PUT /system/clinical-config, PUT /system/clinical-config/:module
 * 存储于 SystemConfig 表 (key=clinical_config, value 为 { modules, updatedAt })
 */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export const CLINICAL_CONFIG_KEY = 'clinical_config'

/** 7 个临床配置模块 key (与前端 src/config/clinicalConfig/registry.ts 对齐) */
export const CLINICAL_CONFIG_MODULES = [
  'gradingScales',
  'aiModels',
  'imagingDevices',
  'kpiThresholds',
  'reportTemplates',
  'findingsLexicon',
  'iolFormulas',
] as const

export type ClinicalConfigModuleKey = (typeof CLINICAL_CONFIG_MODULES)[number]

export interface ClinicalConfigDto {
  modules: Record<string, unknown> | null
  updatedAt: string | null
}

@Injectable()
export class ClinicalConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET: 返回全部模块配置; 无保存记录时 modules=null (前端回退本地默认值) */
  async getConfig(): Promise<ClinicalConfigDto> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { key: CLINICAL_CONFIG_KEY },
    })
    if (!row || !row.value || typeof row.value !== 'object') {
      return { modules: null, updatedAt: null }
    }
    const value = row.value as { modules?: unknown; updatedAt?: unknown }
    const modules =
      value.modules && typeof value.modules === 'object' && !Array.isArray(value.modules)
        ? (value.modules as Record<string, unknown>)
        : null
    return {
      modules,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
    }
  }

  /** PUT: 全量保存 7 模块配置 */
  async saveConfig(modules: Record<string, unknown>): Promise<ClinicalConfigDto> {
    this.assertValidModules(modules)
    const payload = { modules, updatedAt: new Date().toISOString() } as object
    await this.prisma.systemConfig.upsert({
      where: { key: CLINICAL_CONFIG_KEY },
      update: { value: payload },
      create: { key: CLINICAL_CONFIG_KEY, value: payload },
    })
    return { modules, updatedAt: (payload as { updatedAt: string }).updatedAt }
  }

  /** PUT /:module: 单模块保存 (与已有模块合并) */
  async saveModule(
    key: string,
    module: unknown,
  ): Promise<{ module: unknown; updatedAt: string }> {
    if (!CLINICAL_CONFIG_MODULES.includes(key as ClinicalConfigModuleKey)) {
      throw new NotFoundException(`Unknown clinical config module: ${key}`)
    }
    if (!module || typeof module !== 'object' || Array.isArray(module)) {
      throw new BadRequestException(`module 必须是对象 (${key})`)
    }
    const existing = await this.getConfig()
    const modules: Record<string, unknown> = { ...(existing.modules ?? {}) }
    modules[key] = module
    const payload = { modules, updatedAt: new Date().toISOString() } as object
    await this.prisma.systemConfig.upsert({
      where: { key: CLINICAL_CONFIG_KEY },
      update: { value: payload },
      create: { key: CLINICAL_CONFIG_KEY, value: payload },
    })
    return { module, updatedAt: (payload as { updatedAt: string }).updatedAt }
  }

  private assertValidModules(modules: Record<string, unknown>): void {
    const keys = Object.keys(modules)
    if (keys.length === 0) {
      throw new BadRequestException('modules 不能为空')
    }
    for (const k of keys) {
      if (!CLINICAL_CONFIG_MODULES.includes(k as ClinicalConfigModuleKey)) {
        throw new BadRequestException(`Unknown clinical config module: ${k}`)
      }
    }
  }
}
