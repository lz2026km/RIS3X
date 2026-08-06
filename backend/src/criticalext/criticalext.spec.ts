/**
 * G005 RIS v3.0.6.11-75 (W5) - CriticalExtService 通知通道配置测试
 * GET/PUT /critical-ext/channels: 读写 critical_channel_<CHANNEL> SystemConfig 开关
 */
import { CriticalExtService } from './criticalext.service'
import { NotFoundException } from '@nestjs/common'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    systemConfig: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      create: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
      upsert: jest.fn().mockRejectedValue(new Error('no db')),
      delete: jest.fn().mockRejectedValue(new Error('no db')),
    },
    criticalValue: {
      count: jest.fn().mockRejectedValue(new Error('no db')),
      groupBy: jest.fn().mockRejectedValue(new Error('no db')),
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      create: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
    },
    criticalValueNotification: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
    },
    ...overrides,
  }
  return prisma as never
}

describe('CriticalExtService (W5 channels)', () => {
  describe('getChannels', () => {
    it('defaults to enabled=true when no critical_channel_* rows exist', async () => {
      const prisma = makePrisma({
        systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
      })
      const service = new CriticalExtService(prisma)
      const res = await service.getChannels()
      expect(res.total).toBe(5)
      expect(res.items.map((c) => c.channel)).toEqual(['SYSTEM', 'SMS', 'PHONE', 'WECHAT', 'EMAIL'])
      expect(res.items.every((c) => c.enabled === true)).toBe(true)
    })

    it('reads saved enabled flags from critical_channel_<CHANNEL> rows', async () => {
      const prisma = makePrisma({
        systemConfig: {
          findMany: jest.fn().mockResolvedValue([
            { key: 'critical_channel_PHONE', value: { enabled: false } },
            { key: 'critical_channel_SMS', value: { enabled: true } },
          ]),
        },
      })
      const service = new CriticalExtService(prisma)
      const res = await service.getChannels()
      expect(res.items.find((c) => c.channel === 'PHONE')?.enabled).toBe(false)
      expect(res.items.find((c) => c.channel === 'SMS')?.enabled).toBe(true)
      expect(res.items.find((c) => c.channel === 'SYSTEM')?.enabled).toBe(true)
    })
  })

  describe('saveChannels', () => {
    it('upserts critical_channel_<CHANNEL> with enabled flag and returns refreshed list', async () => {
      const upsert = jest.fn().mockResolvedValue({})
      const findMany = jest.fn().mockResolvedValue([])
      const prisma = makePrisma({
        systemConfig: { upsert, findMany },
      })
      const service = new CriticalExtService(prisma)
      const res = await service.saveChannels([
        { channel: 'PHONE', enabled: false },
        { channel: 'EMAIL', enabled: false },
      ])
      expect(upsert).toHaveBeenCalledTimes(2)
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'critical_channel_PHONE' },
          update: { value: { enabled: false } },
          create: { key: 'critical_channel_PHONE', value: { enabled: false } },
        }),
      )
      expect(res.items.find((c) => c.channel === 'PHONE')?.enabled).toBe(true)
    })
  })
})
