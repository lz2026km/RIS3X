import { NotFoundException } from '@nestjs/common'
import { QueueService } from './queue.service'

const makePrisma = () => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  return {
    device: { findMany: reject },
    exam: { findMany: reject, count: reject },
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
})
