/**
 * G005 W3-BackendParity - 眼科 PACS 关键影像/病灶分割/标注/测量写端点 spec
 */
import { EyeService } from './eye.service'

const makeService = () => new EyeService({} as never)

describe('EyeService PACS parity endpoints', () => {
  it('listPacsKeyImages 支持 studyId 过滤', () => {
    const svc = makeService()
    const all = svc.listPacsKeyImages({})
    expect(all.data.length).toBeGreaterThan(0)
    const filtered = svc.listPacsKeyImages({ studyId: 'ES-1001' })
    for (const k of filtered.data as Array<{ studyId: string }>) expect(k.studyId).toBe('ES-1001')
  })

  it('listPacsLesionSegmentations / listPacsAnnotations 返回数组', () => {
    const svc = makeService()
    expect(Array.isArray(svc.listPacsLesionSegmentations({}).data)).toBe(true)
    expect(Array.isArray(svc.listPacsAnnotations({}).data)).toBe(true)
  })

  it('测量创建后列表可见, 删除后消失', async () => {
    const svc = makeService()
    const created = svc.createPacsMeasurement({ studyId: 'ES-9999', measurementType: '测试', value: 1, unit: 'mm' })
    const id = (created.data as { id: string }).id
    const listed = await svc.listPacsMeasurements({ studyId: 'ES-9999' })
    expect((listed.data as Array<{ id: string }>).some((m) => m.id === id)).toBe(true)
    const deleted = svc.deletePacsMeasurement(id)
    expect(deleted.success).toBe(true)
    const after = await svc.listPacsMeasurements({ studyId: 'ES-9999' })
    expect((after.data as Array<{ id: string }>).some((m) => m.id === id)).toBe(false)
  })

  it('删除不存在测量 → success=false', () => {
    const svc = makeService()
    expect(svc.deletePacsMeasurement('NOPE').success).toBe(false)
  })

  it('exportPacsMeasurementSr 返回 SR 导出对象', () => {
    const svc = makeService()
    const res = svc.exportPacsMeasurementSr({ studyUid: '1.2.3' })
    expect(res.ok).toBe(true)
    expect(res.objectUrl).toContain('export-sr')
  })
})
