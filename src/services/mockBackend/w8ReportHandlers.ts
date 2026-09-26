// [G005 W8-Report] 报告专业深度 MSW handlers (确定性)
// 对齐后端:
//   reports: field-specs / :id/revisions / :id/revisions/:versionId/diff / :id/signature /
//            :id/verify-signature / :id/resolve-review-tier / :id/recall / :id/recall-ack
//   report-signing: certificates / crl / signatures(stats|get|verify)
//   report-rules: review-tiers (list/resolve)
import { http, HttpResponse, delay } from 'msw'

const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')

const API = `${API_BASE}/reports`
const SIGNING = `${API_BASE}/report-signing`
const RULES = `${API_BASE}/report-rules`

/** 确定性 64 位十六进制 (mock 摘要; 非真实 SHA-256) */
function h64(input: string): string {
  let out = ''
  for (let round = 0; round < 8; round++) {
    let seed = (0x811c9dc5 ^ (round * 0x9e3779b9)) >>> 0
    const src = `${input}|${round}`
    for (let i = 0; i < src.length; i++) {
      seed ^= src.charCodeAt(i)
      seed = Math.imul(seed, 0x01000193) >>> 0
    }
    out += seed.toString(16).padStart(8, '0')
  }
  return out
}

const nowIso = () => new Date().toISOString()
const isoOffsetMin = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

// ── 字段规范 ──
const FIELD_SPECS = [
  { field: 'findings', label: '影像所见', labelEn: 'Findings', type: 'text', required: true, minLength: 10, maxLength: 20000, description: '报告主体描述' },
  { field: 'conclusion', label: '诊断结论', labelEn: 'Conclusion', type: 'text', required: true, minLength: 2, maxLength: 10000, description: '明确诊断意见' },
  { field: 'impression', label: '印象', labelEn: 'Impression', type: 'text', required: false, maxLength: 10000, description: '诊断印象' },
  { field: 'diagnosis', label: '诊断', labelEn: 'Diagnosis', type: 'text', required: false, maxLength: 10000, description: '结构化诊断文本' },
  { field: 'recommendations', label: '建议', labelEn: 'Recommendations', type: 'text', required: false, maxLength: 10000, description: '随访/进一步检查建议' },
  { field: 'noduleSizeMm', label: '结节长径', labelEn: 'Nodule diameter', type: 'number', required: false, unit: 'mm', min: 0, max: 400, normalRange: { max: 8, unit: 'mm', reference: 'Lung-RADS: <8mm 建议随访; ≥8mm 需进一步评估' }, description: '结节最大径' },
  { field: 'ctValueHU', label: 'CT 值', labelEn: 'CT attenuation', type: 'number', required: false, unit: 'HU', min: -1100, max: 3100, normalRange: { min: -1000, max: 3000, unit: 'HU', reference: '常规组织密度 -1000 ~ +3000 HU' }, description: '病灶 CT 密度值' },
  { field: 'breastDensity', label: '乳腺密度', labelEn: 'Breast density', type: 'enum', required: false, allowedValues: ['A', 'B', 'C', 'D'], description: 'ACR 乳腺密度分级' },
  { field: 'radsCategory', label: 'RADS 分级', labelEn: 'RADS category', type: 'number', required: false, min: 0, max: 5, normalRange: { max: 2, unit: '级', reference: '3 类及以上需随访/审核加严' }, description: 'RADS 0-5' },
  { field: 'qualityScore', label: '质控评分', labelEn: 'Quality score', type: 'number', required: false, min: 0, max: 100, normalRange: { min: 60, unit: '分', reference: '≥60 合格' }, description: '报告质控得分' },
]

// ── 内容版本快照 ──
interface RevisionContent {
  id: string
  reportId: string
  versionNumber: number
  findings: string
  impression: string
  conclusion: string
  diagnosis: string
  recommendations: string
  qualityScore: number | null
  actorId: string
  fromState: string
  toState: string
  reason?: string
  createdAt: string
}

const REVISIONS = new Map<string, RevisionContent[]>()
const seedRevision = (r: RevisionContent) => {
  const list = REVISIONS.get(r.reportId) ?? []
  list.push(r)
  REVISIONS.set(r.reportId, list)
}

