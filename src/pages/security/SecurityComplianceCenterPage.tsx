// [G005 W13-Security] 安全与合规中心 (5 Tab):
//   CA/证书 (RA 颁发/吊销/续期 · OCSP · HSM 密钥轮换) · 字段加密 · 等保 2.0 实时评估 · 灾难恢复 · 审计链校验
// 数据源: w13SecurityApi (后端 /security、/ocsp、/compliance; MSW 确定性回退)
import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Input,
  InputNumber,
  List,
  message,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from 'antd/es/table'
import {
  ShieldCheck, RefreshCw, BadgeCheck, KeyRound, Lock, FileCheck2, DatabaseBackup,
  Link2, Plus, RotateCw, Search, PlayCircle, CheckCircle2, AlertTriangle, XCircle,
} from 'lucide-react'
import { LoadingBanner, ErrorBanner } from '../../components/feedback'
import { DataTable, StatCard, StatCardGrid } from "../../components/common"
import { t } from '../../i18n/appI18n'
import { severityColor, severityToAntd, toneToAntd } from '../../theme/statusTokens'
import {
  auditChainApi, complianceAssessmentApi, drApi, fieldEncryptionApi, hsmApi, ocspApi, raApi, w13CertificateApi,
  type AuditChainVerificationDto, type BackupSetDto, type ComplianceAssessmentDto, type ControlEvaluationDto,
  type DrStatusDto, type DrillRecordDto, type FieldEncryptionDemoDto, type FieldEncryptionInfoDto,
  type HsmProviderDto, type ManagedKeyDto, type OcspResponseDto, type RaCertificateRequestDto, type RaStatsDto,
  type RestorePointDto, type RetentionPolicyDto,
} from '../../services/api/w13SecurityApi'
import type { ReportCertificateDto } from '../../services/api/reportApi'

const { Text, Paragraph } = Typography

const ALGO_COLOR: Record<string, string> = { 'SM3': 'purple', 'SM2': 'purple', 'SHA-256': 'blue', 'RSA-2048': 'blue', 'RSA-3072': 'cyan' }
const STATUS_COLOR: Record<string, string> = { valid: severityToAntd('success'), revoked: severityToAntd('critical'), active: toneToAntd('active'), retired: toneToAntd('archived'), compromised: toneToAntd('failed'), pending: toneToAntd('pending'), approved: toneToAntd('approved'), rejected: toneToAntd('rejected'), completed: toneToAntd('completed'), running: toneToAntd('running'), failed: toneToAntd('failed') }
const OCSP_COLOR: Record<string, string> = { good: severityToAntd('success'), revoked: severityToAntd('critical'), unknown: severityToAntd('neutral') }
const DRILL_COLOR: Record<string, string> = { pass: severityToAntd('success'), warn: severityToAntd('warning'), fail: severityToAntd('critical') }

interface EnvelopeList<T> { data: T[] }

