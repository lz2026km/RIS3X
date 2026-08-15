import { BadRequestException } from '@nestjs/common'
import { WorklistService } from '../src/modules/worklist/worklist.service'

// [v3.0.6.11-100 Wave 1B] 重拍率统计 + 原因分类: GET /worklist/retake-stats + retakeReason 登记
describe('WorklistService Wave1B (retake stats + retakeReason)', () => {
  let svc: WorklistService
  let mockPrisma: any

  const day = (offsetDays: number) => new Date(Date.now() - offsetDays * 86400000)
  const mkExam = (overrides: Record<string, unknown>) => ({
    id: 'E1',
    tenantId: 'default',
    patientId: 'P1',
    modality: 'CT',
    state: 'COMPLETED',
    retakeCount: 0,
    completedAt: day(1),
    device: { id: 'D1', name: 'CT-01' },
    ...overrides,
  })
  const mkOp = (examId: string, fullName: string) => ({
    examId,
    actorId: `u-${fullName}`,
    actor: { fullName },
  })

  beforeEach(() => {
    mockPrisma = {
      exam: { findMany: jest.fn() },
      worklistOp: { findMany: jest.fn() },
    }
    svc = new WorklistService(mockPrisma)
  })

  describe('getRetakeStats', () => {
    it('defaults dimension to reason and window to last 30 days', async () => {
      mockPrisma.exam.findMany.mockResolvedValue([
        mkExam({ id: 'E1', retakeCount: 1, retakeReason: 'motion_artifact' }),
        mkExam({ id: 'E2', retakeCount: 0 }),
      ])
      mockPrisma.worklistOp.findMany.mockResolvedValue([])
      const r = await svc.getRetakeStats({})
      expect(r.dimension).toBe('reason')
      expect(r.summary.totalCompleted).toBe(2)
      expect(r.summary.totalRetakes).toBe(1)
      expect(r.summary.retakeRate).toBe(50)
      expect(r.breakdown[0]).toMatchObject({ key: 'motion_artifact', label: '运动伪影', retakes: 1 })
    })

    it('aggregates by technician dimension from COMPLETE ops', async () => {
      mockPrisma.exam.findMany.mockResolvedValue([
        mkExam({ id: 'E1', retakeCount: 1, retakeReason: 'positioning' }),
        mkExam({ id: 'E2', retakeCount: 0 }),
        mkExam({ id: 'E3', retakeCount: 2, retakeReason: 'equipment' }),
      ])
      mockPrisma.worklistOp.findMany.mockResolvedValue([
        mkOp('E1', '王技师'),
        mkOp('E2', '王技师'),
        mkOp('E3', '李技师'),
      ])
      const r = await svc.getRetakeStats({ dimension: 'tech' })
      expect(r.dimension).toBe('tech')
      expect(r.breakdown).toHaveLength(2)
      const wang = r.breakdown.find((b) => b.label === '王技师')!
      expect(wang).toMatchObject({ completed: 2, retakes: 1, rate: 50 })
      const li = r.breakdown.find((b) => b.label === '李技师')!
      expect(li).toMatchObject({ completed: 1, retakes: 2, rate: 200 })
    })

    it('aggregates by modality with retakeCount totals', async () => {
      mockPrisma.exam.findMany.mockResolvedValue([
        mkExam({ id: 'E1', modality: 'CT', retakeCount: 1 }),
        mkExam({ id: 'E2', modality: 'MR', retakeCount: 0 }),
        mkExam({ id: 'E3', modality: 'CT', retakeCount: 0 }),
      ])
      mockPrisma.worklistOp.findMany.mockResolvedValue([])
      const r = await svc.getRetakeStats({ dimension: 'modality' })
      const ct = r.breakdown.find((b) => b.key === 'CT')!
      expect(ct).toMatchObject({ completed: 2, retakes: 1, rate: 50 })
    })

    it('builds daily trend with dates in range and rate', async () => {
      const exams = [
        mkExam({ id: 'E1', retakeCount: 1, completedAt: day(1) }),
        mkExam({ id: 'E2', retakeCount: 0, completedAt: day(1) }),
        mkExam({ id: 'E3', retakeCount: 1, completedAt: day(2) }),
      ]
      mockPrisma.exam.findMany.mockResolvedValue(exams)
      mockPrisma.worklistOp.findMany.mockResolvedValue([])
      const fromKey = day(5).toISOString().slice(0, 10)
      const toKey = day(0).toISOString().slice(0, 10)
      const r = await svc.getRetakeStats({ from: fromKey, to: toKey })
      // 本地时区 dateKey (避免 toISOString UTC 跨日错位)
      const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const local1 = r.trend.find((t) => t.date === localKey(day(1)))!
      const local2 = r.trend.find((t) => t.date === localKey(day(2)))!
      expect(local1).toMatchObject({ completed: 2, retakes: 1, rate: 50 })
      expect(local2).toMatchObject({ completed: 1, retakes: 1, rate: 100 })
      expect(r.trend.length).toBeGreaterThanOrEqual(4)
      expect(r.trend.every((t) => t.rate >= 0)).toBe(true)
    })

    it('respects from/to window filtering completed exams', async () => {
      mockPrisma.exam.findMany.mockResolvedValue([
        mkExam({ id: 'E1', retakeCount: 1, completedAt: day(10) }),
        mkExam({ id: 'E2', retakeCount: 0, completedAt: day(1) }),
      ])
      mockPrisma.worklistOp.findMany.mockResolvedValue([])
      const r = await svc.getRetakeStats({ from: day(3).toISOString().slice(0, 10), to: day(0).toISOString().slice(0, 10) })
      expect(r.summary.totalCompleted).toBe(1)
      expect(r.summary.totalRetakes).toBe(0)
    })

    it('classifies retakes without reason as 未分类', async () => {
      mockPrisma.exam.findMany.mockResolvedValue([
        mkExam({ id: 'E1', retakeCount: 2 }),
      ])
      mockPrisma.worklistOp.findMany.mockResolvedValue([])
      const r = await svc.getRetakeStats({ dimension: 'reason' })
      const unclassified = r.breakdown.find((b) => b.key === 'unknown')
      expect(unclassified).toMatchObject({ label: '未分类', retakes: 2 })
    })

    it('falls back to deterministic seed when DB empty', async () => {
      mockPrisma.exam.findMany.mockResolvedValue([])
      mockPrisma.worklistOp.findMany.mockResolvedValue([])
      const r = await svc.getRetakeStats({ dimension: 'reason' })
      expect(r.summary.totalCompleted).toBeGreaterThan(0)
      expect(r.breakdown[0]!.key).toBe('motion_artifact')
      expect(r.trend.length).toBeGreaterThan(0)
    })
  })

  describe('updateQcState retakeReason', () => {
    it('stores retakeReason into extras on retake registration (QC_REJECT → IN_PROGRESS)', async () => {
      const base = { id: 'E1', tenantId: 'default', patientId: 'P1', state: 'QC_REJECT', retakeCount: 0, qcNotes: null, patient: {} }
      // DB 未迁移新列 → 首次 update 失败 → 回退 base 更新成功 → extras 合并
      const update = jest.fn()
        .mockRejectedValueOnce(new Error('no column retake_reason'))
        .mockResolvedValueOnce({ ...base, state: 'IN_PROGRESS', retakeCount: 1, qcNotes: '重拍登记 第 1 次: 体位偏移 [positioning]' })
      const prisma = {
        exam: { findUnique: jest.fn().mockResolvedValue(base), update },
      }
      const service = new WorklistService(prisma as never)
      const res = (await service.updateQcState('E1', 'IN_PROGRESS', '体位偏移', { retakeReason: 'positioning' })) as unknown as Record<string, unknown>
      expect(res.retakeCount).toBe(1)
      expect(res.retakeReason).toBe('positioning')
      expect(res.retakeReasons).toEqual(['positioning'])
      expect(String(res.qcNotes)).toContain('重拍登记 第 1 次')
      expect(String(res.qcNotes)).toContain('positioning')
      // 回退更新只含 base 字段 (retakeReason 走内存)
      expect(update.mock.calls[1]![0].data).not.toHaveProperty('retakeReason')
    })

    it('appends multiple retake reasons across registrations', async () => {
      const base = { id: 'E1', tenantId: 'default', patientId: 'P1', state: 'QC_REJECT', retakeCount: 0, qcNotes: null, patient: {} }
      const findUnique = jest.fn()
        .mockResolvedValueOnce(base)
        .mockResolvedValueOnce({
          id: 'E1', tenantId: 'default', patientId: 'P1', state: 'QC_REJECT', retakeCount: 1,
          qcNotes: '重拍登记 第 1 次', retakeReason: 'motion_artifact', retakeReasons: ['motion_artifact'], patient: {},
        })
      const update = jest.fn()
        .mockRejectedValueOnce(new Error('no column retake_reason'))
        .mockResolvedValueOnce({ id: 'E1', tenantId: 'default', patientId: 'P1', state: 'IN_PROGRESS', retakeCount: 1, qcNotes: '重拍登记 第 1 次', patient: {} })
        .mockRejectedValueOnce(new Error('no column retake_reason'))
        .mockResolvedValueOnce({ id: 'E1', tenantId: 'default', patientId: 'P1', state: 'IN_PROGRESS', retakeCount: 2, qcNotes: '重拍登记 第 2 次', patient: {} })
      const prisma = { exam: { findUnique, update } }
      const service = new WorklistService(prisma as never)
      await service.updateQcState('E1', 'IN_PROGRESS', '', { retakeReason: 'motion_artifact' })
      const res = (await service.updateQcState('E1', 'IN_PROGRESS', '', { retakeReason: 'equipment' })) as unknown as Record<string, unknown>
      expect(res.retakeCount).toBe(2)
      expect(res.retakeReasons).toEqual(['motion_artifact', 'equipment'])
    })

    it('rejects retake registration from non-QC_REJECT state', async () => {
      const base = { id: 'E1', tenantId: 'default', patientId: 'P1', state: 'SCHEDULED', retakeCount: 0, patient: {} }
      const prisma = {
        exam: { findUnique: jest.fn().mockResolvedValue(base), update: jest.fn() },
      }
      const service = new WorklistService(prisma as never)
      await expect(service.updateQcState('E1', 'IN_PROGRESS', '', { retakeReason: 'other' }))
        .rejects.toBeInstanceOf(BadRequestException)
    })
  })
})