seedRevision({ id: 'rrc-0001-1', reportId: 'RPT-000001', versionNumber: 1, findings: '双肺纹理清晰, 右肺上叶见 5mm 磨玻璃结节影, 边缘光滑。', impression: '右肺上叶磨玻璃结节, 建议随访。', conclusion: '右肺上叶磨玻璃结节, 建议 6 个月后复查。', diagnosis: '右肺上叶磨玻璃结节', recommendations: '建议 6 个月后复查胸部 CT。', qualityScore: 88, actorId: 'D001', fromState: 'WRITING', toState: 'SUBMITTED', reason: '首次提交', createdAt: isoOffsetMin(60 * 24 * 3) })
seedRevision({ id: 'rrc-0001-2', reportId: 'RPT-000001', versionNumber: 2, findings: '双肺纹理清晰, 右肺上叶见 6mm 磨玻璃结节影, 边缘欠光滑, 可见分叶。', impression: '右肺上叶磨玻璃结节 (较前增大), 考虑肿瘤性病变待排。', conclusion: '右肺上叶磨玻璃结节较前增大, 建议 3 个月后复查或进一步检查。', diagnosis: '右肺上叶磨玻璃结节, 考虑肿瘤性病变待排', recommendations: '建议 3 个月后复查胸部 CT, 必要时 PET-CT。', qualityScore: 82, actorId: 'D001', fromState: 'SUBMITTED', toState: 'INITIAL_REVIEW', reason: '初审通过', createdAt: isoOffsetMin(60 * 24) })
seedRevision({ id: 'rrc-0001-3', reportId: 'RPT-000001', versionNumber: 3, findings: '双肺纹理清晰, 右肺上叶见 6mm 磨玻璃结节影, 边缘欠光滑, 可见分叶及胸膜牵拉。', impression: '右肺上叶磨玻璃结节, 考虑肿瘤性病变。', conclusion: '右肺上叶磨玻璃结节, 考虑肿瘤性病变, 建议 3 个月后复查或穿刺活检。', diagnosis: '右肺上叶磨玻璃结节, 考虑肿瘤性病变', recommendations: '建议 3 个月后复查胸部 CT, 必要时 PET-CT 或穿刺活检。', qualityScore: 90, actorId: 'D002', fromState: 'INITIAL_REVIEW', toState: 'FINAL_REVIEW', reason: '终核修订: 补充胸膜牵拉征象', createdAt: isoOffsetMin(60 * 12) })
seedRevision({ id: 'rrc-1001-1', reportId: 'RPT-1001', versionNumber: 1, findings: '双肺纹理清晰, 右肺上叶见 5mm 磨玻璃结节影。', impression: '右肺上叶磨玻璃结节。', conclusion: '右肺上叶磨玻璃结节, 建议随访。', diagnosis: '右肺上叶磨玻璃结节', recommendations: '建议 6 个月后复查。', qualityScore: 85, actorId: 'D001', fromState: 'WRITING', toState: 'SUBMITTED', createdAt: isoOffsetMin(60 * 30) })
seedRevision({ id: 'rrc-1001-2', reportId: 'RPT-1001', versionNumber: 2, findings: '双肺纹理清晰, 右肺上叶见 5mm 磨玻璃结节影, 边界清晰, 密度均匀。', impression: '右肺上叶磨玻璃结节, 良性可能大。', conclusion: '右肺上叶磨玻璃结节, 良性可能大, 建议年度随访。', diagnosis: '右肺上叶磨玻璃结节', recommendations: '建议 12 个月后复查胸部 CT。', qualityScore: 92, actorId: 'D002', fromState: 'INITIAL_REVIEW', toState: 'FINAL_REVIEW', reason: '终核修订', createdAt: isoOffsetMin(60 * 20) })

const CONTENT_FIELDS: Array<{ field: keyof RevisionContent; label: string }> = [
  { field: 'findings', label: '影像所见' },
  { field: 'diagnosis', label: '诊断' },
  { field: 'impression', label: '印象' },
  { field: 'conclusion', label: '结论' },
  { field: 'recommendations', label: '建议' },
]

function buildDiff(reportId: string, before: RevisionContent | null, after: RevisionContent) {
  const fields = CONTENT_FIELDS.map(({ field, label }) => {
    const b = before ? String(before[field] ?? '') : ''
    const a = String(after[field] ?? '')
    return { field, label, before: b, after: a, changed: b !== a }
  })
  return {
    reportId,
    fromVersionId: before?.id ?? null,
    toVersionId: after.id,
    fromVersionNumber: before?.versionNumber ?? null,
    toVersionNumber: after.versionNumber,
    changedFields: fields.filter((f) => f.changed).map((f) => f.field),
    fields,
    before,
    after,
  }
}

