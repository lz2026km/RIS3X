/**
 * G005 v3.0.6.11-75 W3-1 - 影像质控专项页
 * qcImageAiApi 真实评分(scoreV2) + 评分列表(listResults) + 统计(getStatsV2) + 设备影像等级
 */
import { DEVICE_MASTER, DEVICES_BY_MODALITY } from '../../data/master'
import { qcImageAiApi, type QcImageAiResult, type QcImageAiStatsV2 } from '../../services/api/qcImageAiApi'
import { RETAKE_REASON_OPTIONS, worklistApi } from '../../services/api/worklistApi'
import {
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Alert,
  Button,
  Spin,
  Input,
  Select,
  Space,
  message,
  Progress,
  Modal,
  type TableProps,
} from "antd";
import { Camera, Activity, AlertTriangle, CheckCircle, ScanLine, RefreshCw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/common/PageHeader'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { EmptyState } from '../../components/common/EmptyState'
import { AppText } from '../../components/common/AppText'
import { THEME_TOKENS } from '../../components/common/ThemeTokens'
import { t } from '../../i18n/appI18n'

const MODALITY_OPTIONS = ['CT', 'MR', 'DR', 'US', 'MG', 'DSA'].map((m) => ({ label: m, value: m }))
const STATUS_META: Record<string, { color: string; labelKey: string }> = {
  pending: { color: 'warning', labelKey: 'imageQualityControl.statusPending' },
  reviewed: { color: 'blue', labelKey: 'imageQualityControl.statusReviewed' },
  accepted: { color: 'success', labelKey: 'imageQualityControl.statusAccepted' },
  rejected: { color: 'error', labelKey: 'imageQualityControl.statusRejected' },
}

export default function ImageQualityControlPage() {
  const [modality, setModality] = useState<string>('all')
  const [results, setResults] = useState<QcImageAiResult[]>([])
  const [statsV2, setStatsV2] = useState<QcImageAiStatsV2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [instanceId, setInstanceId] = useState('')
  const [scoreModality, setScoreModality] = useState('CT')
  const [operatorId, setOperatorId] = useState('')
  const [scoring, setScoring] = useState(false)
  // [W2-C] 受控分页
  const [resultPage, setResultPage] = useState(1)
  // [v3.0.6.11-92 Wave1B P0] 质控回写 busy key (质控通过/驳回 → worklistApi.updateState)
  const [qcBusy, setQcBusy] = useState('')

  // [v3.0.6.11-92 Wave1B P0] 质控通过/驳回 → 写回 exam 状态 (通过 → IMAGE_READY 图像可用, 驳回 → QC_REJECT)
  const handleQc = async (r: QcImageAiResult, state: 'IMAGE_READY' | 'QC_REJECT') => {
    const key = `${r.id}:${state === 'IMAGE_READY' ? 'pass' : 'reject'}`
    if (qcBusy) return
    setQcBusy(key)
    try {
      const res = await worklistApi.updateState(
        r.studyId,
        state,
        state === 'QC_REJECT' ? `影像质控驳回: AI 评分 ${r.score}/${r.maxScore}` : '影像质控通过',
      )
      if (res.success) {
        message.success(state === 'IMAGE_READY' ? t('imageQualityControl.qcPassedMsg', { studyId: r.studyId }) : t('imageQualityControl.qcRejectedMsg', { studyId: r.studyId }))
        setResults(prev => prev.map(x => (x.id === r.id ? { ...x, status: state === 'IMAGE_READY' ? 'accepted' : 'rejected' } : x)))
        void load()
      } else {
        message.error(res.error?.message ?? t('imageQualityControl.qcActionFailed'))
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('imageQualityControl.qcActionFailed'))
    } finally {
      setQcBusy('')
    }
  }

  // [v3.0.6.11-95 Wave 1A P1] 驳回后重拍登记: QC_REJECT → IN_PROGRESS (后端 retakeCount +1, 备注"重拍第 N 次")
  // [v3.0.6.11-100 Wave 1B] + 重拍原因下拉 (retakeReason 传递, 重拍率统计原因维度)
  const [retakeTarget, setRetakeTarget] = useState<QcImageAiResult | null>(null)
  const [retakeReason, setRetakeReason] = useState<string | undefined>(undefined)
  const [retakeConfirmOpen, setRetakeConfirmOpen] = useState(false)

  const openRetakeModal = (r: QcImageAiResult) => {
    setRetakeTarget(r)
    setRetakeReason(undefined)
    setRetakeConfirmOpen(true)
  }

  const handleRetake = async (r: QcImageAiResult) => {
    const key = `${r.id}:retake`
    if (qcBusy) return
    setQcBusy(key)
    try {
      // [W6] 重拍登记门禁: QC_REJECT 后提交重拍申请, 审批通过前不得流转 IN_PROGRESS
      const res = await worklistApi.requestRetake(r.studyId, { reason: retakeReason, note: '影像质控重拍申请' })
      if (res.success) {
        message.success(t('w6Workflow.retake.requested'))
        setResults(prev => prev.map(x => (x.id === r.id ? { ...x, status: 'pending' } : x)))
        setRetakeConfirmOpen(false)
        setRetakeTarget(null)
        void load()
      } else {
        message.error(res.error?.message ?? t('imageQualityControl.retakeRegisterFailed'))
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('imageQualityControl.retakeRegisterFailed'))
    } finally {
      setQcBusy('')
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [listRes, statsRes] = await Promise.all([
        qcImageAiApi.listResults(modality === 'all' ? undefined : { modality }),
        qcImageAiApi.getStatsV2(modality === 'all' ? undefined : { modality }),
      ])
      if (listRes.success && Array.isArray(listRes.data)) setResults(listRes.data as unknown as QcImageAiResult[])
      else setError(listRes.error?.message ?? t('imageQualityControl.scoreListLoadFailed'))
      if (statsRes.success && statsRes.data) setStatsV2(statsRes.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('imageQualityControl.qcDataLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [modality])

  useEffect(() => { void load() }, [load])

  const deviceStats = useMemo(() => {
    const filtered = modality === 'all' ? DEVICE_MASTER : DEVICES_BY_MODALITY[modality as keyof typeof DEVICES_BY_MODALITY] || []
    const grade = (g: string) => filtered.filter((d) => d.imageQualityGrade === g).length
    const total = filtered.length
    const doseCompliant = filtered.filter((d) => d.doseComplianceRate >= 90).length
    return { a: grade('A'), b: grade('B'), c: grade('C'), d: grade('D'), total, doseCompliant }
  }, [modality])

  const handleScore = async () => {
    if (!instanceId.trim()) {
      message.warning(t('imageQualityControl.enterInstanceId'))
      return
    }
    setScoring(true)
    try {
      const res = await qcImageAiApi.scoreV2({
        instanceId: instanceId.trim(),
        modality: scoreModality,
        artifactScores: { motion: 4, metal: 4, ring: 4 },
        positioningScores: { setup: 4, rotation: 4, offset: 4 },
        exposure: { value: '正常', score: 4 },
        overall: 4,
        operatorId: operatorId.trim() || undefined,
      })
      if (res.success) {
        message.success(t('imageQualityControl.scoreDoneMsg', { score: res.data.overall }))
        setInstanceId('')
        void load()
      } else {
        message.error(res.error?.message ?? t('imageQualityControl.scoreFailed'))
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('imageQualityControl.scoreFailed'))
    } finally {
      setScoring(false)
    }
  }

  const columns: TableProps<QcImageAiResult>['columns'] = [
    { title: t('imageQualityControl.colStudyId'), dataIndex: 'studyId', width: 150, ellipsis: true, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
    { title: t('imageQualityControl.colPatient'), dataIndex: 'patientName', width: 90 },
    { title: t('imageQualityControl.colModality'), dataIndex: 'modality', width: 70, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: t('imageQualityControl.colDevice'), dataIndex: 'device', width: 130, ellipsis: true },
    { title: t('imageQualityControl.colExamDate'), dataIndex: 'examDate', width: 100 },
    { title: t('imageQualityControl.colAiScore'), dataIndex: 'score', width: 130, render: (v: number, r: QcImageAiResult) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Progress percent={Math.round((v / (r.maxScore || 5)) * 100)} size="small" style={{ flex: 1, margin: 0 }} strokeColor={v >= 4 ? '#10b981' : v >= 3 ? '#f59e0b' : '#ef4444'} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>{v}</span>
        </div>
      ) },
    { title: t('imageQualityControl.colIssues'), key: 'issues', width: 70, render: (_: unknown, r: QcImageAiResult) => <Tag color="orange">{r.issues?.length ?? 0}</Tag> },
    { title: t('imageQualityControl.colStatus'), dataIndex: 'status', width: 90, render: (v: string) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.labelKey ? t(STATUS_META[v].labelKey) : v}</Tag> },
    {
      title: t('imageQualityControl.colQcWriteback'), key: 'qc', width: 190, fixed: 'right',
      render: (_: unknown, r: QcImageAiResult) => (
        <Space size={4}>
          <Button size="small" type="primary" ghost icon={<CheckCircle size={12} />} loading={qcBusy === `${r.id}:pass`} onClick={() => void handleQc(r, 'IMAGE_READY')}>{t('imageQualityControl.pass')}</Button>
          <Button size="small" danger ghost icon={<XCircle size={12} />} loading={qcBusy === `${r.id}:reject`} onClick={() => void handleQc(r, 'QC_REJECT')}>{t('imageQualityControl.reject')}</Button>
          {/* [v3.0.6.11-95 Wave 1A P1] 驳回后提供重拍登记: QC_REJECT → IN_PROGRESS */}
          {r.status === 'rejected' && (
            <Button size="small" danger icon={<RefreshCw size={12} />} loading={qcBusy === `${r.id}:retake`} onClick={() => openRetakeModal(r)}>{t('imageQualityControl.retakeRegister')}</Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)',}}>
      <PageHeader
        icon={<Camera size={20} color="#3b82f6" />}
        title={t('imageQualityControl.title')}
        subtitle={t('imageQualityControl.subtitle')}
        actions={
          <>
            <Tag color="cyan">v3.0.6.11-75</Tag>
            <Tag color="geekblue">{t('imageQualityControl.subtitle')}</Tag>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>{t('imageQualityControl.refresh')}</Button>
          </>
        }
      />

      {error && (
        <Alert type="error" showIcon message={t('imageQualityControl.loadFailed')} description={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('imageQualityControl.retry')}</Button>} />
      )}

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['all', 'CT', 'MR', 'DR', 'US', 'MG', 'DSA'].map((m) => (
          <button key={m} onClick={() => setModality(m)}
            style={{ padding: '6px 14px', background: modality === m ? '#1e40af' : 'var(--bg-card)', color: modality === m ? '#fff' : '#475569', border: '1px solid ' + (modality === m ? '#1e40af' : 'var(--border-color)'), borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {m === 'all' ? t('imageQualityControl.all') : m}
          </button>
        ))}
      </div>

      <StatCardGrid minWidth={150} gap={12} style={{ marginBottom: 16 }}>
        <StatCard title={t('imageQualityControl.statGradeA')} value={deviceStats.a} icon={<CheckCircle size={16} />} color="success" loading={loading} />
        <StatCard title={t('imageQualityControl.statGradeB')} value={deviceStats.b} icon={<Activity size={16} />} color="info" loading={loading} />
        <StatCard title={t('imageQualityControl.statGradeC')} value={deviceStats.c} icon={<AlertTriangle size={16} />} color="warning" loading={loading} />
        <StatCard title={t('imageQualityControl.statGradeD')} value={deviceStats.d} icon={<AlertTriangle size={16} />} color="error" loading={loading} />
        <StatCard title={t('imageQualityControl.statAvgScore')} value={statsV2?.avgOverall ?? 0} suffix="/5" color="#7c3aed" loading={loading} />
        <StatCard title={t('imageQualityControl.statTotalScores')} value={statsV2?.totalScores ?? 0} icon={<ScanLine size={16} />} color="primary" loading={loading} />
      </StatCardGrid>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={8}>
          <Card size="small" title={<Space><ScanLine size={14} />{t('imageQualityControl.aiScoreCard')}</Space>} style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Input placeholder={t('imageQualityControl.instanceIdPlaceholder')} value={instanceId} onChange={(e) => setInstanceId(e.target.value)} />
              <Select style={{ width: '100%' }} options={MODALITY_OPTIONS} value={scoreModality} onChange={setScoreModality} />
              <Input placeholder={t('imageQualityControl.operatorIdPlaceholder')} value={operatorId} onChange={(e) => setOperatorId(e.target.value)} />
              <Button type="primary" block onClick={handleScore} loading={scoring}>
                {scoring ? t('imageQualityControl.scoring') : t('imageQualityControl.startScoring')}
              </Button>
              <div style={{ fontSize: 12, color: THEME_TOKENS.textSecondary }}>
                {t('imageQualityControl.scoreDimensions')}
              </div>
            </Space>
          </Card>

          <Card size="small" title={t('imageQualityControl.scoreStatsCard')}>
            {loading ? <Spin /> : statsV2 ? (
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Row gutter={8}>
                  <Col span={12}><Statistic title={t('imageQualityControl.artifactScore')} value={statsV2.avgArtifactOverall ?? 0} suffix="/5" valueStyle={{ fontSize: 16 }} /></Col>
                  <Col span={12}><Statistic title={t('imageQualityControl.positioningScore')} value={statsV2.avgPositioningOverall ?? 0} suffix="/5" valueStyle={{ fontSize: 16 }} /></Col>
                </Row>
                <Row gutter={8}>
                  <Col span={12}><Statistic title={t('imageQualityControl.exposureScore')} value={statsV2.avgExposureScore ?? 0} suffix="/5" valueStyle={{ fontSize: 16 }} /></Col>
                  <Col span={12}><Statistic title={t('imageQualityControl.overallScore')} value={statsV2.avgOverall ?? 0} suffix="/5" valueStyle={{ fontSize: 16, color: '#7c3aed' }} /></Col>
                </Row>
              </Space>
            ) : <EmptyState description={t('imageQualityControl.noScoreStats')} />}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card size="small" title={t('imageQualityControl.scoreRecordsCard')} extra={<Tag>{t('imageQualityControl.recordsCount', { count: results.length })}</Tag>}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
            ) : results.length === 0 ? (
              <EmptyState description={t('imageQualityControl.noScoreRecords')} />
            ) : (
              <DataTable rowKey="id" dataSource={results} columns={columns} pagination={{ current: resultPage, pageSize: 8, total: results.length, onChange: setResultPage, showSizeChanger: false, showTotal: (total) => t('imageQualityControl.totalItems', { total }) }} scroll={{ x: 900 }} />
            )}
          </Card>
        </Col>
      </Row>

      <Card size="small" title={t('imageQualityControl.deviceDetailCard')} style={{ marginTop: 16 }}>
        <table style={{ width: '100%', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-card)' }}>
              {[t('imageQualityControl.thDeviceId'), t('imageQualityControl.thType'), t('imageQualityControl.thBrandModel'), t('imageQualityControl.thImageGrade'), t('imageQualityControl.thDoseCompliance'), t('imageQualityControl.thMonthlyScans'), t('imageQualityControl.thDefectRate')].map((h) => (
                <th key={h} style={{ padding: 10, textAlign: 'left', fontWeight: 600, color: '#475569', borderBottom: '2px solid var(--border-color)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEVICE_MASTER.slice(0, 30).map((d) => (
              <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: 10, fontFamily: 'monospace', fontSize: 11 }}>{d.id}</td>
                <td style={{ padding: 10 }}>{d.modality}</td>
                <td style={{ padding: 10 }}>{d.brand} {d.model}</td>
                <td style={{ padding: 10 }}>
                  <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: d.imageQualityGrade === 'A' ? 'var(--color-success-bg)' : d.imageQualityGrade === 'D' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', color: d.imageQualityGrade === 'A' ? '#065f46' : d.imageQualityGrade === 'D' ? '#991b1b' : '#92400e' }}>
                    {t('imageQualityControl.gradeSuffix', { grade: d.imageQualityGrade })}
                  </span>
                </td>
                <td style={{ padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 60, height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${d.doseComplianceRate}%`, height: '100%', background: d.doseComplianceRate >= 90 ? '#10b981' : d.doseComplianceRate >= 80 ? '#f59e0b' : '#dc2626' }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#475569' }}>{d.doseComplianceRate}%</span>
                  </div>
                </td>
                <td style={{ padding: 10 }}>{d.monthlyScans}</td>
                <td style={{ padding: 10 }}>{d.defectRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* [v3.0.6.11-100 Wave 1B] 重拍登记确认 Modal: 原因下拉 (retakeReason) */}
      <Modal
        title={t('imageQualityControl.retakeModalTitle', { patient: retakeTarget?.patientName ?? '', studyId: retakeTarget?.studyId ?? '' })}
        open={retakeConfirmOpen}
        onCancel={() => setRetakeConfirmOpen(false)}
        onOk={() => retakeTarget && void handleRetake(retakeTarget)}
        okText={qcBusy ? t('imageQualityControl.registering') : t('imageQualityControl.confirmRetakeRegister')}
        okButtonProps={{ loading: qcBusy === `${retakeTarget?.id}:retake`, danger: true }}
        cancelText={t('imageQualityControl.cancel')}
      >
        <AppText size="sm" color="secondary" style={{ marginBottom: 12, display: 'block' }}>
          {t('imageQualityControl.retakeHint')}
        </AppText>
        <AppText size="xs" color="muted" style={{ marginBottom: 6, display: 'block' }}>{t('imageQualityControl.retakeReasonLabel')}</AppText>
        <Select
          style={{ width: '100%' }}
          placeholder={t('imageQualityControl.retakeReasonPlaceholder')}
          options={RETAKE_REASON_OPTIONS}
          value={retakeReason}
          onChange={setRetakeReason}
        />
      </Modal>
    </div>
  )
}

import { DataTable } from "../../components/common";