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
})