// ── 证书 ──
interface Cert {
  serial: string
  subject: string
  issuer: string
  algorithm: 'SHA-256' | 'SM3'
  usage: string
  notBefore: string
  notAfter: string
  status: 'valid' | 'revoked'
  keyId: string
  revocationReason?: string
  revokedAt?: string
}
const ISSUER = 'CN=G005 RIS Demo CA, O=G005 Hospital, C=CN'
const CERTS: Cert[] = [
  { serial: '05A1B2C3D4E5F607', subject: 'CN=张明远 (医师签名证书), OU=放射科, O=G005 Hospital', issuer: ISSUER, algorithm: 'SHA-256', usage: 'signature', notBefore: isoOffsetMin(60 * 24 * 365), notAfter: new Date(Date.now() + 365 * 86400_000).toISOString(), status: 'valid', keyId: 'ca-g005-ris-demo' },
  { serial: '05B1C2D3E4F50617', subject: 'CN=李慧敏 (医师签名证书), OU=放射科, O=G005 Hospital', issuer: ISSUER, algorithm: 'SHA-256', usage: 'signature', notBefore: isoOffsetMin(60 * 24 * 180), notAfter: new Date(Date.now() + 545 * 86400_000).toISOString(), status: 'valid', keyId: 'ca-g005-ris-demo' },
  { serial: '05C1D2E3F4051627', subject: 'CN=G005 RIS 国密测试证书, OU=信息科, O=G005 Hospital', issuer: ISSUER, algorithm: 'SM3', usage: 'signature', notBefore: isoOffsetMin(60 * 24 * 90), notAfter: new Date(Date.now() + 275 * 86400_000).toISOString(), status: 'valid', keyId: 'ca-g005-ris-demo' },
  { serial: '05D1E2F304152637', subject: 'CN=王建华 (医师签名证书, 已吊销), OU=放射科, O=G005 Hospital', issuer: ISSUER, algorithm: 'SHA-256', usage: 'signature', notBefore: isoOffsetMin(60 * 24 * 400), notAfter: new Date(Date.now() + 100 * 86400_000).toISOString(), status: 'revoked', keyId: 'ca-g005-ris-demo', revocationReason: '私钥疑似泄露 (keyCompromise)', revokedAt: isoOffsetMin(60 * 24 * 30) },
]

// ── 签名 ──
interface SigContent {
  findings: string
  impression: string
  conclusion: string
  diagnosis: string
  recommendations: string
  qualityScore: number | null
  version: number
}
interface Signature {
  reportId: string
  signatureId: string
  algorithm: 'SHA-256' | 'SM3'
  digest: string
  signature: string
  signedById: string
  signedAt: string
  tsaToken: string
  certificateSerial: string
  status: 'valid' | 'superseded' | 'revoked'
  content: SigContent
  supersededBy?: string
  supersededAt?: string
}
const SIGNATURES = new Map<string, Signature[]>()
let sigSeq = 0
const canonical = (c: SigContent) => JSON.stringify({ findings: c.findings ?? '', impression: c.impression ?? '', conclusion: c.conclusion ?? '', diagnosis: c.diagnosis ?? '', recommendations: c.recommendations ?? '', qualityScore: c.qualityScore ?? null, version: c.version ?? 0 })
const digestOf = (c: SigContent, algo: 'SHA-256' | 'SM3') => h64(`${algo}|${canonical(c)}`)
const tsaOf = (digest: string, serial: string, algo: string, tsaTime: string) => btoa(JSON.stringify({ version: 1, tsaTime, digest, algorithm: algo, serial, policy: '1.2.3.4.1.G005.RIS.TSA.1', nonce: h64(`${digest}|${serial}|${tsaTime}`).slice(0, 8) }))
const signMock = (reportId: string, content: SigContent, signedById: string, serial = CERTS[0]!.serial): Signature => {
  const cert = CERTS.find((c) => c.serial === serial)!
  const signedAt = nowIso()
  const digest = digestOf(content, cert.algorithm)
  ;(SIGNATURES.get(reportId) ?? []).forEach((s) => { if (s.status === 'valid') { s.status = 'superseded'; s.supersededAt = signedAt } })
  const sig: Signature = { reportId, signatureId: `sig-${(++sigSeq).toString().padStart(6, '0')}`, algorithm: cert.algorithm, digest, signature: btoa(`mock-rsa:${digest}:${serial}`), signedById, signedAt, tsaToken: tsaOf(digest, serial, cert.algorithm, signedAt), certificateSerial: serial, status: 'valid', content }
  const list = SIGNATURES.get(reportId) ?? []
  list.unshift(sig)
  SIGNATURES.set(reportId, list)
  return sig
}
// 种子签名 (RPT-000001 v3 内容)
signMock('RPT-000001', { findings: '双肺纹理清晰, 右肺上叶见 6mm 磨玻璃结节影, 边缘欠光滑, 可见分叶及胸膜牵拉。', impression: '右肺上叶磨玻璃结节, 考虑肿瘤性病变。', conclusion: '右肺上叶磨玻璃结节, 考虑肿瘤性病变, 建议 3 个月后复查或穿刺活检。', diagnosis: '右肺上叶磨玻璃结节, 考虑肿瘤性病变', recommendations: '建议 3 个月后复查胸部 CT, 必要时 PET-CT 或穿刺活检。', qualityScore: 90, version: 3 }, 'D002')

