// [G005 W13-Security] 安全与合规中心 MSW handlers (确定性, 无随机)。
// 覆盖: RA 证书请求审批 / OCSP / HSM 提供者与密钥轮换 / 字段级加密 / 灾难恢复 / 审计链 / 等保评估。
// 必须注册于 handlers 数组最前 (新增 /security、/ocsp、/compliance 子路径)。
import { http, HttpResponse, delay } from 'msw'
import type {
  BackupSetDto,
  ComplianceAssessmentDto,
  ControlEvaluationDto,
  DrConfigDto,
  DrillRecordDto,
  DrillStepDto,
  HsmProviderDto,
  ManagedKeyDto,
  RaCertificateRequestDto,
  RestorePointDto,
  RotationEventDto,
} from '../api/w13SecurityApi'
import type { ReportCertificateDto } from '../api/reportApi'

const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')

const S = `${API_BASE}/security`
const OCSP = `${API_BASE}/ocsp`
const COMPLIANCE = `${API_BASE}/compliance`

const ok = <T>(data: T) => HttpResponse.json({ success: true, data })
const err = (message: string, status = 400) =>
  HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message } }, { status })

function hashNum(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function hex(input: string, len: number): string {
  let h = hashNum(input)
  let out = ''
  while (out.length < len) {
    out += (h >>> 0).toString(16).padStart(8, '0')
    h = Math.imul(h ^ (h >>> 13), 16777619) >>> 0
  }
  return out.slice(0, len)
}

const nowIso = () => new Date().toISOString()
const isoOffsetDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString()
const isoOffsetMin = (m: number) => new Date(Date.now() + m * 60_000).toISOString()

const ISSUER = 'CN=G005 RIS Demo CA, O=G005 Hospital, C=CN'

// ─────────────────────────────────────────────────────────────────────────────
// 证书注册表 (与后端 RA 视角一致)
// ─────────────────────────────────────────────────────────────────────────────
const CERTS: ReportCertificateDto[] = [
  { serial: '05A1B2C3D4E5F607', subject: 'CN=张明远 (医师签名证书), OU=放射科, O=G005 Hospital', issuer: ISSUER, algorithm: 'SHA-256', usage: 'signature', notBefore: isoOffsetDays(-365), notAfter: isoOffsetDays(365), status: 'valid', keyId: 'ca-g005-ris-demo' },
  { serial: '05B1C2D3E4F50617', subject: 'CN=李慧敏 (医师签名证书), OU=放射科, O=G005 Hospital', issuer: ISSUER, algorithm: 'SHA-256', usage: 'signature', notBefore: isoOffsetDays(-180), notAfter: isoOffsetDays(545), status: 'valid', keyId: 'ca-g005-ris-demo' },
  { serial: '05C1D2E3F4051627', subject: 'CN=G005 RIS 国密测试证书, OU=信息科, O=G005 Hospital', issuer: ISSUER, algorithm: 'SM3', usage: 'signature', notBefore: isoOffsetDays(-90), notAfter: isoOffsetDays(275), status: 'valid', keyId: 'ca-g005-ris-demo' },
  { serial: '05D1E2F304152637', subject: 'CN=王建华 (医师签名证书, 已吊销), OU=放射科, O=G005 Hospital', issuer: ISSUER, algorithm: 'SHA-256', usage: 'signature', notBefore: isoOffsetDays(-400), notAfter: isoOffsetDays(100), status: 'revoked', keyId: 'ca-g005-ris-demo', revocationReason: '私钥疑似泄露 (keyCompromise)', revokedAt: isoOffsetDays(-30) },
]
let certSeq = 0
function nextSerial(): string {
  certSeq += 1
  return `05${Date.now().toString(16).toUpperCase().slice(-8)}${certSeq.toString(16).toUpperCase().padStart(4, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// RA 请求
// ─────────────────────────────────────────────────────────────────────────────
const RA_REQUESTS: RaCertificateRequestDto[] = [
  { id: 'ra-0001', type: 'issue', subject: 'CN=赵星辰 (医师签名证书), OU=放射科, O=G005 Hospital', applicant: '赵星辰', applicantId: 'D1001', algorithm: 'SHA-256', usage: 'signature', reason: '新入职医师签名证书申请', status: 'pending', requestedAt: isoOffsetDays(-1) },
  { id: 'ra-0002', type: 'renew', subject: 'CN=李慧敏 (医师签名证书续期), OU=放射科, O=G005 Hospital', applicant: '李慧敏', applicantId: 'D1002', algorithm: 'SHA-256', usage: 'signature', sourceSerial: '05B1C2D3E4F50617', reason: '证书临近到期续期', status: 'pending', requestedAt: isoOffsetDays(-2) },
]
let raSeq = RA_REQUESTS.length

function issueCert(req: RaCertificateRequestDto): ReportCertificateDto {
  const cert: ReportCertificateDto = {
    serial: nextSerial(),
    subject: req.subject,
    issuer: ISSUER,
    algorithm: req.algorithm === 'SM3' ? 'SM3' : 'SHA-256',
    usage: req.usage,
    notBefore: nowIso(),
    notAfter: isoOffsetDays(365),
    status: 'valid',
    keyId: ACTIVE_KEY_ID,
  }
  CERTS.unshift(cert)
  return cert
}

// ─────────────────────────────────────────────────────────────────────────────
// HSM
// ─────────────────────────────────────────────────────────────────────────────
let ACTIVE_KEY_ID = 'sw-rsa2048-0001'
const HSM_KEYS: ManagedKeyDto[] = [
  { keyId: ACTIVE_KEY_ID, label: 'ca-signing', algorithm: 'RSA-2048', provider: 'software-kms', version: 1, status: 'active', publicKey: '-----BEGIN PUBLIC KEY-----\nMIIB...DEMO...\n-----END PUBLIC KEY-----', createdAt: isoOffsetDays(-60) },
  { keyId: 'mock-rsa2048-0001', label: 'ca-signing', algorithm: 'RSA-2048', provider: 'mock-hsm', version: 1, status: 'active', publicKey: 'mock:' + hex('mock-ca', 64), createdAt: isoOffsetDays(-60) },
]
const ROTATIONS: RotationEventDto[] = []
let rotSeq = 0
let keySeq = 1

// ─────────────────────────────────────────────────────────────────────────────
// 字段加密 (mock: 可逆映射, 非同真实密码学)
// ─────────────────────────────────────────────────────────────────────────────
const FIELD_STORE = new Map<string, string>()
function fieldEncrypt(value: string, algorithm = 'AES-256-GCM'): string {
  const iv = hex(`${value}:${FIELD_STORE.size}:iv`, 24)
  const ct = hex(`${value}:ct`, 48)
  const tag = hex(`${value}:tag`, 32)
  const payload = algorithm === 'SM4-CBC' ? `v1.sm4.${iv.slice(0, 22)}==.${ct}` : `v1.aesgcm.${iv.slice(0, 16)}==.${tag}==.${ct}`
  FIELD_STORE.set(payload, value)
  return payload
}
function fieldDecrypt(payload: string): string | null {
  if (!payload.startsWith('v1.')) return null
  return FIELD_STORE.get(payload) ?? null
}
function mask(value: string, field?: string): string {
  if (!value) return ''
  if (field === 'idCard' || /^\d{18}$/.test(value)) return value.length >= 10 ? `${value.slice(0, 6)}********${value.slice(-4)}` : value
  if (field === 'phone' || /^\d{11}$/.test(value)) return value.length === 11 ? `${value.slice(0, 3)}****${value.slice(-4)}` : value
  if (field === 'allergy') return value.length <= 2 ? '*'.repeat(value.length) : `${value[0]}${'*'.repeat(value.length - 2)}${value[value.length - 1]}`
  if (field === 'name') return value.length <= 1 ? '*' : `${value[0]}${'*'.repeat(value.length - 1)}`
  return value.length <= 2 ? '*'.repeat(value.length) : `${value[0]}${'*'.repeat(value.length - 2)}${value[value.length - 1]}`
}

// ─────────────────────────────────────────────────────────────────────────────
// DR
// ─────────────────────────────────────────────────────────────────────────────
let drConfig: DrConfigDto = { rpoMinutes: 15, rtoMinutes: 30, schedule: '每日 02:00 全量 + 每 4 小时增量', retentionDays: 30, targetSite: '同城灾备中心 (DCC-02)', offsiteEnabled: true, autoFailover: false, updatedAt: nowIso() }
let bsSeq = 0
const BACKUP_SETS: BackupSetDto[] = []
const RESTORE_POINTS: RestorePointDto[] = []
function pushBackupSet(type: 'full' | 'incremental', createdAt: string, sizeBytes: number, baseSetId?: string): BackupSetDto {
  bsSeq += 1
  const id = `bs-${bsSeq.toString().padStart(4, '0')}`
  const set: BackupSetDto = { id, type, status: 'completed', sizeBytes, checksum: hex(`${id}:${type}:${sizeBytes}`, 64), baseSetId: type === 'incremental' ? baseSetId : undefined, createdAt, durationSec: type === 'full' ? 300 : 45, location: type === 'full' ? 'DCC-02 异地' : '主站本地' }
  BACKUP_SETS.unshift(set)
  const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60_000))
  RESTORE_POINTS.unshift({ id: `rp-${id}`, backupSetId: id, createdAt, label: `${type === 'full' ? '全量' : '增量'}恢复点 ${createdAt.slice(0, 16).replace('T', ' ')}`, rpoCompliant: ageMinutes <= drConfig.rpoMinutes, ageMinutes })
  return set
}
const fullSet = pushBackupSet('full', isoOffsetMin(-1440), 18_420_000)
pushBackupSet('incremental', isoOffsetMin(-240), 1_820_000, fullSet.id)
pushBackupSet('incremental', isoOffsetMin(-120), 2_110_000, fullSet.id)
pushBackupSet('incremental', isoOffsetMin(-15), 1_640_000, fullSet.id)

// [demo seed] HSM 密钥轮换事件 (幂等); 备份集/恢复点已有模块加载 seed, 此处加守卫兜底
function seedSecurityExtras(): void {
  if (ROTATIONS.length === 0) {
    const events: Array<Omit<RotationEventDto, 'id'>> = [
      { provider: 'software-kms', algorithm: 'RSA-2048', fromKeyId: null, toKeyId: 'sw-rsa2048-0001', at: isoOffsetDays(-60), reason: 'initial-provisioning' },
      { provider: 'mock-hsm', algorithm: 'RSA-2048', fromKeyId: null, toKeyId: 'mock-rsa2048-0001', at: isoOffsetDays(-30), reason: 'hsm-onboarding' },
      { provider: 'software-kms', algorithm: 'RSA-2048', fromKeyId: 'sw-rsa2048-0000', toKeyId: 'sw-rsa2048-0001', at: isoOffsetDays(-7), reason: 'scheduled-rotation' },
    ]
    for (const e of events) { rotSeq += 1; ROTATIONS.unshift({ id: `rot-${rotSeq.toString().padStart(4, '0')}`, ...e }) }
  }
  if (BACKUP_SETS.length === 0) {
    const base = pushBackupSet('full', isoOffsetMin(-1440), 18_420_000)
    pushBackupSet('incremental', isoOffsetMin(-15), 1_640_000, base.id)
  }
}
seedSecurityExtras()

const DRILLS: DrillRecordDto[] = [
  { id: 'drill-0001', startedAt: isoOffsetDays(-7), finishedAt: isoOffsetDays(-7), durationSec: 300, scenario: 'site-failover', rtoTargetMin: 30, rtoActualMin: 28, rpoTargetMin: 15, rpoActualMin: 12, result: 'pass', steps: [
    { name: '备份完整性校验', status: 'ok', durationSec: 45, detail: '校验和一致' },
    { name: '切换到灾备站点', status: 'ok', durationSec: 120, detail: 'DCC-02 服务已就绪' },
    { name: '业务连通性验证', status: 'ok', durationSec: 90, detail: 'DICOM/RIS 接口正常' },
    { name: '回切主站', status: 'ok', durationSec: 45, detail: '主站恢复' },
  ], executedBy: 'DR-Auto' },
]
let drillSeq = DRILLS.length

function buildDrill(scenario: string, executedBy?: string): DrillRecordDto {
  const latest = BACKUP_SETS[0]
  const age = latest ? Math.max(0, Math.round((Date.now() - new Date(latest.createdAt).getTime()) / 60_000)) : 9999
  const okAge = age <= drConfig.rpoMinutes
  const steps: DrillStepDto[] = [
    { name: '备份完整性校验', status: latest?.type === 'full' ? 'ok' : 'warn', durationSec: 40, detail: latest ? `最新备份集 ${latest.id} (${latest.type})` : '无可用备份集' },
    { name: '恢复点就绪检查', status: okAge ? 'ok' : 'warn', durationSec: 25, detail: `最新恢复点 ${age} 分钟前 (RPO ${drConfig.rpoMinutes} 分钟)` },
    { name: '模拟站点故障注入', status: 'ok', durationSec: 20, detail: `场景: ${scenario}` },
    { name: '自动切换到灾备站点', status: 'ok', durationSec: 150, detail: `${drConfig.targetSite} 切换完成` },
    { name: '业务连通性验证', status: 'ok', durationSec: 80, detail: 'DICOM/RIS/HIS 接口正常' },
    { name: '数据一致性校验', status: okAge ? 'ok' : 'warn', durationSec: 35, detail: `数据年龄 ${age} 分钟` },
    { name: '回切主站', status: 'ok', durationSec: 60, detail: '主站服务恢复' },
  ]
  const result = steps.some((s) => s.status === 'fail') ? 'fail' : steps.some((s) => s.status === 'warn') ? 'warn' : 'pass'
  drillSeq += 1
  const rec: DrillRecordDto = {
    id: `drill-${drillSeq.toString().padStart(4, '0')}`,
    startedAt: nowIso(), finishedAt: nowIso(),
    durationSec: steps.reduce((a, s) => a + s.durationSec, 0),
    scenario, rtoTargetMin: drConfig.rtoMinutes, rtoActualMin: Math.round(steps.reduce((a, s) => a + s.durationSec, 0) / 60),
    rpoTargetMin: drConfig.rpoMinutes, rpoActualMin: age, result, steps, executedBy: executedBy ?? 'DR-Operator',
  }
  DRILLS.unshift(rec)
  return rec
}

function drStatus() {
  const last = BACKUP_SETS[0]
  const age = last ? Math.max(0, Math.round((Date.now() - new Date(last.createdAt).getTime()) / 60_000)) : null
  const lastDrill = DRILLS[0] ?? null
  const passCount = DRILLS.filter((d) => d.result === 'pass').length
  return {
    config: { ...drConfig },
    backup: { total: BACKUP_SETS.length, full: BACKUP_SETS.filter((b) => b.type === 'full').length, incremental: BACKUP_SETS.filter((b) => b.type === 'incremental').length, lastBackupAt: last?.createdAt ?? null, lastBackupAgeMinutes: age, totalSizeBytes: BACKUP_SETS.reduce((a, b) => a + b.sizeBytes, 0), offsite: drConfig.offsiteEnabled },
    restorePoints: { total: RESTORE_POINTS.length, compliant: RESTORE_POINTS.filter((r) => r.rpoCompliant).length, latest: RESTORE_POINTS[0] ?? null },
    drills: { total: DRILLS.length, lastResult: lastDrill?.result ?? null, lastAt: lastDrill?.finishedAt ?? null, passRate: DRILLS.length ? Math.round((passCount / DRILLS.length) * 100) : 0 },
    rpo: { targetMinutes: drConfig.rpoMinutes, actualMinutes: age, compliant: age !== null && age <= drConfig.rpoMinutes },
    rto: { targetMinutes: drConfig.rtoMinutes, lastActualMinutes: lastDrill?.rtoActualMin ?? null, compliant: lastDrill ? lastDrill.rtoActualMin <= drConfig.rtoMinutes : false },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 审计链 (确定性; verified=true)
// ─────────────────────────────────────────────────────────────────────────────
const AUDIT_SEED = [
  ['LOGIN', 'auth'], ['CREATE_REPORT', 'report'], ['SIGN_REPORT', 'report-signature'], ['VIEW_REPORT', 'report'], ['EXPORT_CSV', 'audit'], ['UPDATE_CONFIG', 'system-config'], ['DELETE_REPORT', 'report'], ['LOGIN_FAILED', 'auth'], ['ISSUE_CERT', 'ca'], ['REVOKE_CERT', 'ca'], ['DR_DRILL', 'disaster-recovery'], ['COLD_ARCHIVE', 'audit'],
] as const
function buildChain() {
  let prev = '0'.repeat(64)
  return AUDIT_SEED.map(([action, resource], i) => {
    const id = `seed-${(i + 1).toString().padStart(4, '0')}`
    const createdAt = `2026-09-01T${String(8 + i).padStart(2, '0')}:00:00.000Z`
    const hash = hex(`${prev}|${i}|${id}|${action}|${resource}|${createdAt}`, 64)
    const block = { index: i, id, action, resource, userId: `u-00${(i % 5) + 1}`, createdAt, prevHash: prev, hash }
    prev = hash
    return block
  })
}
let coldArchiveSeq = 0
let lastArchiveAt: string | null = null

// ─────────────────────────────────────────────────────────────────────────────
// 等保评估 (确定性信号)
// ─────────────────────────────────────────────────────────────────────────────
interface CtrlDef { id: string; domain: string; domainName: string; name: string; nameEn: string; requirement: string; level: string; required: boolean; weight: number; score: number; evidence: string; gap?: string; remediation?: string }
const DOMAINS: Array<[string, string]> = [['physical', '安全物理环境'], ['network', '安全通信网络'], ['host', '安全计算环境'], ['application', '安全应用'], ['data', '安全数据'], ['management', '安全管理中心']]
const CTRL_DEFS: CtrlDef[] = [
  { id: 'PHY-01', domain: 'physical', domainName: '安全物理环境', name: '机房出入控制', nameEn: 'Physical Access Control', requirement: '应设置门禁, 对进出人员进行身份鉴别与登记', level: '三级', required: true, weight: 1.0, score: 100, evidence: '门禁系统在线, 出入登记启用' },
  { id: 'PHY-02', domain: 'physical', domainName: '安全物理环境', name: '视频监控', nameEn: 'Video Surveillance', requirement: '应对机房及重要区域进行视频监控, 录像留存≥90天', level: '三级', required: true, weight: 1.0, score: 50, evidence: '监控未接入统管平台', gap: '视频监控信号未接入', remediation: '接入机房视频监控并配置 90 天留存' },
  { id: 'PHY-03', domain: 'physical', domainName: '安全物理环境', name: '温湿度与环境监控', nameEn: 'Environment Monitoring', requirement: '应设置温湿度/水浸/烟感等环境监测与报警', level: '三级', required: false, weight: 0.8, score: 100, evidence: '环境监测与告警已启用' },
  { id: 'PHY-04', domain: 'physical', domainName: '安全物理环境', name: '电力与通信冗余', nameEn: 'Power & Network Redundancy', requirement: '应提供冗余电力与通信线路', level: '三级', required: true, weight: 1.0, score: 100, evidence: '双路供电 + 冗余链路' },
  { id: 'NET-01', domain: 'network', domainName: '安全通信网络', name: '网络区域划分', nameEn: 'Network Segmentation', requirement: '应按业务需要划分安全区域, 区域间实施访问控制', level: '三级', required: true, weight: 1.0, score: 100, evidence: '已划分临床/管理/对外区域并配置 ACL' },
  { id: 'NET-02', domain: 'network', domainName: '安全通信网络', name: '边界防火墙', nameEn: 'Boundary Firewall', requirement: '应在网络边界部署防火墙并配置最小化访问策略', level: '三级', required: true, weight: 1.0, score: 100, evidence: '边界防火墙策略已审计' },
  { id: 'NET-03', domain: 'network', domainName: '安全通信网络', name: '入侵检测/防御', nameEn: 'IDS/IPS', requirement: '应部署入侵检测与防御, 监测异常流量', level: '三级', required: true, weight: 1.0, score: 50, evidence: '未接入 IDS/IPS', gap: '缺少入侵检测', remediation: '部署 IDS/IPS 并联动告警' },
  { id: 'NET-04', domain: 'network', domainName: '安全通信网络', name: '通信加密', nameEn: 'Communication Encryption', requirement: '应采用密码技术保证通信数据的完整性与保密性', level: '三级', required: true, weight: 1.2, score: 100, evidence: 'TLS 全站启用; 支持国密 SM2/SM3/SM4 (字段加密 AES-256-GCM)' },
  { id: 'HOST-01', domain: 'host', domainName: '安全计算环境', name: '身份鉴别', nameEn: 'Identification & Authentication', requirement: '应对登录用户进行身份标识与鉴别, 标识唯一', level: '三级', required: true, weight: 1.2, score: 100, evidence: '用户标识唯一, 集中鉴别' },
  { id: 'HOST-02', domain: 'host', domainName: '安全计算环境', name: '密码策略', nameEn: 'Password Policy', requirement: '口令应满足复杂度、长度要求并定期更换', level: '三级', required: true, weight: 1.2, score: 100, evidence: '最小长度 12, 复杂度开启, 90 天更换' },
  { id: 'HOST-03', domain: 'host', domainName: '安全计算环境', name: '登录失败处理', nameEn: 'Login Failure Handling', requirement: '应限制连续登录失败次数, 超限锁定并告警', level: '三级', required: true, weight: 1.0, score: 100, evidence: '连续失败 5 次锁定' },
  { id: 'HOST-04', domain: 'host', domainName: '安全计算环境', name: '双因素认证', nameEn: 'Multi-Factor Authentication', requirement: '应对管理用户采用双因素认证', level: '三级', required: false, weight: 1.0, score: 100, evidence: 'TOTP 双因素认证已启用' },
  { id: 'HOST-05', domain: 'host', domainName: '安全计算环境', name: '访问控制 (RBAC)', nameEn: 'Access Control', requirement: '应基于角色分配权限, 遵循最小权限原则', level: '三级', required: true, weight: 1.2, score: 100, evidence: 'RBAC 5 角色 + 最小权限' },
  { id: 'HOST-06', domain: 'host', domainName: '安全计算环境', name: '特权账号管理', nameEn: 'Privileged Account Management', requirement: '应对特权账号定期评审并集中管控', level: '三级', required: true, weight: 1.0, score: 40, evidence: '未定期评审特权账号', gap: '特权账号缺乏评审', remediation: '建立特权账号季度评审与审批' },
  { id: 'HOST-07', domain: 'host', domainName: '安全计算环境', name: '恶意代码防范', nameEn: 'Malware Protection', requirement: '应安装防恶意代码软件并及时更新特征库', level: '三级', required: true, weight: 0.8, score: 100, evidence: '主机 EDR/杀毒在线, 特征库自动更新' },
  { id: 'APP-01', domain: 'application', domainName: '安全应用', name: '应用安全审计', nameEn: 'Application Audit', requirement: '应覆盖重要用户行为与安全事件, 审计记录防篡改', level: '三级', required: true, weight: 1.2, score: 100, evidence: '审计覆盖 92%, 哈希链校验通过 (12 区块)' },
  { id: 'APP-02', domain: 'application', domainName: '安全应用', name: '会话与超时控制', nameEn: 'Session Control', requirement: '应设置会话超时与安全退出机制', level: '三级', required: false, weight: 1.0, score: 100, evidence: '会话超时 30 分钟' },
  { id: 'APP-03', domain: 'application', domainName: '安全应用', name: '数据签名与验签', nameEn: 'Data Signature', requirement: '应用系统应对关键数据进行签名验签', level: '三级', required: true, weight: 1.2, score: 100, evidence: '报告签名启用; 证书注册表 + CRL 可用 (SM2/SM3/RSA-SHA256)' },
  { id: 'APP-04', domain: 'application', domainName: '安全应用', name: '应用层访问控制', nameEn: 'Application Access Control', requirement: '应对应用功能与数据实施细粒度访问控制', level: '三级', required: true, weight: 1.0, score: 100, evidence: '接口级 RBAC + 路由守卫' },
  { id: 'DATA-01', domain: 'data', domainName: '安全数据', name: '数据保密性', nameEn: 'Data Confidentiality', requirement: '应对敏感数据 (证件/联系方式/过敏史) 加密存储', level: '三级', required: true, weight: 1.3, score: 100, evidence: '字段级加密 (AES-256-GCM + SM4-CBC 可选)' },
  { id: 'DATA-02', domain: 'data', domainName: '安全数据', name: '数据完整性', nameEn: 'Data Integrity', requirement: '应采用校验技术保证数据完整性, 防止未授权篡改', level: '三级', required: true, weight: 1.2, score: 100, evidence: '审计哈希链 + SM3/SHA-256 摘要校验' },
  { id: 'DATA-03', domain: 'data', domainName: '安全数据', name: '数据备份恢复', nameEn: 'Backup & Recovery', requirement: '应提供数据备份与恢复功能, 关键数据定期备份', level: '三级', required: true, weight: 1.3, score: 100, evidence: '4 个恢复点, RPO 15 分钟' },
  { id: 'DATA-04', domain: 'data', domainName: '安全数据', name: '异地容灾', nameEn: 'Offsite DR', requirement: '重要系统应提供异地数据备份与容灾能力', level: '三级', required: true, weight: 1.2, score: 100, evidence: '同城灾备中心已启用' },
  { id: 'DATA-05', domain: 'data', domainName: '安全数据', name: '剩余信息保护', nameEn: 'Residual Info Protection', requirement: '应对患者敏感信息脱敏显示, 导出需审批', level: '三级', required: true, weight: 1.0, score: 100, evidence: '敏感字段脱敏 + 导出审批' },
  { id: 'DATA-06', domain: 'data', domainName: '安全数据', name: '个人信息保护', nameEn: 'Personal Info Protection', requirement: '应遵循最小必要原则, 明示同意并留痕', level: '三级', required: true, weight: 1.0, score: 100, evidence: '知情同意与最小必要采集' },
  { id: 'MGT-01', domain: 'management', domainName: '安全管理中心', name: '安全管理制度', nameEn: 'Security Policy', requirement: '应建立信息安全管理制度与流程', level: '三级', required: true, weight: 1.0, score: 100, evidence: '安全制度文档齐备且版本受控' },
  { id: 'MGT-02', domain: 'management', domainName: '安全管理中心', name: '安全意识培训', nameEn: 'Security Awareness', requirement: '应定期开展安全意识教育与技能培训', level: '三级', required: false, weight: 1.0, score: 60, evidence: '培训覆盖率 80%', gap: '培训覆盖率不足', remediation: '提升培训覆盖率至 90% 以上' },
  { id: 'MGT-03', domain: 'management', domainName: '安全管理中心', name: '应急预案与演练', nameEn: 'Incident Response & Drill', requirement: '应制定应急预案并定期演练', level: '三级', required: true, weight: 1.1, score: 100, evidence: '应急预案 + 容灾演练通过' },
  { id: 'MGT-04', domain: 'management', domainName: '安全管理中心', name: '集中安全管控', nameEn: 'Centralized Management', requirement: '应对安全设备/系统进行集中管理与监测', level: '三级', required: true, weight: 1.0, score: 100, evidence: '统一监测与告警中心' },
  { id: 'MGT-05', domain: 'management', domainName: '安全管理中心', name: '审计留存≥6个月', nameEn: 'Audit Retention', requirement: '审计日志应留存不少于 6 个月并提供冷归档', level: '三级', required: true, weight: 1.2, score: 100, evidence: '留存 180 天 + 加密冷归档' },
  { id: 'MGT-06', domain: 'management', domainName: '安全管理中心', name: '密钥与证书管理', nameEn: 'Key & Certificate Management', requirement: '应对密钥与证书进行全生命周期管理', level: '三级', required: true, weight: 1.1, score: 100, evidence: 'HSM 抽象层 2 提供者 + 密钥轮换 + OCSP' },
]
function evaluate(): ComplianceAssessmentDto {
  const evaluations: ControlEvaluationDto[] = CTRL_DEFS.map((c) => ({ ...c, implemented: c.score >= 90, gap: c.gap ?? null, remediation: c.remediation ?? null }))
  const totalWeight = evaluations.reduce((a, e) => a + e.weight, 0) || 1
  const overallScore = Math.round(evaluations.reduce((a, e) => a + e.score * e.weight, 0) / totalWeight)
  const required = evaluations.filter((e) => e.required)
  const requiredImplemented = required.filter((e) => e.implemented).length
  const overallCompliance = Math.round((requiredImplemented / required.length) * 100)
  const level = overallScore >= 90 ? '优秀' : overallScore >= 80 ? '良好' : overallScore >= 70 ? '基本符合' : '不符合'
  const domains = DOMAINS.map(([domain, domainName]) => {
    const items = evaluations.filter((e) => e.domain === domain)
    const w = items.reduce((a, e) => a + e.weight, 0) || 1
    return { domain, domainName, controlCount: items.length, implementedCount: items.filter((e) => e.implemented).length, requiredCount: items.filter((e) => e.required).length, averageScore: Math.round(items.reduce((a, e) => a + e.score, 0) / items.length), weight: Math.round(w * 100) / 100, weightedScore: Math.round(items.reduce((a, e) => a + e.score * e.weight, 0) / totalWeight) }
  })
  const gaps = evaluations.filter((e) => !e.implemented).map((e) => ({ id: e.id, domain: e.domain, domainName: e.domainName, name: e.name, level: e.level, score: e.score, gap: e.gap ?? '未满足要求', remediation: e.remediation ?? '请补充控制措施', priority: (e.required ? (e.score < 60 ? 'high' : 'medium') : 'low') as 'high' | 'medium' | 'low' }))
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority] || a.score - b.score))
  return {
    assessedAt: nowIso(),
    version: ASSESSMENT_VERSION,
    standard: '等保 2.0 · GB/T 22239-2019 信息安全技术 网络安全等级保护基本要求 (三级)',
    overallScore, overallCompliance, level,
    totals: { controls: evaluations.length, implemented: evaluations.filter((e) => e.implemented).length, required: required.length, requiredImplemented, gaps: gaps.length, domains: domains.length },
    domains, gaps,
    remediation: gaps.map((g) => ({ controlId: g.id, name: g.name, suggestion: g.remediation, priority: g.priority })),
  }
}
let ASSESSMENT_VERSION = 1

export const w13SecurityHandlers = [
  // ── 等保评估 (静态子路径先于参数路由) ──
  http.get(`${COMPLIANCE}/assessment`, async () => { await delay(30); return ok(evaluate()) }),
  http.get(`${COMPLIANCE}/controls`, async () => {
    await delay(30)
    const a = evaluate()
    const controlMap = new Map(a.gaps.map((g) => [g.id, g]))
    const controls: ControlEvaluationDto[] = CTRL_DEFS.map((c) => ({
      ...c,
      implemented: c.score >= 90,
      gap: controlMap.get(c.id)?.gap ?? null,
      remediation: controlMap.get(c.id)?.remediation ?? null,
    }))
    return ok({ standard: a.standard, assessedAt: a.assessedAt, domains: DOMAINS.map(([domain, domainName]) => ({ domain, domainName, controls: controls.filter((c) => c.domain === domain) })), controls })
  }),
  http.post(`${COMPLIANCE}/reassess`, async () => { await delay(40); ASSESSMENT_VERSION += 1; return ok(evaluate()) }),

  // ── 审计链 ──
  http.get(`${S}/audit-chain/retention`, async () => {
    await delay(20)
    return ok({ retentionMonths: 6, retentionDays: 180, coldArchiveEnabled: true, archiveLocation: 's3://g005-audit-archive/cold', lastArchiveAt, encrypted: true, immutable: true, note: '依据《网络安全法》与等保2.0要求, 审计日志留存不少于 6 个月; 超期数据加密冷归档。' })
  }),
  http.get(`${S}/audit-chain/verify`, async () => {
    await delay(30)
    const chain = buildChain()
    return ok({ verified: true, source: 'seed', totalBlocks: chain.length, checkedBlocks: chain.length, headHash: chain[chain.length - 1]!.hash, brokenAt: null, reason: null, generatedAt: nowIso(), sample: chain.slice(-5) })
  }),
  http.post(`${S}/audit-chain/cold-archive`, async () => {
    await delay(40)
    coldArchiveSeq += 1
    lastArchiveAt = nowIso()
    return ok({ archiveId: `arc-${coldArchiveSeq.toString().padStart(4, '0')}`, archivedCount: 6, location: `s3://g005-audit-archive/cold/arc-${coldArchiveSeq}`, checksum: hex(`arc:${coldArchiveSeq}`, 64), archivedAt: lastArchiveAt, retentionMonths: 6 })
  }),

  // ── HSM ──
  http.get(`${S}/hsm/providers`, async () => {
    await delay(20)
    const providers: HsmProviderDto[] = [
      { name: 'software-kms', kind: 'software', keyCount: HSM_KEYS.filter((k) => k.provider === 'software-kms').length, activeKeyId: ACTIVE_KEY_ID },
      { name: 'mock-hsm', kind: 'mock', keyCount: HSM_KEYS.filter((k) => k.provider === 'mock-hsm').length, activeKeyId: 'mock-rsa2048-0001' },
    ]
    return ok({ data: providers })
  }),
  http.get(`${S}/hsm/rotations`, async () => { await delay(20); return ok({ data: ROTATIONS }) }),
  http.get(`${S}/hsm/keys`, async ({ request }) => {
    await delay(20)
    const provider = new URL(request.url).searchParams.get('provider')
    return ok({ data: HSM_KEYS.filter((k) => !provider || k.provider === provider) })
  }),
  http.post(`${S}/hsm/rotate`, async ({ request }) => {
    await delay(60)
    const body = (await request.json().catch(() => ({}))) as { provider?: string; algorithm?: string; label?: string; reason?: string }
    const algorithm = body.algorithm ?? 'RSA-2048'
    keySeq += 1
    const keyId = `sw-${algorithm.toLowerCase().replace(/[^a-z0-9]/g, '')}-${keySeq.toString().padStart(4, '0')}`
    for (const k of HSM_KEYS) if (k.status === 'active' && k.provider === 'software-kms') { k.status = 'retired'; k.retiredAt = nowIso() }
    const prev = HSM_KEYS.find((k) => k.provider === 'software-kms' && k.status === 'retired')
    const key: ManagedKeyDto = { keyId, label: body.label ?? 'ca-signing', algorithm, provider: 'software-kms', version: keySeq, status: 'active', publicKey: `-----BEGIN PUBLIC KEY-----\n${hex(keyId, 64)}\n-----END PUBLIC KEY-----`, createdAt: nowIso() }
    HSM_KEYS.unshift(key)
    ACTIVE_KEY_ID = keyId
    rotSeq += 1
    const event: RotationEventDto = { id: `rot-${rotSeq.toString().padStart(4, '0')}`, provider: 'software-kms', algorithm, fromKeyId: prev?.keyId ?? null, toKeyId: keyId, at: nowIso(), reason: body.reason ?? 'scheduled-rotation' }
    ROTATIONS.unshift(event)
    return ok({ key, event })
  }),
  http.post(`${S}/hsm/sign`, async ({ request }) => {
    await delay(40)
    const body = (await request.json().catch(() => ({}))) as { data?: string; keyId?: string }
    const keyId = body.keyId ?? ACTIVE_KEY_ID
    const key = HSM_KEYS.find((k) => k.keyId === keyId)
    if (!key) return err('密钥不存在', 404)
    return ok({ signature: key.algorithm === 'SM2' ? hex(`${keyId}:${body.data}:sm2`, 128) : `sig-${hex(`${keyId}:${body.data}`, 88)}`, algorithm: key.algorithm === 'SM2' ? 'SM2-SM3' : 'RSA-SHA256', keyId })
  }),
  http.post(`${S}/hsm/verify`, async ({ request }) => {
    await delay(30)
    const body = (await request.json().catch(() => ({}))) as { data?: string; keyId?: string }
    const key = HSM_KEYS.find((k) => k.keyId === body.keyId)
    return ok({ valid: Boolean(key && body.data) })
  }),

  // ── 字段加密 ──
  http.get(`${S}/field-encryption/algorithms`, async () => { await delay(20); return ok({ default: 'AES-256-GCM', supported: ['AES-256-GCM', 'SM4-CBC'], keySource: 'demo', sm4Available: true }) }),
  http.post(`${S}/field-encryption/encrypt`, async ({ request }) => {
    await delay(30)
    const body = (await request.json().catch(() => ({}))) as { value?: string; algorithm?: string }
    if (!body.value) return err('value 不能为空')
    return ok({ ciphertext: fieldEncrypt(body.value, body.algorithm) })
  }),
  http.post(`${S}/field-encryption/decrypt`, async ({ request }) => {
    await delay(30)
    const body = (await request.json().catch(() => ({}))) as { ciphertext?: string }
    const value = body.ciphertext ? fieldDecrypt(body.ciphertext) : null
    if (value === null) return err('密文非法或无法解密')
    return ok({ value })
  }),
  http.post(`${S}/field-encryption/demo`, async () => {
    await delay(40)
    const samples = [
      { field: 'idCard', value: '110101196803120011' },
      { field: 'phone', value: '13800001001' },
      { field: 'allergy', value: '青霉素过敏' },
    ]
    return ok({ algorithm: 'AES-256-GCM', samples: samples.map((s) => { const ct = fieldEncrypt(s.value); return { field: s.field, plainMasked: mask(s.value, s.field), ciphertextPrefix: ct.slice(0, 16), decryptedMatches: fieldDecrypt(ct) === s.value, maskedRead: mask(s.value, s.field) } }) })
  }),

  // ── DR ──
  http.get(`${S}/dr/status`, async () => { await delay(30); return ok(drStatus()) }),
  http.get(`${S}/dr/config`, async () => { await delay(20); return ok({ ...drConfig }) }),
  http.put(`${S}/dr/config`, async ({ request }) => {
    await delay(40)
    const body = (await request.json().catch(() => ({}))) as Partial<DrConfigDto>
    if (body.rpoMinutes !== undefined && (body.rpoMinutes < 1 || body.rpoMinutes > 1440)) return err('rpoMinutes 必须在 1-1440 之间')
    if (body.rtoMinutes !== undefined && (body.rtoMinutes < 1 || body.rtoMinutes > 1440)) return err('rtoMinutes 必须在 1-1440 之间')
    drConfig = { ...drConfig, ...body, updatedAt: nowIso() }
    return ok({ ...drConfig })
  }),
  http.get(`${S}/dr/backup-sets`, async ({ request }) => {
    await delay(30)
    const type = new URL(request.url).searchParams.get('type')
    return ok({ data: BACKUP_SETS.filter((b) => !type || b.type === type) })
  }),
  http.post(`${S}/dr/backup-sets`, async ({ request }) => {
    await delay(50)
    const body = (await request.json().catch(() => ({}))) as { type?: 'full' | 'incremental'; sizeBytes?: number }
    if (body.type !== 'full' && body.type !== 'incremental') return err('type 必须为 full 或 incremental')
    const base = body.type === 'incremental' ? BACKUP_SETS.find((b) => b.type === 'full')?.id : undefined
    const set = pushBackupSet(body.type, nowIso(), body.sizeBytes ?? 1_700_000, base)
    return HttpResponse.json({ success: true, data: set }, { status: 201 })
  }),
  http.get(`${S}/dr/restore-points`, async () => { await delay(30); return ok({ data: RESTORE_POINTS }) }),
  http.post(`${S}/dr/restore`, async ({ request }) => {
    await delay(50)
    const body = (await request.json().catch(() => ({}))) as { restorePointId?: string }
    const rp = RESTORE_POINTS.find((r) => r.id === body.restorePointId)
    if (!rp) return err('恢复点不存在', 404)
    return ok({ restored: true, restorePointId: rp.id, checksumOk: true, durationSec: 240 })
  }),
  http.get(`${S}/dr/drills`, async () => { await delay(20); return ok({ data: DRILLS }) }),
  http.post(`${S}/dr/drill`, async ({ request }) => {
    await delay(60)
    const body = (await request.json().catch(() => ({}))) as { scenario?: string; executedBy?: string }
    return ok(buildDrill(body.scenario ?? 'site-failover', body.executedBy))
  }),
  http.post(`${S}/dr/failover`, async ({ request }) => {
    await delay(50)
    const body = (await request.json().catch(() => ({}))) as { mode?: 'dry-run' | 'live'; targetSite?: string }
    const mode = body.mode ?? 'dry-run'
    const steps = [
      { name: '主站健康检查', status: 'ok' as const, durationSec: 10, detail: '主站无响应 (模拟故障)' },
      { name: '提升灾备站点为主', status: 'ok' as const, durationSec: 120, detail: `${body.targetSite ?? drConfig.targetSite} 已激活` },
      { name: 'DNS/负载切换', status: (mode === 'live' ? 'ok' : 'warn') as 'ok' | 'warn', durationSec: 60, detail: mode === 'live' ? '流量已切换' : '仅模拟, 未真实切换' },
      { name: '事务一致性确认', status: 'ok' as const, durationSec: 30, detail: '关键表校验通过' },
    ]
    return ok({ success: true, mode, targetSite: body.targetSite ?? drConfig.targetSite, durationSec: 220, steps })
  }),

  // ── RA / 证书 (静态 stats 先于 :id) ──
  http.get(`${S}/ra/stats`, async () => {
    await delay(20)
    return ok({ total: RA_REQUESTS.length, pending: RA_REQUESTS.filter((r) => r.status === 'pending').length, approved: RA_REQUESTS.filter((r) => r.status === 'approved').length, rejected: RA_REQUESTS.filter((r) => r.status === 'rejected').length, issuedCertificates: CERTS.length })
  }),
  http.get(`${S}/ra/requests`, async ({ request }) => {
    await delay(30)
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const type = url.searchParams.get('type')
    const data = RA_REQUESTS.filter((r) => !status || r.status === status).filter((r) => !type || r.type === type)
    return ok({ total: data.length, data })
  }),
  http.post(`${S}/ra/requests`, async ({ request }) => {
    await delay(50)
    const body = (await request.json().catch(() => ({}))) as Partial<RaCertificateRequestDto>
    if (!body.subject?.trim()) return err('subject 不能为空')
    if (!body.applicant?.trim()) return err('applicant 不能为空')
    const type = body.type ?? 'issue'
    if (type === 'renew' && !body.sourceSerial) return err('续期请求必须提供 sourceSerial')
    raSeq += 1
    const req: RaCertificateRequestDto = { id: `ra-${raSeq.toString().padStart(4, '0')}`, type, subject: body.subject.trim(), applicant: body.applicant.trim(), applicantId: body.applicantId, algorithm: body.algorithm ?? 'SHA-256', usage: body.usage ?? 'signature', reason: body.reason, sourceSerial: body.sourceSerial, status: 'pending', requestedAt: nowIso() }
    RA_REQUESTS.unshift(req)
    return HttpResponse.json({ success: true, data: req }, { status: 201 })
  }),
  http.get(`${S}/ra/requests/:id`, async ({ params }) => {
    await delay(20)
    const req = RA_REQUESTS.find((r) => r.id === params.id)
    if (!req) return err('请求不存在', 404)
    return ok(req)
  }),
  http.post(`${S}/ra/requests/:id/approve`, async ({ params, request }) => {
    await delay(60)
    const req = RA_REQUESTS.find((r) => r.id === params.id)
    if (!req) return err('请求不存在', 404)
    if (req.status !== 'pending') return err(`请求已处理 (${req.status})`)
    const body = (await request.json().catch(() => ({}))) as { approvedBy?: string }
    let certificate: ReportCertificateDto
    if (req.type === 'renew' && req.sourceSerial) {
      const src = CERTS.find((c) => c.serial === req.sourceSerial)
      if (src) { src.status = 'revoked'; src.revocationReason = 'supersededByRenew'; src.revokedAt = nowIso() }
      certificate = issueCert(req)
    } else if (req.type === 'revoke' && req.sourceSerial) {
      const src = CERTS.find((c) => c.serial === req.sourceSerial)
      if (src) { src.status = 'revoked'; src.revocationReason = req.reason ?? 'RA 审批吊销'; src.revokedAt = nowIso() }
      certificate = src ?? issueCert(req)
    } else {
      certificate = issueCert(req)
    }
    req.status = 'approved'
    req.decidedAt = nowIso()
    req.decidedBy = body.approvedBy ?? 'RA-Admin'
    req.issuedSerial = certificate.serial
    return ok({ request: req, certificate })
  }),
  http.post(`${S}/ra/requests/:id/reject`, async ({ params, request }) => {
    await delay(50)
    const req = RA_REQUESTS.find((r) => r.id === params.id)
    if (!req) return err('请求不存在', 404)
    if (req.status !== 'pending') return err(`请求已处理 (${req.status})`)
    const body = (await request.json().catch(() => ({}))) as { reason?: string; rejectedBy?: string }
    if (!body.reason?.trim()) return err('驳回原因不能为空')
    req.status = 'rejected'
    req.decidedAt = nowIso()
    req.decidedBy = body.rejectedBy ?? 'RA-Admin'
    req.rejectReason = body.reason.trim()
    return ok(req)
  }),
  http.post(`${S}/ra/certificates/:serial/renew`, async ({ params, request }) => {
    await delay(50)
    const cert = CERTS.find((c) => c.serial === params.serial)
    if (!cert) return err('证书不存在', 404)
    if (cert.status === 'revoked') return err('证书已吊销, 不可续期')
    const body = (await request.json().catch(() => ({}))) as { days?: number }
    const renewed: ReportCertificateDto = { serial: nextSerial(), subject: cert.subject, issuer: ISSUER, algorithm: cert.algorithm, usage: cert.usage, notBefore: nowIso(), notAfter: isoOffsetDays(body.days ?? 365), status: 'valid', keyId: ACTIVE_KEY_ID }
    cert.status = 'revoked'
    cert.revocationReason = `supersededByRenew:${renewed.serial}`
    cert.revokedAt = nowIso()
    CERTS.unshift(renewed)
    return ok(renewed)
  }),
  http.post(`${S}/ra/certificates/:serial/revoke`, async ({ params, request }) => {
    await delay(40)
    const cert = CERTS.find((c) => c.serial === params.serial)
    if (!cert) return err('证书不存在', 404)
    const body = (await request.json().catch(() => ({}))) as { reason?: string }
    if (!body.reason?.trim()) return err('吊销原因不能为空')
    if (cert.status !== 'revoked') { cert.status = 'revoked'; cert.revocationReason = body.reason.trim(); cert.revokedAt = nowIso() }
    return ok(cert)
  }),
  http.get(`${S}/certificates`, async ({ request }) => {
    await delay(30)
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const keyword = (url.searchParams.get('keyword') ?? '').toLowerCase()
    const data = CERTS.filter((c) => !status || c.status === status).filter((c) => !keyword || c.serial.toLowerCase().includes(keyword) || c.subject.toLowerCase().includes(keyword) || c.issuer.toLowerCase().includes(keyword))
    return ok({ source: 'demo', generatedAt: nowIso(), total: data.length, data })
  }),

  // ── OCSP ──
  http.get(`${OCSP}/:serial`, async ({ params }) => {
    await delay(30)
    const cert = CERTS.find((c) => c.serial === params.serial)
    const now = nowIso()
    if (!cert) return ok({ serial: String(params.serial), status: 'unknown', producedAt: now, thisUpdate: now, nextUpdate: isoOffsetDays(1) })
    return ok({ serial: cert.serial, status: cert.status === 'revoked' ? 'revoked' : 'good', producedAt: now, thisUpdate: now, nextUpdate: isoOffsetDays(1), revocationTime: cert.revokedAt, revocationReason: cert.revocationReason, certificateStatus: cert.status, certificate: { serial: cert.serial, subject: cert.subject, issuer: cert.issuer, algorithm: cert.algorithm, notBefore: cert.notBefore, notAfter: cert.notAfter }, responseSignature: `sig-${hex(cert.serial, 64)}`, signatureAlgorithm: 'RSA-SHA256', signingKeyId: ACTIVE_KEY_ID })
  }),
  http.post(OCSP, async ({ request }) => {
    await delay(30)
    const body = (await request.json().catch(() => ({}))) as { serial?: string; request?: { serial?: string } }
    const serial = body.serial ?? body.request?.serial
    if (!serial) return err('请求缺少 serial')
    const cert = CERTS.find((c) => c.serial === serial)
    const now = nowIso()
    if (!cert) return ok({ serial, status: 'unknown', producedAt: now, thisUpdate: now, nextUpdate: isoOffsetDays(1) })
    return ok({ serial: cert.serial, status: cert.status === 'revoked' ? 'revoked' : 'good', producedAt: now, thisUpdate: now, nextUpdate: isoOffsetDays(1), revocationTime: cert.revokedAt, revocationReason: cert.revocationReason, certificateStatus: cert.status, signingKeyId: ACTIVE_KEY_ID })
  }),
]
