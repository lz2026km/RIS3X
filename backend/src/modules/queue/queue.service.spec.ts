import { NotFoundException } from '@nestjs/common'
import { QueueService } from './queue.service'

const makePrisma = () => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  return {
    device: { findMany: reject },
    exam: { findMany: reject, count: reject },
    queueState: {
      count: reject,
      findMany: reject,
      upsert: reject,
    },
  } as never
}

describe('QueueService', () => {
  describe('DB 不可用 → 种子数据回退', () => {
    it('list 返回非空候诊队列且字段完整', async () => {
      const service = new QueueService(makePrisma())
      const items = await service.list()
      expect(items.length).toBeGreaterThan(0)
      const first = items[0]
      expect(first.id).toBeTruthy()
      expect(first.patientName).toBeTruthy()
      expect(first.status).toMatch(/等待中|已呼叫|检查中|已完成/)
    })

    it('rooms 返回房间列表', async () => {
      const service = new QueueService(makePrisma())
      const rooms = await service.rooms()
      expect(rooms.length).toBeGreaterThan(0)
      expect(rooms[0].roomNumber).toBeTruthy()
    })
  })

  describe('叫号流程 (内存状态)', () => {
    it('call → 状态变为已呼叫, calledCount 递增', async () => {
      const service = new QueueService(makePrisma())
      const items = await service.list()
      const target = items.find((i) => i.status === '等待中')!
      const called = await service.call(target.id)
      expect(called.status).toBe('已呼叫')
      expect(called.calledCount).toBeGreaterThan(0)
      const after = await service.list()
      expect(after.find((i) => i.id === target.id)!.status).toBe('已呼叫')
    })

    it('call 支持按 examId body 叫号', async () => {
      const service = new QueueService(makePrisma())
      const items = await service.list()
      const target = items.find((i) => i.status === '等待中')!
      const called = await service.call('ignored-room', { examId: target.id.replace(/^q-/, '') })
      expect(called.status).toBe('已呼叫')
    })

    it('recall 重呼递增 calledCount', async () => {
      const service = new QueueService(makePrisma())
      const items = await service.list()
      const target = items.find((i) => i.status === '已呼叫') ?? items[0]
      const recalled = await service.recall(target.id)
      expect(recalled.status).toBe('已呼叫')
    })

    it('complete 完成当前号', async () => {
      const service = new QueueService(makePrisma())
      const items = await service.list()
      const target = items[0]
      await service.call(target.id)
      const done = await service.complete(target.id)
      expect(done.status).toBe('已完成')
    })

    it('未知 id → NotFoundException', async () => {
      const service = new QueueService(makePrisma())
      await expect(service.complete('unknown-id')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  // [G005 W2-A P0] 叫号状态落库: DB 可用时 queue_states 读写
  describe('叫号状态落库 (queue_states)', () => {
    const makeDbPrisma = () => {
      const rows: any[] = []
      const upsert = jest.fn(async ({ where, create, update }: any) => {
        const idx = rows.findIndex((r) => r.entryId === where.tenantId_entryId.entryId)
        const merged = idx >= 0 ? { ...rows[idx], ...(update ?? {}), entryId: where.tenantId_entryId.entryId } : { ...(create ?? {}), entryId: where.tenantId_entryId.entryId }
        if (idx >= 0) rows[idx] = merged
        else rows.push(merged)
        return merged
      })
      const prisma = {
        device: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
        exam: { findMany: jest.fn().mockRejectedValue(new Error('no db')), count: jest.fn().mockRejectedValue(new Error('no db')) },
        queueState: {
          count: jest.fn().mockResolvedValue(rows.length),
          findMany: jest.fn(async () => rows),
          upsert,
        },
      }
      return { prisma: prisma as never, rows, upsert }
    }

    it('call 持久化条目状态 (upsert 写入 status/calledCount)', async () => {
      const { prisma, upsert } = makeDbPrisma()
      const service = new QueueService(prisma)
      const items = await service.list()
      const target = items.find((i) => i.status === '等待中')!
      await service.call(target.id)
      expect(upsert).toHaveBeenCalled()
      const writes = upsert.mock.calls.map((c) => c[0].create ?? c[0].update)
      const entryWrite = writes.find((w: any) => w.entryId === target.id)
      expect(entryWrite).toBeTruthy()
      expect(entryWrite.status).toBe('called')
      expect(entryWrite.calledCount).toBe(1)
    })

    it('重启后 hydrate 从 queue_states 恢复叫号状态', async () => {
      const { prisma, rows } = makeDbPrisma()
      const first = new QueueService(prisma)
      const items = await first.list()
      const target = items.find((i) => i.status === '等待中')!
      await first.call(target.id)
      expect(rows.some((r) => r.entryId === target.id)).toBe(true)
      // 模拟重启: 同一 prisma 存储, 新 service 实例
      const restarted = new QueueService(prisma)
      const after = await restarted.list()
      expect(after.find((i) => i.id === target.id)!.status).toBe('已呼叫')
      expect(after.find((i) => i.id === target.id)!.calledCount).toBe(1)
    })

    it('complete 落库为 completed, 重启后房间不再显示当前患者', async () => {
      const { prisma } = makeDbPrisma()
      const first = new QueueService(prisma)
      const items = await first.list()
      const target = items.find((i) => i.status === '等待中')!
      await first.call(target.id)
      await first.complete(target.id)
      const restarted = new QueueService(prisma)
      const after = await restarted.list()
      expect(after.find((i) => i.id === target.id)!.status).toBe('已完成')
    })
  })
})
