/**
 * [G005 Wave1A] Kiosk 模块 spec — Patient 派生 + 签到 + 统计
 */
import { KioskService } from '../src/modules/kiosk/kiosk.service'

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

describe('Wave1A Kiosk', () => {
  it('patients: DB 失败时按 idCard 后4位回退 seed', async () => {
    const svc = new KioskService(failingPrisma())
    const hit = await svc.lookupPatients('1234')
    expect(hit.length).toBeGreaterThan(0)
    expect(hit.every((p) => p.patientId && p.patientName && p.exams.length > 0)).toBe(true)
    const miss = await svc.lookupPatients('9999')
    expect(miss.length).toBe(0)
  })

  it('patients: DB 派生 (idCard endsWith + 待检项目)', async () => {
    const prisma: any = {
      patient: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'P1', name: '张三', idCard: '310101196805121234' },
        ]),
      },
      exam: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'E1', bodyPart: '胸部', modality: 'CT', patientId: 'P1' },
        ]),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'A1', bodyPart: '腹部', modality: 'US', patientId: 'P1', patientName: '张三' },
        ]),
      },
    }
    const svc = new KioskService(prisma)
    const patients = await svc.lookupPatients('1234')
    expect(patients).toHaveLength(1)
    expect(patients[0]!.idCardLast4).toBe('1234')
    expect(patients[0]!.exams[0]!.name).toBe('CT 胸部')
    expect(patients[0]!.exams[1]!.name).toBe('US 腹部')
  })

  it('checkIn: 生成排队号/预计等待/检查室', () => {
    const svc = new KioskService(failingPrisma())
    const result = svc.checkIn({ patientId: 'P1', patientName: '张三', examItemId: 'E1', modality: 'MR' })
    expect(result.queueNumber).toMatch(/^A\d{3}$/)
    expect(result.estimatedWaitMinutes).toBeGreaterThanOrEqual(10)
    expect(result.roomName).toBe('MR-1室')
    expect(result.checkedInAt).toBeTruthy()
  })

  it('stats: DB 失败回退 seed; DB 有数据时真实聚合', async () => {
    const fallback = new KioskService(failingPrisma())
    const seedStats = await fallback.getStats()
    expect(seedStats.todayCount).toBeGreaterThan(0)
    expect(seedStats.activeRooms).toBeGreaterThan(0)

    const prisma: any = {
      exam: {
        count: jest
          .fn()
          .mockResolvedValueOnce(30) // todayCount
          .mockResolvedValueOnce(8), // waitingCount
      },
      device: { count: jest.fn().mockResolvedValue(5) },
    }
    const svc = new KioskService(prisma)
    const stats = await svc.getStats()
    expect(stats.todayCount).toBe(30)
    expect(stats.waitingCount).toBe(8)
    expect(stats.activeRooms).toBe(5)
  })

  it('settings / messages: 可列出', () => {
    const svc = new KioskService(failingPrisma())
    const settings = svc.listSettings()
    expect(settings.length).toBeGreaterThan(0)
    expect(settings.some((s) => s.key === 'kiosk_enabled')).toBe(true)
    const messages = svc.listMessages()
    expect(messages.length).toBeGreaterThan(0)
    expect(messages.every((m) => m.title && m.content)).toBe(true)
  })
})
