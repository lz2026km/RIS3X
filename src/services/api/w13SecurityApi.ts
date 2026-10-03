// [G005 W13-Security] 安全与合规中心 API 客户端。
// 对应后端: backend/src/modules/security-center/* (+ compliance 等保评估 + audit verify-chain)。
// 全部走 api 客户端 (mock 模式由 w13SecurityHandlers 提供确定性回退)。
import { api } from './client'
import type { ReportCertificateDto } from './reportApi'

const qs = (params: Record<string, string | number | undefined>): string => {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') sp.set(k, String(v))
  return sp.toString() ? `?${sp.toString()}` : ''
}

// ── 证书列表 ──
export interface CertificateListEnvelope {
  source: 'demo' | 'database'
  generatedAt: string
  total: number
  data: ReportCertificateDto[]
}

// ── RA ──
export type RaRequestType = 'issue' | 'renew' | 'revoke'
export type RaRequestStatus = 'pending' | 'approved' | 'rejected'
export interface RaCertificateRequestDto {
  id: string
  type: RaRequestType
  subject: string
  applicant: string
  applicantId?: string
  algorithm: string
  usage: string
  reason?: string
  sourceSerial?: string
  status: RaRequestStatus
  requestedAt: string
  decidedAt?: string
  decidedBy?: string
  rejectReason?: string
  issuedSerial?: string
}
export interface RaStatsDto { total: number; pending: number; approved: number; rejected: number; issuedCertificates: number }

// ── HSM ──
export interface ManagedKeyDto {
  keyId: string
  label: string
  algorithm: string
  provider: string
  version: number
  status: 'active' | 'retired' | 'compromised'
  publicKey: string
  createdAt: string
  retiredAt?: string
}
export interface HsmProviderDto { name: string; kind: string; keyCount: number; activeKeyId: string | null }
export interface RotationEventDto { id: string; provider: string; algorithm: string; fromKeyId: string | null; toKeyId: string; at: string; reason: string }

// ── OCSP ──
export interface OcspResponseDto {
  serial: string
  status: 'good' | 'revoked' | 'unknown'
  producedAt: string
  thisUpdate: string
  nextUpdate: string
  revocationTime?: string
  revocationReason?: string
  certificateStatus?: string
  certificate?: { serial: string; subject: string; issuer: string; algorithm: string; notBefore: string; notAfter: string }
  responseSignature?: string
  signatureAlgorithm?: string
  signingKeyId?: string
}

// ── 字段加密 ──
export interface FieldEncryptionInfoDto { default: string; supported: string[]; keySource: string; sm4Available: boolean }
export interface FieldEncryptionDemoDto {
  algorithm: string
  samples: Array<{ field: string; plainMasked: string; ciphertextPrefix: string; decryptedMatches: boolean; maskedRead: string }>
}

// ── DR ──
export interface DrConfigDto { rpoMinutes: number; rtoMinutes: number; schedule: string; retentionDays: number; targetSite: string; offsiteEnabled: boolean; autoFailover: boolean; updatedAt: string }
export interface BackupSetDto { id: string; type: 'full' | 'incremental'; status: string; sizeBytes: number; checksum: string; baseSetId?: string; createdAt: string; durationSec: number; location: string }
export interface RestorePointDto { id: string; backupSetId: string; createdAt: string; label: string; rpoCompliant: boolean; ageMinutes: number }
export interface DrillStepDto { name: string; status: 'ok' | 'warn' | 'fail'; durationSec: number; detail: string }
export interface DrillRecordDto {
  id: string
  startedAt: string
  finishedAt: string
  durationSec: number
  scenario: string
  rtoTargetMin: number
  rtoActualMin: number
  rpoTargetMin: number
  rpoActualMin: number
  result: 'pass' | 'warn' | 'fail'
  steps: DrillStepDto[]
  executedBy?: string
}
export interface DrStatusDto {
  config: DrConfigDto
  backup: { total: number; full: number; incremental: number; lastBackupAt: string | null; lastBackupAgeMinutes: number | null; totalSizeBytes: number; offsite: boolean }
  restorePoints: { total: number; compliant: number; latest: RestorePointDto | null }
  drills: { total: number; lastResult: string | null; lastAt: string | null; passRate: number }
  rpo: { targetMinutes: number; actualMinutes: number | null; compliant: boolean }
  rto: { targetMinutes: number; lastActualMinutes: number | null; compliant: boolean }
}

