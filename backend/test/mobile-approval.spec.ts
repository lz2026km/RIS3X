import { BadRequestException, NotFoundException } from '@nestjs/common'
import { MobileApprovalService } from '../src/modules/mobile-approval/mobile-approval.service'

// [G005 v3.0.6.11-100 Wave 4A] 移动审批模块 — 11 用例
describe('MobileApprovalService', () => {
  let svc: MobileApprovalService

  beforeEach(() => {
    svc = new MobileApprovalService()
  })

  it('pending 返回待审批列表 (含委托中), 逾期优先排序', () => {
    const pending = svc.listPending()
    expect(pending.length).toBeGreaterThanOrEqual(7)
    const types = pending.map((i) => i.type)
    expect(types).toEqual(expect.arrayContaining(['报告签发', '报告发布', '危急值处置', '费用审批', '请假审批']))
    // 逾期项 (ma-006, ma-007 dueAt 已过期) 应排在前面
    expect(pending[0]!.id).toBe('ma-006')
    expect(new Date(pending[0]!.dueAt).getTime()).toBeLessThan(Date.now())
  })

  it('pending 条目标含约定字段形状 (id/type/title/applicant/submittedAt/dueAt/status)', () => {
    const [first] = svc.listPending()
    expect(first).toEqual(expect.objectContaining({
      id: expect.any(String),
      type: expect.any(String),
      title: expect.any(String),
      applicant: expect.any(String),
      submittedAt: expect.any(String),
      dueAt: expect.any(String),
      status: expect.any(String),
    }))
    expect(svc.listPending().every((i) => i.status === 'pending' || i.status === 'delegated')).toBe(true)
  })

  it('approve 通过审批: status=approved + comment + processedAt/By', () => {
    const item = svc.approve('ma-001', { comment: '同意签发' })
    expect(item.status).toBe('approved')
    expect(item.comment).toBe('同意签发')
    expect(item.processedAt).not.toBeNull()
    expect(item.processedBy).toContain('current')
    // 从待办中移除
    expect(svc.listPending().some((i) => i.id === 'ma-001')).toBe(false)
  })

  it('approve 不传 comment 也允许 (可选)', () => {
    const item = svc.approve('ma-002', {})
    expect(item.status).toBe('approved')
    expect(item.comment).toBeUndefined()
  })

  it('reject 驳回: status=rejected + reason, 缺少 reason 抛 BadRequestException', () => {
    const item = svc.reject('ma-003', { reason: '危急值记录不完整, 请补充' })
    expect(item.status).toBe('rejected')
    expect(item.reason).toBe('危急值记录不完整, 请补充')
    expect(svc.history().some((i) => i.id === 'ma-003')).toBe(true)
    expect(() => svc.reject('ma-004', { reason: '' })).toThrow(BadRequestException)
  })

  it('delegate 委派: status=delegated + delegatedTo, 保留在待办列表', () => {
    const item = svc.delegate('ma-004', { toUserId: 'D1008' })
    expect(item.status).toBe('delegated')
    expect(item.delegatedTo).toBe('D1008')
    const pending = svc.listPending()
    expect(pending.some((i) => i.id === 'ma-004')).toBe(true)
    expect(pending.find((i) => i.id === 'ma-004')!.status).toBe('delegated')
  })

  it('delegate 缺少 toUserId 抛 BadRequestException', () => {
    expect(() => svc.delegate('ma-001', { toUserId: '' })).toThrow(BadRequestException)
  })

  it('已处理的事项不能重复操作 (approve/reject/delegate 均拦截)', () => {
    svc.approve('ma-001', {})
    expect(() => svc.approve('ma-001', {})).toThrow(BadRequestException)
    expect(() => svc.reject('ma-001', { reason: 'x' })).toThrow(BadRequestException)
    expect(() => svc.delegate('ma-001', { toUserId: 'D1008' })).toThrow(BadRequestException)
  })

  it('操作不存在的 id 抛 NotFoundException', () => {
    expect(() => svc.approve('ma-999', {})).toThrow(NotFoundException)
    expect(() => svc.reject('ma-999', { reason: 'x' })).toThrow(NotFoundException)
    expect(() => svc.delegate('ma-999', { toUserId: 'D1008' })).toThrow(NotFoundException)
  })

  it('history 只含 approved/rejected, 按处理时间倒序, 含处理人/备注', () => {
    svc.approve('ma-001', { comment: 'ok' })
    svc.reject('ma-002', { reason: '补充材料' })
    const history = svc.history()
    expect(history.every((i) => i.status === 'approved' || i.status === 'rejected')).toBe(true)
    expect(history[0]!.processedAt! >= history[1]!.processedAt!).toBe(true)
    const ma101 = history.find((i) => i.id === 'ma-101')
    expect(ma101).toEqual(expect.objectContaining({ status: 'approved', processedBy: expect.any(String) }))
  })

  it('stats 统计 待审/已审/委派中/逾期, 且与列表计数一致', () => {
    const stats = svc.getStats()
    expect(stats.pending).toBe(svc.listPending().filter((i) => i.status === 'pending').length)
    expect(stats.delegated).toBe(svc.listPending().filter((i) => i.status === 'delegated').length)
    expect(stats.overdue).toBeGreaterThanOrEqual(2)
    expect(stats.byType).toHaveLength(5)
    expect(stats.byType.reduce((s, t) => s + t.count, 0)).toBe(stats.pending + stats.delegated)
  })

  it('委派后重新通过: delegated 状态可继续 approve', () => {
    svc.delegate('ma-004', { toUserId: 'D1008' })
    const item = svc.approve('ma-004', { comment: '受托人已确认' })
    expect(item.status).toBe('approved')
    expect(item.delegatedTo).toBe('D1008')
  })
})
