/**
 * G005 v3.0.6.11-75 W3-1 - 影像质控专项页
 * qcImageAiApi 真实评分(scoreV2) + 评分列表(listResults) + 统计(getStatsV2) + 设备影像等级
 */
import { DEVICE_MASTER, DEVICES_BY_MODALITY } from '../../data/master'
import { qcImageAiApi, type QcImageAiResult, type QcImageAiStatsV2 } from '../../services/api/qcImageAiApi'
import { worklistApi } from '../../services/api/worklistApi'
import {
  Card, Row, Col, Statistic, Tag, Alert, Button, Spin, Table, Input, Select, Space, message, Progress, Empty, type TableProps,
} from 'antd'
import { Camera, Activity, AlertTriangle, CheckCircle, ScanLine, RefreshCw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'

const MODALITY_OPTIONS = ['CT', 'MR', 'DR', 'US', 'MG', 'DSA'].map((m) => ({ label: m, value: m }))
const STATUS_META: Record<string, { color: string; label: string }> = {
  pending: { color: 'warning', label: '待审核' },
  reviewed: { color: 'blue', label: '已复核' },
  accepted: { color: 'success', label: '已接受' },
  rejected: { color: 'error', label: '已驳回' },
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
        message.success(state === 'IMAGE_READY' ? `检查 ${r.studyId} 质控通过, 图像已可用` : `检查 ${r.studyId} 质控驳回`)
        setResults(prev => prev.map(x => (x.id === r.id ? { ...x, status: state === 'IMAGE_READY' ? 'accepted' : 'rejected' } : x)))
        void load()
      } else {
        message.error(res.error?.message ?? '质控操作失败')
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '质控操作失败')
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
      if (listRes.success && Array.isArray(listRes.data)) setResults(listRes.data)
      else setError(listRes.error?.message ?? '评分列表加载失败')
      if (statsRes.success && statsRes.data) setStatsV2(statsRes.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '质控数据加载失败')
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
      message.warning('请输入检查实例 ID')
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
        message.success(`AI 评分完成: ${res.data.overall} / ${5}`)
        setInstanceId('')
        void load()
      } else {
        message.error(res.error?.message ?? '评分失败')
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '评分失败')
    } finally {
      setScoring(false)
    }
  }

  const columns: TableProps<QcImageAiResult>['columns'] = [
    { title: '检查号', dataIndex: 'studyId', width: 150, ellipsis: true, render: (v: string) => <code style={{ fontSize: 11 }}>{v}</code> },
    { title: '患者', dataIndex: 'patientName', width: 90 },
    { title: '模态', dataIndex: 'modality', width: 70, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '设备', dataIndex: 'device', width: 130, ellipsis: true },
    { title: '检查日期', dataIndex: 'examDate', width: 100 },
    { title: 'AI 评分', dataIndex: 'score', width: 130, render: (v: number, r: QcImageAiResult) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Progress percent={Math.round((v / (r.maxScore || 5)) * 100)} size="small" style={{ flex: 1, margin: 0 }} strokeColor={v >= 4 ? '#10b981' : v >= 3 ? '#f59e0b' : '#ef4444'} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>{v}</span>
        </div>
      ) },
    { title: '问题数', key: 'issues', width: 70, render: (_: unknown, r: QcImageAiResult) => <Tag color="orange">{r.issues?.length ?? 0}</Tag> },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag> },
    {
      title: '质控回写', key: 'qc', width: 140, fixed: 'right',
      render: (_: unknown, r: QcImageAiResult) => (
        <Space size={4}>
          <Button size="small" type="primary" ghost icon={<CheckCircle size={12} />} loading={qcBusy === `${r.id}:pass`} onClick={() => void handleQc(r, 'IMAGE_READY')}>通过</Button>
          <Button size="small" danger ghost icon={<XCircle size={12} />} loading={qcBusy === `${r.id}:reject`} onClick={() => void handleQc(r, 'QC_REJECT')}>驳回</Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Camera size={20} color="#3b82f6" />
        <span style={{ fontSize: 18, fontWeight: 700 }}>影像质控专项</span>
        <Tag color="cyan">v3.0.6.11-75</Tag>
        <Tag color="geekblue">ACR 模体 / AI 评分 / 剂量合规</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>刷新</Button>
      </Space>

      {error && (
        <Alert type="error" showIcon message="加载失败" description={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> 重试</Button>} />
      )}

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['all', 'CT', 'MR', 'DR', 'US', 'MG', 'DSA'].map((m) => (
          <button key={m} onClick={() => setModality(m)}
            style={{ padding: '6px 14px', background: modality === m ? '#1e40af' : 'var(--bg-card)', color: modality === m ? '#fff' : '#475569', border: '1px solid ' + (modality === m ? '#1e40af' : 'var(--border-color)'), borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {m === 'all' ? '全部' : m}
          </button>
        ))}
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="A 级设备" value={deviceStats.a} prefix={<CheckCircle size={14} />} loading={loading} styles={{ content: { color: '#10b981' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="B 级" value={deviceStats.b} prefix={<Activity size={14} />} loading={loading} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="C 级" value={deviceStats.c} prefix={<AlertTriangle size={14} />} loading={loading} styles={{ content: { color: '#f59e0b' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="D 级(需关注)" value={deviceStats.d} prefix={<AlertTriangle size={14} />} loading={loading} styles={{ content: { color: '#dc2626' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="AI 平均分" value={statsV2?.avgOverall ?? 0} suffix="/5" loading={loading} styles={{ content: { color: '#7c3aed' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="AI 评分总数" value={statsV2?.totalScores ?? 0} loading={loading} /></Card></Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={8}>
          <Card size="small" title={<Space><ScanLine size={14} />AI 影像评分 (score-v2)</Space>} style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Input placeholder="检查实例 ID (instanceId)" value={instanceId} onChange={(e) => setInstanceId(e.target.value)} />
              <Select style={{ width: '100%' }} options={MODALITY_OPTIONS} value={scoreModality} onChange={setScoreModality} />
              <Input placeholder="操作员 ID (选填)" value={operatorId} onChange={(e) => setOperatorId(e.target.value)} />
              <Button type="primary" block onClick={handleScore} loading={scoring}>
                {scoring ? 'AI 评分中...' : '开始 AI 评分'}
              </Button>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                评分维度: 伪影(运动/金属/环) · 摆位(体位/旋转/偏移) · 曝光(不足/正常/过度)
              </div>
            </Space>
          </Card>

          <Card size="small" title="评分统计">
            {loading ? <Spin /> : statsV2 ? (
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Row gutter={8}>
                  <Col span={12}><Statistic title="伪影分" value={statsV2.avgArtifactOverall ?? 0} suffix="/5" valueStyle={{ fontSize: 16 }} /></Col>
                  <Col span={12}><Statistic title="摆位分" value={statsV2.avgPositioningOverall ?? 0} suffix="/5" valueStyle={{ fontSize: 16 }} /></Col>
                </Row>
                <Row gutter={8}>
                  <Col span={12}><Statistic title="曝光分" value={statsV2.avgExposureScore ?? 0} suffix="/5" valueStyle={{ fontSize: 16 }} /></Col>
                  <Col span={12}><Statistic title="综合分" value={statsV2.avgOverall ?? 0} suffix="/5" valueStyle={{ fontSize: 16, color: '#7c3aed' }} /></Col>
                </Row>
              </Space>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card size="small" title="AI 评分记录" extra={<Tag>{results.length} 条</Tag>}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
            ) : results.length === 0 ? (
              <Empty image={<BarChart3 size={48} style={{opacity:0.4}}/>} description="暂无评分记录" />
            ) : (
              <Table rowKey="id" size="small" dataSource={results} columns={columns} pagination={{ current: resultPage, pageSize: 8, total: results.length, onChange: setResultPage, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 900 }} />
            )}
          </Card>
        </Col>
      </Row>

      <Card size="small" title="设备影像质量详细" style={{ marginTop: 16 }}>
        <table style={{ width: '100%', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-card)' }}>
              {['设备 ID', '类型', '厂家型号', '影像等级', '剂量合规率', '月扫描', '故障率'].map((h) => (
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
                    {d.imageQualityGrade} 级
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
    </div>
  )
}
