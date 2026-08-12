/**
 * G005 RIS v3.0.6.11-75 (W5) - SystemStorageService 系统管理配置测试
 * GET/PUT /system/admin/configs + PATCH /system/admin/configs/:key (SystemConfig 表)
 * [G005 v3.0.6.11-90 Wave 4A (PACS P0-2)] 存储容量阈值预警配置测试 (内存 + seed)
 */
import { SystemStorageService } from './system-storage.service'
import { NotFoundException } from '@nestjs/common'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    systemConfig: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      upsert: jest.fn().mockRejectedValue(new Error('no db')),
    },
    ...overrides,
  }
  return prisma as never
}

const makeConfig = (env: Record<string, string> = {}) => ({
  get: jest.fn((key: string, fallback?: unknown) => env[key] ?? fallback),
})

// [v3.0.6.11-79] SystemConfigService 桩: 保存侧 invalidate 缓存
const makeSystemConfig = () => ({ invalidate: jest.fn(), get: jest.fn(), getString: jest.fn(), getNumber: jest.fn() })

const makeService = (prisma: unknown, env: Record<string, string> = {}) =>
  new SystemStorageService(prisma as never, makeConfig(env) as never, {} as never, makeSystemConfig() as never)

describe('SystemStorageService (W5 admin configs)', () => {
  describe('listAdminConfigs', () => {
    it('returns all known config items with defaults when nothing is stored', async () => {
      const prisma = makePrisma({
        systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
      })
      const service = makeService(prisma)
      const items = await service.listAdminConfigs()
      expect(items).toHaveLength(6)
      expect(items.find((c) => c.key === 'hospital_name')?.value).toBe('G005 放射科信息管理系统')
      expect(items.find((c) => c.key === 'critical_sla_minutes')?.value).toBe('10')
      expect(items.find((c) => c.key === 'pdf_watermark_text')?.desc).toContain('水印')
    })

    it('merges stored values over defaults', async () => {
      const prisma = makePrisma({
        systemConfig: {
          findMany: jest.fn().mockResolvedValue([
            { key: 'hospital_name', value: '协和医院' },
            { key: 'critical_sla_minutes', value: 15 },
          ]),
        },
      })
      const service = makeService(prisma)
      const items = await service.listAdminConfigs()
      expect(items.find((c) => c.key === 'hospital_name')?.value).toBe('协和医院')
      expect(items.find((c) => c.key === 'critical_sla_minutes')?.value).toBe('15')
    })
  })

  describe('saveAdminConfigs', () => {
    it('upserts whitelisted keys and ignores unknown keys', async () => {
      const upsert = jest.fn().mockResolvedValue({})
      const prisma = makePrisma({
        systemConfig: {
          upsert,
          findMany: jest.fn().mockResolvedValue([{ key: 'hospital_name', value: '协和医院' }]),
        },
      })
      const service = makeService(prisma)
      const items = await service.saveAdminConfigs([
        { key: 'hospital_name', value: '协和医院' },
        { key: 'evil_key', value: 'x' },
      ])
      expect(upsert).toHaveBeenCalledTimes(1)
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: 'hospital_name' } }),
      )
      expect(items.find((c) => c.key === 'hospital_name')?.value).toBe('协和医院')
    })

    it('coerces numeric config keys from string input', async () => {
      const upsert = jest.fn().mockResolvedValue({})
      const prisma = makePrisma({
        systemConfig: {
          upsert,
          findMany: jest.fn().mockResolvedValue([]),
        },
      })
      const service = makeService(prisma)
      await service.saveAdminConfigs([{ key: 'default_page_size', value: '50' }])
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { value: 50 },
          create: { key: 'default_page_size', value: 50 },
        }),
      )
    })
  })

  describe('updateAdminConfig', () => {
    it('throws 404 for unknown key', async () => {
      const prisma = makePrisma({})
      const service = makeService(prisma)
      await expect(service.updateAdminConfig('nope', 'x')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('persists a single known key and returns updated item', async () => {
      const upsert = jest.fn().mockResolvedValue({})
      const prisma = makePrisma({
        systemConfig: {
          upsert,
          findMany: jest.fn().mockResolvedValue([{ key: 'report_footer', value: '内部使用' }]),
        },
      })
      const service = makeService(prisma)
      const item = await service.updateAdminConfig('report_footer', '内部使用')
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: 'report_footer' } }),
      )
      expect(item.key).toBe('report_footer')
      expect(item.value).toBe('内部使用')
    })
  })
})

describe('SystemStorageService 容量阈值预警 (PACS P0-2)', () => {
  it('seed 回退: STORAGE_ALERT_WARN_PERCENT/CRITICAL_PERCENT/CHANNELS', () => {
    const service = makeService(makePrisma({}), {
      STORAGE_ALERT_WARN_PERCENT: '75',
      STORAGE_ALERT_CRITICAL_PERCENT: '92',
      STORAGE_ALERT_CHANNELS: 'email,sms,wechat',
    })
    const cfg = service.getAlertsConfig()
    expect(cfg.warnPercent).toBe(75)
    expect(cfg.criticalPercent).toBe(92)
    expect(cfg.notifyChannels).toEqual(['email', 'sms', 'wechat'])
  })

  it('无环境 seed 时默认 warn=80 critical=90 email,sms', () => {
    const service = makeService(makePrisma({}), {})
    const cfg = service.getAlertsConfig()
    expect(cfg.warnPercent).toBe(80)
    expect(cfg.criticalPercent).toBe(90)
    expect(cfg.notifyChannels).toContain('email')
  })

  it('updateAlertsConfig 合并更新并返回新配置', () => {
    const service = makeService(makePrisma({}), {})
    const cfg = service.updateAlertsConfig({ warnPercent: 70, notifyChannels: ['dingtalk'] })
    expect(cfg.warnPercent).toBe(70)
    expect(cfg.criticalPercent).toBe(90)
    expect(cfg.notifyChannels).toEqual(['dingtalk'])
  })

  it('warn >= critical 时自动回退 warn 至 critical-1', () => {
    const service = makeService(makePrisma({}), {})
    const cfg = service.updateAlertsConfig({ warnPercent: 95, criticalPercent: 90 })
    expect(cfg.criticalPercent).toBe(90)
    expect(cfg.warnPercent).toBeLessThanOrEqual(90)
  })
})
