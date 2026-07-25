import { RegionalService } from '../src/regional/regional.service'

describe('RegionalService', () => {
  let svc: RegionalService
  let mockPrisma: any

  beforeAll(() => {
    mockPrisma = {
      exam: { findMany: jest.fn(), findUnique: jest.fn() },
      report: { findMany: jest.fn(), findUnique: jest.fn() },
      appointment: { findMany: jest.fn(), update: jest.fn() },
      user: { findMany: jest.fn() },
      systemConfig: { findMany: jest.fn() },
    }
    svc = new RegionalService(mockPrisma)
  })

  beforeEach(() => jest.clearAllMocks())

  it('listRegionalImaging returns recent exams', async () => {
    mockPrisma.exam.findMany.mockResolvedValue([{ id: 'e1', modality: 'CT' }])
    const result = await svc.listRegionalImaging()
    expect(mockPrisma.exam.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' }, take: 100 })
    expect(result.data).toHaveLength(1)
  })

  it('getRegionalImaging returns exam when found', async () => {
    mockPrisma.exam.findUnique.mockResolvedValue({ id: 'e1', modality: 'MRI' })
    const result = await svc.getRegionalImaging('e1')
    expect(result.data[0].id).toBe('e1')
  })

  it('getRegionalImaging returns empty array when not found', async () => {
    mockPrisma.exam.findUnique.mockResolvedValue(null)
    const result = await svc.getRegionalImaging('nonexistent')
    expect(result.data).toEqual([])
  })

  it('listDepartments returns unique non-null departments', async () => {
    mockPrisma.user.findMany.mockImplementation(async (args: any) => {
      const raw = [
        { department: '放射科' },
        { department: '超声科' },
        { department: null },
        { department: '放射科' },
      ]
      const distinct = args?.distinct as string[] | undefined
      if (distinct?.includes('department')) {
        const seen = new Set<string>()
        return raw.filter((d: any) => {
          if (d.department == null) return false
          if (seen.has(d.department)) return false; seen.add(d.department); return true
        })
      }
      return raw
    })
    const result = await svc.listDepartments()
    expect(result.data).toEqual([{ department: '放射科' }, { department: '超声科' }])
  })

  it('getFhirStatus queries systemConfig with fhir_ prefix', async () => {
    mockPrisma.systemConfig.findMany.mockResolvedValue([{ key: 'fhir_endpoint', value: 'http://fhir' }])
    const result = await svc.getFhirStatus()
    expect(mockPrisma.systemConfig.findMany).toHaveBeenCalledWith({ where: { key: { startsWith: 'fhir_' } } })
    expect(result.data).toHaveLength(1)
  })
})
