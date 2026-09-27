// [G005 W13-Security] 安全与合规中心端点:
//   RA 证书请求审批/续期 · HSM 提供者与密钥轮换 · 字段级加密 · 灾难恢复 · 审计链校验。
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ReportCertificateService } from '../report-sign-v2/report-certificate.service'
import { AuditChainService } from './audit-chain/audit-chain.service'
import { DisasterRecoveryService } from './disaster-recovery/disaster-recovery.service'
import { FieldEncryptionService } from './field-encryption/field-encryption.service'
import { HsmService } from './hsm/hsm.service'
import { RaService } from './ra/ra.service'

const AlgorithmSchema = z.enum(['RSA-2048', 'RSA-3072', 'SM2'])
const CipherSchema = z.enum(['AES-256-GCM', 'SM4-CBC'])

const RaCreateSchema = z.object({
  type: z.enum(['issue', 'renew', 'revoke']).optional(),
  subject: z.string().min(1).max(300),
  applicant: z.string().min(1).max(120),
  applicantId: z.string().max(64).optional(),
  algorithm: z.enum(['SHA-256', 'SM3']).optional(),
  usage: z.enum(['signature', 'timestamp']).optional(),
  reason: z.string().max(300).optional(),
  sourceSerial: z.string().max(128).optional(),
})

const RaApproveSchema = z.object({
  approvedBy: z.string().max(120).optional(),
  days: z.number().int().min(1).max(3650).optional(),
})

const RaRejectSchema = z.object({
  reason: z.string().min(1).max(300),
  rejectedBy: z.string().max(120).optional(),
})

const RenewSchema = z.object({ days: z.number().int().min(1).max(3650).optional() })

const RevokeSchema = z.object({ reason: z.string().min(1).max(300) })

const HsmRotateSchema = z.object({
  provider: z.string().max(64).optional(),
  algorithm: AlgorithmSchema.optional(),
  label: z.string().max(120).optional(),
  reason: z.string().max(200).optional(),
})

const HsmSignSchema = z.object({ data: z.string().min(1).max(100000), provider: z.string().max(64).optional(), keyId: z.string().max(128).optional() })
const HsmVerifySchema = z.object({ data: z.string().min(1).max(100000), signature: z.string().min(1).max(200000), keyId: z.string().min(1).max(128), provider: z.string().max(64).optional() })

const EncryptSchema = z.object({ value: z.string().max(100000), algorithm: CipherSchema.optional() })
const DecryptSchema = z.object({ ciphertext: z.string().max(200000) })

const DrConfigSchema = z.object({
  rpoMinutes: z.number().int().min(1).max(1440).optional(),
  rtoMinutes: z.number().int().min(1).max(1440).optional(),
  schedule: z.string().max(200).optional(),
  retentionDays: z.number().int().min(1).max(3650).optional(),
  targetSite: z.string().max(200).optional(),
  offsiteEnabled: z.boolean().optional(),
  autoFailover: z.boolean().optional(),
})

const BackupSetSchema = z.object({
  type: z.enum(['full', 'incremental']),
  sizeBytes: z.number().int().min(0).max(1e12).optional(),
  baseSetId: z.string().max(64).optional(),
})

const RestoreSchema = z.object({ restorePointId: z.string().min(1).max(64) })
const DrillSchema = z.object({
  scenario: z.enum(['site-failover', 'db-restore', 'ransomware-recovery']).optional(),
  executedBy: z.string().max(120).optional(),
  rtoTargetMin: z.number().int().min(1).max(1440).optional(),
  rpoTargetMin: z.number().int().min(1).max(1440).optional(),
})
const FailoverSchema = z.object({ targetSite: z.string().max(200).optional(), mode: z.enum(['dry-run', 'live']).optional() })
const ColdArchiveSchema = z.object({ before: z.string().max(40).optional(), executedBy: z.string().max(120).optional() })

