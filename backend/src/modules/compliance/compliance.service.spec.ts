// [G005 W13-Security] 等保 2.0 实时评估 spec: 目录/得分/域/差距/整改/重算 + 兼容旧报表
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { ReportCertificateService } from '../report-sign-v2/report-certificate.service'
import { AuditChainService } from '../security-center/audit-chain/audit-chain.service'
import { DisasterRecoveryService } from '../security-center/disaster-recovery/disaster-recovery.service'
import { FieldEncryptionService } from '../security-center/field-encryption/field-encryption.service'
import { HsmService } from '../security-center/hsm/hsm.service'
import { SecuritySignalsService } from '../security-center/security-signals.service'
import { ComplianceController } from './compliance.controller'
import { ComplianceService } from './compliance.service'
import { CONTROL_CATALOG, DOMAIN_NAMES } from './compliance.controls'

function buildService(): ComplianceService {
  const signals = new SecuritySignalsService(
    new AuditChainService(),
    new DisasterRecoveryService(),
    new FieldEncryptionService(),
    new HsmService(),
    new ReportCertificateService(),
  )
  return new ComplianceService(signals)
}

describe('[W13] ComplianceService (等保 2.0 实时评估)', () => {
  let svc: ComplianceService
  beforeEach(() => {
    svc = buildService()
  })

  it('控制项目录: 6 大域, 每域 >=3 项', () => {
    expect(Object.keys(DOMAIN_NAMES)).toHaveLength(6)
    expect(CONTROL_CATALOG.length).toBeGreaterThanOrEqual(24)
    for (const domain of Object.keys(DOMAIN_NAMES)) {
      expect(CONTROL_CATALOG.filter((c) => c.domain === domain).length).toBeGreaterThanOrEqual(3)
    }
  })

  it('评估: 得分/符合率/等级/域聚合', async () => {
    const a = await svc.getAssessment()
    expect(a.overallScore).toBeGreaterThan(0)
    expect(a.overallScore).toBeLessThanOrEqual(100)
    expect(a.overallCompliance).toBeGreaterThan(0)
    expect(a.domains).toHaveLength(6)
    expect(a.totals.controls).toBe(CONTROL_CATALOG.length)
    expect(['优秀', '良好', '基本符合', '不符合']).toContain(a.level)
    expect(a.standard).toContain('等保')
  })

  it('评估由真实信号驱动: 包含差距与整改建议', async () => {
    const a = await svc.getAssessment()
    expect(a.gaps.length).toBeGreaterThan(0)
    expect(a.gaps[0]).toHaveProperty('remediation')
    expect(a.remediation.length).toBe(a.gaps.length)
    expect(a.gaps.some((g) => g.id === 'PHY-02' || g.id === 'NET-03')).toBe(true)
    const signals = a.signals as { audit: { chainVerified: boolean }; encryption: { fieldEncryption: boolean } }
    expect(signals.audit.chainVerified).toBe(true)
    expect(signals.encryption.fieldEncryption).toBe(true)
  })

  it('reassess 递增版本号', async () => {
    const a1 = await svc.getAssessment()
    const a2 = await svc.reassess()
    expect(a2.version).toBe(a1.version + 1)
  })

  it('兼容旧报表: overallScore/categories/items + summary/details', async () => {
    const r = (await svc.getReport()) as Record<string, unknown>
    expect(r).toHaveProperty('overallScore')
    expect(r).toHaveProperty('overallCompliance')
    expect(Array.isArray(r['categories'])).toBe(true)
    expect(Array.isArray(r['items'])).toBe(true)
    expect(r).toHaveProperty('summary')
    expect(r).toHaveProperty('details')
  })
})

describe('[W13] ComplianceController 端点', () => {
  let app: INestApplication
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ComplianceController],
      providers: [
        ComplianceService,
        SecuritySignalsService,
        AuditChainService,
        DisasterRecoveryService,
        FieldEncryptionService,
        HsmService,
        ReportCertificateService,
      ],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })
  afterAll(async () => {
    await app.close()
  })

  it('GET /compliance/assessment', async () => {
    const res = await request(app.getHttpServer()).get('/compliance/assessment').expect(200)
    expect(res.body.domains).toHaveLength(6)
  })
  it('GET /compliance/controls', async () => {
    const res = await request(app.getHttpServer()).get('/compliance/controls').expect(200)
    expect(res.body.controls.length).toBe(CONTROL_CATALOG.length)
  })
  it('POST /compliance/reassess', async () => {
    const res = await request(app.getHttpServer()).post('/compliance/reassess').expect(200)
    expect(res.body.overallScore).toBeGreaterThan(0)
  })
  it('GET /compliance/report 兼容', async () => {
    const res = await request(app.getHttpServer()).get('/compliance/report').expect(200)
    expect(res.body).toHaveProperty('overallScore')
    expect(Array.isArray(res.body.items)).toBe(true)
  })
})
