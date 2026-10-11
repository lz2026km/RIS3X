// [G005 W8-Report] 签名与证书中心 — 证书注册表 / CRL / 报告验签
// 数据源: certificateApi (后端 /report-signing/*, MSW 确定性回退)
import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  message,
  Modal,
  Row,
  Col,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from 'antd/es/table'
import { ShieldCheck, Ban, RefreshCw, BadgeCheck, FileSearch, History, KeyRound, PenTool, RotateCw, Search } from 'lucide-react'
import { certificateApi, type CrlViewDto, type SignatureStatsDto } from '../../services/api/certificateApi'
import { hsmApi, ocspApi, raApi, type ManagedKeyDto, type OcspResponseDto, type RotationEventDto } from '../../services/api/w13SecurityApi'
import type { ReportCertificateDto, ReportSignatureVerificationDto } from '../../services/api/reportApi'
import { LoadingBanner, ErrorBanner } from '../../components/feedback'
import { DataTable, StatCard, StatCardGrid } from "../../components/common"
import { t } from '../../i18n/appI18n'
import { severityToAntd } from '../../theme/statusTokens'
import { PageContainer } from "../../components/common";

const { Text } = Typography

const STATUS_COLOR: Record<string, string> = { valid: severityToAntd('success'), revoked: severityToAntd('critical') }

// [G005 W-D6] HSM 密钥状态 / 算法着色 (与 statusTokens 语义一致)
const KEY_STATUS_COLOR: Record<string, string> = {
  active: severityToAntd('success'),
  retired: severityToAntd('neutral'),
  compromised: severityToAntd('critical'),
}
const ALGO_COLOR = (algorithm: string) => (algorithm.toUpperCase().startsWith('SM') ? 'purple' : 'blue')

const AlgorithmTag: React.FC<{ algorithm: string }> = ({ algorithm }) => (
  <Tag color={algorithm === 'SM3' ? 'purple' : 'blue'}>{algorithm}</Tag>
)

