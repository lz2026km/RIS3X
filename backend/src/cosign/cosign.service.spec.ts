import { BadRequestException, NotFoundException } from '@nestjs/common'
import { CosignService } from './cosign.service'

const reportRow = (over: Record<string, unknown> = {}) => ({
  id: 'rep-1',
  tenantId: 'default',
  patientId: 'P1',
  examId: 'EX-1',
  radiologistId: 'dr-1',
  state: 'CO_SIGN_REVIEW',
  findings: '',
  diagnosis: '',
  impression: '',
  recommendations: '',
  conclusion: '',
  rejectReason: null,
  reviewerId: null,
  coSignerId: null,
  coSignedAt: null,
  version: 1,
  createdAt: new Date('2026-08-01T08:00:00Z'),
  updatedAt: new Date('2026-08-01T08:00:00Z'),
  patient: { id: 'P1', name: '张明远' },
  exam: { modality: 'CT', bodyPart: '胸部' },
  radiologist: { id: 'dr-1', fullName: '李慧' },
  ...over,
})

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const base: Record<string, unknown> = {
    report: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      count: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
    },
    auditLog: {
      create: jest.fn().mockRejectedValue(new Error('no db')),
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      groupBy: jest.fn().mockRejectedValue(new Error('no db')),
    },
    systemConfig: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      create: jest.fn().mockRejectedValue(new Error('no db')),
    },
    ...overrides,
  }
  return base as never
}

const makeReports = (over: Record<string, unknown> = {}) => ({
  transition: jest.fn().mockImplementation(async (id: string, to: string, _actorId: string, reason?: string) =>
    reportRow({ id, state: to, rejectReason: to === 'REJECTED' ? reason : null }),
  ),
  ...over,
})

describe('CosignService', () => {
  describe('listPendingCosigns', () => {
    it('查询 Report 表 state=CO_SIGN_REVIEW(替代 auditLog)并映射业务字段', async () => {
      const findMany = jest.fn().mockResolvedValue([reportRow()])
      const prisma = makePrisma({
        report: {
          findMany,
          findUnique: jest.fn().mockRejectedValue(new Error('no db')),
          count: jest.fn().mockRejectedValue(new Error('no db')),
          update: jest.fn().mockRejectedValue(new Error('no db')),
        },
      })
      const service = new CosignService(prisma, makeReports() as never)
      const { data } = await service.listPendingCosigns()
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ state: 'CO_SIGN_REVIEW' }),
      }))
      expect(data).toHaveLength(1)
      expect(data[0]).toMatchObject({
        id: 'rep-1',
        reportId: 'rep-1',
        patientName: '张明远',
        modality: 'CT',
        bodyPart: '胸部',
        authorName: '李慧',
        status: 'CO_SIGN_REVIEW',
      })
      expect(data[0]?.waitingHours).toBeGreaterThanOrEqual(0)
    })
  })

  describe('approveCosign', () => {
    it('驱动 CO_SIGN_REVIEW → REVIEWED 并写 coSignerId/coSignedAt + auditLog', async () => {
      const reports = makeReports()
      const update = jest.fn().mockResolvedValue(reportRow({ state: 'REVIEWED' }))
      const auditCreate = jest.fn().mockResolvedValue({ id: 'log-1' })
      const prisma = makePrisma({
        report: {
          findUnique: jest.fn().mockResolvedValue(reportRow()),
          findMany: jest.fn().mockRejectedValue(new Error('no db')),
          count: jest.fn().mockRejectedValue(new Error('no db')),
          update,
        },
        auditLog: {
          create: auditCreate,
          findMany: jest.fn().mockRejectedValue(new Error('no db')),
          groupBy: jest.fn().mockRejectedValue(new Error('no db')),
        },
      })
      const service = new CosignService(prisma, reports as never)
      const { data } = await service.approveCosign('rep-1', 'dr-admin', { comment: '同意' })
      expect(reports.transition).toHaveBeenCalledWith('rep-1', 'REVIEWED', 'dr-admin', '同意')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ coSignerId: 'dr-admin' }),
      }))
      expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'APPROVE', resource: 'cosign', resourceId: 'rep-1', success: true }),
      }))
      expect(data[0]?.state).toBe('REVIEWED')
    })

    it('报告不在 CO_SIGN_REVIEW 时抛 400', async () => {
      const prisma = makePrisma({
        report: { findUnique: jest.fn().mockResolvedValue(reportRow({ state: 'REVIEWED' })) },
      })
      const service = new CosignService(prisma, makeReports() as never)
      await expect(service.approveCosign('rep-1', 'dr-2', {})).rejects.toBeInstanceOf(BadRequestException)
    })

    it('报告不存在时抛 404', async () => {
      const prisma = makePrisma({
        report: { findUnique: jest.fn().mockResolvedValue(null) },
      })
      const service = new CosignService(prisma, makeReports() as never)
      await expect(service.approveCosign('nope', 'dr-2', {})).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('rejectCosign', () => {
    it('驱动 CO_SIGN_REVIEW → REJECTED 并携带 rejectReason', async () => {
      const reports = makeReports()
      const auditCreate = jest.fn().mockResolvedValue({ id: 'log-2' })
      const prisma = makePrisma({
        report: { findUnique: jest.fn().mockResolvedValue(reportRow()) },
        auditLog: {
          create: auditCreate,
          findMany: jest.fn().mockRejectedValue(new Error('no db')),
          groupBy: jest.fn().mockRejectedValue(new Error('no db')),
        },
      })
      const service = new CosignService(prisma, reports as never)
      const { data } = await service.rejectCosign('rep-1', 'dr-admin', { reason: '影像与临床不符' })
      expect(reports.transition).toHaveBeenCalledWith('rep-1', 'REJECTED', 'dr-admin', '影像与临床不符')
      expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'REJECT', success: false }),
      }))
      expect(data[0]?.state).toBe('REJECTED')
    })

    it('报告不在 CO_SIGN_REVIEW 时抛 400', async () => {
      const prisma = makePrisma({
        report: { findUnique: jest.fn().mockResolvedValue(reportRow({ state: 'REVIEWED' })) },
      })
      const service = new CosignService(prisma, makeReports() as never)
      await expect(service.rejectCosign('rep-1', 'dr-2', { reason: 'x' })).rejects.toBeInstanceOf(BadRequestException)
    })
  })
})
