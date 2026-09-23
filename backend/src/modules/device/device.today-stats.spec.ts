/**
 * G005 W3-BackendParity - GET /devices/stats/today 服务 spec
 */
import { DeviceService } from './device.service'

describe('DeviceService.getTodayStats', () => {
  it('DB 可用 → 返回各状态计数 + total/totalDevices', async () => {
    const counts = [12, 5, 4, 2]
    const count = jest.fn()
    counts.forEach((n) => count.mockResolvedValueOnce(n))
    const prisma = { device: { count } } as never
    const svc = new DeviceService(prisma)
    const res = await svc.getTodayStats()
    expect(res.data.totalDevices).toBe(12)
    expect(res.data.total).toBe(12)
    expect(res.data.inUse).toBe(5)
    expect(res.data.idle).toBe(4)
    expect(res.data.maintenance).toBe(2)
  })

  it('DB 不可用 → 回退确定性种子', async () => {
    const prisma = { device: { count: jest.fn().mockRejectedValue(new Error('no db')) } } as never
    const svc = new DeviceService(prisma)
    const res = await svc.getTodayStats()
    expect(res.data.totalDevices).toBeGreaterThan(0)
    expect(res.data.total).toBe(res.data.totalDevices)
  })
})
