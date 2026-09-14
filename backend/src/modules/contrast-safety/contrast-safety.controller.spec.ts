/**
 * G005 放射RIS系统 v3.0.6.11-104 Wave 3B (contrast-safety) - 控制器端点 spec
 * 覆盖:
 *   1. 各端点 200 (孤儿模块, 无 DB)
 *   2. 阻断规则命中: 无同意书 / 过敏阳性 / eGFR 低于阈值 / 妊娠
 *   3. 注射前核查门禁: 未通过 → 400 PRE_INJECTION_CHECK_FAILED + blockers
 *   4. 留观时长门禁: 未满时长离院 → 400 OBSERVATION_DURATION_NOT_MET; 医生放行/满时长 → 200
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { ContrastSafetyController } from './contrast-safety.controller'
import { ContrastSafetyService } from './contrast-safety.service'

describe('ContrastSafetyController (Wave 3B 对比剂安全闭环)', () => {
  let app: INestApplication
  let service: ContrastSafetyService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ContrastSafetyController],
      providers: [ContrastSafetyService],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
    service = moduleRef.get(ContrastSafetyService)
    void service
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /contrast/allergy-test → 200, GET /contrast/allergy-test/:patientId 返回历史', async () => {
    const created = await request(app.getHttpServer())
      .post('/contrast/allergy-test')
      .send({ patientId: 'P-CT-001', contrastType: '碘海醇', result: 'negative', testedBy: '张技师', notes: '常规' })
      .expect(200)
    expect(created.body.id).toBeTruthy()
    expect(created.body.result).toBe('negative')

    const list = await request(app.getHttpServer()).get('/contrast/allergy-test/P-CT-001').expect(200)
    expect(list.body.total).toBe(1)
    expect(list.body.items[0].contrastType).toBe('碘海醇')
    expect(list.body.latest.result).toBe('negative')
  })

  it('GET /contrast/allergy-test/:patientId 空库回退 seed', async () => {
    const res = await request(app.getHttpServer()).get('/contrast/allergy-test/P-DEMO-002').expect(200)
    expect(res.body.source).toBe('seed')
    expect(res.body.latest.result).toBe('positive')
  })

  it('POST /contrast/allergy-test 缺必填 → 400', async () => {
    await request(app.getHttpServer()).post('/contrast/allergy-test').send({ patientId: 'P-X', contrastType: '碘海醇' }).expect(400)
  })

  it('POST /contrast/pre-injection-check 无同意书 → passed=false + NO_CONSENT', async () => {
    const res = await request(app.getHttpServer())
      .post('/contrast/pre-injection-check')
      .send({ patientId: 'P-CT-002', egfr: 90 })
      .expect(200)
    expect(res.body.passed).toBe(false)
    expect(res.body.blockers).toContain('NO_CONSENT')
    expect(res.body.checks).toHaveLength(4)
  })

  it('POST /contrast/pre-injection-check 过敏阳性 → ALLERGY_POSITIVE', async () => {
    await request(app.getHttpServer())
      .post('/contrast/allergy-test')
      .send({ patientId: 'P-CT-003', contrastType: '碘克沙醇', result: 'positive', testedBy: '李护士' })
      .expect(200)
    const res = await request(app.getHttpServer())
      .post('/contrast/pre-injection-check')
      .send({ patientId: 'P-CT-003', consentSigned: true, egfr: 80 })
      .expect(200)
    expect(res.body.passed).toBe(false)
    expect(res.body.blockers).toContain('ALLERGY_POSITIVE')
  })

  it('POST /contrast/pre-injection-check eGFR 低于阈值 → EGFR_BELOW_THRESHOLD', async () => {
    const res = await request(app.getHttpServer())
      .post('/contrast/pre-injection-check')
      .send({ patientId: 'P-CT-004', consentSigned: true, egfr: 20 })
      .expect(200)
    expect(res.body.passed).toBe(false)
    expect(res.body.blockers).toContain('EGFR_BELOW_THRESHOLD')
    expect(res.body.threshold).toBe(30)
  })

  it('POST /contrast/pre-injection-check 妊娠 → PREGNANCY', async () => {
    const res = await request(app.getHttpServer())
      .post('/contrast/pre-injection-check')
      .send({ patientId: 'P-CT-005', consentSigned: true, egfr: 100, pregnant: true })
      .expect(200)
    expect(res.body.passed).toBe(false)
    expect(res.body.blockers).toContain('PREGNANCY')
  })

  it('POST /contrast/pre-injection-check 全部通过 → passed=true', async () => {
    const res = await request(app.getHttpServer())
      .post('/contrast/pre-injection-check')
      .send({ patientId: 'P-CT-006', consentSigned: true, egfr: 75, pregnant: false })
      .expect(200)
    expect(res.body.passed).toBe(true)
    expect(res.body.blockers).toHaveLength(0)
  })

  it('POST /contrast/injection 未通过核查 → 400 PRE_INJECTION_CHECK_FAILED + blockers', async () => {
    const res = await request(app.getHttpServer())
      .post('/contrast/injection')
      .send({ patientId: 'P-CT-007', protocolId: 'ip-001', contrastType: '碘海醇', eGFR: 90 })
      .expect(400)
    expect(res.body.code).toBe('PRE_INJECTION_CHECK_FAILED')
    expect(res.body.blockers).toContain('NO_CONSENT')
  })

  it('POST /contrast/injection 核查通过 → 200 (下发指令)', async () => {
    const res = await request(app.getHttpServer())
      .post('/contrast/injection')
      .send({ patientId: 'P-CT-008', protocolId: 'ip-001', contrastType: '碘海醇', consentSigned: true, eGFR: 90 })
      .expect(200)
    expect(res.body.passed).toBe(true)
    expect(res.body.resource).toBe('injection-command')
    expect(res.body.preCheck.passed).toBe(true)
  })

  it('留观 start → GET → record → 未满时长离院 400 → 医生放行 200', async () => {
    const started = await request(app.getHttpServer())
      .post('/contrast/observation/start')
      .send({ patientId: 'P-CT-010', contrastType: '碘海醇', operator: '张技师' })
      .expect(200)
    expect(started.body.durationMinutes).toBe(30)
    expect(started.body.canDischarge).toBe(false)
    const id = started.body.id as string

    const status = await request(app.getHttpServer()).get(`/contrast/observation/${id}`).expect(200)
    expect(status.body.remainingSeconds).toBeGreaterThan(0)
    expect(status.body.status).toBe('observing')

    const recorded = await request(app.getHttpServer())
      .post(`/contrast/observation/${id}/record`)
      .send({ symptoms: '无不适', action: '继续观察', recordedBy: '张技师' })
      .expect(200)
    expect(recorded.body.records).toHaveLength(1)

    await request(app.getHttpServer()).post(`/contrast/observation/${id}/discharge`).send({}).expect(400)

    const released = await request(app.getHttpServer())
      .post(`/contrast/observation/${id}/discharge`)
      .send({ doctorRelease: true, dischargedBy: '李医生', notes: '无不适, 提前放行' })
      .expect(200)
    expect(released.body.status).toBe('discharged')
    expect(released.body.doctorRelease).toBe(true)
  })

  it('留观满时长后可正常离院 (startedAt 回填 31 分钟前)', async () => {
    const startedAt = new Date(Date.now() - 31 * 60_000).toISOString()
    const started = await request(app.getHttpServer())
      .post('/contrast/observation/start')
      .send({ patientId: 'P-CT-011', durationMinutes: 30, startedAt })
      .expect(200)
    expect(started.body.canDischarge).toBe(true)
    const res = await request(app.getHttpServer()).post(`/contrast/observation/${started.body.id}/discharge`).send({}).expect(200)
    expect(res.body.status).toBe('discharged')
  })

  it('留观已结束追加记录 → 400 OBSERVATION_DISCHARGED', async () => {
    const started = await request(app.getHttpServer())
      .post('/contrast/observation/start')
      .send({ patientId: 'P-CT-012', durationMinutes: 1, startedAt: new Date(Date.now() - 5 * 60_000).toISOString() })
      .expect(200)
    await request(app.getHttpServer()).post(`/contrast/observation/${started.body.id}/discharge`).send({}).expect(200)
    const res = await request(app.getHttpServer())
      .post(`/contrast/observation/${started.body.id}/record`)
      .send({ symptoms: '皮疹' })
      .expect(400)
    expect(res.body.code).toBe('OBSERVATION_DISCHARGED')
  })

  it('GET /contrast/observation/:id 不存在 → 404', async () => {
    await request(app.getHttpServer()).get('/contrast/observation/obs-missing').expect(404)
  })

  it('GET /contrast/observation 列表 + seed 示例可查', async () => {
    const list = await request(app.getHttpServer()).get('/contrast/observation').expect(200)
    expect(list.body.total).toBeGreaterThan(0)
    const seeded = await request(app.getHttpServer()).get('/contrast/observation/obs-demo-1').expect(200)
    expect(seeded.body.patientId).toBe('P-DEMO-001')
  })
})
