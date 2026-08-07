/**
 * G005 RIS v3.0.6.11-79 - SystemConfigService 共享读取服务 spec
 * SystemConfig 表读 + 缓存 + 回退 + 保存侧失效
 */
import { SystemConfigService } from './system-config.service'

const makePrisma = (overrides: Record<string, unknown> = {}) => ({
  systemConfig: {
    findUnique: jest.fn().mockRejectedValue(new Error('no db')),
    ...overrides,
  },
})

const stored = (key: string, value: unknown) => jest.fn().mockResolvedValue({ key, value })

describe('SystemConfigService', () => {
  describe('getString', () => {
    it('returns stored string and falls back when missing', async () => {
      const prisma = makePrisma({ findUnique: stored('hospital_name', '协和医院') })
      const svc = new SystemConfigService(prisma as never)
      expect(await svc.getString('hospital_name', '默认医院')).toBe('协和医院')

      const empty = makePrisma({ findUnique: jest.fn().mockResolvedValue(null) })
      expect(await new SystemConfigService(empty as never).getString('hospital_name', '默认医院')).toBe('默认医院')
    })

    it('falls back for empty stored string', async () => {
      const prisma = makePrisma({ findUnique: stored('report_footer', '  ') })
      const svc = new SystemConfigService(prisma as never)
      expect(await svc.getString('report_footer', '默认页脚')).toBe('默认页脚')
    })
  })

  describe('getNumber', () => {
    it('coerces numeric strings (frontend sends "30")', async () => {
      const prisma = makePrisma({ findUnique: stored('critical_timeout_minutes', '30') })
      const svc = new SystemConfigService(prisma as never)
      expect(await svc.getNumber('critical_timeout_minutes', 60)).toBe(30)
    })

    it('falls back on invalid values', async () => {
      const prisma = makePrisma({ findUnique: stored('default_page_size', 'abc') })
      const svc = new SystemConfigService(prisma as never)
      expect(await svc.getNumber('default_page_size', 20)).toBe(20)
    })
  })

  describe('cache + invalidation', () => {
    it('caches reads and serves from memory until invalidated', async () => {
      const findUnique = stored('hospital_name', '协和医院')
      const prisma = makePrisma({ findUnique })
      const svc = new SystemConfigService(prisma as never)

      expect(await svc.getString('hospital_name', 'x')).toBe('协和医院')
      expect(await svc.getString('hospital_name', 'x')).toBe('协和医院')
      expect(findUnique).toHaveBeenCalledTimes(1)

      svc.invalidate('hospital_name')
      expect(await svc.getString('hospital_name', 'x')).toBe('协和医院')
      expect(findUnique).toHaveBeenCalledTimes(2)
    })

    it('never throws on DB failure, always falls back', async () => {
      const prisma = makePrisma({ findUnique: jest.fn().mockRejectedValue(new Error('no db')) })
      const svc = new SystemConfigService(prisma as never)
      expect(await svc.getString('pdf_watermark_text', '兜底水印')).toBe('兜底水印')
      expect(await svc.getNumber('critical_sla_minutes', 30)).toBe(30)
    })
  })
})
