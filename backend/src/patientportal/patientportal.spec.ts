/**
 * G005 RIS v3.0.6.11-75 (W5) - PatientPortalService 宣教资料写入测试
 * POST /patient-portal/education + DELETE /patient-portal/education/:key
 */
import { PatientPortalService } from './patientportal.service'
import { NotFoundException } from '@nestjs/common'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    systemConfig: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      create: jest.fn().mockRejectedValue(new Error('no db')),
      delete: jest.fn().mockRejectedValue(new Error('no db')),
    },
    ...overrides,
  }
  return prisma as never
}

describe('PatientPortalService (W5 education write)', () => {
  describe('createEducation', () => {
    it('persists education_<key> row and returns material record', async () => {
      const create = jest.fn().mockResolvedValue({})
      const service = new PatientPortalService(makePrisma({ systemConfig: { create } }))
      const res = await service.createEducation({
        title: 'CT注意事项',
        category: 'pre_exam',
        contentType: 'video',
        content: '正文内容',
        summary: '摘要',
        tags: ['CT'],
        duration: 90,
      })
      expect(res.data.key).toMatch(/^education_/)
      expect(res.data.title).toBe('CT注意事项')
      expect(create).toHaveBeenCalledTimes(1)
      const data = create.mock.calls[0][0].data
      expect(data.key).toBe(res.data.key)
      expect((data.value as any).content).toBe('正文内容')
    })
  })

  describe('deleteEducation', () => {
    it('throws 404 when key does not start with education_', async () => {
      const service = new PatientPortalService(makePrisma({}))
      await expect(service.deleteEducation('hack_key')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('throws 404 when row does not exist', async () => {
      const service = new PatientPortalService(
        makePrisma({ systemConfig: { findUnique: jest.fn().mockResolvedValue(null), delete: jest.fn() } }),
      )
      await expect(service.deleteEducation('education_missing')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('deletes existing education row', async () => {
      const del = jest.fn().mockResolvedValue({})
      const service = new PatientPortalService(
        makePrisma({
          systemConfig: {
            findUnique: jest.fn().mockResolvedValue({ key: 'education_123' }),
            delete: del,
          },
        }),
      )
      const res = await service.deleteEducation('education_123')
      expect(res.data).toEqual({ deleted: true, key: 'education_123' })
      expect(del).toHaveBeenCalledWith({ where: { key: 'education_123' } })
    })
  })

  // [v3.0.6.11-99 Wave7B] 患者自助随访 (移动 H5): GET /patient-portal/followups + POST .../:id/complete
  describe('listFollowups', () => {
    it('returns seed followups filtered by patientId when DB empty', async () => {
      const service = new PatientPortalService(
        makePrisma({ followUpPlan: { findMany: jest.fn().mockRejectedValue(new Error('no db')) } }),
      )
      const res = await service.listFollowups('P001')
      expect(Array.isArray(res.data)).toBe(true)
      expect(res.data.length).toBeGreaterThan(0)
      expect(res.data.every((f: any) => f.patientId === 'P001')).toBe(true)
      expect(res.data[0]).toHaveProperty('planDate')
      expect(res.data[0]).toHaveProperty('nextDate')
      expect(res.data[0]).toHaveProperty('reminderEnabled')
    })

    it('returns DB plans when present', async () => {
      const findMany = jest.fn().mockResolvedValue([
        {
          id: 'FU-1', patientId: 'P001', patientName: '张三',
          planDate: new Date(), intervalDays: 30, nextDate: new Date(Date.now() + 86400000),
          status: 'PENDING', note: 'x', reminderEnabled: true,
          completedAt: null, createdAt: new Date(), updatedAt: new Date(),
        },
      ])
      const service = new PatientPortalService(makePrisma({ followUpPlan: { findMany } }))
      const res = await service.listFollowups('P001')
      expect(res.data).toHaveLength(1)
      expect(res.data[0].id).toBe('FU-1')
      expect(findMany).toHaveBeenCalled()
    })
  })

  describe('completeFollowup', () => {
    it('completes an existing DB plan', async () => {
      const update = jest.fn().mockImplementation(({ data }: any) => Promise.resolve({
        id: 'FU-1', patientId: 'P001', patientName: '张三',
        planDate: new Date(), intervalDays: 30, nextDate: new Date(Date.now() + 86400000),
        status: 'COMPLETED', note: 'x', reminderEnabled: true, completedAt: data.completedAt,
        createdAt: new Date(), updatedAt: new Date(),
      }))
      const service = new PatientPortalService(
        makePrisma({
          followUpPlan: {
            findUnique: jest.fn().mockResolvedValue({ id: 'FU-1', status: 'PENDING' }),
            update,
          },
        }),
      )
      const res = await service.completeFollowup('FU-1')
      expect(res.data.status).toBe('COMPLETED')
      expect(res.data.completedAt).toBeTruthy()
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'FU-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }))
    })

    it('completes seed plan when DB unavailable', async () => {
      const service = new PatientPortalService(
        makePrisma({ followUpPlan: { findUnique: jest.fn().mockRejectedValue(new Error('no db')) } }),
      )
      const res = await service.completeFollowup('FU-P001-001')
      expect(res.data.status).toBe('COMPLETED')
      expect(res.data.completedAt).toBeTruthy()
    })

    it('throws 404 for unknown plan', async () => {
      const service = new PatientPortalService(
        makePrisma({ followUpPlan: { findUnique: jest.fn().mockResolvedValue(null) } }),
      )
      await expect(service.completeFollowup('FU-NOPE')).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})