@ApiTags('security-center')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('security')
export class SecurityCenterController {
  constructor(
    private readonly ra: RaService,
    private readonly hsm: HsmService,
    private readonly fieldEncryption: FieldEncryptionService,
    private readonly dr: DisasterRecoveryService,
    private readonly auditChain: AuditChainService,
    private readonly certificates: ReportCertificateService,
  ) {}

  // ── 证书 (RA 视角) ──
  @Get('certificates')
  listCertificates(@Query('status') status?: string, @Query('keyword') keyword?: string) {
    const statusFilter = status === 'valid' || status === 'revoked' ? status : undefined
    return this.certificates.list({ status: statusFilter, keyword })
  }

  // ── RA 请求 ──
  @Get('ra/requests')
  listRequests(@Query('status') status?: string, @Query('type') type?: string) {
    const s = status === 'pending' || status === 'approved' || status === 'rejected' ? status : undefined
    const t = type === 'issue' || type === 'renew' || type === 'revoke' ? type : undefined
    return { total: this.ra.list({ status: s, type: t }).length, data: this.ra.list({ status: s, type: t }) }
  }

  @Get('ra/stats')
  raStats() {
    return this.ra.stats()
  }

  @Post('ra/requests')
  @HttpCode(HttpStatus.CREATED)
  createRequest(@Body(new ZodValidationPipe(RaCreateSchema)) body: z.infer<typeof RaCreateSchema>) {
    return this.ra.create(body)
  }

  @Get('ra/requests/:id')
  getRequest(@Param('id') id: string) {
    return this.ra.get(id)
  }

  @Post('ra/requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveRequest(@Param('id') id: string, @Body(new ZodValidationPipe(RaApproveSchema)) body: z.infer<typeof RaApproveSchema>) {
    return this.ra.approve(id, body)
  }

  @Post('ra/requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectRequest(@Param('id') id: string, @Body(new ZodValidationPipe(RaRejectSchema)) body: z.infer<typeof RaRejectSchema>) {
    return this.ra.reject(id, body.reason, body.rejectedBy)
  }

  @Post('ra/certificates/:serial/renew')
  @HttpCode(HttpStatus.OK)
  renewCertificate(@Param('serial') serial: string, @Body(new ZodValidationPipe(RenewSchema)) body: z.infer<typeof RenewSchema>) {
    return this.certificates.renew(serial, body)
  }

  @Post('ra/certificates/:serial/revoke')
  @HttpCode(HttpStatus.OK)
  revokeCertificate(@Param('serial') serial: string, @Body(new ZodValidationPipe(RevokeSchema)) body: z.infer<typeof RevokeSchema>) {
    return this.certificates.revoke(serial, body.reason)
  }

  // ── HSM ──
  @Get('hsm/providers')
  hsmProviders() {
    return { data: this.hsm.listProviders() }
  }

  @Get('hsm/keys')
  hsmKeys(@Query('provider') provider?: string) {
    return { data: this.hsm.listKeys(provider) }
  }

  @Get('hsm/rotations')
  hsmRotations() {
    return { data: this.hsm.listRotations() }
  }

  @Post('hsm/rotate')
  @HttpCode(HttpStatus.OK)
  hsmRotate(@Body(new ZodValidationPipe(HsmRotateSchema)) body: z.infer<typeof HsmRotateSchema>) {
    return this.hsm.rotate(body)
  }

  @Post('hsm/sign')
  @HttpCode(HttpStatus.OK)
  hsmSign(@Body(new ZodValidationPipe(HsmSignSchema)) body: z.infer<typeof HsmSignSchema>) {
    return this.hsm.sign(body.data, body.provider, body.keyId)
  }

  @Post('hsm/verify')
  @HttpCode(HttpStatus.OK)
  hsmVerify(@Body(new ZodValidationPipe(HsmVerifySchema)) body: z.infer<typeof HsmVerifySchema>) {
    return { valid: this.hsm.verify(body.data, body.signature, body.keyId, body.provider) }
  }

