import { NotFoundException } from '@nestjs/common'
import { RadPathService } from '../src/modules/radpath/radpath.service'

describe('RadPathService', () => {
  let svc: RadPathService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      radPathRecord: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    }
    svc = new RadPathService(mockPrisma)
  })

  it('create stores a radpath record', async () => {
    mockPrisma.radPathRecord.create.mockResolvedValue({ id: 'rp-1', reportId: 'r1' })
    const result = await svc.create({ reportId: 'r1', pathologyId: 'p1', radFinding: '结节', pathResult: '腺癌', consistency: 'concordant', notes: 'n' })
    expect(result.id).toBe('rp-1')
    expect(mockPrisma.radPathRecord.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ consistency: 'concordant' }) }))
  })

  it('findByReport returns record or throws', async () => {
    mockPrisma.radPathRecord.findFirst.mockResolvedValue({ id: 'rp-1' })
    await expect(svc.findByReport('r1')).resolves.toMatchObject({ id: 'rp-1' })
    mockPrisma.radPathRecord.findFirst.mockResolvedValue(null)
    await expect(svc.findByReport('r9')).rejects.toThrow(NotFoundException)
  })

  it('findByPathology returns record or throws', async () => {
    mockPrisma.radPathRecord.findFirst.mockResolvedValue({ id: 'rp-2' })
    await expect(svc.findByPathology('p2')).resolves.toMatchObject({ id: 'rp-2' })
    mockPrisma.radPathRecord.findFirst.mockResolvedValue(null)
    await expect(svc.findByPathology('p9')).rejects.toThrow(NotFoundException)
  })

  it('updateConsistency updates existing record or throws', async () => {
    mockPrisma.radPathRecord.findUnique.mockResolvedValue({ id: 'rp-1', consistency: 'pending' })
    mockPrisma.radPathRecord.update.mockResolvedValue({ id: 'rp-1', consistency: 'discordant' })
    const r = await svc.updateConsistency({ id: 'rp-1', consistency: 'discordant', notes: 'n2' })
    expect(r.consistency).toBe('discordant')
    mockPrisma.radPathRecord.findUnique.mockResolvedValue(null)
    await expect(svc.updateConsistency({ id: 'ghost', consistency: 'pending' })).rejects.toThrow(NotFoundException)
  })

  it('getStats computes rates and monthly trend', async () => {
    mockPrisma.radPathRecord.count.mockResolvedValueOnce(10).mockResolvedValueOnce(7).mockResolvedValueOnce(2).mockResolvedValueOnce(1)
    mockPrisma.radPathRecord.findMany.mockResolvedValue([
      { createdAt: new Date('2026-07-05T00:00:00Z'), consistency: 'concordant' },
      { createdAt: new Date('2026-07-10T00:00:00Z'), consistency: 'discordant' },
      { createdAt: new Date('2026-08-01T00:00:00Z'), consistency: 'concordant' },
    ])
    const stats = await svc.getStats()
    expect(stats.total).toBe(10)
    expect(stats.concordant).toBe(7)
    expect(stats.positiveConsistency).toBe(70)
    expect(stats.trend).toEqual([
      { month: '2026-07', rate: 50 },
      { month: '2026-08', rate: 100 },
    ])
  })
})
