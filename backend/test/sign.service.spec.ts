import { SignService } from '../src/sign/sign.service'

describe('SignService (G005-P1 在用孤儿补齐)', () => {
  let svc: SignService

  beforeAll(() => {
    svc = new SignService()
  })

  it('listCertificates returns seeded certificates and filters by status', async () => {
    const all = await svc.listCertificates({})
    expect(all.success).toBe(true)
    expect(all.data.length).toBeGreaterThanOrEqual(4)
    const valid = await svc.listCertificates({ status: 'valid' })
    expect(valid.data.every((c: any) => c.status === 'valid')).toBe(true)
    expect(valid.data.length).toBeLessThan(all.data.length)
  })

  it('requestCertificate creates a valid certificate', async () => {
    const r = await svc.requestCertificate({ commonName: '测试医生', userId: 'D999', department: '放射科', title: '主治医师', algorithm: 'SM2' })
    expect(r.success).toBe(true)
    expect(r.data.id).toBeTruthy()
    expect(r.data.status).toBe('valid')
    expect(r.data.algorithm).toBe('SM2')
  })

  it('revokeCertificate flips status to revoked', async () => {
    const r = await svc.revokeCertificate('cert-004', { reason: '证书泄露' })
    expect(r.data.status).toBe('revoked')
    expect(r.data.reason).toBe('证书泄露')
  })

  it('signReport + verifySignature round-trip', async () => {
    const sign = await svc.signReport('RP-TEST-01', { certificateId: 'cert-001', reportHash: 'hash-1' })
    expect(sign.data.signatureHash).toBeTruthy()
    expect(sign.data.signedAt).toBeTruthy()
    const verify = await svc.verifySignature(sign.data.signatureHash)
    expect(verify.data.valid).toBe(true)
    expect(verify.data.reportId).toBe('RP-TEST-01')
  })

  it('verifySignature rejects unknown hash', async () => {
    const r = await svc.verifySignature('UNKNOWN-HASH')
    expect(r.data.valid).toBe(false)
  })

  it('issueTimestamp returns TSA payload', async () => {
    const r = await svc.issueTimestamp({ dataHash: 'd41d8cd9', reportId: 'RP-1' })
    expect(r.success).toBe(true)
    expect(r.data.tsaId).toBeTruthy()
    expect(r.data.timestamp).toBeTruthy()
  })

  it('getBlockchainProof returns proof for report', async () => {
    const r = await svc.getBlockchainProof('RP20260601001')
    expect(r.success).toBe(true)
    expect(r.data[0]).toMatchObject({ reportId: 'RP20260601001', chain: 'G005-hospital-chain' })
  })
})
