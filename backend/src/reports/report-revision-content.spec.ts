// [G005 W8-Report] ReportRevisionContentStore spec — 内容版本快照 + 真实前后差异
import { ReportRevisionContentStore } from './report-revision-content.store'

describe('ReportRevisionContentStore (W8 内容版本)', () => {
  it('seed 报告含多版本快照, diff 返回真实前后差异', () => {
    const store = new ReportRevisionContentStore()
    const list = store.list('RPT-000001')
    expect(list.length).toBeGreaterThanOrEqual(3)
    const diff = store.diff('RPT-000001')
    expect(diff).not.toBeNull()
    expect(diff!.changedFields.length).toBeGreaterThan(0)
    expect(diff!.before).not.toBeNull()
    expect(diff!.after).toBeTruthy()
    // 现场: 最新版本结论已含「穿刺活检」/ 前版本含「增大」
    const conclusionField = diff!.fields.find((f) => f.field === 'conclusion')
    expect(conclusionField?.changed).toBe(true)
  })

  it('append 递增版本号并可对比指定版本', () => {
    const store = new ReportRevisionContentStore()
    store.append({ reportId: 'RPT-NEW', findings: 'v1 所见', conclusion: 'v1 结论', impression: '', diagnosis: '', recommendations: '', qualityScore: 80, actorId: 'D001', fromState: 'WRITING', toState: 'SUBMITTED' })
    const v2 = store.append({ reportId: 'RPT-NEW', findings: 'v2 所见', conclusion: 'v2 结论', impression: '', diagnosis: '', recommendations: '', qualityScore: 88, actorId: 'D002', fromState: 'SUBMITTED', toState: 'INITIAL_REVIEW' })
    expect(v2.versionNumber).toBe(2)
    const diff = store.diff('RPT-NEW', v2.id)
    expect(diff!.fromVersionNumber).toBe(1)
    expect(diff!.toVersionNumber).toBe(2)
    expect(diff!.changedFields).toContain('findings')
    expect(diff!.changedFields).toContain('conclusion')
  })

  it('diffBetween 两个任意版本', () => {
    const store = new ReportRevisionContentStore()
    const a = store.list('RPT-1001')[0]!
    const b = store.list('RPT-1001')[1]!
    const diff = store.diffBetween('RPT-1001', a.id, b.id)
    expect(diff!.before?.versionNumber).toBe(1)
    expect(diff!.after.versionNumber).toBe(2)
    expect(diff!.changedFields.length).toBeGreaterThan(0)
  })

  it('不存在版本 → diff 返回 null', () => {
    const store = new ReportRevisionContentStore()
    expect(store.diff('RPT-GONE')).toBeNull()
    expect(store.diff('RPT-000001', 'no-such-version')).toBeNull()
  })
})
