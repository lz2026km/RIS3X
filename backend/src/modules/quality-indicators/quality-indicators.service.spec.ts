/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1C - 质量指标库镜像 spec
 * 覆盖: 数量=40 / 分类计数正确 / 按编码查询 / 达标判定边界 / 端点 200
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { QualityIndicatorsService } from './quality-indicators.service'
import { QualityIndicatorsController } from './quality-indicators.controller'

describe('QualityIndicatorsService (Wave 1C 指标库镜像)', () => {
  let service: QualityIndicatorsService

  beforeEach(() => {
    service = new QualityIndicatorsService()
  })

  it('指标总数 = 40, 分类计数 结构10/过程18/结果12', () => {
    const result = service.listIndicators()
    expect(result.total).toBe(40)
    expect(result.data).toHaveLength(40)
    expect(result.byCategory).toEqual({ structure: 10, process: 18, outcome: 12 })
    const stats = Object.fromEntries(result.categoryStats.map((s) => [s.categoryKey, s.count]))
    expect(stats).toEqual({ structure: 10, process: 18, outcome: 12 })
  })

  it('按类别过滤 + 按关键词检索', () => {
    expect(service.listIndicators('outcome').data).toHaveLength(12)
    expect(service.listIndicators('process').data).toHaveLength(18)
    const search = service.listIndicators(undefined, '报告').data
    expect(search.length).toBeGreaterThan(0)
    expect(search.every((i) => i.code.includes('报告') || i.name.includes('报告') || i.responsible.includes('报告') || i.formula.includes('报告'))).toBe(true)
  })

  it('按编码查询: 命中返回, 未知编码抛 404', () => {
    const indicator = service.getIndicator('QI-P08')
    expect(indicator.name).toBe('图像质量甲级片率')
    expect(indicator.categoryKey).toBe('process')
    expect(() => service.getIndicator('QI-X99')).toThrow('不存在')
  })

  it('达标判定边界: ≥ 类等于目标达标, 低于不达标', () => {
    expect(service.evaluateTarget('QI-P08', 70).passed).toBe(true)
    expect(service.evaluateTarget('QI-P08', 69.9).passed).toBe(false)
    expect(service.evaluateTarget('QI-P08', 85).passed).toBe(true)
  })

  it('达标判定边界: ≤ 类等于目标达标, 高于不达标', () => {
    expect(service.evaluateTarget('QI-P09', 2).passed).toBe(true)
    expect(service.evaluateTarget('QI-P09', 2.1).passed).toBe(false)
    expect(service.evaluateTarget('QI-R10', 0).passed).toBe(true)
    expect(service.evaluateTarget('QI-R10', 1).passed).toBe(false)
  })

  it('质控标准: 图像 5 维度 / 报告 14 条 / 流程 25 点', () => {
    const standards = service.getStandards()
    expect(standards.imageDimensionCount).toBe(5)
    expect(standards.reportStandardCount).toBe(14)
    expect(standards.workflowPointCount).toBe(25)
    expect(standards.imageQualityDimensions[0]!.levels).toHaveLength(5)
  })
})

describe('QualityIndicatorsController (Wave 1C 端点 200)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QualityIndicatorsController],
      providers: [QualityIndicatorsService],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /quality-indicators/extended → 200, 40 条 + 分类计数', async () => {
    const res = await request(app.getHttpServer()).get('/quality-indicators/extended').expect(200)
    expect(res.body.total).toBe(40)
    expect(res.body.byCategory).toEqual({ structure: 10, process: 18, outcome: 12 })
    expect(res.body.data).toHaveLength(40)
  })

  it('GET /quality-indicators/extended?category=structure → 200, 10 条', async () => {
    const res = await request(app.getHttpServer()).get('/quality-indicators/extended?category=structure').expect(200)
    expect(res.body.data).toHaveLength(10)
  })

  it('GET /quality-indicators/extended?category=bad → 400', async () => {
    await request(app.getHttpServer()).get('/quality-indicators/extended?category=bad').expect(400)
  })

  it('GET /quality-indicators/extended/:code → 200 命中, 未知 404', async () => {
    const res = await request(app.getHttpServer()).get('/quality-indicators/extended/QI-R01').expect(200)
    expect(res.body.code).toBe('QI-R01')
    await request(app.getHttpServer()).get('/quality-indicators/extended/QI-X99').expect(400)
    await request(app.getHttpServer()).get('/quality-indicators/extended/QI-R99').expect(404)
  })

  it('GET /quality-indicators/evaluate → 200 达标判定边界', async () => {
    const pass = await request(app.getHttpServer()).get('/quality-indicators/evaluate?code=QI-P08&value=70').expect(200)
    expect(pass.body.passed).toBe(true)
    const fail = await request(app.getHttpServer()).get('/quality-indicators/evaluate?code=QI-P08&value=69').expect(200)
    expect(fail.body.passed).toBe(false)
  })

  it('GET /quality-indicators/standards → 200', async () => {
    const res = await request(app.getHttpServer()).get('/quality-indicators/standards').expect(200)
    expect(res.body.reportStandardCount).toBe(14)
    expect(res.body.imageQualityDimensions).toHaveLength(5)
  })
})
