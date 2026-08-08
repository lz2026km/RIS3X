import { NotFoundException } from '@nestjs/common'
import { EyeService } from './eye.service'

/**
 * [G005 W1-A] 眼科 API 对齐: 在用孤儿端点单元测试 (内存 seed + 假 Prisma)
 * 覆盖: pacs/studies 宽容模态匹配 / 详情 / 对比 / 危急值 / 视野 /
 *       视力记录 CRUD / 眼压记录 CRUD / 到检叫号 / 报告提交 / 草稿 / KPI
 */

const makePrisma = () => {
  const eyeStudies: any[] = []
  const patients: any[] = []
  const prisma = {
    eyeStudy: {
      findMany: async ({ where, include }: any = {}) => {
        if (where?.id) return eyeStudies.filter(s => s.id === where.id)
        return eyeStudies
      },
      findUnique: async ({ where, include }: any) =>
        eyeStudies.find(s => s.id === where.id) ?? null,
    },
    eyeAiInference: {
      findMany: async () => [],
      findUnique: async () => null,
    },
    patient: {
      findUnique: async ({ where }: any) => patients.find(p => p.id === where.id) ?? null,
    },
  }
  return { prisma: prisma as any, eyeStudies, patients }
}

describe('EyeService [G005 W1-A] 在用孤儿端点', () => {
  it('listPacsStudies 宽容匹配: ffa 命中 FA, visual_field 命中 VisualField', async () => {
    const { prisma } = makePrisma()
    const svc = new EyeService(prisma)
    const ffa = await svc.listPacsStudies({ modality: 'ffa' })
    expect(ffa.success).toBe(true)
    expect(ffa.data.some((s: any) => String(s.modality).toLowerCase() === 'fa')).toBe(true)
    const vf = await svc.listPacsStudies({ modality: 'visual_field' })
    expect(vf.success).toBe(true)
    expect(vf.data.some((s: any) => s.modality === 'VisualField')).toBe(true)
    const fundus = await svc.listPacsStudies({ modality: 'fundus_photo' })
    expect(fundus.success).toBe(true)
    expect(fundus.data.length).toBeGreaterThan(0)
  })

  it('getPacsStudy: seed 存在返回归一化形状 (patientName/eyeSide/studyDate)', async () => {
    const { prisma } = makePrisma()
    const svc = new EyeService(prisma)
    const res = await svc.getPacsStudy('ES-1001')
    expect(res.success).toBe(true)
    expect(res.data.studyId).toBe('ES-1001')
    expect(res.data.patientName).toBeTruthy()
    expect(res.data.eyeSide).toBeTruthy()
    expect(typeof res.data.measurements).toBe('object')
  })

  it('getPacsStudy: 不存在抛 NotFoundException', async () => {
    const { prisma } = makePrisma()
    const svc = new EyeService(prisma)
    await expect(svc.getPacsStudy('no-such')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('comparePacsStudies: 默认返回对比对数组', async () => {
    const { prisma } = makePrisma()
    const svc = new EyeService(prisma)
    const res = await svc.comparePacsStudies([])
    expect(res.success).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data[0]).toHaveProperty('priorModality')
    expect(res.data[0].measurements.length).toBeGreaterThan(0)
  })

  it('listCriticalValues / listVisualFields 返回数组', async () => {
    const { prisma } = makePrisma()
    const svc = new EyeService(prisma)
    const cv = await svc.listCriticalValues()
    expect(cv.success).toBe(true)
    expect(Array.isArray(cv.data)).toBe(true)
    expect(cv.data[0]).toHaveProperty('studyId')
    const vf = await svc.listVisualFields()
    expect(vf.success).toBe(true)
    expect(Array.isArray(vf.data)).toBe(true)
    expect(vf.data[0]).toHaveProperty('md')
  })

  it('视力记录 CRUD: 创建后可查询并删除', async () => {
    const { prisma } = makePrisma()
    const svc = new EyeService(prisma)
    const created = await svc.createVisionRecord({ patientId: 'PX-1', patientName: '测试', odUcva: 0.8, osUcva: 0.7 })
    expect(created.success).toBe(true)
    expect(created.data.id).toBeTruthy()
    const list = await svc.listVisionRecords({ patientId: 'PX-1' })
    expect(list.data.length).toBeGreaterThanOrEqual(1)
    await expect(svc.deleteVisionRecord(created.data.id)).resolves.toMatchObject({ success: true })
    await expect(svc.deleteVisionRecord(created.data.id)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('眼压记录 CRUD: 创建后可查询并删除', async () => {
    const { prisma } = makePrisma()
    const svc = new EyeService(prisma)
    const created = await svc.createIopRecord({ patientId: 'PX-1', patientName: '测试', od: 18, os: 20 })
    expect(created.success).toBe(true)
    const list = await svc.listIopRecords({ patientId: 'PX-1' })
    expect(list.data.some((r: any) => r.id === created.data.id)).toBe(true)
    await svc.deleteIopRecord(created.data.id)
    const after = await svc.listIopRecords({ patientId: 'PX-1' })
    expect(after.data.some((r: any) => r.id === created.data.id)).toBe(false)
  })

  it('checkin/start 预约更新状态, 不存在抛 NotFound', async () => {
    const { prisma } = makePrisma()
    const svc = new EyeService(prisma)
    const checked = await svc.checkinAppointment('APT-7001')
    expect(checked.success).toBe(true)
    expect(checked.data.status).toBe('arrived')
    const started = await svc.startAppointment('APT-7001')
    expect(started.data.status).toBe('in_progress')
    await expect(svc.checkinAppointment('no-such')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('submitReport 置为 pending_review, 不存在抛 NotFound', async () => {
    const { prisma } = makePrisma()
    const svc = new EyeService(prisma)
    const res = await svc.submitReport('ERPT-5001')
    expect(res.success).toBe(true)
    expect(res.data.status).toBe('pending_review')
    await expect(svc.submitReport('no-such')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('createReportDraft 返回草稿', async () => {
    const { prisma } = makePrisma()
    const svc = new EyeService(prisma)
    const res = await svc.createReportDraft({ reportId: 'ERPT-5001', content: '测试内容' })
    expect(res.success).toBe(true)
    expect(res.data.status).toBe('draft')
    expect(res.data.content).toBe('测试内容')
  })

  it('KPI: summary 字段完整 / quality-metrics / satisfaction', async () => {
    const { prisma } = makePrisma()
    const svc = new EyeService(prisma)
    const summary = await svc.getKpiSummary()
    expect(summary.success).toBe(true)
    for (const k of ['dailyExams', 'aiAdoption', 'avgWait', 'avgCost', 'criticalResponse', 'surgeryCount']) {
      expect(summary.data).toHaveProperty(k)
    }
    const qm = await svc.getQualityMetrics()
    expect(qm.data.length).toBeGreaterThan(0)
    expect(qm.data[0]).toHaveProperty('category')
    expect(qm.data[0]).toHaveProperty('target')
    const sat = await svc.getPatientSatisfaction()
    expect(sat.data.length).toBeGreaterThan(0)
    expect(sat.data[0]).toHaveProperty('overallScore')
  })
})