// ── 召回 ──
interface Recall {
  id: string
  reportId: string
  reason: string
  actorId: string
  recalledAt: string
  hl7: { messageType: string; controlId: string; resultStatus: string; target: string; message: string; sentAt: string; bytes: number }
  notify: { channel: string; event: string; delivered: boolean }
  acknowledgement?: { ackBy: string; ackAt: string; note: string; source: 'HIS' | 'CLINICIAN' }
}
const RECALLS = new Map<string, Recall>()
let recallSeq = 0

// ── 分级审核规则 ──
const REVIEW_TIER_RULES = [
  { id: 'rtier-b-001', code: 'RT-CRIT-01', name: '危急征象双签', tier: 'dual-sign', enabled: true, priority: 100, when: { isCritical: true }, reason: '危急征象报告须终核并双人签名', description: '' },
  { id: 'rtier-b-002', code: 'RT-RADS-5', name: 'RADS 5 类双阅', tier: 'dual-read', enabled: true, priority: 90, when: { radsCategoryGte: 5 }, reason: 'RADS 5 类高度可疑, 须双人阅片', description: '' },
  { id: 'rtier-b-003', code: 'RT-RADS-4', name: 'RADS 4 类双签', tier: 'dual-sign', enabled: true, priority: 80, when: { radsCategoryGte: 4 }, reason: 'RADS 4 类可疑, 须双签', description: '' },
  { id: 'rtier-b-004', code: 'RT-RADS-3', name: 'RADS 3 类终核', tier: 'final', enabled: true, priority: 70, when: { radsCategoryGte: 3 }, reason: 'RADS 3 类须终核', description: '' },
  { id: 'rtier-b-005', code: 'RT-AUTHOR-JR', name: '低资历医师报告加严', tier: 'final', enabled: true, priority: 50, when: { authorSeniorityIn: ['resident'] }, reason: '低资历医师报告须上级终核', description: '' },
  { id: 'rtier-b-006', code: 'RT-MOD-HIGH', name: '增强/高危模态终核', tier: 'final', enabled: true, priority: 40, when: { modalities: ['CT', 'MRI', 'MR'] }, reason: 'CT/MRI 报告须终核', description: '' },
  { id: 'rtier-b-007', code: 'RT-DEFAULT', name: '常规初核', tier: 'initial', enabled: true, priority: 1, when: {}, reason: '常规报告默认初核', description: '' },
]

const TIER_RANK: Record<string, number> = { none: 0, initial: 1, final: 2, 'dual-sign': 3, 'dual-read': 4 }
const TIER_LABEL: Record<string, string> = { none: '免审', initial: '初核', final: '终核', 'dual-sign': '双签', 'dual-read': '双阅' }

