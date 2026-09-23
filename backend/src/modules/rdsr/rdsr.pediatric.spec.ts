/**
 * G005 W3-BackendParity - RDSR 儿童剂量记录 spec
 */
import { RdsrService } from './rdsr.service'

describe('RdsrService.getPediatric', () => {
  it('返回确定性儿童剂量种子 (6 条, 字段完整)', async () => {
    const svc = new RdsrService()
    const rows = await svc.getPediatric()
    expect(rows).toHaveLength(6)
    for (const r of rows) {
      expect(r.id).toBeTruthy()
      expect(r.patientId).toBeTruthy()
      expect(r.age).toBeGreaterThanOrEqual(0)
      expect(['normal', 'warning', 'critical']).toContain(r.alertLevel)
      expect(r.doseUnit).toBeTruthy()
    }
  })

  it('两次调用返回相同数据 (确定性)', async () => {
    const svc = new RdsrService()
    const a = await svc.getPediatric()
    const b = await svc.getPediatric()
    expect(a).toEqual(b)
  })
})
