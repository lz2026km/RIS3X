// [G005 W13-Security] RA 服务 spec: 申请/审批颁发/续期/驳回/统计
import { ReportCertificateService } from '../../report-sign-v2/report-certificate.service'
import { HsmService } from '../hsm/hsm.service'
import { RaService } from './ra.service'

const make = () => {
  const certificates = new ReportCertificateService()
  const hsm = new HsmService()
  return { certificates, hsm, ra: new RaService(certificates, hsm) }
}

describe('[W13] RaService', () => {
  it('内置演示请求: 2 个 pending', () => {
    const { ra } = make()
    const pending = ra.list({ status: 'pending' })
    expect(pending.length).toBeGreaterThanOrEqual(2)
    expect(ra.stats().pending).toBeGreaterThanOrEqual(2)
  })

  it('issue 申请 → 审批颁发新证书 (进入证书注册表)', () => {
    const { ra, certificates } = make()
    const req = ra.create({ subject: 'CN=新医师证书', applicant: '测试医师', applicantId: 'D9' })
    expect(req.status).toBe('pending')
    const { request, certificate } = ra.approve(req.id, { approvedBy: 'RA' })
    expect(request.status).toBe('approved')
    expect(certificate.status).toBe('valid')
    expect(certificates.find(certificate.serial)).not.toBeNull()
  })

  it('renew 申请 → 审批后源证书吊销, 新证书有效', () => {
    const { ra, certificates } = make()
    const source = '05B1C2D3E4F50617'
    const req = ra.create({ type: 'renew', subject: '续期', applicant: '李慧敏', sourceSerial: source })
    const { certificate } = ra.approve(req.id)
    expect(certificates.find(source)!.status).toBe('revoked')
    expect(certificate.status).toBe('valid')
    expect(certificate.subject).toContain('李慧敏')
  })

  it('驳回: 记录原因; 已处理请求不可重复审批', () => {
    const { ra } = make()
    const req = ra.create({ subject: 'CN=x', applicant: 'y' })
    const rejected = ra.reject(req.id, '材料不全', 'RA-2')
    expect(rejected.status).toBe('rejected')
    expect(rejected.rejectReason).toBe('材料不全')
    expect(() => ra.approve(req.id)).toThrow()
  })

  it('续期请求缺 sourceSerial / 空 subject 报错', () => {
    const { ra } = make()
    expect(() => ra.create({ type: 'renew', subject: 'x', applicant: 'y' })).toThrow()
    expect(() => ra.create({ subject: '', applicant: 'y' })).toThrow()
  })
})
