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
    const body = { patientId: 'p2', modality: 'CBCT', studyDate: '2026-07-25', description: '检查', toothNumbers: ['18'] }
    mockPrisma.dentalStudy.create.mockResolvedValue({ id: 's2', ...body })
    const result = await svc.createStudy(body)
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
})
