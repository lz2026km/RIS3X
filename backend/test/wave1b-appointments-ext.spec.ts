/**
 * [G005 Wave1B P1] Appointments 5 子资源扩展 spec — rules / waitlist / reminders / reschedules / cancellations
 */
import { AppointmentsService } from '../src/appointments/appointments.service'

function failingPrisma(): any {
  return new Proxy(
    {},
    {
      get: () => () => {
        throw new Error('no db (verification stub)')
      },
    },
  )
}

describe('Wave1B Appointments extensions', () => {
  it('rules: DB 失败时回退确定性规则 (CT/MR/DR)', async () => {
    const svc = new AppointmentsService(failingPrisma())
    const rules = await svc.rules()
    expect(rules.length).toBeGreaterThanOrEqual(3)
    expect(rules.every((r) => r.deviceName && r.maxDailyAppointments > 0 && r.enabled)).toBe(true)
  })

  it('rules: DB 有设备时按模态派生容量', async () => {
    const prisma: any = {
      device: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'D1', name: 'CT-1', modality: 'CT', state: 'IDLE' },
          { id: 'D2', name: 'MR-1', modality: 'MR', state: 'BROKEN' },
        ]),
      },
    }
    const svc = new AppointmentsService(prisma)
    const rules = await svc.rules()
    expect(rules).toHaveLength(2)
    expect(rules[0]!.maxDailyAppointments).toBe(60)
    expect(rules[1]!.enabled).toBe(false)
  })

  it('waitlist: DB 失败时返回空表 (轻量实现)', async () => {
    const svc = new AppointmentsService(failingPrisma())
    const list = await svc.waitlist()
    expect(Array.isArray(list)).toBe(true)
  })

  it('reminders / reschedules / cancellations: 确定性 seed 形状', async () => {
    const svc = new AppointmentsService(failingPrisma())
    const reminders = svc.reminders()
    expect(reminders.length).toBeGreaterThan(0)
    expect(reminders.every((r) => r.patientName && r.phone && r.status)).toBe(true)
    const reschedules = svc.reschedules()
    expect(reschedules.length).toBeGreaterThan(0)
    expect(reschedules.every((r) => r.originalDate && r.newDate)).toBe(true)
    const cancellations = svc.cancellations()
    expect(cancellations.length).toBeGreaterThan(0)
    expect(cancellations.every((c) => c.patientName && c.reason)).toBe(true)
  })
})
