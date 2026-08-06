import { NotFoundException } from '@nestjs/common'
import { DualReadService } from './dual-read.service'

const assignmentRow = (over: Record<string, unknown> = {}) => ({
  id: 'da-db-1',
  reportId: 'rep-1',
  studyId: 'STU-DB-1',
  patientId: 'P-DB-1',
  patientName: 'DB Patient',
  modality: 'CT',
  reader1Id: 'dr-001',
  reader1Name: 'Dr. Wang',
  reader2Id: 'dr-003',
  reader2Name: 'Dr. Zhang',
  report1: null,
  report2: null,
  status: 'pending',
  discrepancyScore: null,
  arbitrationReport: null,
  arbitratorId: null,
  arbitratorName: null,
  createdAt: new Date('2026-07-12T08:00:00Z'),
  ...over,
})

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const base = {
    report: { findFirst: jest.fn().mockRejectedValue(new Error('no db')) },
    dualReadAssignment: {
      create: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
      count: jest.fn().mockRejectedValue(new Error('no db')),
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
    },
  }
  return { ...base, ...overrides } as never
}

describe('DualReadService', () => {
  describe('确定性指派', () => {
    it('同一输入 assign 两次指派同一对阅片医生 (无随机)', async () => {
      const prisma = makePrisma({
        report: { findFirst: jest.fn().mockResolvedValue({ id: 'rep-1' }) },
        dualReadAssignment: { create: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => assignmentRow({ id: 'da-x', ...(args.data as object) })), update: jest.fn().mockRejectedValue(new Error('no db')), count: jest.fn().mockRejectedValue(new Error('no db')), findMany: jest.fn().mockRejectedValue(new Error('no db')) },
      })
      const service = new DualReadService(prisma)
      const a = await service.assign('STU1', 'Zhang San', 'P001', 'CT')
      const b = await service.assign('STU1', 'Zhang San', 'P001', 'CT')
      expect(a.reader1Id).toBe(b.reader1Id)
      expect(a.reader2Id).toBe(b.reader2Id)
      expect(a.reader1Id).not.toBe(a.reader2Id)
    })

    it('assign 从 Report 表查待分配报告并落库 (simulated 未标注)', async () => {
      const create = jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => assignmentRow({ id: 'da-db-2', ...(args.data as object) }))
      const prisma = makePrisma({
        report: { findFirst: jest.fn().mockResolvedValue({ id: 'rep-pending' }) },
        dualReadAssignment: { create, update: jest.fn().mockRejectedValue(new Error('no db')), count: jest.fn().mockRejectedValue(new Error('no db')), findMany: jest.fn().mockRejectedValue(new Error('no db')) },
      })
      const service = new DualReadService(prisma)
      const result = await service.assign('STU2', 'Li Si', 'P002', 'MR')
      expect(create).toHaveBeenCalled()
      expect(create.mock.calls[0][0].data.reportId).toBe('rep-pending')
      expect(result.simulated).toBeUndefined()
      expect(result.status).toBe('pending')
    })

    it('DB 异常时 assign 回退内存并标注 simulated=true', async () => {
      const service = new DualReadService(makePrisma())
      const result = await service.assign('STU-FB-1', 'Wang Wu', 'P003', 'DX')
      expect(result.simulated).toBe(true)
      const list = await service.list()
      expect(list.some((a) => a.id === result.id)).toBe(true)
    })
  })

  describe('reader 提交 / 仲裁 / 统计 / 列表', () => {
    it('submitReader 单方提交后置 reader1_done', async () => {
      const update = jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) =>
        assignmentRow({ id: 'da-db-4', status: 'reader1_done', ...(args.data as object) }),
      )
      const prisma = makePrisma({
        report: { findFirst: jest.fn().mockRejectedValue(new Error('no db')) },
        dualReadAssignment: {
          create: jest.fn().mockRejectedValue(new Error('no db')),
          update,
          count: jest.fn().mockRejectedValue(new Error('no db')),
          findMany: jest.fn().mockRejectedValue(new Error('no db')),
          findUnique: jest.fn().mockResolvedValue(assignmentRow({ status: 'pending' })),
        },
      })
      const service = new DualReadService(prisma)
      const a = await service.submitReader('da-db-4', 1, '右肺上叶磨玻璃结节')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ report1: '右肺上叶磨玻璃结节', status: 'reader1_done' }),
      }))
      expect(a.status).toBe('reader1_done')
    })

    it('submitReader 双方完成后置 both_done 且分差确定性(同一输入两次一致,无 Math.random)', async () => {
      const update = jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) =>
        assignmentRow({ id: 'da-db-5', status: 'both_done', ...(args.data as object) }),
      )
      const prisma = makePrisma({
        report: { findFirst: jest.fn().mockRejectedValue(new Error('no db')) },
        dualReadAssignment: {
          create: jest.fn().mockRejectedValue(new Error('no db')),
          update,
          count: jest.fn().mockRejectedValue(new Error('no db')),
          findMany: jest.fn().mockRejectedValue(new Error('no db')),
          findUnique: jest.fn().mockResolvedValue(assignmentRow({ status: 'reader1_done', report1: '结节 1.2cm' })),
        },
      })
      const service = new DualReadService(prisma)
      const a = await service.submitReader('da-db-5', 2, '磨玻璃影')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ report2: '磨玻璃影', status: 'both_done', discrepancyScore: expect.any(Number) }),
      }))
      const b = await service.submitReader('da-db-5', 2, '磨玻璃影')
      expect(a.discrepancyScore).toBe(b.discrepancyScore)
      expect(a.status).toBe('both_done')
    })

    it('submitReader 未知 id 抛 NotFound', async () => {
      const service = new DualReadService(makePrisma())
      await expect(service.submitReader('no-such-id', 1, '报告')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('仲裁 / 统计 / 列表', () => {
    it('arbitrate 落库更新且 discrepancyScore 对同一报告恒定', async () => {
      const update = jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) =>
        assignmentRow({ id: 'da-db-3', status: 'arbitrated', ...(args.data as object) }),
      )
      const prisma = makePrisma({
        report: { findFirst: jest.fn().mockRejectedValue(new Error('no db')) },
        dualReadAssignment: { create: jest.fn().mockRejectedValue(new Error('no db')), update, count: jest.fn().mockRejectedValue(new Error('no db')), findMany: jest.fn().mockRejectedValue(new Error('no db')) },
      })
      const service = new DualReadService(prisma)
      const a = await service.arbitrate('da-db-3', 'dr-005', 'Dr. Chen', '左侧基底节区急性脑梗死')
      const b = await service.arbitrate('da-db-3', 'dr-005', 'Dr. Chen', '左侧基底节区急性脑梗死')
      expect(a.status).toBe('arbitrated')
      expect(a.discrepancyScore).toBe(b.discrepancyScore)
      expect(update).toHaveBeenCalled()
    })

    it('discrepancyStats 基于 DB 聚合', async () => {
      const prisma = makePrisma({
        report: { findFirst: jest.fn().mockRejectedValue(new Error('no db')) },
        dualReadAssignment: {
          create: jest.fn().mockRejectedValue(new Error('no db')),
          update: jest.fn().mockRejectedValue(new Error('no db')),
          count: jest.fn().mockImplementation(async (args?: { where?: { status?: string } }) => (args?.where?.status === 'arbitrated' ? 2 : 5)),
          findMany: jest.fn().mockResolvedValue([{ discrepancyScore: 0.1 }, { discrepancyScore: 0.3 }]),
        },
      })
      const service = new DualReadService(prisma)
      const stats = await service.discrepancyStats()
      expect(stats).toEqual({ total: 5, arbitrated: 2, avgDiscrepancy: 0.2 })
    })

    it('list 返回 DB 行并映射为 DTO', async () => {
      const prisma = makePrisma({
        report: { findFirst: jest.fn().mockRejectedValue(new Error('no db')) },
        dualReadAssignment: {
          create: jest.fn().mockRejectedValue(new Error('no db')),
          update: jest.fn().mockRejectedValue(new Error('no db')),
          count: jest.fn().mockRejectedValue(new Error('no db')),
          findMany: jest.fn().mockResolvedValue([assignmentRow()]),
        },
      })
      const service = new DualReadService(prisma)
      const list = await service.list()
      expect(list).toHaveLength(1)
      expect(list[0]?.id).toBe('da-db-1')
      expect(list[0]?.simulated).toBeUndefined()
      expect(list[0]?.createdAt).toBe('2026-07-12T08:00:00.000Z')
    })

    it('arbitrate 内存回退时未知 id 抛 NotFound', async () => {
      const service = new DualReadService(makePrisma())
      await expect(service.arbitrate('no-such-id', 'dr-1', 'Dr. X', '报告')).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})
