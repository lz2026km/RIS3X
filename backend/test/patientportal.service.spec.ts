import { PatientPortalService } from '../src/patientportal/patientportal.service'

describe('PatientPortalService', () => {
  let svc: PatientPortalService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      patient: { findMany: jest.fn(), findUnique: jest.fn() },
      report: { findMany: jest.fn(), findUnique: jest.fn() },
      systemConfig: { findMany: jest.fn(), findUnique: jest.fn() },
      user: { findMany: jest.fn() },
    }
    svc = new PatientPortalService(mockPrisma)
  })

  it('listPortalPatients returns wrapped patient list', async () => {
    mockPrisma.patient.findMany.mockResolvedValue([{ id: 'p1' }])
    const r = await svc.listPortalPatients()
    expect(r.data).toHaveLength(1)
  })

  it('getPortalPatient wraps single patient or empty array', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue({ id: 'p1' })
    await expect(svc.getPortalPatient('p1')).resolves.toMatchObject({ data: [{ id: 'p1' }] })
    mockPrisma.patient.findUnique.mockResolvedValue(null)
    await expect(svc.getPortalPatient('ghost')).resolves.toEqual({ data: [] })
  })

  it('listClinicalData returns recent reports', async () => {
    mockPrisma.report.findMany.mockResolvedValue([{ id: 'r1' }])
    const r = await svc.listClinicalData()
    expect(mockPrisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }))
    expect(r.data).toHaveLength(1)
  })

  it('getClinicalData wraps single report', async () => {
    mockPrisma.report.findUnique.mockResolvedValue({ id: 'r1' })
    await expect(svc.getClinicalData('r1')).resolves.toMatchObject({ data: [{ id: 'r1' }] })
  })

  it('listEducation queries education config keys', async () => {
    mockPrisma.systemConfig.findMany.mockResolvedValue([{ key: 'education_a' }])
    const r = await svc.listEducation()
    expect(mockPrisma.systemConfig.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { key: { startsWith: 'education_' } } }))
    expect(r.data).toHaveLength(1)
  })

  it('getEducation returns config or empty', async () => {
    mockPrisma.systemConfig.findUnique.mockResolvedValue({ key: 'education_a' })
    await expect(svc.getEducation('education_a')).resolves.toMatchObject({ data: [{ key: 'education_a' }] })
    mockPrisma.systemConfig.findUnique.mockResolvedValue(null)
    await expect(svc.getEducation('x')).resolves.toEqual({ data: [] })
  })

  it('mobile endpoints query patients/users by role', async () => {
    mockPrisma.patient.findMany.mockResolvedValue([])
    await svc.getPatientMobile()
    expect(mockPrisma.patient.findMany).toHaveBeenCalled()
    for (const role of ['DOCTOR', 'NURSE', 'TECHNICIAN']) {
      mockPrisma.user.findMany.mockResolvedValue([])
      if (role === 'DOCTOR') await svc.getDoctorMobile()
      if (role === 'NURSE') await svc.getNurseMobile()
      if (role === 'TECHNICIAN') await svc.getTechMobile()
      expect(mockPrisma.user.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { role } }))
    }
  })
})
