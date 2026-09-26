// [G005 W8-Report] ReportSigningService + Certificate + TSA spec
// 覆盖: 真实摘要/RSA 签名/TSA、验签、篡改检测、证书吊销、修订取代、SM3 分支
import { ReportSigningService } from './report-signing.service'
import { ReportCertificateService } from './report-certificate.service'
import { ReportTsaService } from './report-tsa.service'
import { sm3Hex } from './report-sm3'
import type { SignatureContentSnapshot } from './report-signing.types'

const content = (over: Partial<SignatureContentSnapshot> = {}): SignatureContentSnapshot => ({
  findings: '右肺上叶见 5mm 磨玻璃结节影。',
  impression: '右肺上叶磨玻璃结节, 建议随访。',
  conclusion: '右肺上叶磨玻璃结节, 建议 6 个月后复查。',
  diagnosis: '右肺上叶磨玻璃结节',
  recommendations: '建议 6 个月后复查。',
  qualityScore: 90,
  version: 1,
  ...over,
})

const make = () => {
  const cert = new ReportCertificateService()
  const tsa = new ReportTsaService()
  const svc = new ReportSigningService(cert, tsa)
  return { cert, tsa, svc }
}

describe('ReportSigningService (W8 真实签名)', () => {
  it('SM3 摘要与标准向量一致', () => {
    expect(sm3Hex('abc')).toBe('66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0')
  })

  it('签名产出 SHA-256 摘要 + base64 RSA 签名 + TSA, 且验签通过', () => {
    const { svc } = make()
    const sig = svc.signReport({ reportId: 'RPT-1', content: content(), signedById: 'D001' })
    expect(sig.algorithm).toBe('SHA-256')
    expect(sig.digest).toMatch(/^[0-9a-f]{64}$/)
    expect(sig.signature.length).toBeGreaterThan(100)
    expect(sig.certificateSerial).toBeTruthy()
    const tsa = Buffer.from(sig.tsaToken, 'base64').toString('utf8')
    expect(tsa).toContain(sig.digest)

    const v = svc.verifySignature('RPT-1')
    expect(v.valid).toBe(true)
    expect(v.digestMatch).toBe(true)
    expect(v.signatureMatch).toBe(true)
    expect(v.certificateValid).toBe(true)
    expect(v.notRevoked).toBe(true)
    expect(v.tsaValid).toBe(true)
  })

  it('内容被篡改 → digestMatch=false, valid=false', () => {
    const { svc } = make()
    svc.signReport({ reportId: 'RPT-2', content: content(), signedById: 'D001' })
    const v = svc.verifySignature('RPT-2', { content: content({ conclusion: '被篡改的结论' }) })
    expect(v.digestMatch).toBe(false)
    expect(v.valid).toBe(false)
    expect(v.reasons.join(' ')).toContain('DIGEST_MISMATCH')
  })

  it('证书吊销后验签失败 (CRL)', () => {
    const { svc, cert } = make()
    const sig = svc.signReport({ reportId: 'RPT-3', content: content(), signedById: 'D001' })
    cert.revoke(sig.certificateSerial, '私钥泄露')
    const v = svc.verifySignature('RPT-3')
    expect(v.notRevoked).toBe(false)
    expect(v.valid).toBe(false)
    expect(v.reasons.join(' ')).toContain('CERT_REVOKED')
    const crl = cert.crl()
    expect(crl.entries.some((e) => e.serial === sig.certificateSerial)).toBe(true)
  })

  it('SM3 证书 → algorithm=SM3 且摘要 64 位 hex', () => {
    const { svc, cert } = make()
    const sm3Serial = cert.list({ keyword: '国密' }).data[0]!.serial
    const sig = svc.signReport({ reportId: 'RPT-4', content: content(), signedById: 'D001', certificateSerial: sm3Serial })
    expect(sig.algorithm).toBe('SM3')
    expect(sig.digest).toMatch(/^[0-9a-f]{64}$/)
    expect(svc.verifySignature('RPT-4').valid).toBe(true)
  })

  it('修订后再次签名 → 旧签名 superseded, 新签名有效', () => {
    const { svc } = make()
    const first = svc.signReport({ reportId: 'RPT-5', content: content(), signedById: 'D001' })
    const second = svc.signReport({ reportId: 'RPT-5', content: content({ conclusion: '修订结论' }), signedById: 'D002' })
    expect(second.signatureId).not.toBe(first.signatureId)
    const history = svc.listSignatures('RPT-5')
    const old = history.find((s) => s.signatureId === first.signatureId)!
    expect(old.status).toBe('superseded')
    expect(svc.getSignature('RPT-5')!.signatureId).toBe(second.signatureId)
    expect(svc.verifySignature('RPT-5').valid).toBe(true)
  })

  it('未签名报告验签 → NO_SIGNATURE', () => {
    const { svc } = make()
    const v = svc.verifySignature('RPT-NONE')
    expect(v.valid).toBe(false)
    expect(v.reasons.join(' ')).toContain('NO_SIGNATURE')
  })
})