function resolveTier(input: { modality?: string; radsCategory?: number; severity?: string; isCritical?: boolean; authorSeniority?: string }) {
  const modality = (input.modality ?? '').toUpperCase()
  const matched: Array<{ ruleId: string; code: string; name: string; tier: string; reason: string }> = []
  let tier = 'none'
  for (const rule of REVIEW_TIER_RULES.filter((r) => r.enabled).sort((a, b) => b.priority - a.priority)) {
    const w = rule.when as Record<string, unknown>
    if (w.modalities && !(w.modalities as string[]).map((m) => m.toUpperCase()).includes(modality)) continue
    if (w.radsCategoryGte !== undefined && (typeof input.radsCategory !== 'number' || input.radsCategory < (w.radsCategoryGte as number))) continue
    if (w.severities && !(w.severities as string[]).includes(input.severity ?? '')) continue
    if (w.isCritical !== undefined && Boolean(input.isCritical) !== w.isCritical) continue
    if (w.authorSeniorityIn && !(w.authorSeniorityIn as string[]).includes(input.authorSeniority ?? '')) continue
    matched.push({ ruleId: rule.id, code: rule.code, name: rule.name, tier: rule.tier, reason: rule.reason })
    if (TIER_RANK[rule.tier]! > TIER_RANK[tier]!) tier = rule.tier
  }
  if (matched.length === 0) tier = 'initial'
  const steps =
    tier === 'none' ? []
      : tier === 'initial' ? [{ order: 1, step: 'initial', role: 'reviewer', label: '初核', reason: matched[0]?.reason ?? '常规初核' }]
        : tier === 'final' ? [
          { order: 1, step: 'initial', role: 'reviewer', label: '初核', reason: '初审通过' },
          { order: 2, step: 'final', role: 'senior-reviewer', label: '终核', reason: matched[0]?.reason ?? '须终核' },
        ]
          : tier === 'dual-sign' ? [
            { order: 1, step: 'initial', role: 'reviewer', label: '初核', reason: '初审通过' },
            { order: 2, step: 'final', role: 'senior-reviewer', label: '终核', reason: '终核通过' },
            { order: 3, step: 'co-sign', role: 'co-signer', label: '双签', reason: matched[0]?.reason ?? '须双人签名' },
          ]
            : [
              { order: 1, step: 'initial', role: 'reviewer', label: '初核', reason: '初审通过' },
              { order: 2, step: 'peer-read', role: 'peer-reader', label: '双阅', reason: matched[0]?.reason ?? '须双人阅片' },
              { order: 3, step: 'final', role: 'senior-reviewer', label: '终核', reason: '终核通过' },
            ]
  return {
    source: 'demo' as const,
    generatedAt: nowIso(),
    reportId: undefined,
    input,
    requiredTier: tier,
    tierLabel: TIER_LABEL[tier],
    steps,
    matchedRules: matched.sort((a, b) => TIER_RANK[b.tier]! - TIER_RANK[a.tier]! || a.code.localeCompare(b.code)),
    critical: Boolean(input.isCritical) || input.severity === 'critical',
  }
}

const envelope = (data: unknown) => ({ success: true, data })

