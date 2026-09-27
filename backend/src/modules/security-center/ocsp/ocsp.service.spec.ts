// [G005 W13-Security] OCSP 服务 spec: good/revoked/unknown + 批量 + 响应签名
import { ReportCertificateService } from '../../report-sign-v2/report-certificate.service'
import { HsmService } from '../hsm/hsm.service'
import { OcspService } from './ocsp.service'

const make = () => {
  const certificates = new ReportCertificateService()
  const hsm = new HsmService()
  return { certificates, hsm, ocsp: new OcspService(certificates, hsm) }
}

describe('[W13] OcspService', () => {
  it('有效证书 → good, 且在有效期内', () => {
    const { ocsp, certificates } = make()
    const serial = certificates.list({ status: 'valid' }).data[0]!.serial
    const res = ocsp.respond(serial)
    expect(res.status).toBe('good')
    expect(res.certificate?.serial).toBe(serial)
    expect(res.nextUpdate > res.thisUpdate).toBe(true)
  })

  it('已吊销证书 → revoked + 吊销原因/时间', () => {
    const { ocsp, certificates } = make()
    const revoked = certificates.list({ status: 'revoked' }).data[0]!
    const res = ocsp.respond(revoked.serial)
    expect(res.status).toBe('revoked')
    expect(res.revocationReason).toContain('泄露')
    expect(res.revocationTime).toBeTruthy()
  })

  it('未知序列号 → unknown', () => {
    const { ocsp } = make()
    expect(ocsp.respond('DEADBEEF0000').status).toBe('unknown')
  })

  it('响应带 HSM 签名', () => {
    const { ocsp, certificates } = make()
    const serial = certificates.list({ status: 'valid' }).data[0]!.serial
    const res = ocsp.respond(serial)
    expect(res.responseSignature).toBeTruthy()
    expect(res.signingKeyId).toBeTruthy()
    expect(res.signatureAlgorithm).toBe('RSA-SHA256')
  })

  it('批量查询 + handleRequest 三种形态 + 空 serial 报错', () => {
    const { ocsp, certificates } = make()
    const serial = certificates.list({ status: 'valid' }).data[0]!.serial
    const batch = ocsp.respondBatch([serial, 'NOPE']) as { responses: Array<{ status: string }> }
    expect(batch.responses).toHaveLength(2)
    expect(ocsp.handleRequest({ serial })).toMatchObject({ serial, status: 'good' })
    expect(ocsp.handleRequest({ request: { serial } })).toMatchObject({ serial })
    expect(() => ocsp.handleRequest({})).toThrow()
  })
})
