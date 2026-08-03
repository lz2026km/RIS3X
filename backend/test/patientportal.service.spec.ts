import { PatientPortalService } from '../src/patientportal/patientportal.service'

describe('PatientPortalService', () => {
  let svc: PatientPortalService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      patient: { findMany: jest.fn(), findUnique: jest.fn() },
      report: { findMany: jest.fn(), findUnique: jest.fn() },
      systemConfig: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      user: { findMany: jest.fn() },
      appointment: { findMany: jest.fn(), create: jest.fn() },
      dicomInstance: { findMany: jest.fn() },
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

  // ===== v3.1 患者门户: 自助预约 =====

  it('listAppointments queries by patientId when provided', async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([
      { id: 'a1', patientId: 'p1', modality: 'CT', scheduledAt: new Date(), state: 'SCHEDULED', patient: { name: '张三' } },
    ])
    const r = await svc.listAppointments('p1')
    expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ patientId: 'p1' }) }))
    expect(r.data).toHaveLength(1)
    expect(r.data[0].patientName).toBe('张三')
  })

  it('listAppointments returns seed demo when database empty', async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([])
    const all = await svc.listAppointments()
    expect(all.data.length).toBeGreaterThan(0)
    const mine = await svc.listAppointments('P001')
    expect(mine.data.every((a: any) => a.patientId === 'P001')).toBe(true)
  })

  it('createAppointment creates a SCHEDULED appointment', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue({ id: 'p1', name: '张三' })
    mockPrisma.appointment.create.mockResolvedValue({
      id: 'a9', patientId: 'p1', modality: 'MR', scheduledAt: new Date('2026-08-10T09:00:00Z'), state: 'SCHEDULED', createdAt: new Date(), patient: { name: '张三' },
    })
    const r = await svc.createAppointment({ patientId: 'p1', modality: 'MR', bodyPart: '颅脑', scheduledAt: '2026-08-10T09:00:00Z' })
    expect(mockPrisma.appointment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ patientId: 'p1', modality: 'MR', state: 'SCHEDULED' }),
    }))
    expect(r.data.bodyPart).toBe('颅脑')
    expect(r.data.state).toBe('SCHEDULED')
  })

  it('createAppointment throws NotFound when patient missing', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue(null)
    await expect(svc.createAppointment({ patientId: 'ghost', modality: 'CT', scheduledAt: '2026-08-10T09:00:00Z' })).rejects.toThrow()
    expect(mockPrisma.appointment.create).not.toHaveBeenCalled()
  })

  // ===== v3.1 患者门户: 报告 =====

  it('listReports only returns published reports of patient', async () => {
    mockPrisma.report.findMany.mockResolvedValue([
      { id: 'r1', patientId: 'p1', state: 'PUBLISHED', findings: 'f', exam: { modality: 'CT', bodyPart: '胸部', completedAt: new Date() } },
    ])
    const r = await svc.listReports('p1')
    expect(mockPrisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ patientId: 'p1', state: { in: ['PUBLISHED', 'AMENDED'] } }),
    }))
    expect(r.data[0].modality).toBe('CT')
  })

  it('listReports returns seed demo when database empty', async () => {
    mockPrisma.report.findMany.mockResolvedValue([])
    const mine = await svc.listReports('P001')
    expect(mine.data.length).toBeGreaterThan(0)
    expect(mine.data.every((r: any) => r.patientId === 'P001')).toBe(true)
  })

  it('getReport returns structured detail or null', async () => {
    mockPrisma.report.findUnique.mockResolvedValue({
      id: 'r1', patientId: 'p1', state: 'PUBLISHED', findings: 'f1', diagnosis: 'd1',
      impression: 'i1', recommendations: 'r1', conclusion: 'c1', isCritical: false,
      exam: { modality: 'CT' },
    })
    await expect(svc.getReport('r1')).resolves.toMatchObject({ data: { diagnosis: 'd1', conclusion: 'c1' } })
    mockPrisma.report.findUnique.mockResolvedValue(null)
    const seed = await svc.getReport('RPT-P001-001')
    expect(seed.data).not.toBeNull()
    await expect(svc.getReport('ghost')).resolves.toEqual({ data: null })
  })

  // ===== v3.1 患者门户: 影像 =====

  it('listImages groups instances into series with WADO-RS refs', async () => {
    mockPrisma.dicomInstance.findMany.mockResolvedValue([
      { seriesInstanceUid: 's1', modality: 'CT' },
      { seriesInstanceUid: 's1', modality: 'CT' },
      { seriesInstanceUid: 's2', modality: 'CT' },
    ])
    const r = await svc.listImages('study-1')
    expect(r.data.series).toHaveLength(2)
    expect(r.data.series[0].instanceCount).toBe(2)
    expect(r.data.series[0].wadoRs.instances).toContain('/dicom-web/studies/study-1/series/s1')
  })

  it('listImages returns seed study when no instances', async () => {
    mockPrisma.dicomInstance.findMany.mockResolvedValue([])
    const r = await svc.listImages('1.2.826.0.1.3680043.8.498.202607201000001')
    expect(r.data.series.length).toBeGreaterThan(0)
    expect(r.data.wadoRs.study).toContain('1.2.826.0.1.3680043.8.498.202607201000001')
  })

  // ===== v3.1 患者门户: 反馈 =====

  it('createFeedback persists satisfaction feedback to systemConfig', async () => {
    mockPrisma.systemConfig.create.mockResolvedValue({ key: 'feedback_x', value: {} })
    const r = await svc.createFeedback({ patientId: 'p1', patientName: '张三', rating: 5, category: 'service', comment: '很满意' })
    expect(mockPrisma.systemConfig.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ key: expect.stringMatching(/^feedback_/) }),
    }))
    expect(r.data.rating).toBe(5)
    expect(r.data.category).toBe('service')
    expect(r.data.comment).toBe('很满意')
  })

  it('createFeedback defaults category and comment', async () => {
    mockPrisma.systemConfig.create.mockResolvedValue({ key: 'feedback_y', value: {} })
    const r = await svc.createFeedback({ patientId: 'p1', rating: 4 })
    expect(r.data.category).toBe('general')
    expect(r.data.comment).toBe('')
  })
})
