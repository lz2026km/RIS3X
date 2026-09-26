// [G005 W8-Report] ReportRecallService spec — 召回事件 + HL7 ORU(C) + 回执
import { ReportRecallService } from './report-recall.service'

const make = () => new ReportRecallService({} as never)

describe('ReportRecallService (W8 召回通知)', () => {
  it('recall 生成 HL7 ORU^R01 且结果状态 C', () => {
    const svc = make()
    const rec = svc.recall('RPT-R1', { reason: '结果有误需召回', actorId: 'D001', reportSnapshot: { findings: '所见', conclusion: '结论' } })
    expect(rec.reportId).toBe('RPT-R1')
    expect(rec.hl7.messageType).toBe('ORU^R01')
    expect(rec.hl7.resultStatus).toBe('C')
    expect(rec.hl7.target).toBe('HIS')
    expect(rec.hl7.message).toContain('ORU^R01')
    expect(rec.hl7.message).toContain('||C')
    expect(rec.hl7.bytes).toBeGreaterThan(0)
    expect(rec.notify.delivered).toBe(true)
  })

  it('空原因 → 抛错', () => {
    const svc = make()
    expect(() => svc.recall('RPT-R2', { reason: '  ', actorId: 'D001' })).toThrow('召回原因不能为空')
  })

  it('回执: 召回后未确认, acknowledge 后 acknowledged=true', () => {
    const svc = make()
    svc.recall('RPT-R3', { reason: '召回', actorId: 'D001' })
    const before = svc.getAck('RPT-R3')
    expect(before.recalled).toBe(true)
    expect(before.acknowledged).toBe(false)
    expect(before.controlId).toContain('ORU-G005-RPT-R3')

    const acked = svc.acknowledge('RPT-R3', { ackBy: '临床-张医生', note: '已收到', source: 'CLINICIAN' })
    expect(acked.acknowledgement?.ackBy).toBe('临床-张医生')
    const after = svc.getAck('RPT-R3')
    expect(after.acknowledged).toBe(true)
    expect(after.acknowledgement?.source).toBe('CLINICIAN')
  })

  it('无召回记录确认 → NotFound', () => {
    const svc = make()
    expect(() => svc.acknowledge('RPT-NONE', { ackBy: 'x' })).toThrow()
  })

  it('list 按报告过滤', () => {
    const svc = make()
    svc.recall('RPT-R4', { reason: 'r1', actorId: 'D001' })
    svc.recall('RPT-R5', { reason: 'r2', actorId: 'D002' })
    const list = svc.list('RPT-R4')
    expect(list.total).toBe(1)
    expect(list.data[0]!.reportId).toBe('RPT-R4')
  })
})
