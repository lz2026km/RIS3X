import { QcExtService } from '../src/qcext/qcext.service'

describe('QcExtService', () => {
  let svc: QcExtService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      reportQualityScore: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), groupBy: jest.fn() },
      dicomInstance: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      auditLog: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    }
    svc = new QcExtService(mockPrisma)
  })

  it('getQcDashboard counts and lists recent scores', async () => {
    mockPrisma.reportQualityScore.count.mockResolvedValue(12)
    mockPrisma.reportQualityScore.findMany.mockResolvedValue([{ id: 's1' }])
    const r = await svc.getQcDashboard()
    expect(r.data).toMatchObject({ totalScored: 12 })
    expect(r.data.recent).toHaveLength(1)
  })

  it('getQcDashboardItem wraps score or empty', async () => {
    mockPrisma.reportQualityScore.findUnique.mockResolvedValue({ id: 's1' })
    await expect(svc.getQcDashboardItem('s1')).resolves.toMatchObject({ data: [{ id: 's1' }] })
    mockPrisma.reportQualityScore.findUnique.mockResolvedValue(null)
    await expect(svc.getQcDashboardItem('x')).resolves.toEqual({ data: [] })
  })

  it('listQcImages and getQcImage', async () => {
    mockPrisma.dicomInstance.findMany.mockResolvedValue([{ id: 'd1' }])
    await expect(svc.listQcImages()).resolves.toMatchObject({ data: [{ id: 'd1' }] })
    mockPrisma.dicomInstance.findUnique.mockResolvedValue({ id: 'd1' })
    await expect(svc.getQcImage('d1')).resolves.toMatchObject({ data: [{ id: 'd1' }] })
  })

  it('rateQcImage updates instance without id in data', async () => {
    mockPrisma.dicomInstance.update.mockResolvedValue({ id: 'd1' })
    const r = await svc.rateQcImage({ id: 'd1', quality: 4, notes: 'n' })
    expect(mockPrisma.dicomInstance.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'd1' }, data: { quality: 4, notes: 'n' } }))
    expect(r.data).toHaveLength(1)
  })

  it('radiologist annual list and get', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'a1' }])
    await expect(svc.listRadiologistAnnual()).resolves.toMatchObject({ data: [{ id: 'a1' }] })
    mockPrisma.auditLog.findUnique.mockResolvedValue({ id: 'a1' })
    await expect(svc.getRadiologistAnnual('a1')).resolves.toMatchObject({ data: [{ id: 'a1' }] })
  })

  it('qc defects list and report', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'a1' }])
    await expect(svc.listQcDefects()).resolves.toMatchObject({ data: [{ id: 'a1' }] })
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a2' })
    await svc.reportQcDefect({ type: 'phantom', note: 'x' })
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ resource: 'qc-defect' }) }))
  })

  it('getQcStats counts and groups by grade', async () => {
    mockPrisma.reportQualityScore.count.mockResolvedValue(8)
    mockPrisma.reportQualityScore.groupBy.mockResolvedValue([{ grade: 'A', _count: { id: 5 } }])
    const r = await svc.getQcStats()
    expect(r.data.total).toBe(8)
    expect(r.data.byGrade).toHaveLength(1)
  })

  it('listQcScores returns all scores', async () => {
    mockPrisma.reportQualityScore.findMany.mockResolvedValue([{ id: 's1' }])
    await expect(svc.listQcScores()).resolves.toMatchObject({ data: [{ id: 's1' }] })
  })
})
