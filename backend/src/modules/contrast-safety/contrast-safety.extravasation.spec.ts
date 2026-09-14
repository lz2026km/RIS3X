/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1B (contrast-safety / extravasation) - spec
 * 覆盖:
 *   1. 外渗事件记录 (zod 校验 / 必填缺失 400)
 *   2. 列表筛选 (患者/日期/严重度) + 分页
 *   3. 统计: 总数/按严重度/按部位/按月 + 发生率‰ (分母 = injection 累计 + seed)
 *   4. 处置闭环: 处置措施/随访/状态 resolved
 *   5. 空库 seed 回退 (确定性)
 *   6. 端点 200
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { ContrastSafetyController } from './contrast-safety.controller'
import { ContrastSafetyService } from './contrast-safety.service'
import { SEED_INJECTION_TOTAL } from './contrast-safety.types'

describe('ContrastSafetyService 外渗事件 (Wave 1B)', () => {
  it('记录外渗事件 → open, 含严重度/部位/外渗量/记录人', async () => {
    const svc = new ContrastSafetyService(undefined)
    const ev = await svc.recordExtravasation({
      patientId: 'P-EXV-1',
      examId: 'E-EXV-1',
      severity: 'moderate',
      site: '右前臂',
      estimatedVolumeMl: 35,
      management: '停止注射, 抬高患肢, 冷敷',
      recordedBy: '张技师',
      occurredAt: '2026-09-10T08:00:00.000Z',
    })
    expect(ev.id).toBeTruthy()
    expect(ev.status).toBe('open')
    expect(ev.severity).toBe('moderate')
    expect(ev.estimatedVolumeMl).toBe(35)
    expect(ev.handledAt).toBeUndefined()
  })

  it('列表按患者/严重度/日期筛选 + 分页', async () => {
    const svc = new ContrastSafetyService(undefined)
    await svc.recordExtravasation({ patientId: 'P-A', severity: 'mild', site: '手背', estimatedVolumeMl: 10, management: '冷敷', recordedBy: 't', occurredAt: '2026-09-01T00:00:00.000Z' })
    await svc.recordExtravasation({ patientId: 'P-A', severity: 'severe', site: '肘窝', estimatedVolumeMl: 90, management: '外科会诊', recordedBy: 't', occurredAt: '2026-09-02T00:00:00.000Z' })
    await svc.recordExtravasation({ patientId: 'P-B', severity: 'mild', site: '手背', estimatedVolumeMl: 12, management: '冷敷', recordedBy: 't', occurredAt: '2026-09-03T00:00:00.000Z' })

    const byPatient = svc.listExtravasations({ patientId: 'P-A' })
    expect(byPatient.total).toBe(2)
    expect(byPatient.source).toBe('memory')

    const bySeverity = svc.listExtravasations({ severity: 'mild' })
    expect(bySeverity.total).toBe(2)

    const byDate = svc.listExtravasations({ dateFrom: '2026-09-02T00:00:00.000Z' })
    expect(byDate.total).toBe(2)

    const paged = svc.listExtravasations({ page: 2, pageSize: 2 })
    expect(paged.page).toBe(2)
    expect(paged.items).toHaveLength(1)
    expect(paged.total).toBe(3)
  })

  it('统计: 总数/按严重度/按部位/按月 + 发生率‰ (分母含 injection 累计)', async () => {
    const svc = new ContrastSafetyService(undefined)
    await svc.recordExtravasation({ patientId: 'P-C', severity: 'mild', site: '手背', estimatedVolumeMl: 10, management: 'x', recordedBy: 't', occurredAt: '2026-08-01T00:00:00.000Z' })
    await svc.recordExtravasation({ patientId: 'P-D', severity: 'severe', site: '前臂', estimatedVolumeMl: 80, management: 'x', recordedBy: 't', occurredAt: '2026-09-01T00:00:00.000Z' })
    // 记一次增强注射 → 分母 +1
    await svc.runInjection({ patientId: 'P-C', consentSigned: true, eGFR: 90 })

    const stats = svc.extravasationStats()
    expect(stats.total).toBe(2)
    expect(stats.totalInjections).toBe(SEED_INJECTION_TOTAL + 1)
    expect(stats.incidenceRatePerThousand).toBe(Math.round((2 / (SEED_INJECTION_TOTAL + 1)) * 1000 * 10) / 10)
    expect(stats.bySeverity.find((s) => s.severity === 'severe')?.count).toBe(1)
    expect(stats.bySite.find((s) => s.site === '手背')?.count).toBe(1)
    expect(stats.byMonth.map((m) => m.month)).toEqual(['2026-08', '2026-09'])
    expect(stats.openCount).toBe(2)
  })

  it('处置闭环: handle → resolved + 处置措施/随访/处置人', async () => {
    const svc = new ContrastSafetyService(undefined)
    const ev = await svc.recordExtravasation({ patientId: 'P-E', severity: 'moderate', site: '手背', estimatedVolumeMl: 40, management: '初处置', recordedBy: 't' })
    const handled = await svc.handleExtravasation(ev.id, {
      management: '硫酸镁湿敷 + 抬高患肢',
      followUp: '24h 随访无张力性水疱',
      handledBy: '李医生',
      note: '已告知患者',
    })
    expect(handled.status).toBe('resolved')
    expect(handled.management).toBe('硫酸镁湿敷 + 抬高患肢')
    expect(handled.followUp).toBe('24h 随访无张力性水疱')
    expect(handled.handledBy).toBe('李医生')
    expect(handled.handledAt).toBeTruthy()
    expect(svc.extravasationStats().resolvedCount).toBe(1)
  })

  it('空库 seed 回退 (确定性)', () => {
    const svc = new ContrastSafetyService(undefined)
    const list = svc.listExtravasations()
    expect(list.source).toBe('seed')
    expect(list.total).toBeGreaterThan(0)
    const stats = svc.extravasationStats()
    expect(stats.source).toBe('seed')
    expect(stats.total).toBe(3)
    const second = svc.extravasationStats()
    expect(second.total).toBe(stats.total)
  })
})

