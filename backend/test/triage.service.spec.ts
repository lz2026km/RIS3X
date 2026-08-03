import { NotFoundException } from '@nestjs/common'
import { TriageService, TriageExamInput } from '../src/modules/triage/triage.service'

describe('TriageService', () => {
  let svc: TriageService
  let mockPrisma: any

  const base: TriageExamInput = {
    examId: 'E1',
    patientId: 'P1',
    patientName: '张三',
    examType: 'CT头+CTA',
  }

  beforeEach(() => {
    mockPrisma = {
      triageRecord: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    svc = new TriageService(mockPrisma)
  })

  describe('score', () => {
    it('computes base exam weight for unknown exam type', async () => {
      const r = await svc.score({ ...base, examType: 'UnknownExam' })
      expect(r.score).toBe(4)
      expect(r.level).toBe('ROUTINE')
    })

    it('adds emergency keyword score (capped at 10)', async () => {
      const r = await svc.score({ ...base, symptoms: '突发卒中，考虑脑梗合并主动脉夹层，肺栓塞待排' })
      expect(r.score).toBeGreaterThanOrEqual(10 + 10)
      expect(r.level).toBe('CRITICAL')
      expect(r.factors.find((f) => f.name === '症状关键词')?.contribution).toBe(10)
    })

    it('adds referring dept weight', async () => {
      const r = await svc.score({ ...base, referringDept: '急诊科', patientAge: 2 })
      expect(r.factors.find((f) => f.name === '申请科室')?.weight).toBe(2)
      expect(r.factors.find((f) => f.name === '患者年龄')?.weight).toBe(3)
    })

    it('maps age brackets to weights', async () => {
      expect((await svc.score({ ...base, patientAge: 2 })).factors.find((f) => f.name === '患者年龄')?.weight).toBe(3)
      expect((await svc.score({ ...base, patientAge: 8 })).factors.find((f) => f.name === '患者年龄')?.weight).toBe(2)
      expect((await svc.score({ ...base, patientAge: 15 })).factors.find((f) => f.name === '患者年龄')?.weight).toBe(1)
      expect((await svc.score({ ...base, patientAge: 70 })).factors.find((f) => f.name === '患者年龄')?.weight).toBe(3)
      expect((await svc.score({ ...base, patientAge: 65 })).factors.find((f) => f.name === '患者年龄')?.weight).toBe(1.5)
      expect((await svc.score({ ...base, patientAge: 40 })).factors.find((f) => f.name === '患者年龄')?.weight).toBeUndefined()
    })

    it('maps score to levels', async () => {
      expect((await svc.score({ ...base, symptoms: '卒中 脑出血 主动脉夹层 肺栓塞' })).level).toBe('CRITICAL')
      expect((await svc.score({ ...base, examType: 'CT头', symptoms: '卒中卒中卒中' })).level).toBe('URGENT')
      expect((await svc.score({ ...base, examType: 'CT胸', symptoms: '卒中' })).level).toBe('SEMI_URGENT')
      expect((await svc.score({ ...base, examType: 'Unknown' })).level).toBe('ROUTINE')
    })

    it('persists via prisma create and updates when existing record found', async () => {
      mockPrisma.triageRecord.findFirst.mockResolvedValue(null)
      await svc.score(base)
      expect(mockPrisma.triageRecord.create).toHaveBeenCalled()
      mockPrisma.triageRecord.findFirst.mockResolvedValue({ id: 'triage-1', examId: 'E1' })
      await svc.score(base)
      expect(mockPrisma.triageRecord.update).toHaveBeenCalled()
    })

    it('returns pure score when DB fails', async () => {
      mockPrisma.triageRecord.findFirst.mockRejectedValue(new Error('db down'))
      const r = await svc.score(base)
      expect(r.score).toBeGreaterThan(0)
    })
  })

  describe('assign', () => {
    it('returns scored result with assigned doctor', async () => {
      mockPrisma.triageRecord.findFirst.mockResolvedValue(null)
      const r = await svc.assign(base)
      expect(r.assignedDoctor).toMatch(/^(张|李|王|刘)主任$|^(陈|赵|周|吴)医生$/)
      expect(r.level).toBeDefined()
      expect(mockPrisma.triageRecord.create).toHaveBeenCalled()
    })

    it('keeps assignment in memory when DB fails', async () => {
      mockPrisma.triageRecord.findFirst.mockRejectedValue(new Error('db down'))
      const r = await svc.assign({ ...base, examId: 'E9' })
      expect(r.assignedDoctor).toBeDefined()
      const pending = await svc.getPending()
      expect(pending.some((p) => p.examId === 'E9')).toBe(true)
    })
  })

  describe('getPending', () => {
    it('maps DB rows sorted by score desc', async () => {
      mockPrisma.triageRecord.findMany.mockResolvedValue([
        { id: 't1', examId: 'E1', patientId: 'P1', patientName: '张三', examType: 'CT', score: 20, status: 'ASSIGNED', assignedTo: '李主任', createdAt: new Date() },
        { id: 't2', examId: 'E2', patientId: 'P2', patientName: null, examType: null, score: 5, status: 'WEIRD', assignedTo: null, createdAt: new Date() },
      ])
      const pending = await svc.getPending()
      expect(pending[0].level).toBe('CRITICAL')
      expect(pending[1].patientName).toBe('')
      expect(pending[1].status).toBe('PENDING')
    })

    it('falls back to memory store sorted by score', async () => {
      mockPrisma.triageRecord.findMany.mockRejectedValue(new Error('db down'))
      mockPrisma.triageRecord.findFirst.mockRejectedValue(new Error('db down'))
      await svc.assign({ ...base, examId: 'E-A' })
      const pending = await svc.getPending()
      expect(pending).toHaveLength(1)
    })
  })

  describe('update', () => {
    it('updates via DB and maps result', async () => {
      mockPrisma.triageRecord.findUnique.mockResolvedValue({ id: 't1', examId: 'E1', patientId: 'P1', patientName: '张三', examType: 'CT', score: 8, status: 'PENDING', assignedTo: null, createdAt: new Date() })
      mockPrisma.triageRecord.update.mockResolvedValue({ id: 't1', examId: 'E1', patientId: 'P1', patientName: '张三', examType: 'CT', score: 8, status: 'COMPLETED', assignedTo: '王主任', createdAt: new Date() })
      const item = await svc.update('t1', { status: 'COMPLETED', assignedDoctor: '王主任' })
      expect(item.status).toBe('COMPLETED')
      expect(item.assignedDoctor).toBe('王主任')
    })

    it('rethrows NotFoundException when DB row missing', async () => {
      mockPrisma.triageRecord.findUnique.mockResolvedValue(null)
      await expect(svc.update('t1', { status: 'COMPLETED' })).rejects.toThrow(NotFoundException)
    })

    it('falls back to memory store and throws when absent', async () => {
      mockPrisma.triageRecord.findUnique.mockRejectedValue(new Error('db down'))
      mockPrisma.triageRecord.findFirst.mockRejectedValue(new Error('db down'))
      await svc.assign({ ...base, examId: 'E-M' })
      const pending = await svc.getPending()
      const item = await svc.update(pending[0].id, { assignedDoctor: '陈医生' })
      expect(item.assignedDoctor).toBe('陈医生')
      await expect(svc.update('ghost', { status: 'COMPLETED' })).rejects.toThrow(NotFoundException)
    })
  })
})
