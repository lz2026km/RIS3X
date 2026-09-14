/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1B (criticals / 国标 13 类) - spec
 * 覆盖:
 *   1. 国标 13 类字典完整性 (编码唯一 / 是否国标 / 全部类别)
 *   2. 10 分钟边界: =10 计入, >10 不计
 *   3. 10 分钟内通报完成率 分子/分母 + 明细下钻
 *   4. 署名记录完整性统计 (notifiedAt/notifiedBy/receivedBy/receiveNote)
 *   5. 内存 overlay 回退 (patchCriticalNotification 写入后可统计)
 *   6. 端点 200
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { CriticalsService } from './criticals.service'
import { CriticalsController } from './criticals.controller'
import { PrismaService } from '../prisma/prisma.service'
import { SystemConfigService } from '../system-storage/system-config.service'
import { NotificationsGateway, createNoopGateway } from '../notifications/notifications.gateway'
import {
  NATIONAL_CRITICAL_DIAGNOSES,
  criticalRqiOverlay,
  matchNationalDiagnosis,
} from './national-critical'

const makePrisma = () => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  return {
    criticalValue: { findMany: reject, findUnique: reject, count: reject, groupBy: reject, create: reject, update: reject, delete: reject },
    criticalValueNotification: { findMany: reject, count: reject, groupBy: reject, createMany: reject },
    exam: { findMany: reject, findUnique: reject },
    patient: { findMany: reject },
    systemConfig: { findUnique: reject },
  } as never
}

const makeSystemConfig = () =>
  ({ getNumber: jest.fn().mockResolvedValue(20), getString: jest.fn().mockResolvedValue(undefined) }) as never