describe('ContrastSafetyController 外渗端点 (Wave 1B)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ContrastSafetyController],
      providers: [ContrastSafetyService],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /contrast/extravasation → 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/contrast/extravasation')
      .send({ patientId: 'P-CT-EXV', examId: 'E-1', severity: 'mild', site: '左上肢前臂', estimatedVolumeMl: 12, management: '冷敷', recordedBy: '张技师' })
      .expect(200)
    expect(res.body.id).toBeTruthy()
    expect(res.body.status).toBe('open')
  })

  it('POST /contrast/extravasation 缺必填 → 400', async () => {
    await request(app.getHttpServer())
      .post('/contrast/extravasation')
      .send({ patientId: 'P-CT-EXV', severity: 'mild', site: '手背' })
      .expect(400)
  })

  it('GET /contrast/extravasation → 200 列表', async () => {
    const res = await request(app.getHttpServer()).get('/contrast/extravasation').query({ patientId: 'P-CT-EXV' }).expect(200)
    expect(res.body.total).toBe(1)
    expect(res.body.items[0].patientId).toBe('P-CT-EXV')
  })

  it('GET /contrast/extravasation/stats → 200 统计', async () => {
    const res = await request(app.getHttpServer()).get('/contrast/extravasation/stats').expect(200)
    expect(res.body.total).toBeGreaterThanOrEqual(1)
    expect(typeof res.body.incidenceRatePerThousand).toBe('number')
    expect(res.body.totalInjections).toBeGreaterThan(0)
  })

  it('POST /contrast/extravasation/:id/handle → 200 resolved', async () => {
    const ev = await request(app.getHttpServer())
      .post('/contrast/extravasation')
      .send({ patientId: 'P-CT-EXV2', severity: 'severe', site: '手背', estimatedVolumeMl: 80, management: '外科会诊', recordedBy: '张技师' })
      .expect(200)
    const res = await request(app.getHttpServer())
      .post(`/contrast/extravasation/${ev.body.id}/handle`)
      .send({ management: '筋膜切开减压', followUp: '48h 随访', handledBy: '王医生' })
      .expect(200)
    expect(res.body.status).toBe('resolved')
    expect(res.body.followUp).toBe('48h 随访')
  })

  it('GET /contrast/extravasation/:id/handle 不存在 → 404', async () => {
    await request(app.getHttpServer()).post('/contrast/extravasation/exv-missing/handle').send({}).expect(404)
  })
})
