/**
 * [G005 W9-QC] defect-library 规范化缺陷库 spec
 */
import { DefectLibraryService } from './defect-library.service'

describe('DefectLibraryService', () => {
  let service: DefectLibraryService

  beforeEach(() => {
    service = new DefectLibraryService()
  })

  it('种子: 6 分类 / 24 缺陷项', () => {
    expect(service.listCategories()).toHaveLength(6)
    expect(service.listItems()).toHaveLength(24)
  })

  it('按类别/严重度/关键词过滤', () => {
    expect(service.listItems({ categoryCode: 'STRUCT' }).length).toBe(5)
    expect(service.listItems({ severity: 'critical' }).every((i) => i.severity === 'critical')).toBe(true)
    expect(service.listItems({ keyword: '危急值' }).length).toBeGreaterThan(0)
  })

  it('createItem 校验分类/编码唯一', () => {
    const item = service.createItem({ code: 'NEW-01', categoryCode: 'STRUCT', name: '新缺陷', severity: 'low', description: '测试' })
    expect(item.id).toBeTruthy()
    expect(() => service.createItem({ code: 'NEW-01', categoryCode: 'STRUCT', name: 'x', severity: 'low', description: 'x' })).toThrow()
    expect(() => service.createItem({ code: 'NEW-02', categoryCode: 'BAD', name: 'x', severity: 'low', description: 'x' })).toThrow()
  })

  it('update/delete item', () => {
    const item = service.createItem({ code: 'NEW-03', categoryCode: 'TERM', name: '术语缺陷', severity: 'medium', description: 'x' })
    const updated = service.updateItem(item.id, { severity: 'high' })
    expect(updated.severity).toBe('high')
    const del = service.deleteItem(item.id)
    expect(del.deleted).toBe(true)
    expect(() => service.getItem(item.id)).toThrow()
  })

  it('aggregation: 按分类/严重度聚合总数一致', () => {
    const agg = service.aggregation()
    expect(agg.total).toBe(24)
    expect(agg.byCategory.reduce((a, c) => a + c.count, 0)).toBe(24)
    expect(agg.bySeverity.reduce((a, s) => a + s.count, 0)).toBe(24)
  })
})