describe('国标 13 类危急值字典 (Wave 1B)', () => {
  it('字典完整性: 13 类, 覆盖全部国标诊断', () => {
    expect(NATIONAL_CRITICAL_DIAGNOSES).toHaveLength(13)
    const names = NATIONAL_CRITICAL_DIAGNOSES.map((d) => d.name).join('|')
    const expected = [
      '急性肺栓塞',
      '急性主动脉夹层',
      '急性主动脉瘤破裂',
      '心包填塞',
      '大量液·血·气胸',
      '气管·支气管异物',
      '急性脑梗死',
      '急性脑出血',
      '急性硬膜外·硬膜下出血',
      '急性蛛网膜下腔出血',
      '脑疝',
      '消化道穿孔',
      '腹腔内脏器破裂出血',
      '绞窄性肠梗阻',
    ]
    for (const entity of expected) {
      expect(names).toContain(entity)
    }
  })

  it('编码唯一 + 全部标记为国标', () => {
    const codes = NATIONAL_CRITICAL_DIAGNOSES.map((d) => d.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(NATIONAL_CRITICAL_DIAGNOSES.every((d) => d.isNational)).toBe(true)
  })

  it('描述匹配归入国标类别', () => {
    expect(matchNationalDiagnosis('急性主动脉夹层 (DeBakey I型) 内膜片征')?.code).toBe('GW-02')
    expect(matchNationalDiagnosis('腹腔积血伴脾破裂')?.code).toBe('GW-12')
    expect(matchNationalDiagnosis('普通肺炎')?.code).toBeUndefined()
  })
})

describe('CriticalsService 国标 RQI 统计 (Wave 1B)', () => {
  beforeEach(() => {
    criticalRqiOverlay.clear()
  })

  it('getNationalDiagnoses 返回编码/名称/是否国标', () => {
    const svc = new CriticalsService(makePrisma(), makeSystemConfig())
    const res = svc.getNationalDiagnoses()
    expect(res.total).toBe(13)
    expect(res.nationalCount).toBe(13)
    expect(res.items[0]).toEqual(expect.objectContaining({ code: expect.any(String), name: expect.any(String), isNational: true }))
  })

  it('RQI 统计: 分母 = 国标危急值总例数, 完成率 = 分子/分母 (seed 回退)', async () => {
    const svc = new CriticalsService(makePrisma(), makeSystemConfig())
    const stats = await svc.getRqiStats(1)
    expect(stats.source).toBe('seed')
    expect(stats.nationalTotal).toBe(5)
    expect(stats.within10MinCount).toBe(3)
    expect(stats.completionRate).toBe(60)
    expect(stats.overdueCount).toBe(2)
    expect(stats.details).toHaveLength(5)
  })

  it('10 分钟边界: =10 计入, >10 不计', async () => {
    const svc = new CriticalsService(makePrisma(), makeSystemConfig())
    const stats = await svc.getRqiStats(1)
    const exact10 = stats.details.find((d) => d.diagnosisCode === 'GW-06')
    expect(exact10?.notifyMinutes).toBe(10)
    expect(exact10?.within10Min).toBe(true)
    const over10 = stats.details.find((d) => d.diagnosisCode === 'GW-13')
    expect(over10?.notifyMinutes).toBe(16)
    expect(over10?.within10Min).toBe(false)
    const neverNotified = stats.details.find((d) => d.diagnosisCode === 'GW-03')
    expect(neverNotified?.notifiedAt).toBeUndefined()
    expect(neverNotified?.within10Min).toBe(false)
  })

  it('署名记录完整性统计', async () => {
    const svc = new CriticalsService(makePrisma(), makeSystemConfig())
    const stats = await svc.getRqiStats(1)
    expect(stats.signatureIntegrity).toEqual({
      total: 5,
      notifiedAtCount: 4,
      notifiedByCount: 4,
      receivedByCount: 3,
      receiveNoteCount: 2,
      completeCount: 2,
      completenessRate: 40,
    })
  })

  it('内存 overlay 回退: patchCriticalNotification 写入后可统计', async () => {
    const svc = new CriticalsService(makePrisma(), makeSystemConfig())
    const foundAt = new Date(Date.now() - 20 * 60_000).toISOString()
    const notifiedAt = new Date(Date.now() - 13 * 60_000).toISOString()
    svc.patchCriticalNotification('cv-new-1', {
      diagnosisCode: 'GW-09',
      diagnosisName: '急性蛛网膜下腔出血',
      foundAt,
      notifiedAt,
      notifiedBy: '李技师',
      receivedBy: '王医生',
      receiveNote: '已接收',
    })
    const stats = await svc.getRqiStats(1)
    expect(stats.nationalTotal).toBe(6)
    expect(stats.within10MinCount).toBe(4)
    expect(stats.completionRate).toBe(Math.round((4 / 6) * 1000) / 10)
    const added = stats.details.find((d) => d.criticalId === 'cv-new-1')
    expect(added?.notifyMinutes).toBe(7)
    expect(added?.within10Min).toBe(true)
    expect(added?.signatureComplete).toBe(true)
  })

  it('窗口外 overlay 记录不计入 months 统计', async () => {
    const svc = new CriticalsService(makePrisma(), makeSystemConfig())
    const oldFoundAt = new Date()
    oldFoundAt.setMonth(oldFoundAt.getMonth() - 6)
    svc.patchCriticalNotification('cv-old-1', {
      diagnosisCode: 'GW-11',
      diagnosisName: '消化道穿孔',
      foundAt: oldFoundAt.toISOString(),
      notifiedAt: oldFoundAt.toISOString(),
      notifiedBy: '张技师',
      receivedBy: '王医生',
      receiveNote: '已处理',
    })
    const stats = await svc.getRqiStats(1)
    expect(stats.nationalTotal).toBe(5)
  })
})

describe('CriticalsController 国标端点 (Wave 1B)', () => {
  let app: INestApplication

  beforeAll(async () => {
    criticalRqiOverlay.clear()
    const moduleRef = await Test.createTestingModule({
      controllers: [CriticalsController],
      providers: [
        CriticalsService,
        { provide: PrismaService, useValue: makePrisma() },
        { provide: SystemConfigService, useValue: makeSystemConfig() },
        { provide: NotificationsGateway, useValue: createNoopGateway() },
      ],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /criticals/national-diagnoses → 200', async () => {
    const res = await request(app.getHttpServer()).get('/criticals/national-diagnoses').expect(200)
    expect(res.body.total).toBe(13)
    expect(res.body.items[0]).toHaveProperty('code')
    expect(res.body.items[0]).toHaveProperty('isNational')
  })

  it('GET /criticals/rqi-stats?months=1 → 200', async () => {
    const res = await request(app.getHttpServer()).get('/criticals/rqi-stats').query({ months: 1 }).expect(200)
    expect(res.body.nationalTotal).toBe(5)
    expect(res.body.within10MinCount).toBe(3)
    expect(res.body.completionRate).toBe(60)
    expect(res.body.details).toHaveLength(5)
  })
})
