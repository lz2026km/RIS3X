import { DataReportService } from '../src/datareport/datareport.service'

describe('DataReportService', () => {
  let svc: DataReportService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      nationalReport: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      report: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      insuranceAudit: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      patient: { findMany: jest.fn() },
    }
    svc = new DataReportService(mockPrisma)
  })

  it('listNationalReports and getNationalReport', async () => {
    mockPrisma.nationalReport.findMany.mockResolvedValue([{ id: 'n1' }])
    await expect(svc.listNationalReports()).resolves.toMatchObject({ data: [{ id: 'n1' }] })
    mockPrisma.nationalReport.findUnique.mockResolvedValue({ id: 'n1' })
    await expect(svc.getNationalReport('n1')).resolves.toMatchObject({ data: [{ id: 'n1' }] })
    mockPrisma.nationalReport.findUnique.mockResolvedValue(null)
    await expect(svc.getNationalReport('x')).resolves.toEqual({ data: [] })
  })

  it('createNationalReport fills defaults', async () => {
    mockPrisma.nationalReport.create.mockResolvedValue({ id: 'n1' })
    await svc.createNationalReport({})
    expect(mockPrisma.nationalReport.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: '未命名上报', reportType: 'GENERAL' }) }))
    const r = await svc.createNationalReport({ title: '月报', reportType: 'MONTHLY', period: '2026-07', payload: { a: 1 } })
    expect(r.data).toHaveLength(1)
  })

  it('listDataReports and getDataReport', async () => {
    mockPrisma.report.findMany.mockResolvedValue([{ id: 'r1' }])
    const r = await svc.listDataReports()
    expect(mockPrisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }))
    expect(r.data).toHaveLength(1)
    mockPrisma.report.findUnique.mockResolvedValue({ id: 'r1' })
    await expect(svc.getDataReport('r1')).resolves.toMatchObject({ data: [{ id: 'r1' }] })
  })

  it('createDataReport passes body through', async () => {
    mockPrisma.report.create.mockResolvedValue({ id: 'r1' })
    await svc.createDataReport({ title: 'x' })
    expect(mockPrisma.report.create).toHaveBeenCalledWith(expect.objectContaining({ data: { title: 'x' } }))
  })

  it('insurance audit CRUD', async () => {
    mockPrisma.insuranceAudit.findMany.mockResolvedValue([{ id: 'i1' }])
    await expect(svc.listInsuranceAudits()).resolves.toMatchObject({ data: [{ id: 'i1' }] })
    mockPrisma.insuranceAudit.findUnique.mockResolvedValue({ id: 'i1' })
    await expect(svc.getInsuranceAudit('i1')).resolves.toMatchObject({ data: [{ id: 'i1' }] })
    mockPrisma.insuranceAudit.create.mockResolvedValue({ id: 'i2' })
    await svc.createInsuranceAudit({ patientId: 'p1', invoiceId: 'inv1' })
    expect(mockPrisma.insuranceAudit.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ auditType: 'GENERAL', finding: '' }) }))
    await svc.createInsuranceAudit({})
    expect(mockPrisma.insuranceAudit.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ patientId: undefined, amount: 0 }) }))
  })

  it('enterpriseSearch builds OR query only when term provided', async () => {
    mockPrisma.patient.findMany.mockResolvedValue([])
    await svc.enterpriseSearch()
    expect(mockPrisma.patient.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: {} }))
    await svc.enterpriseSearch('张三')
    expect(mockPrisma.patient.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { OR: expect.any(Array) } }))
  })
})
