// [G005 W8-Report] 签名与证书中心 — 证书注册表 / CRL / 报告验签
// 数据源: certificateApi (后端 /report-signing/*, MSW 确定性回退)
import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Descriptions, Input, message, Modal, Row, Col, Select, Space, Statistic, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ShieldCheck, Ban, RefreshCw, BadgeCheck, FileSearch, KeyRound, RotateCw, Search } from 'lucide-react'
import { certificateApi, type CrlViewDto, type SignatureStatsDto } from '../../services/api/certificateApi'
import { hsmApi, ocspApi, type OcspResponseDto } from '../../services/api/w13SecurityApi'
import type { ReportCertificateDto, ReportSignatureVerificationDto } from '../../services/api/reportApi'
import { LoadingBanner, ErrorBanner } from '../../components/feedback'
import { t } from '../../i18n/appI18n'

const { Text } = Typography

const STATUS_COLOR: Record<string, string> = { valid: 'green', revoked: 'red' }

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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [certRes, statsRes, crlRes] = await Promise.all([
        certificateApi.listCertificates({ status: statusFilter === 'all' ? undefined : statusFilter, keyword: keyword || undefined }),
        certificateApi.getSignatureStats(),
        certificateApi.getCrl(),
      ])
      if (certRes.success && certRes.data) setCerts(certRes.data.data)
      else setError(t('w8Report.loadError'))
      if (statsRes.success && statsRes.data) setStats(statsRes.data)
      if (crlRes.success && crlRes.data) setCrl(crlRes.data)
      try {
        const keyRes = await hsmApi.keys('software-kms')
        if (keyRes.success && keyRes.data) setActiveKeyId((keyRes.data.data ?? []).find((k) => k.status === 'active')?.keyId ?? null)
      } catch { /* 回退: 不展示活动密钥 */ }
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
          {r.revokedAt && <div style={{ color: '#dc2626' }}>{t('w8Report.revokedAt')}: {r.revokedAt.slice(0, 10)} · {r.revocationReason}</div>}
        </div>
      ),
    },
    {
      title: t('w8Report.col.status'), dataIndex: 'status', key: 'status', width: 90,
      render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s === 'valid' ? t('w8Report.statusValid') : t('w8Report.statusRevoked')}</Tag>,
    },
    {
      title: t('w8Report.col.actions'), key: 'actions', width: 110,
      render: (_: unknown, r) => (
        <Button size="small" danger icon={<Ban size={12} />} disabled={r.status === 'revoked'} onClick={() => setRevokeTarget(r)}>
          {t('w8Report.revoke')}
        </Button>
      ),
    },
  ]

  return (
    <div data-testid="certificate-center-page" style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <ShieldCheck size={22} color="#0891b2" />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{t('w8Report.certCenterTitle')}</h1>
        <Tag color="cyan">{t('w8Report.certCenterBadge')}</Tag>
        <div style={{ flex: 1 }} />
        {activeKeyId && <Tag icon={<KeyRound size={12} />} color="blue">{activeKeyId}</Tag>}
        <Button size="small" icon={<RotateCw size={12} />} loading={rotating} onClick={() => void handleRotate()}>{t('w13Sec.ca.hsm.rotate')}</Button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -8, marginBottom: 16 }}>{t('w8Report.certCenterSubtitle')}</p>

      {error && <ErrorBanner message={error} />}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title={t('w8Report.stat.total')} value={stats?.total ?? 0} prefix={<KeyRound size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('w8Report.stat.valid')} value={stats?.valid ?? 0} valueStyle={{ color: '#16a34a' }} prefix={<BadgeCheck size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('w8Report.stat.superseded')} value={stats?.superseded ?? 0} valueStyle={{ color: '#d97706' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('w8Report.stat.revoked')} value={stats?.revoked ?? 0} valueStyle={{ color: '#dc2626' }} /></Card></Col>
      </Row>

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
            {loading ? <LoadingBanner /> : <Table<ReportCertificateDto> rowKey="serial" columns={columns} dataSource={certs} size="small" pagination={{ pageSize: 8, hideOnSinglePage: true }} />}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={<span><Ban size={14} /> {t('w8Report.crlTitle')}</span>} style={{ marginBottom: 16 }}>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label={t('w8Report.crlIssuer')}>{crl?.issuer ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('w8Report.crlThisUpdate')}>{crl?.thisUpdate?.slice(0, 19).replace('T', ' ') ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('w8Report.crlEntryCount')}>{crl?.entryCount ?? 0}</Descriptions.Item>
            </Descriptions>
            {(crl?.entries ?? []).length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>{t('w8Report.crlEmpty')}</Text>}
            {(crl?.entries ?? []).map((e) => (
              <div key={e.serial} style={{ fontSize: 12, padding: '4px 0', borderTop: '1px solid var(--border-color)' }}>
                <Text code style={{ fontSize: 11 }}>{e.serial}</Text>
                <div style={{ color: '#dc2626' }}>{e.reason} · {e.revocationDate.slice(0, 10)}</div>
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
          <Card size="small" title={<span><Search size={14} /> {t('w13Sec.ca.ocsp')}</span>} style={{ marginTop: 16 }}>
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
    </div>
  )
}

export default CertificateCenterPage
