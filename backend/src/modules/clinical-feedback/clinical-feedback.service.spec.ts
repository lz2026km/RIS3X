/**
 * G005 RIS v3.0.6.11-104 Wave 3C (临床反馈闭环) - 服务 spec
 *
 * 覆盖:
 *   1. 提交: 异议/补充/更正 + reportId/patientId/提交人/科室 校验
 *   2. 列表: 状态/报告/科室/类型 筛选 + 分页
 *   3. 状态机门禁: SUBMITTED→RESPONDED→RESOLVED / REJECTED, 非法跳转 400
 *   4. 关闭: 关联 amendId
 *   5. 孤儿模块: seed 回退
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ClinicalFeedbackService } from './clinical-feedback.service'

describe('ClinicalFeedbackService (Wave 3C 临床反馈闭环)', () => {
  const svc = new ClinicalFeedbackService()

  describe('1. 提交反馈', () => {
    it('提交异议/补充/更正 → SUBMITTED + 初始字段', () => {
      for (const type of ['objection', 'supplement', 'correction'] as const) {
        const f = svc.create({ reportId: `RPT-${type}`, patientId: 'P-1', type, content: '内容说明', submittedBy: '周临床', department: '呼吸内科' })
        expect(f.status).toBe('SUBMITTED')
        expect(f.type).toBe(type)
        expect(f.reportId).toBe(`RPT-${type}`)
        expect(f.patientId).toBe('P-1')
        expect(f.createdAt).toBeTruthy()
      }
    })

    it('非法 / 缺字段 → BadRequestException', () => {
      expect(() => svc.create({ reportId: '', type: 'objection', content: 'x', submittedBy: 'a', department: 'b' })).toThrow(BadRequestException)
      expect(() => svc.create({ reportId: 'R', type: 'objection', content: '', submittedBy: 'a', department: 'b' })).toThrow(BadRequestException)
      expect(() => svc.create({ reportId: 'R', type: 'objection', content: 'x', submittedBy: '', department: 'b' })).toThrow(BadRequestException)
      expect(() => svc.create({ reportId: 'R', type: 'objection', content: 'x', submittedBy: 'a', department: '' })).toThrow(BadRequestException)
      expect(() => svc.create({ reportId: 'R', type: 'bogus' as never, content: 'x', submittedBy: 'a', department: 'b' })).toThrow(BadRequestException)
      expect(() => svc.get('no-such')).toThrow(NotFoundException)
    })
  })

  describe('2. 列表筛选 + 分页', () => {
    it('按状态/报告/科室筛选', () => {
      const created = svc.create({ reportId: 'RPT-FLT-1', type: 'supplement', content: '筛选', submittedBy: '临床A', department: '心内科' })
      expect(svc.list({ status: 'SUBMITTED' }).items.some((f) => f.id === created.id)).toBe(true)
      expect(svc.list({ reportId: 'RPT-FLT-1' }).items).toHaveLength(1)
      expect(svc.list({ department: '心内科' }).items.some((f) => f.id === created.id)).toBe(true)
      expect(svc.list({ type: 'supplement' }).items.every((f) => f.type === 'supplement')).toBe(true)
    })

    it('分页 page/pageSize + total', () => {
      const res = svc.list({ page: 1, pageSize: 2 })
      expect(res.page).toBe(1)
      expect(res.pageSize).toBe(2)
      expect(res.items.length).toBeLessThanOrEqual(2)
      expect(res.total).toBeGreaterThanOrEqual(res.items.length)
      const page2 = svc.list({ page: 2, pageSize: 2 })
      expect(page2.page).toBe(2)
    })
  })

  describe('3. 状态机门禁', () => {
    it('SUBMITTED → RESPONDED → RESOLVED 合法闭环', () => {
      const f = svc.create({ reportId: 'RPT-SM-1', type: 'objection', content: '闭环', submittedBy: '临床', department: '外科' })
      const responded = svc.respond(f.id, { content: '已复核', responder: '王放射', department: '放射科' })
      expect(responded.status).toBe('RESPONDED')
      expect(responded.response?.responder).toBe('王放射')
      const resolved = svc.resolve(f.id, { content: '已修订', resolver: '王放射', amendId: 'AMEND-1' })
      expect(resolved.status).toBe('RESOLVED')
      expect(resolved.resolution?.amendId).toBe('AMEND-1')
    })

    it('SUBMITTED → REJECTED 合法', () => {
      const f = svc.create({ reportId: 'RPT-SM-2', type: 'correction', content: '驳回', submittedBy: '临床', department: '外科' })
      const rejected = svc.reject(f.id, { reason: '依据充分', resolver: '吴放射' })
      expect(rejected.status).toBe('REJECTED')
    })

    it('RESPONDED → REJECTED 合法', () => {
      const f = svc.create({ reportId: 'RPT-SM-3', type: 'objection', content: '回应后驳回', submittedBy: '临床', department: '外科' })
      svc.respond(f.id, { content: '回应', responder: '王放射' })
      const rejected = svc.reject(f.id, { reason: '维持原报告', resolver: '王放射' })
      expect(rejected.status).toBe('REJECTED')
    })

    it('非法跳转 → BadRequestException: SUBMITTED→RESOLVED / RESOLVED 后再流转 / 重复回应', () => {
      const f = svc.create({ reportId: 'RPT-SM-4', type: 'objection', content: '非法', submittedBy: '临床', department: '外科' })
      expect(() => svc.resolve(f.id, { resolver: '王放射' })).toThrow(BadRequestException)
      svc.respond(f.id, { content: '回应', responder: '王放射' })
      expect(() => svc.respond(f.id, { content: '重复', responder: '王放射' })).toThrow(BadRequestException)
      svc.resolve(f.id, { resolver: '王放射' })
      expect(() => svc.reject(f.id, { reason: '终态', resolver: '王放射' })).toThrow(BadRequestException)
    })

    it('回应/关闭/驳回必填校验', () => {
      const f = svc.create({ reportId: 'RPT-SM-5', type: 'objection', content: '校验', submittedBy: '临床', department: '外科' })
      expect(() => svc.respond(f.id, { content: '', responder: '王放射' })).toThrow(BadRequestException)
      expect(() => svc.respond(f.id, { content: 'x', responder: '' })).toThrow(BadRequestException)
      svc.respond(f.id, { content: 'x', responder: '王放射' })
      expect(() => svc.resolve(f.id, { resolver: '' })).toThrow(BadRequestException)
    })
  })

  describe('4. 元数据', () => {
    it('类型/状态/流转齐全', () => {
      const meta = svc.getMeta()
      expect(meta.types.map((t) => t.key)).toEqual(['objection', 'supplement', 'correction'])
      expect(meta.statuses.map((s) => s.key)).toEqual(['SUBMITTED', 'RESPONDED', 'RESOLVED', 'REJECTED'])
      expect(meta.transitions.SUBMITTED).toEqual(['RESPONDED', 'REJECTED'])
      expect(meta.transitions.RESPONDED).toEqual(['RESOLVED', 'REJECTED'])
      expect(meta.transitions.RESOLVED).toEqual([])
    })
  })

  describe('5. seed 回退 (孤儿模块)', () => {
    it('无 DB 构造 → seed 覆盖 4 状态', () => {
      const list = svc.list({ pageSize: 100 })
      expect(list.total).toBeGreaterThanOrEqual(4)
      const statuses = new Set(list.items.map((f) => f.status))
      for (const s of ['SUBMITTED', 'RESPONDED', 'RESOLVED', 'REJECTED']) {
        expect(statuses.has(s as never)).toBe(true)
      }
      expect(list.items.some((f) => f.status === 'RESOLVED' && f.resolution?.amendId)).toBe(true)
    })
  })
})
