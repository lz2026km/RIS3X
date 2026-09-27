// [G005 W13-Security] 安全中心端点 spec (supertest): RA / OCSP / HSM / 字段加密 / DR / 审计链
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { ReportCertificateService } from '../report-sign-v2/report-certificate.service'
import { AuditChainService } from './audit-chain/audit-chain.service'
import { DisasterRecoveryService } from './disaster-recovery/disaster-recovery.service'
import { FieldEncryptionService } from './field-encryption/field-encryption.service'
import { HsmService } from './hsm/hsm.service'
import { OcspController } from './ocsp/ocsp.controller'
import { OcspService } from './ocsp/ocsp.service'
import { RaService } from './ra/ra.service'
import { SecurityCenterController } from './security-center.controller'

describe('[W13] SecurityCenter 端点', () => {
  let app: INestApplication
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SecurityCenterController, OcspController],
      providers: [
        HsmService,
        OcspService,
        RaService,
        FieldEncryptionService,
        DisasterRecoveryService,
        AuditChainService,
        ReportCertificateService,
      ],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })
  afterAll(async () => {
    await app.close()
  })

  it('GET /security/ra/requests + stats', async () => {
    const list = await request(app.getHttpServer()).get('/security/ra/requests?status=pending').expect(200)
    expect(list.body.total).toBeGreaterThanOrEqual(2)
    const stats = await request(app.getHttpServer()).get('/security/ra/stats').expect(200)
    expect(stats.body.pending).toBeGreaterThanOrEqual(2)
  })

  it('POST /security/ra/requests → approve 颁发证书', async () => {
    const created = await request(app.getHttpServer())
      .post('/security/ra/requests')
      .send({ subject: 'CN=测试证书', applicant: 'tester' })
      .expect(201)
    const approved = await request(app.getHttpServer())
      .post(`/security/ra/requests/${created.body.id}/approve`)
      .send({ approvedBy: 'RA' })
      .expect(200)
    expect(approved.body.request.status).toBe('approved')
    expect(approved.body.certificate.status).toBe('valid')
  })

  it('POST /security/ra/requests → reject', async () => {
    const created = await request(app.getHttpServer()).post('/security/ra/requests').send({ subject: 'CN=z', applicant: 'a' }).expect(201)
    const rej = await request(app.getHttpServer()).post(`/security/ra/requests/${created.body.id}/reject`).send({ reason: '材料不全' }).expect(200)
    expect(rej.body.status).toBe('rejected')
  })

  it('GET /ocsp/:serial + POST /ocsp', async () => {
    const certs = await request(app.getHttpServer()).get('/security/certificates?status=valid').expect(200)
    const serial = certs.body.data[0].serial
    const one = await request(app.getHttpServer()).get(`/ocsp/${serial}`).expect(200)
    expect(one.body.status).toBe('good')
    const post = await request(app.getHttpServer()).post('/ocsp').send({ serial }).expect(200)
    expect(post.body.status).toBe('good')
    const unknown = await request(app.getHttpServer()).get('/ocsp/UNKNOWN123').expect(200)
    expect(unknown.body.status).toBe('unknown')
  })

  it('HSM providers/keys/rotate/sign/verify', async () => {
    const providers = await request(app.getHttpServer()).get('/security/hsm/providers').expect(200)
    expect(providers.body.data.length).toBe(2)
    const rot = await request(app.getHttpServer()).post('/security/hsm/rotate').send({ reason: 'spec' }).expect(200)
    const keyId = rot.body.key.keyId
    const signed = await request(app.getHttpServer()).post('/security/hsm/sign').send({ data: 'payload', keyId }).expect(200)
    const verified = await request(app.getHttpServer()).post('/security/hsm/verify').send({ data: 'payload', signature: signed.body.signature, keyId }).expect(200)
    expect(verified.body.valid).toBe(true)
    const rotations = await request(app.getHttpServer()).get('/security/hsm/rotations').expect(200)
    expect(rotations.body.data[0].toKeyId).toBe(keyId)
  })

  it('字段加密 encrypt/decrypt/demo', async () => {
    const enc = await request(app.getHttpServer()).post('/security/field-encryption/encrypt').send({ value: '110101196803120011' }).expect(200)
    expect(enc.body.ciphertext).toContain('v1.aesgcm')
    const dec = await request(app.getHttpServer()).post('/security/field-encryption/decrypt').send({ ciphertext: enc.body.ciphertext }).expect(200)
    expect(dec.body.value).toBe('110101196803120011')
    const demo = await request(app.getHttpServer()).post('/security/field-encryption/demo').expect(200)
    expect(demo.body.samples.every((s: { decryptedMatches: boolean }) => s.decryptedMatches)).toBe(true)
  })

  it('DR status/config/drill/failover/restore', async () => {
    const status = await request(app.getHttpServer()).get('/security/dr/status').expect(200)
    expect(status.body.config.rpoMinutes).toBe(15)
    const drill = await request(app.getHttpServer()).post('/security/dr/drill').send({ scenario: 'db-restore' }).expect(200)
    expect(drill.body.steps.length).toBeGreaterThan(0)
    const fo = await request(app.getHttpServer()).post('/security/dr/failover').send({ mode: 'dry-run' }).expect(200)
    expect(fo.body.success).toBe(true)
    const sets = await request(app.getHttpServer()).get('/security/dr/backup-sets').expect(200)
    expect(sets.body.data.length).toBeGreaterThanOrEqual(4)
    const created = await request(app.getHttpServer()).post('/security/dr/backup-sets').send({ type: 'incremental' }).expect(201)
    expect(created.body.type).toBe('incremental')
    const pts = await request(app.getHttpServer()).get('/security/dr/restore-points').expect(200)
    const restore = await request(app.getHttpServer()).post('/security/dr/restore').send({ restorePointId: pts.body.data[0].id }).expect(200)
    expect(restore.body.restored).toBe(true)
    const upd = await request(app.getHttpServer()).put('/security/dr/config').send({ rpoMinutes: 20 }).expect(200)
    expect(upd.body.rpoMinutes).toBe(20)
  })

  it('审计链 verify/retention/cold-archive', async () => {
    const v = await request(app.getHttpServer()).get('/security/audit-chain/verify').expect(200)
    expect(v.body.verified).toBe(true)
    const rp = await request(app.getHttpServer()).get('/security/audit-chain/retention').expect(200)
    expect(rp.body.retentionMonths).toBe(6)
    const arc = await request(app.getHttpServer()).post('/security/audit-chain/cold-archive').send({}).expect(200)
    expect(arc.body.archiveId).toMatch(/^arc-/)
  })
})