async function unwrap<T>(p: Promise<{ success: boolean; data?: T; error?: { message?: string } }>): Promise<T | null> {
  try {
    const res = await p
    return res.success && res.data ? res.data : null
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// CA / 证书 Tab
// ─────────────────────────────────────────────────────────────
const CaTab: React.FC = () => {
  const [requests, setRequests] = useState<RaCertificateRequestDto[]>([])
  const [stats, setStats] = useState<RaStatsDto | null>(null)
  const [certs, setCerts] = useState<ReportCertificateDto[]>([])
  const [providers, setProviders] = useState<HsmProviderDto[]>([])
  const [keys, setKeys] = useState<ManagedKeyDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [applicant, setApplicant] = useState('')
  const [type, setType] = useState<'issue' | 'renew' | 'revoke'>('issue')
  const [algorithm, setAlgorithm] = useState<'SHA-256' | 'SM3'>('SHA-256')
  const [sourceSerial, setSourceSerial] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<RaCertificateRequestDto | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [ocspSerial, setOcspSerial] = useState('')
  const [ocspResult, setOcspResult] = useState<OcspResponseDto | null>(null)
  const [ocspLoading, setOcspLoading] = useState(false)
  const [rotating, setRotating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [reqs, st, cs, provs, ks] = await Promise.all([
      unwrap<{ total: number; data: RaCertificateRequestDto[] }>(raApi.list()),
      unwrap<RaStatsDto>(raApi.stats()),
      unwrap<{ data: ReportCertificateDto[] }>(w13CertificateApi.list()),
      unwrap<{ data: HsmProviderDto[] }>(hsmApi.providers()),
      unwrap<{ data: ManagedKeyDto[] }>(hsmApi.keys()),
    ])
    if (reqs) setRequests(reqs.data ?? []); if (st) setStats(st)
    if (cs) setCerts(cs.data ?? []); if (provs) setProviders(provs.data ?? []); if (ks) setKeys(ks.data ?? [])
    if (!reqs && !cs) setError(t('w13Sec.loadError'))
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const handleCreate = async () => {
    if (!subject.trim() || !applicant.trim()) { message.warning(t('w13Sec.ca.subjectRequired')); return }
    setSubmitting(true)
    try {
      const res = await raApi.create({ type, subject: subject.trim(), applicant: applicant.trim(), algorithm, sourceSerial: sourceSerial.trim() || undefined })
      if (res.success && res.data) {
        message.success(t('w13Sec.ca.requestCreated', { id: res.data.id }))
        setSubject(''); setApplicant(''); setSourceSerial('')
        await load()
      } else message.error(res.error?.message ?? t('w13Sec.ca.requestFailed'))
    } finally { setSubmitting(false) }
  }

  const handleApprove = async (id: string) => {
    const res = await raApi.approve(id, { approvedBy: '安全管理员' })
    if (res.success && res.data) {
      message.success(t('w13Sec.ca.approveSuccess', { id, serial: res.data.certificate.serial }))
      await load()
    } else message.error(res.error?.message ?? t('w13Sec.ca.requestFailed'))
  }

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return
    const res = await raApi.reject(rejectTarget.id, rejectReason.trim())
    if (res.success) {
      message.success(t('w13Sec.ca.rejectSuccess', { id: rejectTarget.id }))
      setRejectTarget(null); setRejectReason('')
      await load()
    } else message.error(res.error?.message ?? t('w13Sec.ca.requestFailed'))
  }

  const handleOcsp = async () => {
    if (!ocspSerial.trim()) return
    setOcspLoading(true)
    try {
      const res = await ocspApi.query(ocspSerial.trim())
      if (res.success && res.data) setOcspResult(res.data)
      else message.error(t('w13Sec.ca.requestFailed'))
    } finally { setOcspLoading(false) }
  }

  const handleRotate = async () => {
    setRotating(true)
    try {
      const res = await hsmApi.rotate({ reason: 'ui-rotation' })
      if (res.success && res.data) { message.success(t('w13Sec.ca.hsm.rotated', { keyId: res.data.key.keyId })); await load() }
      else message.error(t('w13Sec.ca.requestFailed'))
    } finally { setRotating(false) }
  }

  const reqColumns: ColumnsType<RaCertificateRequestDto> = [
    { title: t('w13Sec.cp.col.id'), dataIndex: 'id', width: 90, render: (v) => <Text code>{v}</Text> },
    { title: t('w13Sec.ca.type'), dataIndex: 'type', width: 80, render: (v: string) => <Tag color={v === 'issue' ? 'blue' : v === 'renew' ? 'green' : 'red'}>{t(`w13Sec.ca.type.${v}`)}</Tag> },
    { title: t('w13Sec.ca.subject'), dataIndex: 'subject', ellipsis: true },
    { title: t('w13Sec.ca.applicant'), dataIndex: 'applicant', width: 100 },
    { title: t('w13Sec.ca.col.status'), dataIndex: 'status', width: 90, render: (v: string) => <Tag color={STATUS_COLOR[v]}>{v}</Tag> },
    {
      title: t('w13Sec.ca.col.actions'), key: 'actions', width: 170,
      render: (_v, r) => r.status === 'pending' ? (
        <Space size={4}>
          <Button size="small" type="primary" onClick={() => void handleApprove(r.id)}>{t('w13Sec.ca.approve')}</Button>
          <Button size="small" danger onClick={() => { setRejectTarget(r); setRejectReason('') }}>{t('w13Sec.ca.reject')}</Button>
        </Space>
      ) : r.issuedSerial ? <Text code style={{ fontSize: 11 }}>{r.issuedSerial}</Text> : '-',
    },
  ]

  const certColumns: ColumnsType<ReportCertificateDto> = [
    { title: t('w13Sec.ca.col.serial'), dataIndex: 'serial', width: 170, render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
    { title: t('w13Sec.ca.col.subject'), dataIndex: 'subject', ellipsis: true },
    { title: t('w13Sec.ca.col.algorithm'), dataIndex: 'algorithm', width: 90, render: (a: string) => <Tag color={ALGO_COLOR[a] ?? 'default'}>{a}</Tag> },
    { title: t('w13Sec.ca.col.validity'), key: 'validity', width: 180, render: (_v, r) => <span style={{ fontSize: 12 }}>{r.notBefore.slice(0, 10)} ~ {r.notAfter.slice(0, 10)}</span> },
    { title: t('w13Sec.ca.col.status'), dataIndex: 'status', width: 80, render: (s: string) => <Tag color={STATUS_COLOR[s]}>{s}</Tag> },
  ]

  const keyColumns: ColumnsType<ManagedKeyDto> = [
    { title: t('w13Sec.ca.hsm.col.keyId'), dataIndex: 'keyId', render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
    { title: t('w13Sec.ca.hsm.col.algorithm'), dataIndex: 'algorithm', width: 100, render: (a: string) => <Tag color={ALGO_COLOR[a] ?? 'default'}>{a}</Tag> },
    { title: t('w13Sec.ca.hsm.col.provider'), dataIndex: 'provider', width: 120 },
    { title: t('w13Sec.ca.hsm.col.status'), dataIndex: 'status', width: 90, render: (s: string) => <Tag color={STATUS_COLOR[s]}>{s}</Tag> },
    { title: t('w13Sec.ca.hsm.col.createdAt'), dataIndex: 'createdAt', width: 160, render: (v: string) => v?.slice(0, 19).replace('T', ' ') },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {error && <ErrorBanner message={error} />}
      <StatCardGrid minWidth={200} gap={16}>
        <StatCard title={t('w13Sec.ca.stats.pending')} value={stats?.pending ?? 0} icon={<KeyRound size={16} />} color="warning" />
        <StatCard title={t('w13Sec.ca.stats.approved')} value={stats?.approved ?? 0} color="success" />
        <StatCard title={t('w13Sec.ca.stats.rejected')} value={stats?.rejected ?? 0} color="error" />
        <StatCard title={t('w13Sec.ca.stats.certs')} value={stats?.issuedCertificates ?? certs.length} />
      </StatCardGrid>

      <Row gutter={16}>
        <Col span={10}>
          <Card size="small" title={<span><Plus size={14} /> {t('w13Sec.ca.createRequest')}</span>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select value={type} style={{ width: '100%' }} onChange={(v) => setType(v)} options={[
                { value: 'issue', label: t('w13Sec.ca.type.issue') }, { value: 'renew', label: t('w13Sec.ca.type.renew') }, { value: 'revoke', label: t('w13Sec.ca.type.revoke') },
              ]} />
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('w13Sec.ca.subject')} maxLength={300} />
              <Input value={applicant} onChange={(e) => setApplicant(e.target.value)} placeholder={t('w13Sec.ca.applicant')} maxLength={120} />
              <Row gutter={8}>
                <Col span={12}><Select value={algorithm} style={{ width: '100%' }} onChange={(v) => setAlgorithm(v)} options={[{ value: 'SHA-256', label: 'SHA-256' }, { value: 'SM3', label: 'SM3 (国密)' }]} /></Col>
                <Col span={12}><Input value={sourceSerial} onChange={(e) => setSourceSerial(e.target.value)} placeholder={t('w13Sec.ca.sourceSerial')} /></Col>
              </Row>
              <Button type="primary" loading={submitting} onClick={() => void handleCreate()}>{t('w13Sec.ca.submit')}</Button>
            </Space>
          </Card>

          <Card size="small" style={{ marginTop: 'var(--space-4, 16px)' }} title={<span><KeyRound size={14} /> {t('w13Sec.ca.hsm')}</span>} extra={<Button size="small" icon={<RotateCw size={12} />} loading={rotating} onClick={() => void handleRotate()}>{t('w13Sec.ca.hsm.rotate')}</Button>}>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label={t('w13Sec.ca.hsm.providers')}>
                {providers.map((p) => <Tag key={p.name} color={p.kind === 'mock' ? 'gold' : 'blue'}>{p.name} ({p.keyCount})</Tag>)}
              </Descriptions.Item>
              <Descriptions.Item label={t('w13Sec.ca.hsm.activeKey')}>
                <Text code style={{ fontSize: 12 }}>{providers.find((p) => p.name === 'software-kms')?.activeKeyId ?? '-'}</Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" style={{ marginTop: 'var(--space-4, 16px)' }} title={<span><BadgeCheck size={14} /> {t('w13Sec.ca.ocsp')}</span>}>
            <Space.Compact style={{ width: '100%' }}>
              <Input value={ocspSerial} onChange={(e) => setOcspSerial(e.target.value)} placeholder={t('w13Sec.ca.ocspPlaceholder')} onPressEnter={() => void handleOcsp()} />
              <Button type="primary" loading={ocspLoading} icon={<Search size={12} />} onClick={() => void handleOcsp()}>{t('w13Sec.ca.ocspQuery')}</Button>
            </Space.Compact>
            {ocspResult && (
              <Alert
                style={{ marginTop: 'var(--space-3, 12px)' }}
                type={ocspResult.status === 'good' ? 'success' : ocspResult.status === 'revoked' ? 'error' : 'warning'}
                showIcon
                message={<Space><Tag color={OCSP_COLOR[ocspResult.status]}>{t(`w13Sec.ca.ocsp.${ocspResult.status}`)}</Tag><Text code style={{ fontSize: 12 }}>{ocspResult.serial}</Text></Space>}
                description={
                  <div style={{ fontSize: 12 }}>
                    <div>{t('w13Sec.ca.ocspProducedAt')}: {ocspResult.producedAt?.slice(0, 19).replace('T', ' ')}</div>
                    {ocspResult.certificate && <div>{ocspResult.certificate.subject}</div>}
                    {ocspResult.revocationReason && <div style={{ color: 'var(--color-error-600)' }}>{ocspResult.revocationReason}</div>}
                    {ocspResult.responseSignature && <div>{t('w13Sec.ca.ocspSignature')}: <Text code style={{ fontSize: 11 }}>{ocspResult.responseSignature.slice(0, 24)}…</Text></div>}
                  </div>
                }
              />
            )}
          </Card>
        </Col>

        <Col span={14}>
          <Card size="small" title={<span><ShieldCheck size={14} /> {t('w13Sec.ca.requests')}</span>}>
            {loading ? <LoadingBanner /> : <DataTable<RaCertificateRequestDto> rowKey="id" dataSource={requests} columns={reqColumns} pagination={{ pageSize: 5, hideOnSinglePage: true }} />}
          </Card>
          <Card size="small" style={{ marginTop: 'var(--space-4, 16px)' }} title={<span><BadgeCheck size={14} /> {t('w13Sec.ca.certList')}</span>}>
            {loading ? <LoadingBanner /> : <DataTable<ReportCertificateDto> rowKey="serial" dataSource={certs} columns={certColumns} pagination={{ pageSize: 5, hideOnSinglePage: true }} />}
          </Card>
          <Card size="small" style={{ marginTop: 'var(--space-4, 16px)' }} title={<span><KeyRound size={14} /> {t('w13Sec.ca.hsm.keys')}</span>}>
            {loading ? <LoadingBanner /> : <DataTable<ManagedKeyDto> rowKey="keyId" dataSource={keys} columns={keyColumns} pagination={{ pageSize: 5, hideOnSinglePage: true }} />}
          </Card>
        </Col>
      </Row>

      <Modal title={t('w13Sec.ca.reject')} open={Boolean(rejectTarget)} onCancel={() => setRejectTarget(null)} onOk={() => void handleReject()} okText={t('w13Sec.ca.reject')} cancelText="取消" okButtonProps={{ danger: true }}>
        <Input.TextArea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t('w13Sec.ca.rejectReason')} maxLength={300} showCount />
      </Modal>
    </Space>
  )
}

// ─────────────────────────────────────────────────────────────
// 字段加密 Tab
// ─────────────────────────────────────────────────────────────
const FieldEncryptionTab: React.FC = () => {
  const [info, setInfo] = useState<FieldEncryptionInfoDto | null>(null)
  const [demo, setDemo] = useState<FieldEncryptionDemoDto | null>(null)
  const [plain, setPlain] = useState('110101196803120011')
  const [cipher, setCipher] = useState('')
  const [decrypted, setDecrypted] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // [G005 W4B] 字段加密自检 (GET /security/field-encryption/selftest)
  const [selfTestResult, setSelfTestResult] = useState<FieldEncryptionDemoDto | null>(null)
  const [selfTesting, setSelfTesting] = useState(false)

  useEffect(() => {
    void (async () => {
      const [i, d] = await Promise.all([unwrap<FieldEncryptionInfoDto>(fieldEncryptionApi.algorithms()), unwrap<FieldEncryptionDemoDto>(fieldEncryptionApi.demo())])
      if (i) setInfo(i); else setError(t('w13Sec.loadError'))
      if (d) setDemo(d)
    })()
  }, [])

  const handleSelfTest = async () => {
    setSelfTesting(true)
    try {
      const res = await fieldEncryptionApi.selfTest()
      if (res.success && res.data) {
        setSelfTestResult(res.data)
        message.success(t('w4b.fe.selftestDone'))
      } else message.error(t('w4b.fe.selftestFailed'))
    } catch {
      message.error(t('w4b.fe.selftestFailed'))
    } finally {
      setSelfTesting(false)
    }
  }

  const handleEncrypt = async () => {
    if (!plain) return
    setBusy(true)
    try {
      const res = await fieldEncryptionApi.encrypt(plain)
      if (res.success && res.data) { setCipher(res.data.ciphertext); message.success(t('w13Sec.fe.encryptSuccess')) }
      else message.error(t('w13Sec.fe.failed'))
    } finally { setBusy(false) }
  }
  const handleDecrypt = async () => {
    if (!cipher) return
    setBusy(true)
    try {
      const res = await fieldEncryptionApi.decrypt(cipher)
      if (res.success && res.data) { setDecrypted(res.data.value); message.success(t('w13Sec.fe.decryptSuccess')) }
      else message.error(t('w13Sec.fe.failed'))
    } finally { setBusy(false) }
  }

  const demoColumns: ColumnsType<FieldEncryptionDemoDto['samples'][number]> = [
    { title: t('w13Sec.fe.col.field'), dataIndex: 'field', width: 90 },
    { title: t('w13Sec.fe.col.masked'), dataIndex: 'plainMasked', render: (v: string) => <Text code>{v}</Text> },
    { title: t('w13Sec.fe.col.ciphertext'), dataIndex: 'ciphertextPrefix', render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}…</Text> },
    { title: t('w13Sec.fe.col.roundtrip'), dataIndex: 'decryptedMatches', width: 100, render: (v: boolean) => v ? <Tag color="green"></Tag> : <Tag color="red"></Tag> },
    { title: t('w13Sec.fe.col.maskedRead'), dataIndex: 'maskedRead', render: (v: string) => <Text code>{v}</Text> },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {error && <ErrorBanner message={error} />}
      <StatCardGrid minWidth={200} gap={16}>
        <StatCard title={t('w13Sec.fe.default')} value={info?.default ?? '-'} icon={<Lock size={16} />} />
        <StatCard title={t('w13Sec.fe.supported')} value={(info?.supported ?? []).join(' / ')} />
        <StatCard title={t('w13Sec.fe.keySource')} value={info?.keySource ?? '-'} />
        <StatCard title={t('w13Sec.fe.sm4')} value={info?.sm4Available ? t('w13Sec.fe.available') : '-'} icon={<Lock size={16} />} color={info?.sm4Available ? 'success' : undefined} />
      </StatCardGrid>
      <Row gutter={16}>
        <Col span={12}>
          <Card
            size="small"
            title={t('w13Sec.fe.demo')}
            extra={<Button size="small" type="primary" ghost loading={selfTesting} onClick={() => void handleSelfTest()}>{t('w4b.fe.selftest')}</Button>}
          >
            {demo ? <DataTable rowKey="field" pagination={false} dataSource={demo.samples} columns={demoColumns} /> : <LoadingBanner />}
            {selfTestResult && (
              <div style={{ marginTop: 'var(--space-3, 12px)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)', marginBottom: 6 }}>
                  {t('w4b.fe.selftestResult')} · <Tag color="purple">{selfTestResult.algorithm}</Tag>
                </div>
                <DataTable rowKey="field" pagination={false} dataSource={selfTestResult.samples} columns={demoColumns} />
              </div>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title={t('w13Sec.fe.playground')}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input value={plain} onChange={(e) => setPlain(e.target.value)} addonBefore={t('w13Sec.fe.plaintext')} placeholder={t('w13Sec.fe.plaintextPlaceholder')} />
              <Space>
                <Button type="primary" loading={busy} icon={<Lock size={12} />} onClick={() => void handleEncrypt()}>{t('w13Sec.fe.encrypt')}</Button>
                <Button loading={busy} onClick={() => void handleDecrypt()}>{t('w13Sec.fe.decrypt')}</Button>
              </Space>
              <Input value={cipher} onChange={(e) => setCipher(e.target.value)} placeholder={t('w13Sec.fe.ciphertext')} />
              <Input value={decrypted} readOnly addonBefore={t('w13Sec.fe.decryptResult')} />
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  )
}

// ─────────────────────────────────────────────────────────────
// 等保 2.0 评估 Tab
// ─────────────────────────────────────────────────────────────
const LEVEL_COLOR: Record<string, string> = { '优秀': severityColor('success'), '良好': severityColor('info'), '基本符合': severityColor('warning'), '不符合': severityColor('critical') }

const ComplianceTab: React.FC = () => {
  const [assessment, setAssessment] = useState<ComplianceAssessmentDto | null>(null)
  const [controls, setControls] = useState<ControlEvaluationDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [a, c] = await Promise.all([unwrap<ComplianceAssessmentDto>(complianceAssessmentApi.assessment()), unwrap<{ controls: ControlEvaluationDto[] }>(complianceAssessmentApi.controls())])
    if (a) setAssessment(a); else setError(t('w13Sec.loadError'))
    if (c) setControls(c.controls)
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const handleReassess = async () => {
    setBusy(true)
    try {
      const res = await complianceAssessmentApi.reassess()
      if (res.success && res.data) { setAssessment(res.data); message.success(t('w13Sec.cp.reassessed')) }
      else message.error(t('w13Sec.loadError'))
    } finally { setBusy(false) }
  }

  const controlColumns: ColumnsType<ControlEvaluationDto> = [
    { title: t('w13Sec.cp.col.id'), dataIndex: 'id', width: 90, render: (v: string) => <Text code>{v}</Text> },
    { title: t('w13Sec.cp.col.domain'), dataIndex: 'domainName', width: 120 },
    { title: t('w13Sec.cp.col.name'), dataIndex: 'name', ellipsis: true },
    { title: t('w13Sec.cp.col.level'), dataIndex: 'level', width: 70, render: (v: string) => <Tag>{v}</Tag> },
    { title: t('w13Sec.cp.col.required'), dataIndex: 'required', width: 70, render: (v: boolean) => v ? <Tag color="blue">{t('w13Sec.cp.required')}</Tag> : <Tag>{t('w13Sec.cp.optional')}</Tag> },
    { title: t('w13Sec.cp.col.score'), dataIndex: 'score', width: 90, sorter: (a, b) => a.score - b.score, render: (v: number) => <Progress percent={v} size="small" status={v >= 90 ? 'success' : v >= 60 ? 'normal' : 'exception'} format={() => `${v}`} /> },
    { title: t('w13Sec.cp.col.status'), dataIndex: 'implemented', width: 90, render: (v: boolean) => v ? <Tag color="green">{t('w13Sec.cp.status.implemented')}</Tag> : <Tag color="gold">{t('w13Sec.cp.status.gap')}</Tag> },
    { title: t('w13Sec.cp.col.evidence'), dataIndex: 'evidence', ellipsis: true },
  ]

  if (loading) return <LoadingBanner />
  if (!assessment) return <>{error && <ErrorBanner message={error} />}</>

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {error && <ErrorBanner message={error} />}
      <Card size="small" extra={<Button size="small" icon={<RefreshCw size={12} />} loading={busy} onClick={() => void handleReassess()}>{t('w13Sec.cp.reassess')}</Button>}>
        <Row gutter={16} align="middle">
          <Col span={5}><Statistic title={t('w13Sec.cp.overallScore')} value={assessment.overallScore} suffix="/100" valueStyle={{ color: LEVEL_COLOR[assessment.level] }} /></Col>
          <Col span={5}><Statistic title={t('w13Sec.cp.compliance')} value={assessment.overallCompliance} suffix="%" /></Col>
          <Col span={4}><Statistic title={t('w13Sec.cp.level')} value={assessment.level} valueStyle={{ color: LEVEL_COLOR[assessment.level] }} /></Col>
          <Col span={5}><Statistic title={t('w13Sec.cp.controls')} value={assessment.totals.controls} /></Col>
          <Col span={5}><Statistic title={t('w13Sec.cp.gaps')} value={assessment.totals.gaps} valueStyle={{ color: assessment.totals.gaps > 0 ? 'var(--color-warning-600)' : 'var(--color-success-600)' }} prefix={<AlertTriangle size={16} />} /></Col>
        </Row>
        <Paragraph type="secondary" style={{ marginTop: 'var(--space-2, 8px)', marginBottom: 0, fontSize: 12 }}>{t('w13Sec.cp.standard')}: {assessment.standard} · v{assessment.version}</Paragraph>
      </Card>

      <Card size="small" title={t('w13Sec.cp.domainScores')}>
        <Row gutter={[16, 16]}>
          {assessment.domains.map((d) => (
            <Col span={8} key={d.domain}>
              <div style={{ marginBottom: 'var(--space-1, 4px)', display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>{d.domainName}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{d.implementedCount}/{d.controlCount} · {d.averageScore}</Text>
              </div>
              <Progress percent={d.averageScore} strokeColor={d.averageScore >= 90 ? 'var(--color-success-600)' : d.averageScore >= 70 ? 'var(--color-info-600)' : 'var(--color-warning-600)'} />
            </Col>
          ))}
        </Row>
      </Card>

      <Card size="small" title={t('w13Sec.cp.gapList')}>
        {assessment.gaps.length === 0 ? <Text type="secondary">{t('w13Sec.cp.noGaps')}</Text> : (
          <List
            size="small"
            dataSource={assessment.gaps}
            renderItem={(g) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Tag color={g.priority === 'high' ? 'red' : g.priority === 'medium' ? 'gold' : 'default'}>{t(`w13Sec.cp.priority.${g.priority}`)}</Tag>}
                  title={<Space><Text code>{g.id}</Text><span>{g.name}</span><Tag>{g.domainName}</Tag></Space>}
                  description={<span style={{ fontSize: 12 }}>{g.gap} → <Text type="success">{g.remediation}</Text></span>}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Card size="small" title={t('w13Sec.cp.controlList')}>
        <DataTable<ControlEvaluationDto> rowKey="id" dataSource={controls} columns={controlColumns} pagination={{ pageSize: 10, hideOnSinglePage: true }} />
      </Card>
    </Space>
  )
}

// ─────────────────────────────────────────────────────────────
// 灾难恢复 Tab
// ─────────────────────────────────────────────────────────────
const DrTab: React.FC = () => {
  const [status, setStatus] = useState<DrStatusDto | null>(null)
  const [backupSets, setBackupSets] = useState<BackupSetDto[]>([])
  const [restorePoints, setRestorePoints] = useState<RestorePointDto[]>([])
  const [drills, setDrills] = useState<DrillRecordDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rpo, setRpo] = useState<number>(15)
  const [rto, setRto] = useState<number>(30)
  const [lastDrill, setLastDrill] = useState<DrillRecordDto | null>(null)
  // [G005 W4B] 演练详情 (GET /security/dr/drills/:id)
  const [drillDetail, setDrillDetail] = useState<DrillRecordDto | null>(null)
  const [drillDetailOpen, setDrillDetailOpen] = useState(false)
  const [drillDetailLoading, setDrillDetailLoading] = useState(false)

  const openDrillDetail = async (id: string) => {
    setDrillDetailOpen(true)
    setDrillDetail(null)
    setDrillDetailLoading(true)
    try {
      const res = await drApi.getDrill(id)
      if (res.success && res.data) setDrillDetail(res.data)
      else message.error(t('w4b.dr.loadFailed'))
    } catch {
      message.error(t('w4b.dr.loadFailed'))
    } finally {
      setDrillDetailLoading(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [st, bs, rp, dr] = await Promise.all([
      unwrap<DrStatusDto>(drApi.status()),
      unwrap<EnvelopeList<BackupSetDto>>(drApi.listBackupSets()),
      unwrap<EnvelopeList<RestorePointDto>>(drApi.listRestorePoints()),
      unwrap<EnvelopeList<DrillRecordDto>>(drApi.listDrills()),
    ])
    if (st) { setStatus(st); setRpo(st.config.rpoMinutes); setRto(st.config.rtoMinutes) } else setError(t('w13Sec.loadError'))
    if (bs) setBackupSets(bs.data ?? [])
    if (rp) setRestorePoints(rp.data ?? [])
    if (dr) setDrills(dr.data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const handleCreateBackup = async () => {
    setBusy(true)
    try {
      const res = await drApi.createBackupSet({ type: 'incremental' })
      if (res.success && res.data) { message.success(t('w13Sec.dr.created', { id: res.data.id })); await load() }
      else message.error(t('w13Sec.loadError'))
    } finally { setBusy(false) }
  }
  const handleDrill = async () => {
    setBusy(true)
    try {
      const res = await drApi.drill({ scenario: 'site-failover', executedBy: '安全管理员' })
      if (res.success && res.data) { setLastDrill(res.data); message.success(t('w13Sec.dr.drillDone', { result: t(`w13Sec.dr.drillResult.${res.data.result}`) })); await load() }
      else message.error(t('w13Sec.loadError'))
    } finally { setBusy(false) }
  }
  const handleFailover = async (mode: 'dry-run' | 'live') => {
    setBusy(true)
    try {
      const res = await drApi.failover({ mode })
      if (res.success && res.data) message.success(t('w13Sec.dr.failoverDone', { mode }))
      else message.error(t('w13Sec.loadError'))
    } finally { setBusy(false) }
  }
  const handleRestore = async (id: string) => {
    const res = await drApi.restore(id)
    if (res.success && res.data?.restored) message.success(t('w13Sec.dr.restored', { id }))
    else message.error(t('w13Sec.loadError'))
  }
  const handleSaveConfig = async () => {
    const res = await drApi.updateConfig({ rpoMinutes: rpo, rtoMinutes: rto })
    if (res.success) { message.success(t('w13Sec.dr.saved')); await load() } else message.error(t('w13Sec.loadError'))
  }

  const backupColumns: ColumnsType<BackupSetDto> = [
    { title: 'ID', dataIndex: 'id', width: 90, render: (v: string) => <Text code>{v}</Text> },
    { title: t('w13Sec.dr.col.type'), dataIndex: 'type', width: 90, render: (v: string) => <Tag color={v === 'full' ? 'blue' : 'cyan'}>{v === 'full' ? t('w13Sec.dr.full') : t('w13Sec.dr.incremental')}</Tag> },
    { title: t('w13Sec.dr.col.size'), dataIndex: 'sizeBytes', width: 110, render: (v: number) => `${(v / 1024 / 1024).toFixed(1)} MB` },
    { title: t('w13Sec.dr.col.location'), dataIndex: 'location', width: 130 },
    { title: t('w13Sec.dr.col.createdAt'), dataIndex: 'createdAt', width: 160, render: (v: string) => v?.slice(0, 19).replace('T', ' ') },
    { title: t('w13Sec.dr.col.status'), dataIndex: 'status', width: 90, render: (v: string) => <Tag color={STATUS_COLOR[v]}>{v}</Tag> },
  ]
  const rpColumns: ColumnsType<RestorePointDto> = [
    { title: t('w13Sec.dr.col.label'), dataIndex: 'label', ellipsis: true },
    { title: t('w13Sec.dr.col.age'), dataIndex: 'ageMinutes', width: 100, render: (v: number) => `${v} min` },
    { title: t('w13Sec.dr.col.rpoOk'), dataIndex: 'rpoCompliant', width: 90, render: (v: boolean) => v ? <Tag color="green">{t('w13Sec.dr.compliant')}</Tag> : <Tag color="red">{t('w13Sec.dr.nonCompliant')}</Tag> },
    { title: t('w13Sec.ca.col.actions'), key: 'a', width: 90, render: (_v, r) => <Button size="small" icon={<PlayCircle size={12} />} onClick={() => void handleRestore(r.id)}>{t('w13Sec.dr.restore')}</Button> },
  ]
  const drillColumns: ColumnsType<DrillRecordDto> = [
    { title: 'ID', dataIndex: 'id', width: 90, render: (v: string) => <Text code>{v}</Text> },
    { title: t('w13Sec.dr.col.scenario'), dataIndex: 'scenario', width: 150 },
    { title: t('w13Sec.dr.col.result'), dataIndex: 'result', width: 90, render: (v: string) => <Tag color={DRILL_COLOR[v]}>{t(`w13Sec.dr.drillResult.${v}`)}</Tag> },
    { title: t('w13Sec.dr.col.rto'), key: 'rto', width: 110, render: (_v, r) => `${r.rtoActualMin}/${r.rtoTargetMin} min` },
    { title: t('w13Sec.dr.col.rpo'), key: 'rpo', width: 110, render: (_v, r) => `${r.rpoActualMin}/${r.rpoTargetMin} min` },
    { title: t('w13Sec.dr.col.at'), dataIndex: 'finishedAt', width: 160, render: (v: string) => v?.slice(0, 19).replace('T', ' ') },
    // [G005 W4B] 演练详情 (GET /security/dr/drills/:id)
    { title: t('w13Sec.ca.col.actions'), key: 'detail', width: 90, render: (_v, r) => <Button size="small" icon={<PlayCircle size={12} />} onClick={() => void openDrillDetail(r.id)}>{t('w4b.dr.detailTitle')}</Button> },
  ]

  if (loading) return <LoadingBanner />
  if (!status) return <>{error && <ErrorBanner message={error} />}</>

  const StepIcon: React.FC<{ status: string }> = ({ status: s }) => s === 'ok' ? <CheckCircle2 size={14} color="var(--color-success-600)" /> : s === 'warn' ? <AlertTriangle size={14} color="var(--color-warning-600)" /> : <XCircle size={14} color="var(--color-error-600)" />

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {error && <ErrorBanner message={error} />}
      <StatCardGrid minWidth={200} gap={16}>
        <StatCard title={t('w13Sec.dr.rpo')} value={status.rpo.targetMinutes} suffix="min" />
        <StatCard title={t('w13Sec.dr.rto')} value={status.rto.targetMinutes} suffix="min" />
        <StatCard title={t('w13Sec.dr.rpoActual')} value={status.rpo.actualMinutes ?? '-'} suffix="min" color={status.rpo.compliant ? 'success' : 'error'} />
        <StatCard title={t('w13Sec.dr.rtoActual')} value={status.rto.lastActualMinutes ?? '-'} suffix="min" color={status.rto.compliant ? 'success' : 'warning'} />
        <StatCard title={t('w13Sec.dr.restorePoints')} value={status.restorePoints.total} icon={<DatabaseBackup size={16} />} />
        <StatCard title={t('w13Sec.dr.passRate')} value={status.drills.passRate} suffix="%" color={status.drills.passRate >= 80 ? 'success' : 'warning'} />
      </StatCardGrid>

      <Card size="small" title={<span><DatabaseBackup size={14} /> {t('w13Sec.dr.title')}</span>}
        extra={<Space>
          <Button size="small" icon={<Plus size={12} />} loading={busy} onClick={() => void handleCreateBackup()}>{t('w13Sec.dr.createBackup')}</Button>
          <Button size="small" type="primary" icon={<PlayCircle size={12} />} loading={busy} onClick={() => void handleDrill()}>{t('w13Sec.dr.runDrill')}</Button>
          <Button size="small" onClick={() => void handleFailover('dry-run')}>{t('w13Sec.dr.dryRun')}</Button>
          <Button size="small" danger onClick={() => void handleFailover('live')}>{t('w13Sec.dr.live')}</Button>
        </Space>}>
        <Row gutter={16}>
          <Col span={8}>
            <Descriptions size="small" column={1} title={t('w13Sec.dr.config')}>
              <Descriptions.Item label="RPO (min)"><InputNumber size="small" min={1} max={1440} value={rpo} onChange={(v) => setRpo(v ?? 15)} /></Descriptions.Item>
              <Descriptions.Item label="RTO (min)"><InputNumber size="small" min={1} max={1440} value={rto} onChange={(v) => setRto(v ?? 30)} /></Descriptions.Item>
              <Descriptions.Item label={t('w13Sec.dr.offsite')}>{status.backup.offsite ? <Tag color="green">{t('w13Sec.dr.compliant')}</Tag> : <Tag color="red">{t('w13Sec.dr.nonCompliant')}</Tag>}</Descriptions.Item>
              <Descriptions.Item label={t('w13Sec.dr.lastBackup')}>{status.backup.lastBackupAt?.slice(0, 19).replace('T', ' ') ?? '-'}</Descriptions.Item>
              <Descriptions.Item label=""><Button size="small" type="primary" onClick={() => void handleSaveConfig()}>{t('w13Sec.dr.saveConfig')}</Button></Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={16}>
            <Card size="small" title={t('w13Sec.dr.steps')} style={{ marginBottom: 'var(--space-3, 12px)' }}>
              {lastDrill ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {lastDrill.steps.map((s) => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', fontSize: 12 }}>
                      <StepIcon status={s.status} />
                      <span style={{ width: 150 }}>{s.name}</span>
                      <Text type="secondary" style={{ flex: 1 }}>{s.detail}</Text>
                      <Text type="secondary">{s.durationSec}s</Text>
                    </div>
                  ))}
                </Space>
              ) : <Text type="secondary" style={{ fontSize: 12 }}>{status.drills.lastResult ? `${t('w13Sec.dr.lastDrill')}: ${t(`w13Sec.dr.drillResult.${status.drills.lastResult}`)}` : '-'}</Text>}
            </Card>
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        <Col span={14}>
          <Card size="small" title={t('w13Sec.dr.backupSets')}>
            <DataTable<BackupSetDto> rowKey="id" dataSource={backupSets} columns={backupColumns} pagination={{ pageSize: 5, hideOnSinglePage: true }} />
          </Card>
        </Col>
        <Col span={10}>
          <Card size="small" title={t('w13Sec.dr.restorePointsTable')}>
            <DataTable<RestorePointDto> rowKey="id" dataSource={restorePoints} columns={rpColumns} pagination={{ pageSize: 5, hideOnSinglePage: true }} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={t('w13Sec.dr.drills')}>
        <DataTable<DrillRecordDto> rowKey="id" dataSource={drills} columns={drillColumns} pagination={{ pageSize: 5, hideOnSinglePage: true }} />
      </Card>

      {/* [G005 W4B] 演练详情抽屉 (GET /security/dr/drills/:id) */}
      <Drawer
        title={<span><PlayCircle size={14} /> {t('w4b.dr.detailTitle')} - {drillDetail?.id ?? ''}</span>}
        open={drillDetailOpen}
        onClose={() => setDrillDetailOpen(false)}
        width={640}
      >
        {drillDetailLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-10, 40px)' }}><Spin /></div>
        ) : drillDetail ? (
          <>
            <Descriptions size="small" column={2} bordered style={{ marginBottom: 'var(--space-4, 16px)' }}>
              <Descriptions.Item label={t('w13Sec.cp.col.id')}><Text code>{drillDetail.id}</Text></Descriptions.Item>
              <Descriptions.Item label={t('w4b.dr.scenario')}>{drillDetail.scenario}</Descriptions.Item>
              <Descriptions.Item label={t('w13Sec.dr.col.result')}><Tag color={DRILL_COLOR[drillDetail.result]}>{t(`w13Sec.dr.drillResult.${drillDetail.result}`)}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('w4b.dr.executedBy')}>{drillDetail.executedBy ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('w13Sec.dr.col.rto')}>{`${drillDetail.rtoActualMin}/${drillDetail.rtoTargetMin} min`}</Descriptions.Item>
              <Descriptions.Item label={t('w13Sec.dr.col.rpo')}>{`${drillDetail.rpoActualMin}/${drillDetail.rpoTargetMin} min`}</Descriptions.Item>
              <Descriptions.Item label={t('w13Sec.dr.col.at')} span={2}>{drillDetail.finishedAt?.slice(0, 19).replace('T', ' ')}</Descriptions.Item>
            </Descriptions>
            <DataTable
              rowKey="name"
              pagination={false}
              dataSource={drillDetail.steps}
              columns={[
                { title: t('w4b.dr.thStep'), dataIndex: 'name', width: 180 },
                {
                  title: t('w4b.dr.thStepStatus'), dataIndex: 'status', width: 90,
                  render: (s: string) => s === 'ok' ? <Tag color="green">{t('w13Sec.cp.status.implemented')}</Tag> : s === 'warn' ? <Tag color="gold">WARN</Tag> : <Tag color="red">FAIL</Tag>,
                },
                { title: t('w4b.dr.thDuration'), dataIndex: 'durationSec', width: 90, render: (v: number) => `${v}s` },
                { title: t('w4b.dr.thDetail'), dataIndex: 'detail' },
              ]}
            />
          </>
        ) : (
          <Text type="secondary">{t('w4b.dr.loadFailed')}</Text>
        )}
      </Drawer>
    </Space>
  )
}

// ─────────────────────────────────────────────────────────────
// 审计链校验 Tab
// ─────────────────────────────────────────────────────────────
const AuditChainTab: React.FC = () => {
  const [verification, setVerification] = useState<AuditChainVerificationDto | null>(null)
  const [retention, setRetention] = useState<RetentionPolicyDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [v, r] = await Promise.all([unwrap<AuditChainVerificationDto>(auditChainApi.verify()), unwrap<RetentionPolicyDto>(auditChainApi.retention())])
    if (v) setVerification(v); else setError(t('w13Sec.loadError'))
    if (r) setRetention(r)
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const handleColdArchive = async () => {
    setBusy(true)
    try {
      const res = await auditChainApi.coldArchive({ executedBy: '安全管理员' })
      if (res.success && res.data) { message.success(t('w13Sec.ac.archived', { id: res.data.archiveId })); await load() }
      else message.error(t('w13Sec.loadError'))
    } finally { setBusy(false) }
  }

  const sampleColumns: ColumnsType<AuditChainVerificationDto['sample'][number]> = [
    { title: t('w13Sec.ac.col.index'), dataIndex: 'index', width: 70 },
    { title: t('w13Sec.ac.col.action'), dataIndex: 'action', width: 150, render: (v: string) => <Tag>{v}</Tag> },
    { title: t('w13Sec.ac.col.resource'), dataIndex: 'resource', width: 150 },
    { title: t('w13Sec.ac.col.hash'), dataIndex: 'hash', ellipsis: true, render: (v: string) => <Text code style={{ fontSize: 11 }}>{v.slice(0, 32)}…</Text> },
    { title: t('w13Sec.ac.col.prevHash'), dataIndex: 'prevHash', ellipsis: true, render: (v: string) => <Text code style={{ fontSize: 11 }}>{v.slice(0, 32)}…</Text> },
    { title: t('w13Sec.ac.col.createdAt'), dataIndex: 'createdAt', width: 160, render: (v: string) => v?.slice(0, 19).replace('T', ' ') },
  ]

  if (loading) return <LoadingBanner />

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {error && <ErrorBanner message={error} />}
      {verification && (
        <Card size="small" title={<span><Link2 size={14} /> {t('w13Sec.ac.title')}</span>} extra={<Button size="small" type="primary" icon={<FileCheck2 size={12} />} onClick={() => void load()}>{t('w13Sec.ac.verify')}</Button>}>
          <Alert
            type={verification.verified ? 'success' : 'error'}
            showIcon
            icon={verification.verified ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            message={verification.verified ? t('w13Sec.ac.verified') : t('w13Sec.ac.broken', { index: verification.brokenAt ?? 0 })}
            description={verification.reason ?? undefined}
          />
          <Row gutter={16} style={{ marginTop: 'var(--space-3, 12px)' }}>
            <Col span={6}><Statistic title={t('w13Sec.ac.blocks')} value={verification.totalBlocks} /></Col>
            <Col span={6}><Statistic title={t('w13Sec.ac.checked')} value={verification.checkedBlocks} /></Col>
            <Col span={6}><Statistic title={t('w13Sec.ac.source')} value={t(`w13Sec.ac.source.${verification.source}`)} /></Col>
            <Col span={6}><Card size="small"><Text type="secondary" style={{ fontSize: 12 }}>{t('w13Sec.ac.headHash')}</Text><div><Text code style={{ fontSize: 11, wordBreak: 'break-all' }}>{verification.headHash.slice(0, 24)}…</Text></div></Card></Col>
          </Row>
        </Card>
      )}

      {retention && (
        <Card size="small" title={t('w13Sec.ac.retention')} extra={<Button size="small" type="primary" loading={busy} icon={<DatabaseBackup size={12} />} onClick={() => void handleColdArchive()}>{t('w13Sec.ac.coldArchive')}</Button>}>
          <Descriptions size="small" column={3}>
            <Descriptions.Item label={t('w13Sec.ac.retentionMonths')}>{retention.retentionMonths}</Descriptions.Item>
            <Descriptions.Item label={t('w13Sec.ac.retentionDays')}>{retention.retentionDays}</Descriptions.Item>
            <Descriptions.Item label={t('w13Sec.ac.archiveLocation')}><Text code style={{ fontSize: 12 }}>{retention.archiveLocation}</Text></Descriptions.Item>
            <Descriptions.Item label={t('w13Sec.ac.encrypted')}>{retention.encrypted ? <Tag color="green"></Tag> : <Tag></Tag>}</Descriptions.Item>
            <Descriptions.Item label={t('w13Sec.ac.immutable')}>{retention.immutable ? <Tag color="green"></Tag> : <Tag></Tag>}</Descriptions.Item>
            <Descriptions.Item label={t('w13Sec.ac.lastArchive')}>{retention.lastArchiveAt?.slice(0, 19).replace('T', ' ') ?? '-'}</Descriptions.Item>
          </Descriptions>
          <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>{retention.note}</Paragraph>
        </Card>
      )}

      {verification && (
        <Card size="small" title={t('w13Sec.ac.sample')}>
          <DataTable rowKey="index" pagination={false} dataSource={verification.sample} columns={sampleColumns} />
        </Card>
      )}
    </Space>
  )
}

// ─────────────────────────────────────────────────────────────
export const SecurityComplianceCenterPage: React.FC = () => {
  const [tab, setTab] = useState('ca')
  return (
    <div data-testid="security-compliance-center-page" style={{ padding: 'var(--space-5, 20px)', maxWidth: 1500, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-1, 4px)' }}>
        <ShieldCheck size={22} color="var(--color-info-600)" />
        <Typography.Title level={4} style={{ margin: 0 }}>{t('w13Sec.title')}</Typography.Title>
        <Tag color="cyan">{t('w13Sec.badge')}</Tag>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 'var(--space-4, 16px)' }}>{t('w13Sec.subtitle')}</p>
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'ca', label: <span><KeyRound size={14} /> {t('w13Sec.tab.ca')}</span>, children: <CaTab /> },
        { key: 'field', label: <span><Lock size={14} /> {t('w13Sec.tab.fieldEncryption')}</span>, children: <FieldEncryptionTab /> },
        { key: 'compliance', label: <span><FileCheck2 size={14} /> {t('w13Sec.tab.compliance')}</span>, children: <ComplianceTab /> },
        { key: 'dr', label: <span><DatabaseBackup size={14} /> {t('w13Sec.tab.dr')}</span>, children: <DrTab /> },
        { key: 'audit', label: <span><Link2 size={14} /> {t('w13Sec.tab.auditChain')}</span>, children: <AuditChainTab /> },
      ]} />
    </div>
  )
}

export default SecurityComplianceCenterPage
