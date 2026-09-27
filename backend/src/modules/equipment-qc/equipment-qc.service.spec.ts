/**
 * [G005 W9-QC] 设备质控 spec: 检测项/排程/记录判定/统计/失败清单
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { EquipmentQcService } from './equipment-qc.service'
import { EquipmentQcController } from './equipment-qc.controller'

describe('EquipmentQcService', () => {
  let service: EquipmentQcService

  beforeEach(() => {
    service = new EquipmentQcService()
  })

  it('检测项覆盖 CT/DR/MRI/MG 且含日/周/月频率', () => {
    const items = service.listItems()
    expect(items.length).toBeGreaterThan(20)
    const modalities = new Set(items.map((i) => i.modality))
    expect([...modalities].sort()).toEqual(['CT', 'DR', 'MG', 'MRI'])
    const freqs = new Set(items.map((i) => i.frequency))
    expect(freqs.has('daily') && freqs.has('weekly') && freqs.has('monthly')).toBe(true)
  })

  it('按模态过滤', () => {
    expect(service.listItems('CT').every((i) => i.modality === 'CT')).toBe(true)
    expect(service.listItems('MG').length).toBeGreaterThan(0)
  })

  it('录入记录自动判定 pass/fail', () => {
    const item = service.getItem('CT-D-01')
    const ok = service.createRecord({ deviceId: 'DEV-CT-01', modality: 'CT', testItemId: item.id, value: 0 })
    expect(ok.passed).toBe(true)
    const bad = service.createRecord({ deviceId: 'DEV-CT-01', modality: 'CT', testItemId: item.id, value: 30 })
    expect(bad.passed).toBe(false)
    expect(bad.deviation).toBeGreaterThan(0)
  })

  it('模态不符抛 400, 未知检测项抛 404', () => {
    expect(() => service.createRecord({ deviceId: 'D', modality: 'DR', testItemId: 'CT-D-01', value: 0 })).toThrow()
    expect(() => service.createRecord({ deviceId: 'D', modality: 'CT', testItemId: 'NOPE', value: 0 })).toThrow()
  })

  it('统计: 通过率 0-100, 模态/频率拆分齐全', () => {
    const stats = service.getStats()
    expect(stats.total).toBeGreaterThan(0)
    expect(stats.passRate).toBeGreaterThanOrEqual(0)
    expect(stats.passRate).toBeLessThanOrEqual(100)
    expect(stats.byModality).toHaveLength(4)
    expect(stats.byFrequency).toHaveLength(3)
    expect(service.listFailures().every((r) => !r.passed)).toBe(true)
  })

  it('排程: 覆盖 4 模态', () => {
    const schedule = service.listSchedule()
    expect(new Set(schedule.map((s) => s.modality)).size).toBe(4)
  })
})

describe('EquipmentQcController', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EquipmentQcController],
      providers: [EquipmentQcService],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /equipment-qc/items → 200', async () => {
    const res = await request(app.getHttpServer()).get('/equipment-qc/items?modality=CT').expect(200)
    expect(res.body.data.every((i: { modality: string }) => i.modality === 'CT')).toBe(true)
  })

  it('GET /equipment-qc/stats → 200', async () => {
    const res = await request(app.getHttpServer()).get('/equipment-qc/stats').expect(200)
    expect(res.body.data.byModality).toHaveLength(4)
  })

  it('POST /equipment-qc/records → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/equipment-qc/records')
      .send({ deviceId: 'DEV-MG-01', modality: 'MG', testItemId: 'MG-D-01', value: 1 })
      .expect(201)
    expect(res.body.passed).toBe(true)
  })

  it('GET /equipment-qc/failures → 200', async () => {
    const res = await request(app.getHttpServer()).get('/equipment-qc/failures').expect(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})
