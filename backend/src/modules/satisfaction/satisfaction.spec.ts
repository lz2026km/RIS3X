/**
 * [G005 W12-PatientService] 满意度 问卷/答卷/分析 规格
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { SatisfactionService } from './satisfaction.service'

describe('[W12] 满意度分析', () => {
  let svc: SatisfactionService
  beforeEach(() => {
    svc = new SatisfactionService()
  })

  it('情感判定: 基于关键词', () => {
    expect(svc.classifySentiment('服务很好, 非常满意')).toBe('positive')
    expect(svc.classifySentiment('等待太久, 态度冷漠')).toBe('negative')
    expect(svc.classifySentiment('一般般')).toBe('neutral')
    expect(svc.classifySentiment('')).toBe('neutral')
  })

  it('评语标签提取', () => {
    const tags = svc.extractTags('候诊等待时间长, 但报告很清晰')
    expect(tags).toEqual(expect.arrayContaining(['等待时间', '报告质量']))
  })

  it('创建问卷: 默认题目 + 校验', () => {
    const s = svc.createSurvey({ title: '测试问卷', department: 'CT室' })
    expect(s.questions.length).toBe(3)
    expect(s.status).toBe('OPEN')
    expect(() => svc.createSurvey({ title: '' })).toThrow(BadRequestException)
  })

  it('答卷: 评分范围校验', () => {
    const s = svc.createSurvey({ title: 'Q', department: 'CT室' })
    expect(() => svc.respond(s.id, { rating: 9, npsScore: 9 })).toThrow(BadRequestException)
    expect(() => svc.respond(s.id, { rating: 4, npsScore: 11 })).toThrow(BadRequestException)
    const r = svc.respond(s.id, { rating: 5, npsScore: 10, comment: '非常满意, 服务专业', patientName: '张三' })
    expect(r.sentiment).toBe('positive')
    expect(r.department).toBe('CT室')
    expect(r.tags).toContain('专业水平')
  })

  it('答卷: 关闭问卷不可提交', () => {
    const s = svc.createSurvey({ title: 'Closed', department: 'MR室', status: 'CLOSED' })
    expect(() => svc.respond(s.id, { rating: 4, npsScore: 8 })).toThrow(BadRequestException)
  })

  it('问卷不存在抛 NotFoundException', () => {
    expect(() => svc.getSurvey('SV-9999')).toThrow(NotFoundException)
    expect(() => svc.respond('SV-9999', { rating: 5, npsScore: 9 })).toThrow(NotFoundException)
  })

  it('分析: NPS / 科室 / 模态 / 趋势 / 评语', () => {
    const a = svc.analytics()
    expect(a.overall.totalResponses).toBeGreaterThan(0)
    expect(a.overall.promoters + a.overall.passives + a.overall.detractors).toBe(a.overall.totalResponses)
    expect(a.overall.nps).toBeGreaterThanOrEqual(-100)
    expect(a.overall.nps).toBeLessThanOrEqual(100)
    expect(a.byDepartment.length).toBeGreaterThan(0)
    expect(a.byModality.length).toBeGreaterThan(0)
    expect(a.trend.length).toBeGreaterThan(0)
    expect(a.comments.some((c) => c.sentiment === 'negative')).toBe(true)
    expect(a.comments.some((c) => c.sentiment === 'positive')).toBe(true)
  })

  it('分析: 科室过滤', () => {
    const a = svc.analytics({ department: 'CT室' })
    expect(a.byDepartment.every((d) => d.department === 'CT室')).toBe(true)
  })

  it('新增答卷后分析口径随之变化', () => {
    const before = svc.analytics().overall.totalResponses
    const s = svc.listSurveys().items[0]!
    svc.respond(s.id, { rating: 5, npsScore: 10, comment: '很满意' })
    expect(svc.analytics().overall.totalResponses).toBe(before + 1)
  })
})