export const w8ReportHandlers = [
  // 报告字段规范
  http.get(`${API}/field-specs`, async () => {
    await delay(30)
    return HttpResponse.json(envelope({ source: 'seed', generatedAt: nowIso(), total: FIELD_SPECS.length, data: FIELD_SPECS }))
  }),

  // 内容版本列表
  http.get(`${API}/:id/revisions`, async ({ params }) => {
    await delay(40)
    const data = (REVISIONS.get(String(params.id)) ?? []).slice().sort((a, b) => a.versionNumber - b.versionNumber)
    return HttpResponse.json(envelope({ reportId: String(params.id), total: data.length, data }))
  }),

  // 版本差异
  http.get(`${API}/:id/revisions/:versionId/diff`, async ({ params }) => {
    await delay(40)
    const list = (REVISIONS.get(String(params.id)) ?? []).slice().sort((a, b) => a.versionNumber - b.versionNumber)
    const idx = list.findIndex((r) => r.id === params.versionId || String(r.versionNumber) === params.versionId)
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'version not found' } }, { status: 404 })
    return HttpResponse.json(envelope(buildDiff(String(params.id), idx > 0 ? list[idx - 1]! : null, list[idx]!)))
  }),

  // 报告签名
  http.get(`${API}/:id/signature`, async ({ params }) => {
    await delay(40)
    const list = SIGNATURES.get(String(params.id)) ?? []
    return HttpResponse.json(envelope({ reportId: String(params.id), signed: list.length > 0, signature: list[0] ?? null, history: list }))
  }),

  // 报告验签
  http.post(`${API}/:id/verify-signature`, async ({ params, request }) => {
    await delay(60)
    const body = (await request.json().catch(() => ({}))) as { signatureId?: string; content?: Partial<SigContent> }
    const list = SIGNATURES.get(String(params.id)) ?? []
    const sig = body.signatureId ? list.find((s) => s.signatureId === body.signatureId) : list[0]
    if (!sig) {
      return HttpResponse.json(envelope({ valid: false, reportId: params.id, signatureId: null, algorithm: null, reasons: ['NO_SIGNATURE: 该报告没有签名记录'], digestMatch: false, signatureMatch: false, certificateValid: false, notRevoked: false, tsaValid: false, certificate: null, signedAt: null, signedById: null, computedDigest: null, verifiedAt: nowIso() }))
    }
    const content: SigContent = { ...sig.content, ...(body.content ?? {}) }
    const computed = digestOf(content, sig.algorithm)
    const cert = CERTS.find((c) => c.serial === sig.certificateSerial) ?? null
    const digestMatch = computed === sig.digest
    const certificateValid = Boolean(cert) && new Date(sig.signedAt) >= new Date(cert!.notBefore) && new Date(sig.signedAt) <= new Date(cert!.notAfter)
    const notRevoked = cert?.status !== 'revoked'
    const reasons: string[] = []
    if (!digestMatch) reasons.push('DIGEST_MISMATCH: 内容摘要与签名不一致 (疑似篡改)')
    if (!certificateValid) reasons.push('CERT_EXPIRED: 签名证书不在有效期内')
    if (!notRevoked) reasons.push('CERT_REVOKED: 签名证书已被吊销 (CRL)')
    if (sig.status === 'superseded') reasons.push('SUPERSEDED: 该签名已被后续修订签名取代')
    return HttpResponse.json(envelope({ valid: digestMatch && certificateValid && notRevoked && sig.status === 'valid', reportId: params.id, signatureId: sig.signatureId, algorithm: sig.algorithm, reasons, digestMatch, signatureMatch: digestMatch, certificateValid, notRevoked, tsaValid: true, certificate: cert, signedAt: sig.signedAt, signedById: sig.signedById, computedDigest: computed, verifiedAt: nowIso() }))
  }),

  // 分级审核链
  http.post(`${API}/:id/resolve-review-tier`, async ({ request }) => {
    await delay(50)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json(envelope(resolveTier(body)))
  }),

  // 召回
  http.post(`${API}/:id/recall`, async ({ params, request }) => {
    await delay(60)
    const body = (await request.json()) as { reason?: string; actorId?: string }
    const ts = nowIso()
    const controlId = `ORU-G005-${params.id}-${Date.now()}`
    const message = [`MSH|^~\\&|G005_RIS|G005|HIS|HOSPITAL|${ts}|`, `ORU^R01|${controlId}|P|2.5.1`, `OBR|1|${params.id}|${params.id}||RAD|||C`].join('\r')
    const record: Recall = {
      id: `RCL-${String(++recallSeq).padStart(6, '0')}`,
      reportId: String(params.id),
      reason: String(body?.reason ?? ''),
      actorId: String(body?.actorId ?? 'unknown'),
      recalledAt: ts,
      hl7: { messageType: 'ORU^R01', controlId, resultStatus: 'C', target: 'HIS', message, sentAt: ts, bytes: message.length },
      notify: { channel: 'websocket', event: 'report-recall', delivered: true },
    }
    RECALLS.set(String(params.id), record)
    return HttpResponse.json(envelope(record))
  }),

  // 召回回执状态
  http.get(`${API}/:id/recall-ack`, async ({ params }) => {
    await delay(30)
    const rec = RECALLS.get(String(params.id))
    return HttpResponse.json(envelope({ reportId: String(params.id), recalled: Boolean(rec), notifiedAt: rec?.recalledAt ?? null, acknowledged: Boolean(rec?.acknowledgement), acknowledgement: rec?.acknowledgement ?? null, controlId: rec?.hl7.controlId ?? null }))
  }),

  // 临床回执确认
  http.post(`${API}/:id/recall-ack`, async ({ params, request }) => {
    await delay(40)
    const body = (await request.json()) as { ackBy?: string; note?: string; source?: 'HIS' | 'CLINICIAN' }
    const rec = RECALLS.get(String(params.id))
    if (rec) rec.acknowledgement = { ackBy: String(body?.ackBy ?? 'unknown'), ackAt: nowIso(), note: String(body?.note ?? ''), source: body?.source ?? 'CLINICIAN' }
    return HttpResponse.json(envelope(rec ?? { reportId: params.id }))
  }),

  // ── 证书中心 ──
  http.get(`${SIGNING}/certificates`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const keyword = (url.searchParams.get('keyword') ?? '').toLowerCase()
    const data = CERTS.filter((c) => !status || c.status === status).filter((c) => !keyword || c.serial.toLowerCase().includes(keyword) || c.subject.toLowerCase().includes(keyword))
    return HttpResponse.json(envelope({ source: 'demo', generatedAt: nowIso(), total: data.length, data }))
  }),

  http.get(`${SIGNING}/certificates/:serial`, async ({ params }) => {
    await delay(30)
    const cert = CERTS.find((c) => c.serial === params.serial)
    if (!cert) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'cert not found' } }, { status: 404 })
    return HttpResponse.json(envelope(cert))
  }),

  http.post(`${SIGNING}/certificates/:serial/revoke`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { reason?: string }
    const cert = CERTS.find((c) => c.serial === params.serial)
    if (!cert) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'cert not found' } }, { status: 404 })
    if (cert.status !== 'revoked') {
      cert.status = 'revoked'
      cert.revocationReason = String(body?.reason ?? 'unspecified')
      cert.revokedAt = nowIso()
    }
    return HttpResponse.json(envelope(cert))
  }),

  http.get(`${SIGNING}/crl`, async () => {
    await delay(30)
    const entries = CERTS.filter((c) => c.status === 'revoked').map((c) => ({ serial: c.serial, revocationDate: c.revokedAt ?? nowIso(), reason: c.revocationReason ?? 'unspecified' }))
    return HttpResponse.json(envelope({ issuer: ISSUER, algorithm: 'RSA-SHA256', thisUpdate: nowIso(), nextUpdate: new Date(Date.now() + 7 * 86400_000).toISOString(), entryCount: entries.length, entries }))
  }),

  http.get(`${SIGNING}/signatures/stats`, async () => {
    await delay(30)
    let total = 0, valid = 0, superseded = 0, revoked = 0
    for (const list of SIGNATURES.values()) for (const s of list) { total++; if (s.status === 'valid') valid++; else if (s.status === 'superseded') superseded++; else revoked++ }
    return HttpResponse.json(envelope({ total, valid, superseded, revoked, reports: SIGNATURES.size }))
  }),

  http.get(`${SIGNING}/signatures/:reportId`, async ({ params }) => {
    await delay(30)
    const list = SIGNATURES.get(String(params.reportId)) ?? []
    return HttpResponse.json(envelope({ reportId: String(params.reportId), signed: list.length > 0, signature: list[0] ?? null, history: list }))
  }),

  http.post(`${SIGNING}/signatures/:reportId/verify`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json().catch(() => ({}))) as { signatureId?: string }
    const list = SIGNATURES.get(String(params.reportId)) ?? []
    const sig = body.signatureId ? list.find((s) => s.signatureId === body.signatureId) : list[0]
    const cert = sig ? CERTS.find((c) => c.serial === sig.certificateSerial) ?? null : null
    const valid = Boolean(sig && cert && cert.status !== 'revoked' && sig.status === 'valid')
    return HttpResponse.json(envelope({ valid, reportId: params.reportId, signatureId: sig?.signatureId ?? null, algorithm: sig?.algorithm ?? null, reasons: valid ? [] : ['INVALID: 签名无效'], digestMatch: valid, signatureMatch: valid, certificateValid: Boolean(cert), notRevoked: cert?.status !== 'revoked', tsaValid: valid, certificate: cert, signedAt: sig?.signedAt ?? null, signedById: sig?.signedById ?? null, computedDigest: sig?.digest ?? null, verifiedAt: nowIso() }))
  }),

  // ── 分级审核规则列表 / resolve ──
  http.get(`${RULES}/review-tiers`, async () => {
    await delay(30)
    return HttpResponse.json(envelope({ source: 'demo', generatedAt: nowIso(), total: REVIEW_TIER_RULES.length, data: REVIEW_TIER_RULES }))
  }),

  http.post(`${RULES}/review-tiers/resolve`, async ({ request }) => {
    await delay(40)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json(envelope(resolveTier(body)))
  }),
]
