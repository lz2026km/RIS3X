/**
 * G005 RIS v3.0.6.11-75 (W5) - SystemStorageService 系统管理配置测试
 * GET/PUT /system/admin/configs + PATCH /system/admin/configs/:key (SystemConfig 表)
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

const makeConfig = () => ({ get: jest.fn().mockReturnValue(undefined) })

const makeService = (prisma: unknown) =>
  new SystemStorageService(prisma as never, makeConfig() as never, {} as never)

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
