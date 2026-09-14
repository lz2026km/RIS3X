/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1B (critical-alert / RQI overlay) - spec
 * 覆盖: 5 步流程「通知」步骤补写 notifiedAt/notifiedBy, 「确认」步骤补写 receivedBy/receiveNote
 * (内存 overlay 回退, 供 /criticals/rqi-stats 10 分钟通报口径消费)。
 */
import { CriticalAlertService } from './critical-alert.service'
import { criticalRqiOverlay } from '../../criticals/national-critical'

const makePrisma = () => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  return {
    criticalValue: { findMany: reject, findUnique: reject, create: reject, update: reject },
  } as never
}

describe('CriticalAlertService → RQI overlay (Wave 1B)', () => {
  beforeEach(() => {
    criticalRqiOverlay.clear()
  })

  it('notify 补写 notifiedAt/notifiedBy (内存 overlay) 且保留 5 步时间戳', async () => {
    const service = new CriticalAlertService(makePrisma())
    const notified = await service.notify('CA-001', { method: 'phone', phone: '13800000001' })
    expect(notified.flowSteps!.notified).toBeTruthy()

    const rec = criticalRqiOverlay.get('CA-001')
    expect(rec).toBeDefined()
    expect(rec!.notifiedAt).toBeTruthy()
    expect(rec!.notifiedBy).toBe('13800000001')
    expect(rec!.foundAt).toBeTruthy()
  })

  it('confirm 补写 receivedBy/receiveNote (内存 overlay)', async () => {
    const service = new CriticalAlertService(makePrisma())
    await service.notify('CA-005', { method: 'sms' })
    await service.confirm('CA-005', { receiver: '王医生', comment: '已接收' })

    const rec = criticalRqiOverlay.get('CA-005')
    expect(rec?.receivedBy).toBe('王医生')
    expect(rec?.receiveNote).toBe('已接收')
  })

  it('confirm 无备注时不写空 receiveNote', async () => {
    const service = new CriticalAlertService(makePrisma())
    await service.notify('CA-001', { method: 'sms' })
    await service.confirm('CA-001', { receiver: '李医生' })
    const rec = criticalRqiOverlay.get('CA-001')
    expect(rec?.receivedBy).toBe('李医生')
    expect(rec?.receiveNote).toBeUndefined()
  })
})