// ── 审计链 ──
export interface AuditChainBlockDto { index: number; id: string; action: string; resource: string; userId: string | null; createdAt: string; prevHash: string; hash: string }
export interface AuditChainVerificationDto { verified: boolean; source: string; totalBlocks: number; checkedBlocks: number; headHash: string; brokenAt: number | null; reason: string | null; generatedAt: string; sample: AuditChainBlockDto[] }
export interface RetentionPolicyDto { retentionMonths: number; retentionDays: number; coldArchiveEnabled: boolean; archiveLocation: string; lastArchiveAt: string | null; encrypted: boolean; immutable: boolean; note: string }
export interface ColdArchiveResultDto { archiveId: string; archivedCount: number; location: string; checksum: string; archivedAt: string; retentionMonths: number }

// ── 等保评估 ──
export interface ControlEvaluationDto {
  id: string
  domain: string
  domainName: string
  name: string
  nameEn: string
  requirement: string
  level: string
  required: boolean
  weight: number
  implemented: boolean
  score: number
  evidence: string
  gap: string | null
  remediation: string | null
}
export interface DomainScoreDto { domain: string; domainName: string; controlCount: number; implementedCount: number; requiredCount: number; averageScore: number; weight: number; weightedScore: number }
export interface GapItemDto { id: string; domain: string; domainName: string; name: string; level: string; score: number; gap: string; remediation: string; priority: 'high' | 'medium' | 'low' }
export interface ComplianceAssessmentDto {
  assessedAt: string
  version: number
  standard: string
  overallScore: number
  overallCompliance: number
  level: string
  totals: { controls: number; implemented: number; required: number; requiredImplemented: number; gaps: number; domains: number }
  domains: DomainScoreDto[]
  gaps: GapItemDto[]
  remediation: Array<{ controlId: string; name: string; suggestion: string; priority: string }>
}
export interface ControlsEnvelopeDto { standard: string; assessedAt: string | null; domains: Array<{ domain: string; domainName: string; controls: ControlEvaluationDto[] }>; controls: ControlEvaluationDto[] }

export const w13CertificateApi = {
  list: (params?: { status?: 'valid' | 'revoked'; keyword?: string }) =>
    api.get<CertificateListEnvelope>(`/security/certificates${qs(params ?? {})}`),
}

export const raApi = {
  list: (params?: { status?: RaRequestStatus; type?: RaRequestType }) =>
    api.get<{ total: number; data: RaCertificateRequestDto[] }>(`/security/ra/requests${qs(params ?? {})}`),
  stats: () => api.get<RaStatsDto>('/security/ra/stats'),
  create: (body: { type?: RaRequestType; subject: string; applicant: string; applicantId?: string; algorithm?: string; usage?: string; reason?: string; sourceSerial?: string }) =>
    api.post<RaCertificateRequestDto>('/security/ra/requests', body),
  approve: (id: string, body?: { approvedBy?: string; days?: number }) =>
    api.post<{ request: RaCertificateRequestDto; certificate: ReportCertificateDto }>(`/security/ra/requests/${encodeURIComponent(id)}/approve`, body ?? {}),
  reject: (id: string, reason: string, rejectedBy?: string) =>
    api.post<RaCertificateRequestDto>(`/security/ra/requests/${encodeURIComponent(id)}/reject`, { reason, rejectedBy }),
  renew: (serial: string, days?: number) => api.post<ReportCertificateDto>(`/security/ra/certificates/${encodeURIComponent(serial)}/renew`, { days }),
  revoke: (serial: string, reason: string) => api.post<ReportCertificateDto>(`/security/ra/certificates/${encodeURIComponent(serial)}/revoke`, { reason }),
}

