/**
 * [W3-B] 孤儿模块 controller/service 运行时回归测试 (seed 回退 + 内存态)
 * 不依赖数据库: prisma 用抛错 stub, 验证确定性 seed 回退与状态流转。
 * 覆盖: remote-reading / clinical-pathways / nuclear-stats / screening /
 *       dicom-share / treatment-plans / hl7 mllp 管理方法
 */
import { RemoteReadingService } from '../src/modules/remote-reading/remote-reading.service'
import { ClinicalPathwayService } from '../src/modules/clinical-pathways/clinical-pathway.service'
import { NuclearStatsService } from '../src/modules/nuclear-stats/nuclear-stats.service'
import { ScreeningService } from '../src/modules/screening/screening.service'
import { DicomShareService } from '../src/modules/dicom-share/dicom-share.service'
import { TreatmentPlanService } from '../src/modules/treatment-plans/treatment-plan.service'
import { Hl7Service } from '../src/hl7/hl7.service'

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

describe('W3-B orphan modules runtime', () => {
  it('remote-reading: seed fallback + lifecycle', async () => {
    const svc = new RemoteReadingService(failingPrisma())
    const sessions = await svc.listSessions({})
    expect(sessions.length).toBeGreaterThan(0)
    const stats = await svc.getStats()
    expect(stats.totalSessions).toBe(sessions.length)
    const created = await svc.createSession({ studyId: 'S1', readingDoctorId: 'D1', priority: 'urgent' })
    expect(created.status).toBe('pending')
    await svc.startReading(created.id)
    expect((await svc.getSession(created.id)).status).toBe('in_progress')
    await svc.completeReading(created.id, '未见异常')
    const done = await svc.getSession(created.id)
    expect(done.status).toBe('completed')
    expect(done.report).toBe('未见异常')
  })

  it('clinical-pathways: list + stats + enroll', async () => {
    const svc = new ClinicalPathwayService(failingPrisma())
    const list = await svc.listPathways()
    expect(list.length).toBeGreaterThan(0)
    const stats = await svc.getStats()
    expect(stats.active).toBeGreaterThan(0)
    const patient = await svc.enrollPatient({ patientName: '测试', pathwayName: '测试路径' })
    expect(patient.status).toBe('on-track')
    const steps = await svc.getSteps(patient.id)
    expect(steps.length).toBeGreaterThan(0)
  })

  it('nuclear-stats: all 6 endpoints deterministic', async () => {
    const svc = new NuclearStatsService(failingPrisma())
    const summary = await svc.getSummary()
    expect(summary.totalExams).toBeGreaterThan(0)
    expect(summary.suvRange).toHaveLength(2)
    const daily = await svc.getDaily()
    expect(daily.length).toBe(30)
    const monthly = await svc.getMonthly()
    expect(monthly.length).toBe(6)
    const devices = await svc.getDevices()
    expect(devices.length).toBeGreaterThan(0)
    const suv = await svc.getSuv()
    expect(suv.threshold).toBe(2.5)
    const drugs = await svc.getDrugs()
    expect(drugs.length).toBeGreaterThan(0)
  })

  it('screening: stats + queue + mark/status + trend + create', async () => {
    const svc = new ScreeningService(failingPrisma())
    const stats = await svc.getStats()
    expect(stats.ldctCount).toBeGreaterThan(0)
    const queue = await svc.listQueue({ screenType: 'ldct' })
    expect(queue.length).toBeGreaterThan(0)
    const first = queue[0]!
    await svc.markScreening(first.id, { screenType: 'breast', doctor: '测试医生' })
    expect((await svc.listQueue({})).find((q) => q.id === first.id)?.markDoctor).toBe('测试医生')
    await svc.updateStatus(first.id, { status: 'reviewed', result: '正常' })
    const trend = await svc.getTrend()
    expect(trend.length).toBeGreaterThan(0)
    const created = await svc.create({ patientName: '新患者', screenType: 'ldct' })
    expect(created.id).toBeTruthy()
  })

  it('dicom-share: crud + stats + link', () => {
    const svc = new DicomShareService()
    const before = svc.list().length
    const created = svc.create({ studyId: 'STU-1', toDept: '口腔科', protocol: 'wado' })
    expect(svc.list().length).toBe(before + 1)
    expect(created.url).toContain('/dicom-share/link/')
    const link = svc.copyLink(created.id)
    expect(link.id).toBe(created.id)
    const removed = svc.remove(created.id)
    expect(removed.deleted).toBe(true)
    expect(svc.list().length).toBe(before)
    const stats = svc.getStats()
    expect(stats.total).toBe(before)
  })

  it('treatment-plans: crud + transition + timeline', () => {
    const svc = new TreatmentPlanService()
    const created = svc.create({ patient: '测试患者', type: '随访', department: '放射科→肿瘤科' })
    expect(created.status).toBe('planned')
    svc.transition(created.id, 'in_progress')
    expect(svc.get(created.id).status).toBe('in_progress')
    svc.transition(created.id, 'completed')
    expect(svc.get(created.id).progress).toBe(1)
    const timeline = svc.getTimeline(created.id)
    expect(Array.isArray(timeline)).toBe(true)
    svc.update(created.id, { desc: '更新描述' })
    expect(svc.get(created.id).desc).toBe('更新描述')
    svc.remove(created.id)
    expect(() => svc.get(created.id)).toThrow()
  })

  it('hl7 mllp admin: status/logs/whitelist/tls guard', async () => {
    const svc = new Hl7Service(failingPrisma(), { getString: async () => '', getNumber: async () => 0 } as any)
    const status = svc.getMllpStatus()
    expect(typeof status.running).toBe('boolean')
    expect(Array.isArray(status.whitelist)).toBe(true)
    svc.addMllpWhitelist('10.0.0.0/8')
    expect(svc.getMllpStatus().whitelist).toContain('10.0.0.0/8')
    svc.removeMllpWhitelist('10.0.0.0/8')
    expect(svc.getMllpStatus().whitelist).not.toContain('10.0.0.0/8')
    const logs = svc.getMllpLogs(10)
    expect(Array.isArray(logs)).toBe(true)
    expect(() => svc.toggleMllpTls(true)).toThrow(/TLS/)
    const stopped = svc.stopMllp()
    expect(stopped.running).toBe(false)
  })
})