export const CertificateCenterPage: React.FC = () => {
  const [certs, setCerts] = useState<ReportCertificateDto[]>([])
  const [stats, setStats] = useState<SignatureStatsDto | null>(null)
  const [crl, setCrl] = useState<CrlViewDto | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'revoked'>('all')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ReportCertificateDto | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revoking, setRevoking] = useState(false)

  const [verifyReportId, setVerifyReportId] = useState('RPT-000001')
  const [verifyResult, setVerifyResult] = useState<ReportSignatureVerificationDto | null>(null)
  const [verifying, setVerifying] = useState(false)

  // [G005 W13-Security] OCSP 在线状态查询 + HSM 密钥轮换
  const [ocspSerial, setOcspSerial] = useState('')
  const [ocspResult, setOcspResult] = useState<OcspResponseDto | null>(null)
  const [ocspLoading, setOcspLoading] = useState(false)
  const [activeKeyId, setActiveKeyId] = useState<string | null>(null)
  const [rotating, setRotating] = useState(false)

  // [G005 W-D6] HSM 密钥清单 / 轮换历史 / 签名验签试验台 / 证书续期
  const [hsmKeys, setHsmKeys] = useState<ManagedKeyDto[]>([])
  const [rotations, setRotations] = useState<RotationEventDto[]>([])
  const [signKeyId, setSignKeyId] = useState<string | undefined>(undefined)
  const [signData, setSignData] = useState('G005 RIS 报告签名演示数据')
  const [signResult, setSignResult] = useState<{ signature: string; algorithm: string; keyId: string } | null>(null)
  const [hsmVerifyValid, setHsmVerifyValid] = useState<boolean | null>(null)
  const [signing, setSigning] = useState(false)
  const [hsmVerifying, setHsmVerifying] = useState(false)
  const [renewingSerial, setRenewingSerial] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [certRes, statsRes, crlRes, keyRes, rotRes] = await Promise.all([
        certificateApi.listCertificates({ status: statusFilter === 'all' ? undefined : statusFilter, keyword: keyword || undefined }),
        certificateApi.getSignatureStats(),
        certificateApi.getCrl(),
        hsmApi.keys(),
        hsmApi.rotations(),
      ])
      if (certRes.success && certRes.data) setCerts(certRes.data.data)
      else setError(t('w8Report.loadError'))
      if (statsRes.success && statsRes.data) setStats(statsRes.data)
      if (crlRes.success && crlRes.data) setCrl(crlRes.data)
      if (keyRes.success && keyRes.data) {
        const keys = keyRes.data.data ?? []
        setHsmKeys(keys)
        const active = keys.find((k) => k.status === 'active')?.keyId ?? keys[0]?.keyId ?? null
        setActiveKeyId(active)
        setSignKeyId((prev) => prev ?? active ?? undefined)
      }
      if (rotRes.success && rotRes.data) setRotations(rotRes.data.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('w8Report.loadError'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, keyword])

  useEffect(() => { void load() }, [load])

  const handleRevoke = async () => {
    if (!revokeTarget) return
    if (!revokeReason.trim()) { message.warning(t('w8Report.revokeReasonRequired')); return }
    setRevoking(true)
    try {
      const res = await certificateApi.revokeCertificate(revokeTarget.serial, revokeReason.trim())
      if (res.success) {
        message.success(t('w8Report.revokeSuccess', { serial: revokeTarget.serial }))
        setRevokeTarget(null)
        setRevokeReason('')
        await load()
      } else {
        message.error(res.error?.message ?? t('w8Report.revokeFail'))
      }
    } catch {
      message.error(t('w8Report.revokeFail'))
    } finally {
      setRevoking(false)
    }
  }

  // [G005 W13-Security] OCSP 查询
  const handleOcsp = async () => {
    if (!ocspSerial.trim()) return
    setOcspLoading(true)
    try {
      const res = await ocspApi.query(ocspSerial.trim())
      if (res.success && res.data) setOcspResult(res.data)
      else message.error(t('w8Report.loadError'))
    } catch {
      message.error(t('w8Report.loadError'))
    } finally {
      setOcspLoading(false)
    }
  }

  // [G005 W13-Security] HSM 密钥轮换
  const handleRotate = async () => {
    setRotating(true)
    try {
      const res = await hsmApi.rotate({ reason: 'ui-rotation' })
      if (res.success && res.data) { message.success(t('w13Sec.ca.hsm.rotated', { keyId: res.data.key.keyId })); await load() }
      else message.error(t('w8Report.loadError'))
    } catch {
      message.error(t('w8Report.loadError'))
    } finally {
      setRotating(false)
    }
  }

  // [G005 W-D6] 证书续期 (POST /security/ra/certificates/:serial/renew)
  const handleRenew = async (serial: string) => {
    setRenewingSerial(serial)
    try {
      const res = await raApi.renew(serial)
      if (res.success && res.data) {
        message.success(t('common.operationSuccess'))
        await load()
      } else {
        message.error(res.error?.message ?? t('w13Sec.ca.requestFailed'))
      }
    } catch {
      message.error(t('w13Sec.ca.requestFailed'))
    } finally {
      setRenewingSerial(null)
    }
  }

  // [G005 W-D6] HSM 签名 (POST /security/hsm/sign)
  const handleSign = async () => {
    if (!signData.trim()) return
    setSigning(true)
    try {
      const res = await hsmApi.sign(signData.trim(), signKeyId)
      if (res.success && res.data) {
        setSignResult(res.data)
        setHsmVerifyValid(null)
        message.success(t('common.operationSuccess'))
      } else {
        message.error(res.error?.message ?? t('w8Report.loadError'))
      }
    } catch {
      message.error(t('w8Report.loadError'))
    } finally {
      setSigning(false)
    }
  }

  // [G005 W-D6] HSM 验签 (POST /security/hsm/verify)
  const handleVerifyHsm = async () => {
    if (!signResult) return
    setHsmVerifying(true)
    try {
      const res = await hsmApi.verify(signData.trim(), signResult.signature, signResult.keyId)
      if (res.success && res.data) setHsmVerifyValid(res.data.valid)
      else message.error(t('w8Report.verifyFail'))
    } catch {
      message.error(t('w8Report.verifyFail'))
    } finally {
      setHsmVerifying(false)
    }
  }

  const handleVerify = async () => {
    if (!verifyReportId.trim()) return
    setVerifying(true)
    try {
      const res = await certificateApi.verify(verifyReportId.trim())
      if (res.success && res.data) setVerifyResult(res.data)
      else message.error(t('w8Report.verifyFail'))
    } catch {
      message.error(t('w8Report.verifyFail'))
    } finally {
      setVerifying(false)
    }
  }

  const columns: ColumnsType<ReportCertificateDto> = [
    {
      title: t('w8Report.col.serial'), dataIndex: 'serial', key: 'serial', width: 180,
      render: (serial: string) => <Text code style={{ fontSize: 12 }}>{serial}</Text>,
    },
    { title: t('w8Report.col.subject'), dataIndex: 'subject', key: 'subject', ellipsis: true },
    { title: t('w8Report.col.algorithm'), dataIndex: 'algorithm', key: 'algorithm', width: 100, render: (a: string) => <AlgorithmTag algorithm={a} /> },
    {
      title: t('w8Report.col.validity'), key: 'validity', width: 220,
      render: (_: unknown, r) => (
        <div style={{ fontSize: 12 }}>
          <div>{r.notBefore.slice(0, 10)} ~ {r.notAfter.slice(0, 10)}</div>
          {r.revokedAt && <div style={{ color: 'var(--color-error-600)' }}>{t('w8Report.revokedAt')}: {r.revokedAt.slice(0, 10)} · {r.revocationReason}</div>}
        </div>
      ),
    },
    {
      title: t('w8Report.col.status'), dataIndex: 'status', key: 'status', width: 90,
      render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s === 'valid' ? t('w8Report.statusValid') : t('w8Report.statusRevoked')}</Tag>,
    },
    {
      title: t('w8Report.col.actions'), key: 'actions', width: 210,
      render: (_: unknown, r) => (
        <Space size={4}>
          <Button size="small" loading={renewingSerial === r.serial} disabled={r.status === 'revoked'} icon={<RefreshCw size={12} />} onClick={() => void handleRenew(r.serial)}>
            {t('w13Sec.ca.renew')}
          </Button>
          <Button size="small" danger icon={<Ban size={12} />} disabled={r.status === 'revoked'} onClick={() => setRevokeTarget(r)}>
            {t('w8Report.revoke')}
          </Button>
        </Space>
      ),
    },
  ]

  // [G005 W-D6] HSM 托管密钥清单 (GET /security/hsm/keys)
  const hsmKeyColumns: ColumnsType<ManagedKeyDto> = [
    {
      title: t('w13Sec.ca.hsm.col.keyId'), dataIndex: 'keyId', key: 'keyId', width: 190,
      render: (keyId: string, r) => (
        <Space size={4}>
          <Text code style={{ fontSize: 12 }}>{keyId}</Text>
          {r.status === 'active' && keyId === activeKeyId && <Tag color="blue">{t('w13Sec.ca.hsm.activeKey')}</Tag>}
        </Space>
      ),
    },
    { title: t('w13Sec.ca.hsm.col.algorithm'), dataIndex: 'algorithm', key: 'algorithm', width: 110, render: (a: string) => <Tag color={ALGO_COLOR(a)}>{a}</Tag> },
    { title: t('w13Sec.ca.hsm.col.provider'), dataIndex: 'provider', key: 'provider', width: 130 },
    { title: t('common.name'), dataIndex: 'label', key: 'label', width: 120 },
    {
      title: t('w13Sec.ca.hsm.col.status'), dataIndex: 'status', key: 'status', width: 110,
      render: (s: string) => <Tag color={KEY_STATUS_COLOR[s] ?? 'default'}>{s}</Tag>,
    },
    {
      title: t('w13Sec.ca.hsm.col.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 160,
      render: (v: string) => <span style={{ fontSize: 12 }}>{v?.slice(0, 19).replace('T', ' ') ?? '-'}</span>,
    },
  ]

  // [G005 W-D6] 密钥轮换历史 (GET /security/hsm/rotations)
  const rotationColumns: ColumnsType<RotationEventDto> = [
    { title: t('w13Sec.ca.hsm.col.algorithm'), dataIndex: 'algorithm', key: 'algorithm', width: 110, render: (a: string) => <Tag color={ALGO_COLOR(a)}>{a}</Tag> },
    { title: t('w13Sec.ca.hsm.col.provider'), dataIndex: 'provider', key: 'provider', width: 120 },
    {
      title: t('w13Sec.ca.hsm.col.keyId'), key: 'keys', width: 200,
      render: (_: unknown, r) => (
        <Space size={4}>
          <Text code style={{ fontSize: 11 }}>{r.fromKeyId ?? '-'}</Text>
          <span style={{ color: 'var(--text-secondary)' }}>→</span>
          <Text code style={{ fontSize: 11 }}>{r.toKeyId}</Text>
        </Space>
      ),
    },
    {
      title: t('w13Sec.dr.col.at'), dataIndex: 'at', key: 'at', width: 160,
      render: (v: string) => <span style={{ fontSize: 12 }}>{v?.slice(0, 19).replace('T', ' ') ?? '-'}</span>,
    },
    { title: t('w13Sec.ca.reason'), dataIndex: 'reason', key: 'reason', ellipsis: true },
  ]

  return (
    <PageContainer maxWidth="standard" padding="var(--space-5, 20px)" testId="certificate-center-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-4, 16px)' }}>
        <ShieldCheck size={22} color="var(--color-info-600)" />
        <Typography.Title level={4} style={{ margin: 0 }}>{t('w8Report.certCenterTitle')}</Typography.Title>
        <Tag color="cyan">{t('w8Report.certCenterBadge')}</Tag>
        <div style={{ flex: 1 }} />
        {activeKeyId && <Tag icon={<KeyRound size={12} />} color="blue">{activeKeyId}</Tag>}
        <Button size="small" icon={<RotateCw size={12} />} loading={rotating} onClick={() => void handleRotate()}>{t('w13Sec.ca.hsm.rotate')}</Button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -8, marginBottom: 'var(--space-4, 16px)' }}>{t('w8Report.certCenterSubtitle')}</p>

      {error && <ErrorBanner message={error} />}

      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('w8Report.stat.total')} value={stats?.total ?? 0} icon={<KeyRound size={16} />} />
        <StatCard title={t('w8Report.stat.valid')} value={stats?.valid ?? 0} color="success" icon={<BadgeCheck size={16} />} />
        <StatCard title={t('w8Report.stat.superseded')} value={stats?.superseded ?? 0} color="warning" icon={<RotateCw size={16} />} />
        <StatCard title={t('w8Report.stat.revoked')} value={stats?.revoked ?? 0} color="error" icon={<Ban size={16} />} />
      </StatCardGrid>

      <Row gutter={16}>
        <Col span={16}>
          <Card
            size="small"
            title={<span><KeyRound size={14} /> {t('w8Report.certList')}</span>}
            extra={
              <Space>
                <Select
                  size="small"
                  value={statusFilter}
                  style={{ width: 120 }}
                  onChange={(v) => setStatusFilter(v)}
                  options={[
                    { value: 'all', label: t('w8Report.filterAll') },
                    { value: 'valid', label: t('w8Report.statusValid') },
                    { value: 'revoked', label: t('w8Report.statusRevoked') },
                  ]}
                />
                <Input.Search size="small" placeholder={t('w8Report.searchPlaceholder')} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 180 }} />
                <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>{t('w8Report.refresh')}</Button>
              </Space>
            }
          >
            {loading ? <LoadingBanner /> : <DataTable<ReportCertificateDto> rowKey="serial" columns={columns} dataSource={certs} pagination={{ pageSize: 8, hideOnSinglePage: true }} />}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={<span><Ban size={14} /> {t('w8Report.crlTitle')}</span>} style={{ marginBottom: 'var(--space-4, 16px)' }}>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label={t('w8Report.crlIssuer')}>{crl?.issuer ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('w8Report.crlThisUpdate')}>{crl?.thisUpdate?.slice(0, 19).replace('T', ' ') ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('w8Report.crlEntryCount')}>{crl?.entryCount ?? 0}</Descriptions.Item>
            </Descriptions>
            {(crl?.entries ?? []).length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>{t('w8Report.crlEmpty')}</Text>}
            {(crl?.entries ?? []).map((e) => (
              <div key={e.serial} style={{ fontSize: 12, padding: '4px 0', borderTop: '1px solid var(--border-color)' }}>
                <Text code style={{ fontSize: 11 }}>{e.serial}</Text>
                <div style={{ color: 'var(--color-error-600)' }}>{e.reason} · {e.revocationDate.slice(0, 10)}</div>
              </div>
            ))}
          </Card>

          <Card size="small" title={<span><FileSearch size={14} /> {t('w8Report.verifyTitle')}</span>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input value={verifyReportId} onChange={(e) => setVerifyReportId(e.target.value)} placeholder={t('w8Report.verifyReportPlaceholder')} />
              <Button type="primary" size="small" loading={verifying} icon={<BadgeCheck size={12} />} onClick={() => void handleVerify()}>{t('w8Report.verify')}</Button>
              {verifyResult && (
                <Alert
                  type={verifyResult.valid ? 'success' : 'warning'}
                  showIcon
                  message={verifyResult.valid ? t('w8Report.verifyValid') : t('w8Report.verifyInvalid')}
                  description={
                    <div style={{ fontSize: 12 }}>
                      <div>{t('w8Report.verifyAlgorithm')}: {verifyResult.algorithm ?? '-'}</div>
                      <div>{t('w8Report.verifyDigest')}: <Text code style={{ fontSize: 11 }}>{(verifyResult.computedDigest ?? '').slice(0, 32)}…</Text></div>
                      <div>{t('w8Report.verifyCert')}: {verifyResult.certificate?.serial ?? '-'}</div>
                      {verifyResult.reasons.length > 0 && <div style={{ color: '#b45309' }}>{verifyResult.reasons.join('; ')}</div>}
                    </div>
                  }
                />
              )}
            </Space>
          </Card>

          {/* [G005 W13-Security] OCSP 在线状态查询 */}
          <Card size="small" title={<span><Search size={14} /> {t('w13Sec.ca.ocsp')}</span>} style={{ marginTop: 'var(--space-4, 16px)' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space.Compact style={{ width: '100%' }}>
                <Input value={ocspSerial} onChange={(e) => setOcspSerial(e.target.value)} placeholder={t('w13Sec.ca.ocspPlaceholder')} onPressEnter={() => void handleOcsp()} />
                <Button type="primary" loading={ocspLoading} onClick={() => void handleOcsp()}>{t('w13Sec.ca.ocspQuery')}</Button>
              </Space.Compact>
              {ocspResult && (
                <Alert
                  type={ocspResult.status === 'good' ? 'success' : ocspResult.status === 'revoked' ? 'error' : 'warning'}
                  showIcon
                  message={<Space size={4}><Tag color={ocspResult.status === 'good' ? 'green' : ocspResult.status === 'revoked' ? 'red' : 'default'}>{t(`w13Sec.ca.ocsp.${ocspResult.status}`)}</Tag><Text code style={{ fontSize: 11 }}>{ocspResult.serial}</Text></Space>}
                  description={<div style={{ fontSize: 12 }}>{t('w13Sec.ca.ocspProducedAt')}: {ocspResult.producedAt?.slice(0, 19).replace('T', ' ')}{ocspResult.responseSignature ? ` · ${t('w13Sec.ca.ocspSignature')}: ${ocspResult.responseSignature.slice(0, 16)}…` : ''}</div>}
                />
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* [G005 W-D6] HSM 密钥清单 + 轮换历史 (GET /security/hsm/keys + /security/hsm/rotations) */}
      <Row gutter={16} style={{ marginTop: 'var(--space-4, 16px)' }} data-testid="hsm-keys-panel">
        <Col span={14}>
          <Card
            size="small"
            title={<span><KeyRound size={14} /> {t('w13Sec.ca.hsm.keys')}</span>}
            extra={
              <Space>
                {activeKeyId && <Tag icon={<KeyRound size={12} />} color="blue">{activeKeyId}</Tag>}
                <Button size="small" icon={<RotateCw size={12} />} loading={rotating} onClick={() => void handleRotate()}>{t('w13Sec.ca.hsm.rotate')}</Button>
              </Space>
            }
          >
            <DataTable<ManagedKeyDto>
              rowKey="keyId"
              columns={hsmKeyColumns}
              dataSource={hsmKeys}
              loading={loading}
              pagination={{ pageSize: 5, hideOnSinglePage: true }}
              showExport={false}
              showDensity={false}
              emptyText={t('w9.states.empty')}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card size="small" title={<span><History size={14} /> {t('w13Sec.ca.hsm.rotate')} · {t('common.time')}</span>} data-testid="hsm-rotations-panel">
            <DataTable<RotationEventDto>
              rowKey="id"
              columns={rotationColumns}
              dataSource={rotations}
              loading={loading}
              pagination={{ pageSize: 5, hideOnSinglePage: true }}
              showExport={false}
              showDensity={false}
              emptyText={t('w9.states.empty')}
            />
          </Card>
        </Col>
      </Row>

      {/* [G005 W-D6] HSM 签名 / 验签试验台 (POST /security/hsm/sign + /security/hsm/verify) */}
      <Card
        size="small"
        style={{ marginTop: 'var(--space-4, 16px)' }}
        title={<span><PenTool size={14} /> {t('w13Sec.ca.hsm')} · {t('w8Report.sig.verify')}</span>}
        data-testid="hsm-sign-verify-panel"
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space.Compact style={{ width: '100%' }}>
            <Select
              style={{ width: 240 }}
              value={signKeyId}
              placeholder={t('w13Sec.ca.hsm.activeKey')}
              onChange={(v) => setSignKeyId(v)}
              options={hsmKeys.map((k) => ({ value: k.keyId, label: `${k.keyId} (${k.algorithm})` }))}
              allowClear
            />
            <Input value={signData} onChange={(e) => setSignData(e.target.value)} placeholder={t('w13Sec.fe.plaintext')} onPressEnter={() => void handleSign()} />
            <Button type="primary" loading={signing} icon={<PenTool size={12} />} onClick={() => void handleSign()}>{t('w12Patient.sr.sign')}</Button>
            <Button loading={hsmVerifying} disabled={!signResult} icon={<BadgeCheck size={12} />} onClick={() => void handleVerifyHsm()}>{t('w8Report.verify')}</Button>
          </Space.Compact>
          {signResult && (
            <Alert
              type={hsmVerifyValid === null ? 'info' : hsmVerifyValid ? 'success' : 'error'}
              showIcon
              message={
                <Space size={4} wrap>
                  <Tag color={ALGO_COLOR(signResult.algorithm)}>{signResult.algorithm}</Tag>
                  <Text code style={{ fontSize: 11 }}>{signResult.keyId}</Text>
                  {hsmVerifyValid !== null && (
                    <Tag color={hsmVerifyValid ? severityToAntd('success') : severityToAntd('critical')}>
                      {hsmVerifyValid ? t('w8Report.sig.verifyPass') : t('w8Report.sig.verifyFail')}
                    </Tag>
                  )}
                </Space>
              }
              description={<Text code style={{ fontSize: 11, wordBreak: 'break-all' }}>{signResult.signature}</Text>}
            />
          )}
        </Space>
      </Card>

      <Modal
        title={t('w8Report.revokeTitle', { serial: revokeTarget?.serial ?? '' })}
        open={Boolean(revokeTarget)}
        onCancel={() => { setRevokeTarget(null); setRevokeReason('') }}
        onOk={() => void handleRevoke()}
        confirmLoading={revoking}
        okText={t('w8Report.revoke')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea rows={3} value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} placeholder={t('w8Report.revokeReasonPlaceholder')} maxLength={200} showCount />
      </Modal>
    </PageContainer>
  )
}

export default CertificateCenterPage
