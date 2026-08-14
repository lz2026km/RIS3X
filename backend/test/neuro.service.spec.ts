/**
 * [G005 Wave1A 17] Neuro 神经专科模块 spec — seed 回退 + DB 派生 + 确定性分析规则
 */
import { NeuroService } from '../src/modules/neuro/neuro.service'

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

describe('Wave1A Neuro 神经专科模块', () => {
  it('listStudies: DB 失败回退确定性 seed (12 例, success 信封)', async () => {
    const svc = new NeuroService(failingPrisma())
    const res = await svc.listStudies()
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(12)
    expect(res.meta.total).toBe(12)
    const types = new Set(res.data.map((s) => s.type))
    expect(types.has('stroke')).toBe(true)
    expect(types.has('tumor')).toBe(true)
    expect(types.has('epilepsy')).toBe(true)
    expect(types.has('aneurysm')).toBe(true)
    expect(res.data.every((s) => s.id && s.patientName && s.modality && s.date)).toBe(true)
  })

  it('listStudies: type/search 过滤', async () => {
    const svc = new NeuroService(failingPrisma())
    const strokes = await svc.listStudies({ type: 'stroke' })
    expect(strokes.data.length).toBe(4)
    expect(strokes.data.every((s) => s.type === 'stroke')).toBe(true)
    const search = await svc.listStudies({ search: '张伟' })
    expect(search.data.length).toBe(1)
    expect(search.data[0]!.id).toBe('NX001')
  })

  it('getStudy: 详情含报告/影像信息; 不存在抛 NotFoundException', async () => {
    const svc = new NeuroService(failingPrisma())
    const detail = await svc.getStudy('NX001')
    expect(detail.data.patientName).toBe('张伟')
    expect(detail.data.findings).toBeTruthy()
    expect(detail.data.impression).toContain('取栓')
    expect(detail.data.accessionNumber).toBe('ACC-NX001')
    await expect(svc.getStudy('NOPE')).rejects.toThrow()
  })

  it('stats: 分类计数与疾病分布 (seed: 卒中4/肿瘤4/癫痫2/动脉瘤2/LVO2/待报告2)', async () => {
    const svc = new NeuroService(failingPrisma())
    const res = await svc.stats()
    expect(res.success).toBe(true)
    expect(res.data.strokeCount).toBe(4)
    expect(res.data.tumorCount).toBe(4)
    expect(res.data.epilepsyCount).toBe(2)
    expect(res.data.aneurysmCount).toBe(2)
    expect(res.data.lvoPositive).toBe(2)
    expect(res.data.pendingReports).toBe(2)
    expect(res.data.diseaseDistribution).toHaveLength(4)
    expect(res.data.diseaseDistribution.reduce((s, d) => s + d.count, 0)).toBe(12)
  })

  it('tumorGrades: 分级/类型分布', async () => {
    const svc = new NeuroService(failingPrisma())
    const res = await svc.tumorGrades()
    expect(res.success).toBe(true)
    expect(res.data.grades.length).toBeGreaterThan(0)
    expect(res.data.grades.find((g) => g.grade === 'I')?.count).toBeGreaterThanOrEqual(2)
    expect(res.data.types.some((t) => t.label === 'meningioma')).toBe(true)
  })

  it('strokeWindows: 4 窗口, 窗内判定 (发病/成像时间差)', async () => {
    const svc = new NeuroService(failingPrisma())
    const res = await svc.strokeWindows()
    expect(res.success).toBe(true)
    expect(res.data).toHaveLength(4)
    expect(res.data.every((w) => w.color && w.count >= 0)).toBe(true)
    expect(res.data[0]!.count).toBeGreaterThanOrEqual(1)
    const total = res.data.reduce((s, w) => s + w.count, 0)
    expect(total).toBe(4)
    const analyze = svc.analyze('NX001')
    expect(analyze.data.analysis.hoursFromOnset).toBe(2.5)
    expect(analyze.data.analysis.window).toBe('0-3h (IV tPA)')
    expect(analyze.data.analysis.withinWindow).toBe(true)
  })

  it('analyze: LVO 疑似 + ASPECTS 确定性派生 (NX007: 6分/MCA-R → LVO)', () => {
    const svc = new NeuroService(failingPrisma())
    const res = svc.analyze('NX007')
    expect(res.success).toBe(true)
    expect(res.data.queued).toBe(true)
    expect(res.data.studyId).toBe('NX007')
    expect(res.data.analysis.lvoSuspect).toBe(true)
    expect(res.data.analysis.aspectScore).toBe(6)
    expect(res.data.analysis.window).toBe('0-3h (IV tPA)')
    expect(typeof res.data.analysis.confidence).toBe('number')
  })

  it('analyze: 肿瘤/癫痫/动脉瘤分支 + 未知 studyId 抛 NotFoundException', () => {
    const svc = new NeuroService(failingPrisma())
    const tumor = svc.analyze('NX005')
    expect(tumor.data.analysis.grade).toBe('IV')
    expect(tumor.data.analysis.malignancyHint).toBe(true)
    const epi = svc.analyze('NX004')
    expect(epi.data.analysis.surgicalCandidate).toBe(true)
    const aneu = svc.analyze('NX006')
    expect(aneu.data.analysis.ruptureRisk).toBe('moderate')
    expect(() => svc.analyze('NOPE')).toThrow()
  })

  it('listStudies: DB 有神经检查时派生 (NX-DB- 前缀, 报告关键词分类)', async () => {
    const prisma: any = {
      exam: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'E1',
            accessionNumber: 'ACC-DB-0001',
            modality: 'MRI',
            bodyPart: '头颅',
            techNotes: '急性脑梗死',
            completedAt: new Date('2026-08-10T09:00:00.000Z'),
            createdAt: new Date('2026-08-10T08:00:00.000Z'),
            deviceId: 'DEV-MR-9',
            patient: { name: '王五', gender: 'MALE', birthDate: new Date('1958-04-01') },
            reports: [
              {
                state: 'SIGNED',
                diagnosis: '右侧基底节区脑梗死',
                impression: '急性缺血性卒中',
                findings: '右侧基底节低密度灶',
                radiologist: { fullName: '李医生' },
              },
            ],
          },
        ]),
      },
    }
    const svc = new NeuroService(prisma)
    const res = await svc.listStudies()
    expect(res.success).toBe(true)
    expect(res.data.length).toBe(1)
    const s = res.data[0]!
    expect(s.id.startsWith('NX-DB-')).toBe(true)
    expect(s.patientName).toBe('王五')
    expect(s.type).toBe('stroke')
    expect(s.status).toBe('reported')
    expect(s.radiologist).toBe('李医生')
    expect(s.findings).toContain('低密度灶')
  })
})
