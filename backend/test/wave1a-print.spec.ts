/**
 * [G005 Wave1A] Print 模块 spec — 内存 seed + 生命周期 + Device 派生打印机
 */
import { PrintService } from '../src/modules/print/print.service'

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

describe('Wave1A Print', () => {
  it('jobs: seed 队列/历史 + 创建任务', () => {
    const svc = new PrintService(failingPrisma())
    const all = svc.listJobs()
    expect(all.length).toBeGreaterThan(0)
    const queue = svc.listQueue()
    expect(queue.every((j) => j.status === 'queued' || j.status === 'printing')).toBe(true)
    const history = svc.listHistory()
    expect(history.every((j) => j.status === 'completed' || j.status === 'failed')).toBe(true)

    const created = svc.createJob({ patientName: '新患者', modality: 'DR', copies: 2 })
    expect(created.status).toBe('queued')
    expect(created.filmSpec).toBe('10x12')
    expect(created.copies).toBe(2)
    expect(svc.getJob(created.id)).toBeDefined()
  })

  it('cancel/retry/reprint 生命周期', () => {
    const svc = new PrintService(failingPrisma())
    const created = svc.createJob({ patientName: '重试患者', studyType: '胸部CT' })
    expect(svc.cancelJob(created.id).ok).toBe(true)
    expect(() => svc.getJob(created.id)).toThrow()

    const failed = svc.listJobs().find((j) => j.status === 'failed')!
    const retried = svc.retryJob(failed.id)
    expect(retried.ok).toBe(true)

    const completed = svc.listJobs().find((j) => j.status === 'completed')!
    const reprinted = svc.reprintJob(completed.id)
    expect(reprinted.status).toBe('queued')
    expect(reprinted.patientName).toBe(completed.patientName)
  })

  it('printers: DB 失败回退 seed; DB 有设备时派生胶片打印机', async () => {
    const fallbackSvc = new PrintService(failingPrisma())
    const seedPrinters = await fallbackSvc.listPrinters()
    expect(seedPrinters.length).toBeGreaterThanOrEqual(5)
    expect(seedPrinters.every((p) => p.name && p.status)).toBe(true)

    const prisma: any = {
      device: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'D1', name: 'CT-1', modality: 'CT', location: '1室', state: 'IDLE' },
          { id: 'D2', name: 'MR-1', modality: 'MR', location: '2室', state: 'MAINTENANCE' },
        ]),
      },
    }
    const svc = new PrintService(prisma)
    const printers = await svc.listPrinters()
    expect(printers.length).toBeGreaterThanOrEqual(7)
    const fp = printers.find((p) => p.id === 'FP-1')!
    expect(fp.name).toContain('CT-1')
    expect(fp.status).toBe('online')
    expect(fp.filmSpec).toBe('14x17')
    const fp2 = printers.find((p) => p.id === 'FP-2')!
    expect(fp2.status).toBe('offline')
  })

  it('stats: 胶片用量/设备打印/成本报表 (确定性)', () => {
    const svc = new PrintService(failingPrisma())
    const stats = svc.getStats()
    expect(stats.filmUsage.length).toBe(7)
    expect(stats.filmUsage.every((d) => d.total === d.films14x17 + d.films10x12 + d.films8x10)).toBe(true)
    expect(stats.costReport).toHaveLength(7)
    expect(stats.devicePrint.length).toBeGreaterThan(0)
  })
})
