/**
 * [G005 Wave1A P0] Eye Edu 教学病例库模块 spec — seed 回退 + DB 派生 + 内存 (标注/项目/脱敏/SR)
 */
import { EyeEduService } from '../src/modules/eye-edu/eye-edu.service'

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

describe('Wave1A Eye Edu Case Library', () => {
  it('listCases: DB 失败回退确定性 seed (success 信封)', async () => {
    const svc = new EyeEduService(failingPrisma())
    const res = await svc.listCases({})
    expect(res.success).toBe(true)
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.meta.total).toBeGreaterThan(0)
    expect(res.data.every((c) => c.id && c.patientName && c.modality)).toBe(true)
  })

  it('listCases: DB 有报告时派生病例 (EDU-DB- 前缀)', async () => {
    const prisma: any = {
      report: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'R1',
            findings: '双眼糖尿病视网膜病变',
            diagnosis: '糖尿病视网膜病变',
            impression: '建议随访',
            isCritical: false,
            createdAt: new Date('2026-07-01'),
            exam: { modality: 'OCT', bodyPart: '眼底' },
            patient: { name: '张三', id: 'P1' },
          },
        ]),
      },
    }
    const svc = new EyeEduService(prisma)
    const res = await svc.listCases({})
    expect(res.success).toBe(true)
    expect(res.data[0]!.id.startsWith('EDU-DB-')).toBe(true)
    expect(res.data[0]!.patientName).toBe('张三')
  })

  it('annotate: 保存标注到内存 + 详情可回读', async () => {
    const svc = new EyeEduService(failingPrisma())
    const ann = svc.annotate('EDU-001', { annotationType: 'roi', label: '视盘', coordinates: [[1, 2]] })
    expect(ann.success).toBe(true)
    expect(ann.data.annotationId).toBeTruthy()
    expect(ann.data.caseId).toBe('EDU-001')
    const detail = await svc.getCase('EDU-001')
    expect(detail.data.annotations.some((a: any) => a.label === '视盘')).toBe(true)
  })

  it('getCase: 不存在抛 NotFoundException', async () => {
    const svc = new EyeEduService(failingPrisma())
    await expect(svc.getCase('NOPE')).rejects.toThrow()
  })

  it('createCase + createProject: 内存创建', async () => {
    const svc = new EyeEduService(failingPrisma())
    const c = svc.createCase({ patientName: '测试患者', patientId: 'P-TEST' })
    expect(c.success).toBe(true)
    expect(c.data.status).toBe('draft')
    const p = svc.createProject({ name: 'DR 标注二期', total: 100 })
    expect(p.success).toBe(true)
    expect(p.data.status).toBe('in_progress')
    expect(svc.listProjects().data.some((x) => x.name === 'DR 标注二期')).toBe(true)
  })

  it('cohort/deidentify/exportSr/stats: 形状与 MSW 对齐', async () => {
    const svc = new EyeEduService(failingPrisma())
    const cohort = await svc.cohort({ disease: 'DR' })
    expect(cohort.success).toBe(true)
    expect(cohort.data.cohortId).toBeTruthy()
    const deid = svc.deidentify('EDU-001', 'basic')
    expect(deid.success).toBe(true)
    expect(deid.data.deidentifiedId).toBeTruthy()
    expect(deid.data.actions.length).toBeGreaterThan(0)
    const sr = svc.exportSr({ caseId: 'EDU-001', annotations: [{ annotationType: 'roi', label: '视盘' }], format: 'sr-tid1500' })
    expect(sr.success).toBe(true)
    expect(sr.data.sopInstanceUID).toContain('edu')
    expect(sr.data.contentSequence.length).toBe(1)
    const st = svc.stats('COH1')
    expect(st.success).toBe(true)
    expect(st.data.cohortId).toBe('COH1')
    expect(typeof st.data.demographics.meanAge).toBe('number')
  })
})