  // ── 字段级加密 ──
  @Get('field-encryption/algorithms')
  encryptionAlgorithms() {
    return this.fieldEncryption.algorithmInfo()
  }

  @Post('field-encryption/encrypt')
  @HttpCode(HttpStatus.OK)
  encrypt(@Body(new ZodValidationPipe(EncryptSchema)) body: z.infer<typeof EncryptSchema>) {
    return { ciphertext: this.fieldEncryption.encrypt(body.value, body.algorithm) }
  }

  @Post('field-encryption/decrypt')
  @HttpCode(HttpStatus.OK)
  decrypt(@Body(new ZodValidationPipe(DecryptSchema)) body: z.infer<typeof DecryptSchema>) {
    return { value: this.fieldEncryption.decrypt(body.ciphertext) }
  }

  @Post('field-encryption/demo')
  @HttpCode(HttpStatus.OK)
  encryptionDemo() {
    return this.fieldEncryption.selfTest()
  }

  @Get('field-encryption/selftest')
  encryptionSelfTest() {
    return this.fieldEncryption.selfTest()
  }

  // ── 灾难恢复 ──
  @Get('dr/status')
  drStatus() {
    return this.dr.status()
  }

  @Get('dr/config')
  drConfig() {
    return this.dr.getConfig()
  }

  @Put('dr/config')
  drUpdateConfig(@Body(new ZodValidationPipe(DrConfigSchema)) body: z.infer<typeof DrConfigSchema>) {
    return this.dr.updateConfig(body)
  }

  @Get('dr/backup-sets')
  drBackupSets(@Query('type') type?: string) {
    const t = type === 'full' || type === 'incremental' ? type : undefined
    return { data: this.dr.listBackupSets({ type: t }) }
  }

  @Post('dr/backup-sets')
  @HttpCode(HttpStatus.CREATED)
  drCreateBackupSet(@Body(new ZodValidationPipe(BackupSetSchema)) body: z.infer<typeof BackupSetSchema>) {
    return this.dr.createBackupSet(body)
  }

  @Get('dr/restore-points')
  drRestorePoints() {
    return { data: this.dr.listRestorePoints() }
  }

  @Post('dr/restore')
  @HttpCode(HttpStatus.OK)
  drRestore(@Body(new ZodValidationPipe(RestoreSchema)) body: z.infer<typeof RestoreSchema>) {
    return this.dr.restore(body.restorePointId)
  }

  @Post('dr/drill')
  @HttpCode(HttpStatus.OK)
  drDrill(@Body(new ZodValidationPipe(DrillSchema)) body: z.infer<typeof DrillSchema>) {
    return this.dr.runDrill(body)
  }

  @Get('dr/drills')
  drDrills() {
    return { data: this.dr.listDrills() }
  }

  @Get('dr/drills/:id')
  drDrillDetail(@Param('id') id: string) {
    return this.dr.getDrill(id)
  }

  @Post('dr/failover')
  @HttpCode(HttpStatus.OK)
  drFailover(@Body(new ZodValidationPipe(FailoverSchema)) body: z.infer<typeof FailoverSchema>) {
    return this.dr.failover(body)
  }

  // ── 审计链 / 留存 / 冷归档 (与 /audit/verify-chain 同源) ──
  @Get('audit-chain/verify')
  verifyChain() {
    return this.auditChain.verifyChain()
  }

  @Get('audit-chain/retention')
  retentionPolicy() {
    return this.auditChain.getRetentionPolicy()
  }

  @Post('audit-chain/cold-archive')
  @HttpCode(HttpStatus.OK)
  coldArchive(@Body(new ZodValidationPipe(ColdArchiveSchema)) body: z.infer<typeof ColdArchiveSchema>) {
    return this.auditChain.coldArchive(body)
  }
}
