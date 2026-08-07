/**
 * G005 RIS v3.0.6.11-79 - admin config 共享读取服务 (SystemConfig 表 + 缓存 + 回退)
 * 供报告导出 / HL7 / 危急值 SLA / 调度升级 / 分页默认值等消费者复用。
 * - getString/getNumber: 读 SystemConfig.value(Json), 缺失或非法时回退 fallback
 * - 内存缓存 CACHE_TTL_MS(10s): 高频读取(分页/调度 cron)不打穿 DB; 保存时经 invalidate 立即失效
 */
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const CACHE_TTL_MS = 10_000

interface CacheEntry {
  value: unknown
  expiresAt: number
}

@Injectable()
export class SystemConfigService {
  private readonly cache = new Map<string, CacheEntry>()

  constructor(private readonly prisma: PrismaService) {}

  /** 读取原始配置值(Json), 查不到 / DB 不可用时回退 fallback */
  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const hit = this.cache.get(key)
      if (hit && hit.expiresAt > Date.now()) return hit.value as T
      const row = await this.prisma.systemConfig.findUnique({ where: { key } })
      const value: T = row ? (row.value as T) : fallback
      this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
      return value
    } catch {
      return fallback
    }
  }

  /** 数值配置: 支持存 number 或数字字符串(如前端 '30'), 非法回退 */
  async getNumber(key: string, fallback: number): Promise<number> {
    const value = await this.get<unknown>(key, fallback)
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const n = Number(value.trim())
      if (Number.isFinite(n)) return n
    }
    return fallback
  }

  /** 字符串配置: 空串视为未配置, 回退 fallback */
  async getString(key: string, fallback: string): Promise<string> {
    const value = await this.get<unknown>(key, fallback)
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback
  }

  /** 保存侧写入后调用, 立即失效缓存(或全量) */
  invalidate(key?: string): void {
    if (key) this.cache.delete(key)
    else this.cache.clear()
  }
}
