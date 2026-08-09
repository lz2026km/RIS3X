/**
 * [G005 Wave1B P1] Research 模块 spec — seed 回退 + DB 派生 + 进程内存
 */
import { ResearchService } from '../src/modules/research/research.service'

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

describe('Wave1B Research', () => {
  it('projects: DB 失败时回退确定性 seed', async () => {
    const svc = new ResearchService(failingPrisma())
    const projects = await svc.listProjects()
    expect(projects.length).toBeGreaterThan(0)
    expect(projects.every((p) => p.code && p.name && p.leader)).toBe(true)
  })

  it('projects: DB 有检查时派生课题 (bodyPart 分组)', async () => {
    const prisma: any = {
      exam: {
        findMany: jest.fn().mockResolvedValue([
          { bodyPart: '胸部', modality: 'CT', createdAt: new Date() },
          { bodyPart: '胸部', modality: 'CT', createdAt: new Date() },
          { bodyPart: '头颅', modality: 'MR', createdAt: new Date() },
        ]),
      },
    }
    const svc = new ResearchService(prisma)
    const projects = await svc.listProjects()
    expect(projects.length).toBeGreaterThan(0)
    const chest = projects.find((p) => p.name.includes('胸部'))
    expect(chest?.dataCount).toBe(2)
  })

  it('createProject: 进程内存新增', async () => {
    const svc = new ResearchService(failingPrisma())
    const created = await svc.createProject({ name: '测试课题', leader: '王教授' })
    const projects = await svc.listProjects()
    expect(projects.some((p) => p.id === created.id)).toBe(true)
  })

  it('exam-records: DB 派生检查记录 (患者信息 + 报告诊断)', async () => {
    const prisma: any = {
      exam: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'E1',
            patientId: 'P1',
            modality: 'CT',
            bodyPart: '胸部',
            scheduledAt: new Date('2026-07-28'),
            createdAt: new Date(),
            patient: { name: '张三', gender: 'MALE', birthDate: new Date('1970-01-01'), idCard: 'X', phone: '138' },
            reports: [{ diagnosis: '右肺结节', findings: '磨玻璃结节' }],
          },
        ]),
      },
    }
    const svc = new ResearchService(prisma)
    const records = await svc.listExamRecords()
    expect(records).toHaveLength(1)
    expect(records[0]!.patientName).toBe('张三')
    expect(records[0]!.gender).toBe('男')
    expect(records[0]!.result).toBe('阳性')
  })

  it('labels / irb / cohorts: seed + 内存创建', async () => {
    const svc = new ResearchService(failingPrisma())
    expect((await svc.listLabels()).length).toBeGreaterThan(0)
    const label = svc.createLabel({ name: '新标签' })
    expect(svc.listLabels().some((l) => l.id === label.id)).toBe(true)

    expect(svc.listIRBSubmissions().length).toBeGreaterThan(0)
    const irb = svc.createIRBSubmission({ projectName: '课题A' })
    expect(svc.listIRBSubmissions().some((i) => i.id === irb.id)).toBe(true)

    expect(svc.listCohorts().length).toBeGreaterThan(0)
    const cohort = svc.createCohort({ name: '队列B' })
    expect(svc.listCohorts().some((c) => c.id === cohort.id)).toBe(true)
  })

  it('exports / export-audit: DB 失败时 seed; quality-scores 派生', async () => {
    const svc = new ResearchService(failingPrisma())
    const exports = await svc.listExportRecords()
    expect(exports.length).toBeGreaterThan(0)
    expect(exports.every((e) => e.downloadUrl)).toBe(true)
    const audit = await svc.listExportAudit()
    expect(audit.length).toBeGreaterThan(0)

    const prisma: any = {
      reportQualityScore: {
        findMany: jest.fn().mockResolvedValue([
          { totalScore: 95, grade: '优秀' },
          { totalScore: 88, grade: '良好' },
          { totalScore: 50, grade: '不合格' },
        ]),
      },
    }
    const svc2 = new ResearchService(prisma)
    const quality = await svc2.listQualityScores()
    expect(quality.some((q) => q.consistency > 0)).toBe(true)
  })
})
