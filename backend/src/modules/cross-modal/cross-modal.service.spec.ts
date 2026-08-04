import { CrossModalService } from './cross-modal.service'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const base = {
    exam: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      findFirst: jest.fn().mockRejectedValue(new Error('no db')),
    },
  }
  return { ...base, ...overrides } as never
}

const examRow = (over: Partial<{ id: string; accessionNumber: string; modality: string; bodyPart: string; scheduledAt: Date | null; patientId: string; patientName: string; findings: string }> = {}) => ({
  id: over.id ?? 'exam-1',
  accessionNumber: over.accessionNumber ?? 'ACC001',
  modality: over.modality ?? 'CT',
  bodyPart: over.bodyPart ?? '胸部',
  scheduledAt: over.scheduledAt ?? new Date('2026-07-10T08:00:00Z'),
  patientId: over.patientId ?? 'P001',
  patient: { name: over.patientName ?? 'Zhang San' },
  reports: over.findings ? [{ findings: over.findings }] : [],
})

describe('CrossModalService', () => {
  describe('真实检索 (DB 可用)', () => {
    let service: CrossModalService

    beforeEach(() => {
      const prisma = makePrisma({
        exam: {
          findMany: jest.fn().mockResolvedValue([
            examRow({ id: 'exam-1', modality: 'CT', patientName: 'Zhang San', findings: '右肺上叶结节' }),
            examRow({ id: 'exam-2', accessionNumber: 'ACC002', modality: 'MR', patientName: 'Li Si', bodyPart: '头颅' }),
          ]),
          findFirst: jest.fn().mockResolvedValue(examRow({ id: 'exam-1', modality: 'CT', patientName: 'Zhang San' })),
        },
      })
      service = new CrossModalService(prisma)
    })

    it('search 无查询词返回真实 Exam 记录且 simulated 未标注', async () => {
      const results = await service.search('')
      expect(results).toHaveLength(2)
      expect(results[0]?.simulated).toBeUndefined()
      expect(results[0]?.id).toBe('exam-1')
      expect(results[0]?.description).toContain('右肺上叶结节')
    })

    it('search 按关键词过滤 (患者名/检查类型/报告内容)', async () => {
      const byPatient = await service.search('Zhang')
      expect(byPatient).toHaveLength(1)
      expect(byPatient[0]?.patientId).toBe('P001')
      const byModality = await service.search('MR')
      expect(byModality).toHaveLength(1)
      expect(byModality[0]?.id).toBe('exam-2')
      const byFinding = await service.search('结节')
      expect(byFinding[0]?.id).toBe('exam-1')
    })

    it('findSimilar 同患者不同检查返回相似病例并按确定性 similarity 排序', async () => {
      const similar = await service.findSimilar('exam-2')
      expect(similar.length).toBeGreaterThan(0)
      expect(similar.every((s) => s.simulated === undefined)).toBe(true)
      const scores = similar.map((s) => s.similarity)
      expect([...scores].sort((a, b) => b - a)).toEqual(scores)
    })

    it('同一输入的确定性 similarity 恒定', async () => {
      const a = await service.search('CT')
      const b = await service.search('CT')
      expect(a[0]?.similarity).toBe(b[0]?.similarity)
    })
  })

  describe('回退 (DB 不可用/无数据)', () => {
    it('DB 异常时 search 回退 seed 并标注 simulated=true', async () => {
      const service = new CrossModalService(makePrisma())
      const results = await service.search('Zhang')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.simulated).toBe(true)
      expect(results[0]?.id).toBe('img-001')
    })

    it('DB 无数据时 findSimilar 回退 seed mock', async () => {
      const prisma = makePrisma({
        exam: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
      })
      const service = new CrossModalService(prisma)
      const similar = await service.findSimilar('img-002')
      expect(similar.length).toBeGreaterThan(0)
      expect(similar.every((s) => s.simulated === true)).toBe(true)
    })
  })
})
