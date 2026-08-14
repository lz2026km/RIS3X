/**
 * G005 RIS v3.0.6.11-99 (Wave 2A 报告批注) - ReportAnnotationService 测试
 * 批注 CRUD / 引用段落 / 回复(嵌套1层) / 解决 / 重开 / 按作者统计 (内存 + 种子)
 */
import { ReportAnnotationService } from '../src/modules/report-annotation/report-annotation.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'

const ACTOR = { id: 'u-test', name: '测试医生' }

describe('ReportAnnotationService - 批注', () => {
  it('list 种子非空且按创建时间倒序 (仅返回该 reportId)', () => {
    const svc = new ReportAnnotationService()
    const list = svc.list('RPT-000001')
    expect(list.length).toBeGreaterThanOrEqual(2)
    expect(list.every((a) => a.reportId === 'RPT-000001')).toBe(true)
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1]!.createdAt >= list[i]!.createdAt).toBe(true)
    }
    expect(svc.list('RPT-NOT-EXIST')).toEqual([])
  })

  it('create 生成批注 (authorId/authorName/quote/status=open)', () => {
    const svc = new ReportAnnotationService()
    const created = svc.create(
      { reportId: 'RPT-000001', content: '这里需要补充增强扫描建议。', quote: '右肺中叶见结节影。' },
      ACTOR,
    )
    expect(created.id).toBeTruthy()
    expect(created.authorId).toBe('u-test')
    expect(created.authorName).toBe('测试医生')
    expect(created.quote).toBe('右肺中叶见结节影。')
    expect(created.status).toBe('open')
    expect(created.replies).toEqual([])
    expect(svc.list('RPT-000001').some((a) => a.id === created.id)).toBe(true)
  })

  it('create 校验: content 过短 / reportId 缺失 → BadRequestException', () => {
    const svc = new ReportAnnotationService()
    expect(() => svc.create({ reportId: 'RPT-1', content: '短' }, ACTOR)).toThrow(BadRequestException)
    expect(() => svc.create({ reportId: '', content: '内容足够长' }, ACTOR)).toThrow(BadRequestException)
  })

  it('create 支持 authorName 覆盖 (前端传入展示名)', () => {
    const svc = new ReportAnnotationService()
    const created = svc.create(
      { reportId: 'RPT-000001', content: '匿名批注内容足够长', authorName: '张海涛' },
      { id: 'u-1', name: 'fallback' },
    )
    expect(created.authorName).toBe('张海涛')
  })

  it('update 修改内容并标记 editedAt', () => {
    const svc = new ReportAnnotationService()
    const target = svc.list('RPT-000001')[0]!
    const before = target.editedAt
    const updated = svc.update(target.id, { content: '更新后的批注内容 (更长更完整)' })
    expect(updated.content).toContain('更新后')
    expect(updated.editedAt).toBeTruthy()
    expect(updated.editedAt).not.toBe(before)
  })

  it('update 未知 id → NotFoundException', () => {
    const svc = new ReportAnnotationService()
    expect(() => svc.update('RA-UNKNOWN', { content: '内容足够长' })).toThrow(NotFoundException)
  })

  it('reply 追加回复 (嵌套 1 层) 且回复者信息正确', () => {
    const svc = new ReportAnnotationService()
    const target = svc.list('RPT-000100')[0]!
    const before = target.replies.length
    const updated = svc.reply(target.id, '已确认危急值电话闭环。', { id: 'u-2', name: '王秀峰' })
    expect(updated.replies.length).toBe(before + 1)
    const last = updated.replies[updated.replies.length - 1]!
    expect(last.annotationId).toBe(target.id)
    expect(last.authorName).toBe('王秀峰')
    expect(last.content).toBe('已确认危急值电话闭环。')
  })

  it('reply 未知 id → NotFoundException; 过短内容 → BadRequestException', () => {
    const svc = new ReportAnnotationService()
    expect(() => svc.reply('RA-UNKNOWN', '内容足够长', ACTOR)).toThrow(NotFoundException)
    const target = svc.list('RPT-000001')[0]!
    expect(() => svc.reply(target.id, '短', ACTOR)).toThrow(BadRequestException)
  })

  it('resolve 设置 status/resolvedAt/resolvedBy/resolution, reopen 恢复 open', () => {
    const svc = new ReportAnnotationService()
    const target = svc.list('RPT-000001').find((a) => a.status === 'open')!
    const resolved = svc.resolve(target.id, '已按意见修改并复核。', ACTOR)
    expect(resolved.status).toBe('resolved')
    expect(resolved.resolvedAt).toBeTruthy()
    expect(resolved.resolvedBy).toBe('测试医生')
    expect(resolved.resolution).toBe('已按意见修改并复核。')

    const reopened = svc.reopen(resolved.id)
    expect(reopened.status).toBe('open')
    expect(reopened.resolvedAt).toBeNull()
    expect(reopened.resolvedBy).toBeNull()
    expect(reopened.resolution).toBeNull()
  })

  it('resolve/reopen 未知 id → NotFoundException', () => {
    const svc = new ReportAnnotationService()
    expect(() => svc.resolve('RA-UNKNOWN', '意见', ACTOR)).toThrow(NotFoundException)
    expect(() => svc.reopen('RA-UNKNOWN')).toThrow(NotFoundException)
  })

  it('remove 删除后列表不再包含, 重复删除 → NotFoundException', () => {
    const svc = new ReportAnnotationService()
    const target = svc.list('RPT-000002')[0]!
    svc.remove(target.id)
    expect(svc.list('RPT-000002').some((a) => a.id === target.id)).toBe(false)
    expect(() => svc.remove(target.id)).toThrow(NotFoundException)
  })

  it('stats 返回 总数/未解决/已解决/按作者聚合', () => {
    const svc = new ReportAnnotationService()
    const s = svc.stats('RPT-000001')
    expect(s.reportId).toBe('RPT-000001')
    expect(s.total).toBe(s.open + s.resolved)
    expect(s.byAuthor.length).toBeGreaterThan(0)
    const sumCount = s.byAuthor.reduce((acc, x) => acc + x.count, 0)
    expect(sumCount).toBe(s.total)
    const sumOpen = s.byAuthor.reduce((acc, x) => acc + x.open, 0)
    expect(sumOpen).toBe(s.open)
  })

  it('stats 空报告返回零值统计', () => {
    const svc = new ReportAnnotationService()
    const s = svc.stats('RPT-NOT-EXIST')
    expect(s).toEqual({ reportId: 'RPT-NOT-EXIST', total: 0, open: 0, resolved: 0, byAuthor: [] })
  })
})