export const ocspApi = {
  query: (serial: string) => api.get<OcspResponseDto>(`/ocsp/${encodeURIComponent(serial)}`),
  queryPost: (serial: string) => api.post<OcspResponseDto>('/ocsp', { serial }),
}

export const hsmApi = {
  providers: () => api.get<{ data: HsmProviderDto[] }>('/security/hsm/providers'),
  keys: (provider?: string) => api.get<{ data: ManagedKeyDto[] }>(`/security/hsm/keys${qs({ provider })}`),
  rotations: () => api.get<{ data: RotationEventDto[] }>('/security/hsm/rotations'),
  rotate: (body?: { provider?: string; algorithm?: string; label?: string; reason?: string }) =>
    api.post<{ key: ManagedKeyDto; event: RotationEventDto }>('/security/hsm/rotate', body ?? {}),
  sign: (data: string, keyId?: string) => api.post<{ signature: string; algorithm: string; keyId: string }>('/security/hsm/sign', { data, keyId }),
  verify: (data: string, signature: string, keyId: string) => api.post<{ valid: boolean }>('/security/hsm/verify', { data, signature, keyId }),
}

export const fieldEncryptionApi = {
  algorithms: () => api.get<FieldEncryptionInfoDto>('/security/field-encryption/algorithms'),
  encrypt: (value: string, algorithm?: string) => api.post<{ ciphertext: string }>('/security/field-encryption/encrypt', { value, algorithm }),
  decrypt: (ciphertext: string) => api.post<{ value: string }>('/security/field-encryption/decrypt', { ciphertext }),
  demo: () => api.post<FieldEncryptionDemoDto>('/security/field-encryption/demo', {}),
  // [G005 W4B] 字段加密自检 (GET /security/field-encryption/selftest)
  selfTest: () => api.get<FieldEncryptionDemoDto>('/security/field-encryption/selftest'),
}

export const drApi = {
  status: () => api.get<DrStatusDto>('/security/dr/status'),
  getConfig: () => api.get<DrConfigDto>('/security/dr/config'),
  updateConfig: (body: Partial<DrConfigDto>) => api.put<DrConfigDto>('/security/dr/config', body),
  listBackupSets: (type?: 'full' | 'incremental') => api.get<{ data: BackupSetDto[] }>(`/security/dr/backup-sets${qs({ type })}`),
  createBackupSet: (body: { type: 'full' | 'incremental'; sizeBytes?: number }) => api.post<BackupSetDto>('/security/dr/backup-sets', body),
  listRestorePoints: () => api.get<{ data: RestorePointDto[] }>('/security/dr/restore-points'),
  restore: (restorePointId: string) => api.post<{ restored: boolean; restorePointId: string; checksumOk: boolean; durationSec: number }>('/security/dr/restore', { restorePointId }),
  drill: (body?: { scenario?: string; executedBy?: string }) => api.post<DrillRecordDto>('/security/dr/drill', body ?? {}),
  listDrills: () => api.get<{ data: DrillRecordDto[] }>('/security/dr/drills'),
  // [G005 W4B] 演练详情 (GET /security/dr/drills/:id)
  getDrill: (id: string) => api.get<DrillRecordDto>(`/security/dr/drills/${encodeURIComponent(id)}`),
  failover: (body?: { targetSite?: string; mode?: 'dry-run' | 'live' }) => api.post<{ success: boolean; mode: string; targetSite: string; durationSec: number; steps: DrillStepDto[] }>('/security/dr/failover', body ?? {}),
}

export const auditChainApi = {
  verify: () => api.get<AuditChainVerificationDto>('/security/audit-chain/verify'),
  retention: () => api.get<RetentionPolicyDto>('/security/audit-chain/retention'),
  coldArchive: (body?: { before?: string; executedBy?: string }) => api.post<ColdArchiveResultDto>('/security/audit-chain/cold-archive', body ?? {}),
}

export const complianceAssessmentApi = {
  assessment: () => api.get<ComplianceAssessmentDto>('/compliance/assessment'),
  controls: () => api.get<ControlsEnvelopeDto>('/compliance/controls'),
  reassess: () => api.post<ComplianceAssessmentDto>('/compliance/reassess', {}),
}
