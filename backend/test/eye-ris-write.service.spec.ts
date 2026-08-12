import { EyeService } from '../src/eye/eye.service'

// [G005 Wave1A P1] EyeService RIS 写操作 (EyeRisPage: 排程/取消手术 + 接受转诊)
describe('EyeService RIS write ops', () => {
  let svc: EyeService

  beforeAll(() => {
    svc = new EyeService({} as never)
  })

  it('listRisSurgeries returns seeded surgeries', async () => {
    const { data } = await svc.listRisSurgeries()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(2)
  })

  it('createRisSurgery adds a new surgery with page DTO fields', async () => {
    const { data } = await svc.createRisSurgery({
      patientName: '测试患者',
      procedure: '白内障超声乳化 + IOL 植入',
      surgeonName: '张主任',
      scheduledDate: '2026-08-01',
      eyeSide: 'OD',
      orRoom: '手术室 2',
      preOpDiagnosis: '老年性白内障',
    })
    expect(data.id).toBeDefined()
    expect(data.patientName).toBe('测试患者')
    expect(data.procedure).toBe('白内障超声乳化 + IOL 植入')
    expect(data.status).toBe('scheduled')
    const { data: list } = await svc.listRisSurgeries()
    expect(list.some((s: any) => s.id === data.id)).toBe(true)
  })

  it('createRisSurgery accepts spec DTO {patientId, date, type, notes}', async () => {
    const { data } = await svc.createRisSurgery({
      patientId: 'PEYE-009',
      date: '2026-08-02',
      type: '玻璃体切割',
      notes: '术中备硅油',
    })
    expect(data.patientId).toBe('PEYE-009')
    expect(data.procedure).toBe('玻璃体切割')
    expect(data.notes).toBe('术中备硅油')
  })

  it('deleteRisSurgery removes a surgery', async () => {
    const created = await svc.createRisSurgery({ patientName: '待取消', procedure: '斜视矫正' })
    const { data } = await svc.deleteRisSurgery(created.data.id)
    expect(data.deleted).toBe(true)
    const { data: list } = await svc.listRisSurgeries()
    expect(list.some((s: any) => s.id === created.data.id)).toBe(false)
  })

  it('deleteRisSurgery reports not deleted for unknown id', async () => {
    const { data } = await svc.deleteRisSurgery('SURG-NOT-EXIST')
    expect(data.deleted).toBe(false)
  })

  it('acceptRisReferral flips pending -> accepted', async () => {
    const { data } = await svc.acceptRisReferral('REF-10001')
    expect(data).not.toBeNull()
    expect(data.status).toBe('accepted')
    expect(data.acceptedAt).toBeDefined()
  })

  it('acceptRisReferral returns null for unknown id', async () => {
    const { data } = await svc.acceptRisReferral('REF-NOT-EXIST')
    expect(data).toBeNull()
  })
})
