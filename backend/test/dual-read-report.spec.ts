/**
 * [G-21 Wave3C] 双阅完成 → 报告自动关联 spec
 *  - POST /dual-read/:id/complete: 双阅完成 → 自动创建报告(无)或关联已有报告 + 双阅结论写入 impression
 *  - GET  /dual-read/:id/report-link: 关联报告信息查询
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { DualReadService, dualReadConclusion } from '../src/modules/dual-read/dual-read.service'

const assignmentRow = (over: Record<string, unknown> = {}) => ({
  id: 'da-db-1',
  reportId: null,
  studyId: 'STU-DB-1',
  patientId: 'P-DB-1',
  patientName: 'DB Patient',
  modality: 'CT',
  reader1Id: 'dr-001',
  reader1Name: 'Dr. Wang',
  reader2Id: 'dr-003',
  reader2Name: 'Dr. Zhang',
  report1: '右肺上叶磨玻璃结节',
  report2: '右肺上叶磨玻璃密度影',
  status: 'both_done',
  discrepancyScore: 0.12,
  arbitrationReport: null,
  arbitratorId: null,
  arbitratorName: null,
  createdAt: new Date('2026-07-12T08:00:00Z'),
  ...over,
})

const reportRow = (over: Record<string, unknown> = {}) => ({
  id: 'rep-1',
  tenantId: 'default',
  patientId: 'P-DB-1',
  examId: 'exam-1',
  state: 'DRAFT',
  impression: '',
  ...over,
})

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const base = {
    report: {
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      findFirst: jest.fn().mockRejectedValue(new Error('no db')),
      create: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
    },
    exam: { findFirst: jest.fn().mockRejectedValue(new Error('no db')) },
    dualReadAssignment: {
      create: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
      count: jest.fn().mockRejectedValue(new Error('no db')),
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
    },
  }
  return { ...base, ...overrides } as never
}

describe('DualReadService 报告自动关联', () => {
  describe('dualReadConclusion', () => {
    it('仲裁报告优先作为双阅结论', () => {
      const c = dualReadConclusion({
        arbitrationReport: '左乳簇状分布点状钙化, BI-RADS 2 类',
        report1: '阅片一内容', report2: '阅片二内容',
        reader1Name: 'Dr. Wang', reader2Name: 'Dr. Zhang',
      })
      expect(c).toBe('左乳簇状分布点状钙化, BI-RADS 2 类')
    })

    it('无仲裁报告时合并双方结论', () => {
      const c = dualReadConclusion({
        report1: '右肺上叶磨玻璃结节', report2: '建议随访',
        reader1Name: 'Dr. Wang', reader2Name: 'Dr. Zhang',
      })
      expect(c).toContain('阅片医师一(Dr. Wang)')
      expect(c).toContain('阅片医师二(Dr. Zhang)')
    })
  })

  describe('complete', () => {
    it('pending 状态未完成双阅 → 抛 BadRequest', async () => {
      const prisma = makePrisma({
        dualReadAssignment: { findUnique: jest.fn().mockResolvedValue(assignmentRow({ status: 'pending' })) },
      })
      const service = new DualReadService(prisma)
      await expect(service.complete('da-db-1')).rejects.toBeInstanceOf(BadRequestException)
    })

    it('无已有报告 → 自动创建报告, created=true, 双阅结论写入 impression', async () => {
      const prisma = makePrisma({
        exam: { findFirst: jest.fn().mockResolvedValue({ id: 'exam-1' }) },
        report: {
          findUnique: jest.fn().mockRejectedValue(new Error('none')),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => reportRow({ ...(args.data as object) })),
          update: jest.fn().mockResolvedValue({}),
        },
        dualReadAssignment: {
          findUnique: jest.fn().mockResolvedValue(assignmentRow()),
          update: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => assignmentRow({ status: 'completed', ...(args.data as object) })),
        },
      })
      const service = new DualReadService(prisma)
      const res = await service.complete('da-db-1')
      expect(res.created).toBe(true)
      expect(res.report?.reportId).toBe('rep-1')
      expect(res.report?.examId).toBe('exam-1')
      expect(res.report?.impression).toContain('【双阅结论】')
      expect(res.report?.impression).toContain('右肺上叶磨玻璃结节')
      expect(res.assignment.status).toBe('completed')
    })

    it('已有报告 (reportId) → 关联并更新 impression, created=false', async () => {
      const update = jest.fn().mockResolvedValue({})
      const prisma = makePrisma({
        exam: { findFirst: jest.fn().mockResolvedValue({ id: 'exam-1' }) },
        report: {
          findUnique: jest.fn().mockResolvedValue(reportRow({ id: 'rep-existing', examId: 'exam-1' })),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(null),
          update,
        },
        dualReadAssignment: {
          findUnique: jest.fn().mockResolvedValue(assignmentRow({ reportId: 'rep-existing' })),
          update: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => assignmentRow({ status: 'completed', ...(args.data as object) })),
        },
      })
      const service = new DualReadService(prisma)
      const res = await service.complete('da-db-1')
      expect(res.created).toBe(false)
      expect(res.report?.reportId).toBe('rep-existing')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ impression: expect.stringContaining('【双阅结论】') }) }))
    })

    it('arbitrated 双阅以仲裁报告为结论写入报告', async () => {
      const prisma = makePrisma({
        exam: { findFirst: jest.fn().mockResolvedValue(null) },
        report: {
          findUnique: jest.fn().mockRejectedValue(new Error('none')),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => reportRow({ ...(args.data as object) })),
          update: jest.fn().mockResolvedValue({}),
        },
        dualReadAssignment: {
          findUnique: jest.fn().mockResolvedValue(assignmentRow({
            status: 'arbitrated',
            arbitrationReport: 'L4/5 椎间盘突出伴 L5/S1 膨出',
          })),
          update: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => assignmentRow({ status: 'completed', ...(args.data as object) })),
        },
      })
      const service = new DualReadService(prisma)
      const res = await service.complete('da-db-1')
      expect(res.report?.impression).toContain('L4/5 椎间盘突出伴 L5/S1 膨出')
      expect(res.report?.impression).not.toContain('右肺上叶')
    })

    it('DB 不可用 → 内存回退创建报告 (created=true) 且 reportLink 可查', async () => {
      const service = new DualReadService(makePrisma())
      const a = await service.assign('STU-MEM-1', 'Mem Patient', 'P-MEM', 'CT')
      await service.submitReader(a.id, 1, '未见明显异常')
      await service.submitReader(a.id, 2, '未见异常')
      const res = await service.complete(a.id)
      expect(res.created).toBe(true)
      expect(res.report?.reportId).toContain('rep-mem-')
      expect(res.report?.impression).toContain('【双阅结论】')
      const link = await service.reportLink(a.id)
      expect(link.linked).toBe(true)
      expect(link.report?.reportId).toBe(res.report?.reportId)
    })

    it('未知 id → NotFound', async () => {
      const service = new DualReadService(makePrisma())
      await expect(service.complete('no-such-id')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('reportLink', () => {
    it('DB 有 reportId → 返回关联报告信息', async () => {
      const prisma = makePrisma({
        dualReadAssignment: { findUnique: jest.fn().mockResolvedValue(assignmentRow({ reportId: 'rep-linked' })) },
        report: { findUnique: jest.fn().mockResolvedValue(reportRow({ id: 'rep-linked', state: 'WRITING' })) },
      })
      const service = new DualReadService(prisma)
      const res = await service.reportLink('da-db-1')
      expect(res.linked).toBe(true)
      expect(res.report?.reportId).toBe('rep-linked')
      expect(res.report?.state).toBe('WRITING')
    })

    it('未关联任何报告 → { linked: false }', async () => {
      const prisma = makePrisma({
        dualReadAssignment: { findUnique: jest.fn().mockResolvedValue(assignmentRow({ reportId: null })) },
        report: { findUnique: jest.fn().mockRejectedValue(new Error('none')), findFirst: jest.fn().mockResolvedValue(null) },
      })
      const service = new DualReadService(prisma)
      const res = await service.reportLink('da-db-1')
      expect(res.linked).toBe(false)
    })
  })
})
