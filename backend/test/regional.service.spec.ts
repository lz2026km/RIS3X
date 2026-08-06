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

  // ── [G005-P1] 在用孤儿补齐: 医联体影像页 (seed) ──

  it('listRegionalInstitutions returns institution statistics', async () => {
    const result = await svc.listRegionalInstitutions()
    expect(result.success).toBe(true)
    expect(result.data.length).toBeGreaterThanOrEqual(4)
    expect(result.data[0]).toHaveProperty('institutionName')
    expect(result.data[0]).toHaveProperty('positiveRate')
  })

  it('listAccessApplications returns applications and create/approve flow', async () => {
    const list = await svc.listAccessApplications()
    expect(list.data.length).toBeGreaterThan(0)
    const created = await svc.createAccessApplication({ patientName: '测试患者', patientId: 'P-X', hospital: '东华区第一医院', modality: 'CT', reason: '测试' })
    expect(created.data.status).toBe('pending')
    const approved = await svc.approveAccessApplication(created.data.id)
    expect(approved.data?.status).toBe('approved')
  })

  it('crossInstitutionQuery filters by patient name', async () => {
    const result = await svc.crossInstitutionQuery({ queryType: 'name', queryValue: '张伟' })
    expect(result.success).toBe(true)
    expect(result.data.length).toBeGreaterThan(0)
    expect(result.data.every((s: any) => s.patientName.includes('张伟'))).toBe(true)
  })

  it('pixQuery returns local/remote mapping', async () => {
    const result = await svc.pixQuery('P000023')
    expect(result.success).toBe(true)
    expect(result.data.local).toBeTruthy()
    expect(result.data.remote).toContain('PIX-EXT')
  })

  // ── [G005-P1] 医联体报告页 (seed) ──

  it('listReportRecords / listCriticalValues / listCoSignRecords return seed data', async () => {
    const records = await svc.listReportRecords()
    expect(records.success).toBe(true)
    expect(records.data.length).toBeGreaterThan(0)
    expect(records.data[0]).toHaveProperty('qualityScore')
    const cvs = await svc.listCriticalValues()
    expect(cvs.data.length).toBeGreaterThan(0)
    expect(['危急', '高危', '紧急']).toContain(cvs.data[0].severity)
    const cosign = await svc.listCoSignRecords()
    expect(cosign.data.length).toBeGreaterThan(0)
    expect(Array.isArray(cosign.data[0].signatures)).toBe(true)
  })
})
