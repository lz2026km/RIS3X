import { CaService } from '../src/ca/ca.service'

describe('CaService', () => {
  let svc: CaService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      auditLog: { findMany: jest.fn(), create: jest.fn() },
      systemConfig: { findMany: jest.fn(), upsert: jest.fn() },
    }
    svc = new CaService(mockPrisma)
  })

  it('listCertificates sanitizes privateKey from details', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([
      { id: 'a1', detail: { privateKey: 'secret', certificateData: 'cert', commonName: 'x' } },
    ])
    const r = await svc.listCertificates()
    expect((r.data[0] as any).detail).toEqual({ commonName: 'x' })
    expect((r.data[0] as any).detail.privateKey).toBeUndefined()
  })

  it('sanitizes non-object details to empty', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'a2', detail: 'rawstring' }])
    const r = await svc.listCertificates()
    expect(r.data[0].detail).toEqual({})
  })

  it('uploadCertificate creates UPLOAD audit entry', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' })
    const r = await svc.uploadCertificate({ commonName: 'cn', privateKey: 'k' })
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'UPLOAD', resource: 'ca-certificate' }) }))
    expect(r.data).toHaveLength(1)
  })

  it('revokeCertificate creates REVOKE entry with resourceId', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a2' })
    await svc.revokeCertificate('cert-1')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'REVOKE', resourceId: 'cert-1' }) }))
  })

  it('signDocument and verifySignature create audit entries', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a3' })
    await svc.signDocument({ docId: 'd1' })
    expect(mockPrisma.auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'SIGN' }) }))
    await svc.verifySignature({ docId: 'd1' })
    expect(mockPrisma.auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'VERIFY' }) }))
  })

  it('listSignatures and getCaHistory query auditLog', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([])
    await svc.listSignatures()
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { resource: 'ca-signature' } }))
    await svc.getCaHistory()
    expect(mockPrisma.auditLog.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { resource: { startsWith: 'ca-' } } }))
  })

  it('getCaConfig and updateCaConfig manage system config', async () => {
    mockPrisma.systemConfig.findMany.mockResolvedValue([{ key: 'ca_cn', value: 'x' }])
    const r = await svc.getCaConfig()
    expect(r.data).toHaveLength(1)
    mockPrisma.systemConfig.upsert.mockResolvedValue({ key: 'ca_a', value: '1' })
    const u = await svc.updateCaConfig({ ca_a: '1', ca_b: '2' })
    expect(mockPrisma.systemConfig.upsert).toHaveBeenCalledTimes(2)
    expect(u.data).toHaveLength(2)
  })
})
