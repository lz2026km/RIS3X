/**
 * [G005 Wave1B P1] Diagnosis Accuracy 模块 spec — Report 审核结果派生 + seed 回退
 */
import { DiagnosisAccuracyService } from '../src/modules/diagnosis-accuracy/diagnosis-accuracy.service'

function failingPrisma(): any {
  return new Proxy(
    {},
    {
      get: () => () => {
        throw new Error('no db (verification stub)')
      },
    },
  )
}

describe('Wave1B Diagnosis Accuracy', () => {
  it('getAccuracy: DB 失败时回退确定性 seed (demo)', async () => {
    const svc = new DiagnosisAccuracyService(failingPrisma())
    const res = await svc.getAccuracy()
    expect(res.source).toBe('demo')
    expect(res.data.accuracyRate).toBeGreaterThan(0)
    expect(res.data.byModality.length).toBeGreaterThan(0)
    expect(res.data.byDisease.length).toBeGreaterThan(0)
    expect(res.data.totalReports).toBeGreaterThan(0)
  })

  it('getAccuracy: 从报告审核结果派生 (rectificationCount → 准确率)', async () => {
    const prisma: any = {
      report: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'R1', diagnosis: '肺结节', rectificationCount: 0, exam: { modality: 'CT' } },
          { id: 'R2', diagnosis: '肺结节', rectificationCount: 1, exam: { modality: 'CT' } },
          { id: 'R3', diagnosis: '骨折', rectificationCount: 0, exam: { modality: 'DR' } },
        ]),
      },
      reportQualityScore: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    const svc = new DiagnosisAccuracyService(prisma)
    const res = await svc.getAccuracy()
    expect(res.source).toBe('database')
    expect(res.data.totalReports).toBe(3)
    expect(res.data.accuracyRate).toBeCloseTo(66.7, 0)
    const chest = res.data.byDisease.find((d) => d.disease === '肺结节')
    expect(chest?.count).toBe(2)
    const ct = res.data.byModality.find((m) => m.modality === 'CT')
    expect(ct?.count).toBe(2)
  })
})
