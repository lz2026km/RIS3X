/**
 * G005 W8-Dose - RDSR 剂量监测扩展端点 spec
 * 覆盖: getStaffDose / getBreastDose / getDeviceHistory / getDoseOverview
 */
import { RdsrService } from './rdsr.service'

describe('RdsrService dose extras', () => {
  it('getStaffDose 返回确定性工作人员剂量记录 (字段完整)', async () => {
    const svc = new RdsrService()
    const rows = await svc.getStaffDose()
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.id).toBeTruthy()
      expect(r.staffName).toBeTruthy()
      expect(r.annualLimit).toBeGreaterThan(0)
      expect(Array.isArray(r.readings)).toBe(true)
      expect(r.readings.length).toBeGreaterThan(0)
    }
  })

  it('getStaffDose 两次调用返回相同数据 (确定性)', async () => {
    const svc = new RdsrService()
    expect(await svc.getStaffDose()).toEqual(await svc.getStaffDose())
  })

  it('getBreastDose 返回确定性乳腺 AGD 记录', async () => {
    const svc = new RdsrService()
    const rows = await svc.getBreastDose()
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.agd).toBeGreaterThanOrEqual(0)
      expect(['normal', 'warning', 'critical']).toContain(r.alertLevel)
      expect(['none', 'recalled', 'completed']).toContain(r.recallStatus)
    }
    expect(await svc.getBreastDose()).toEqual(rows)
  })

  it('getDeviceHistory 返回 7 日确定性历史', async () => {
    const svc = new RdsrService()
    const rows = await svc.getDeviceHistory('CT-1')
    expect(rows).toHaveLength(7)
    for (const r of rows) {
      expect(r.date).toBeTruthy()
      expect(typeof r.DLP).toBe('number')
      expect(typeof r.CTDIvol).toBe('number')
    }
    expect(await svc.getDeviceHistory('CT-2')).toEqual(rows)
  })

  it('getDoseOverview 返回四组确定性结构', async () => {
    const svc = new RdsrService()
    const ov = await svc.getDoseOverview()
    expect(ov.deviceDose.length).toBeGreaterThan(0)
    expect(ov.doseHistory.length).toBeGreaterThan(0)
    expect(ov.ctdivolTrend.length).toBeGreaterThan(0)
    expect(ov.deviceDap.length).toBeGreaterThan(0)
    expect(ov).toEqual(await svc.getDoseOverview())
  })
})
