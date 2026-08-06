import { DentalService } from '../src/dental/dental.service'

describe('DentalService', () => {
  let svc: DentalService
  let mockPrisma: any

  beforeAll(() => {
    mockPrisma = {
      dentalStudy: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      dentalAiFinding: { findMany: jest.fn(), create: jest.fn() },
      dentalImplant: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      dentalAppointment: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      dentalInvoice: { findMany: jest.fn(), create: jest.fn() },
      dentalInventoryItem: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    }
    svc = new DentalService(mockPrisma)
  })

  beforeEach(() => jest.clearAllMocks())

  it('listStudies returns studies ordered by createdAt desc', async () => {
    mockPrisma.dentalStudy.findMany.mockResolvedValue([{ id: 's1', patientName: '张三' }])
    const result = await svc.listStudies()
    expect(mockPrisma.dentalStudy.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } })
    expect(result.data).toHaveLength(1)
  })

  it('getStudy returns study wrapped in array', async () => {
    mockPrisma.dentalStudy.findUnique.mockResolvedValue({ id: 's1', patientName: '张三' })
    const result = await svc.getStudy('s1')
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('s1')
  })

  it('getStudy returns empty array when not found', async () => {
    mockPrisma.dentalStudy.findUnique.mockResolvedValue(null)
    const result = await svc.getStudy('nonexistent')
    expect(result.data).toEqual([])
  })

  it('createStudy creates dental study record', async () => {
    const body = { patientId: 'p2', patientName: '张三', modality: 'CBCT', region: '上颌', toothArea: '上颌', studyDate: '2026-07-25', findings: '检查所见', impressions: '检查印象', deviceModel: 'Planmeca', fieldOfView: '15x15', imageCount: 1 }
    mockPrisma.dentalStudy.create.mockResolvedValue({ id: 's2', ...body })
    const result = await svc.createStudy(body as any)
    expect(mockPrisma.dentalStudy.create).toHaveBeenCalledWith({ data: body })
    expect(result.data[0].id).toBe('s2')
  })

  it('deleteStudy deletes and returns empty data', async () => {
    mockPrisma.dentalStudy.delete.mockResolvedValue({})
    const result = await svc.deleteStudy('s1')
    expect(mockPrisma.dentalStudy.delete).toHaveBeenCalledWith({ where: { id: 's1' } })
    expect(result.data).toEqual([])
  })

  it('listAppointments returns appointments ordered by scheduledAt desc', async () => {
    mockPrisma.dentalAppointment.findMany.mockResolvedValue([{ id: 'a1', patientName: '王五' }])
    const result = await svc.listAppointments()
    expect(mockPrisma.dentalAppointment.findMany).toHaveBeenCalledWith({ orderBy: { scheduledAt: 'desc' } })
    expect(result.data).toHaveLength(1)
  })

  // ── [G005-P1] 在用孤儿补齐: 核心 8 个 (seed 回退) ──

  describe('modality lists', () => {
    beforeEach(() => {
      mockPrisma.dentalStudy.findMany.mockResolvedValue([])
    })

    it('listCbct returns seed CBCT studies when DB empty', async () => {
      const r = await svc.listCbct()
      expect(r.success).toBe(true)
      expect(r.data.length).toBeGreaterThan(0)
      expect(r.data.every((s: any) => s.modality === 'CBCT')).toBe(true)
    })

    it('listPanoramic / listPeriapical / listScan / listBitewing return seeded studies', async () => {
      const panoramic = await svc.listPanoramic()
      expect(panoramic.data.every((s: any) => s.modality === 'Panoramic')).toBe(true)
      const periapical = await svc.listPeriapical()
      expect(periapical.data[0].modality).toBe('Periapical')
      const scan = await svc.listScan()
      expect(scan.data[0].modality).toBe('Scan')
      const bitewing = await svc.listBitewing()
      expect(bitewing.data[0].modality).toBe('Bitewing')
    })

    it('listCbct reads from DentalStudy table when rows exist', async () => {
      mockPrisma.dentalStudy.findMany.mockResolvedValue([{ id: 's1', modality: 'CBCT', patientName: '张三' }])
      const r = await svc.listCbct()
      expect(r.data).toHaveLength(1)
      expect(mockPrisma.dentalStudy.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { modality: 'CBCT' } }))
    })
  })

  it('compareStudies returns difference summary', async () => {
    const r = await svc.compareStudies('DT-1001', 'DT-1003')
    expect(r.success).toBe(true)
    expect(r.data.idA).toBe('DT-1001')
    expect(typeof r.data.differenceScore).toBe('number')
  })

  it('getStats aggregates studies and appointments', async () => {
    mockPrisma.dentalStudy.findMany.mockResolvedValue([])
    mockPrisma.dentalAppointment.findMany.mockResolvedValue([])
    const r = await svc.getStats()
    expect(r.success).toBe(true)
    expect(r.data.totalStudies).toBeGreaterThan(0)
    expect(r.data.byModality).toHaveProperty('CBCT')
    expect(typeof r.data.reportRate).toBe('number')
  })

  it('listTreatments filters by status and pageSize', async () => {
    const r = await svc.listTreatments({ status: 'in_progress', pageSize: 1 })
    expect(r.success).toBe(true)
    expect(r.data.every((t: any) => t.status === 'in_progress')).toBe(true)
    expect(r.data.length).toBeLessThanOrEqual(1)
  })

  it('listTreatmentTypes returns builtin types', async () => {
    const r = await svc.listTreatmentTypes()
    expect(r.success).toBe(true)
    expect(r.data.length).toBeGreaterThanOrEqual(5)
    expect(r.data[0]).toHaveProperty('category')
  })
})
