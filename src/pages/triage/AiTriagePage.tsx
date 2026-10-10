// [W3-2] AI 智能分检: 真实 API (aiTriageApi) + loading/error + 紧急度排序 + 详情
import { usePagination } from '../../hooks/usePagination'
import { aiTriageApi, type AiTriageResult } from '../../services/api/aiTriageApi'
import {
  Card,
  Button,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Modal,
  Progress,
  message,
  Alert,
  Empty,
  Tooltip,
  Segmented,
} from "antd";
import { Bot, AlertTriangle, CheckCircle, Clock, RefreshCw, FileText, Zap, UserCheck, Search } from 'lucide-react'
import { DataTable, StatCard, StatCardGrid } from "../../components/common"
import React, { useState, useEffect, useCallback } from 'react'
import { t } from '../../i18n/appI18n'

const levelColor: Record<string, string> = { CRITICAL: 'red', URGENT: 'orange', SEMI_URGENT: 'gold', ROUTINE: 'green' }
const levelLabelKey: Record<string, string> = { CRITICAL: 'aiTriage.levelCritical', URGENT: 'aiTriage.levelUrgent', SEMI_URGENT: 'aiTriage.levelSemiUrgent', ROUTINE: 'aiTriage.levelRoutine' }
const levelOrder: Record<string, number> = { CRITICAL: 0, URGENT: 1, SEMI_URGENT: 2, ROUTINE: 3 }

interface TriageStats {
  total: number
  byLevel?: Record<string, number>
  avgScore?: number
  accuracy?: number
}

const AiTriagePage: React.FC = () => {
  const [items, setItems] = useState<AiTriageResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<TriageStats>({ total: 0 })
  const [statsLoading, setStatsLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<AiTriageResult | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ASSIGNED'>('ALL')
  const [scoreModal, setScoreModal] = useState(false)
  const [scoring, setScoring] = useState(false)

  const fetchPending = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await aiTriageApi.getPending()
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const sorted = [...res.data].sort(
          (a, b) => (levelOrder[a.level] ?? 0) - (levelOrder[b.level] ?? 0) || b.score - a.score,
        )
        setItems(sorted)
      } else {
        setItems([])
        setError(res.error?.message ?? t('aiTriage.loadFailed'))
      }
    } catch (e) {
      console.error('[AiTriage] fetchPending:', e)
      setError(t('aiTriage.loadFailedNetwork'))
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await aiTriageApi.getStats()
      if (res.success && res.data) setStats(res.data)
    } catch {
      /* stats 失败不阻塞主流程 */
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPending()
    void fetchStats()
  }, [fetchPending, fetchStats])

  const handleScore = async (values: { examId: string; patientName: string; examType: string; symptoms: string }) => {
    setScoring(true)
    try {
      const res = await aiTriageApi.score({
        examId: values.examId || `EXAM-${Date.now()}`,
        patientId: `P${Date.now()}`,
        patientName: values.patientName || t('aiTriage.currentPatient'),
        examType: values.examType || 'CT',
        symptoms: values.symptoms,
      })
      if (res.success && res.data) {
        const sorted = [res.data, ...items].sort(
          (a, b) => (levelOrder[a.level] ?? 0) - (levelOrder[b.level] ?? 0) || b.score - a.score,
        )
        setItems(sorted)
        setScoreModal(false)
        setSelectedItem(res.data)
        setShowDetail(true)
        message.success(`${t('aiTriage.scoreDone')}: ${res.data.score} ${t('aiTriage.points')} (${t(levelLabelKey[res.data.level] ?? res.data.level)})`)
        void fetchStats()
      } else {
        message.error(res.error?.message ?? t('aiTriage.scoreFailed'))
      }
    } catch {
      message.error(t('aiTriage.scoreFailedRetry'))
    } finally {
      setScoring(false)
    }
  }

  const handleAssign = async (item: AiTriageResult) => {
    setAssigning(true)
    try {
      const res = await aiTriageApi.assign({
        examId: item.examId,
        patientId: item.patientId ?? `P${Date.now()}`,
        patientName: item.patientName ?? t('aiTriage.currentPatient'),
        examType: item.examType ?? 'CT',
      })
      if (res.success && res.data) {
        setItems(prev => prev.map(i => i.examId === item.examId ? { ...i, status: 'ASSIGNED', assignedDoctor: res.data.assignedDoctor } : i))
        setShowDetail(false)
        message.success(`${t('aiTriage.assignedMsg')}: ${res.data.assignedDoctor}`)
      } else {
        message.error(res.error?.message ?? t('aiTriage.assignFailed'))
      }
    } catch {
      message.error(t('aiTriage.assignFailed'))
    } finally {
      setAssigning(false)
    }
  }

  const filtered = filter === 'ALL' ? items : items.filter(i => i.status === filter)
  const { pageData: triagePageData, pagination: triagePagination } = usePagination(filtered, 10)

  const columns = [
    { title: t('aiTriage.colExamId'), dataIndex: 'examId', key: 'examId', width: 150, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { title: t('aiTriage.colPatient'), dataIndex: 'patientName', key: 'patientName', width: 90 },
    { title: t('aiTriage.colAiScore'), dataIndex: 'score', key: 'score', width: 140, sorter: (a: AiTriageResult, b: AiTriageResult) => b.score - a.score, render: (s: number) => <Progress percent={s} size="small" strokeColor={s >= 80 ? '#ff4d4f' : s >= 60 ? '#faad14' : '#52c41a'} /> },
    { title: t('aiTriage.colLevel'), dataIndex: 'level', key: 'level', width: 90, sorter: (a: AiTriageResult, b: AiTriageResult) => (levelOrder[a.level] ?? 0) - (levelOrder[b.level] ?? 0), render: (l: string) => <Tag color={levelColor[l]}>{t(levelLabelKey[l] ?? l)}</Tag> },
    { title: t('aiTriage.colAiConfidence'), dataIndex: 'aiConfidence', key: 'aiConfidence', width: 100, render: (c: number) => `${((c ?? 0) * 100).toFixed(1)}%` },
    { title: t('aiTriage.colSuggestedDoctor'), dataIndex: 'suggestedDoctor', key: 'suggestedDoctor', ellipsis: true, render: (d: string) => d || '-' },
    { title: t('aiTriage.colStatus'), dataIndex: 'status', key: 'status', width: 90, render: (s: string) => <Tag color={s === 'COMPLETED' ? 'green' : s === 'ASSIGNED' ? 'blue' : 'orange'}>{s === 'COMPLETED' ? t('aiTriage.stCompleted') : s === 'ASSIGNED' ? t('aiTriage.stAssigned') : t('aiTriage.stPending')}</Tag> },
    { title: t('aiTriage.colActions'), key: 'actions', width: 120, render: (_: unknown, r: AiTriageResult) => (
      <Space>
        <Button size="small" onClick={() => { setSelectedItem(r); setShowDetail(true) }}>{t('aiTriage.detail')}</Button>
        {r.status !== 'ASSIGNED' && r.status !== 'COMPLETED' && (
          <Button size="small" type="primary" icon={<UserCheck size={12} />} loading={assigning} onClick={() => void handleAssign(r)}>{t('aiTriage.assign')}</Button>
        )}
      </Space>
    ) },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Bot size={20} color="#722ed1" /><h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t('aiTriage.title')}</h1><Tag color="purple">{t('aiTriage.tag')}</Tag>
      </div>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void fetchPending()}><RefreshCw size={14} /> {t('aiTriage.retry')}</Button>} />}
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('aiTriage.statTotal')} value={stats.total ?? items.length} icon={<FileText size={16} />} loading={statsLoading} />
        <StatCard title={t('aiTriage.levelCritical')} value={stats.byLevel?.CRITICAL ?? items.filter(i => i.level === 'CRITICAL').length} color="error" icon={<AlertTriangle size={16} />} loading={statsLoading} />
        <StatCard title={t('aiTriage.statAccuracy')} value={stats.accuracy ?? 95} suffix="%" icon={<CheckCircle size={16} />} loading={statsLoading} />
        <StatCard title={t('aiTriage.statAvgScore')} value={stats.avgScore ?? '-'} icon={<Clock size={16} />} loading={statsLoading} />
      </StatCardGrid>
      <Card
        title={t('aiTriage.taskList')}
        extra={
          <Space wrap>
            <Segmented
              size="small"
              value={filter}
              onChange={(v) => setFilter(v as typeof filter)}
              options={[
                { label: t('aiTriage.filterAll'), value: 'ALL' },
                { label: t('aiTriage.stPending'), value: 'PENDING' },
                { label: t('aiTriage.stAssigned'), value: 'ASSIGNED' },
              ]}
            />
            <Button type="primary" icon={<Zap size={14} />} onClick={() => setScoreModal(true)}>{t('aiTriage.aiScore')}</Button>
            <Button icon={<RefreshCw size={14} />} onClick={() => { void fetchPending(); void fetchStats() }}>{t('aiTriage.refresh')}</Button>
          </Space>
        }
      >
        <DataTable
          dataSource={triagePageData}
          columns={columns}
          rowKey="examId"
          loading={loading}
          pagination={triagePagination}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('aiTriage.empty')} /> }}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal title={t('aiTriage.detailTitle')} open={showDetail} onCancel={() => { setShowDetail(false); setSelectedItem(null) }} footer={
        selectedItem && selectedItem.status !== 'ASSIGNED' && selectedItem.status !== 'COMPLETED' ? (
          <Button type="primary" icon={<UserCheck size={14} />} loading={assigning} onClick={() => void handleAssign(selectedItem)}>{t('aiTriage.assignDoctor')}</Button>
        ) : null
      } width={640}>
        {selectedItem && (<div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Card size="small"><Statistic title={t('aiTriage.overallScore')} value={selectedItem.score} styles={{ content: { color: levelColor[selectedItem.level] } }} /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title={t('aiTriage.colLevel')} value={t(levelLabelKey[selectedItem.level] ?? selectedItem.level)} styles={{ content: { color: levelColor[selectedItem.level] } }} /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title={t('aiTriage.colAiConfidence')} value={`${((selectedItem.aiConfidence ?? 0) * 100).toFixed(1)}%`} /></Card></Col>
          </Row>
          <Card size="small" title={t('aiTriage.factors')} style={{ marginBottom: 16 }}>
            {(selectedItem.factors ?? []).map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Tooltip title={f.description}>
                  <span style={{ width: 140 }}>{f.name}</span>
                </Tooltip>
                <Progress style={{ flex: 1 }} percent={Math.round((f.contribution ?? 0) * 100)} size="small" />
                <span style={{ width: 60, textAlign: 'right' }}>{((f.contribution ?? 0) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </Card>
          <Card size="small" title={t('aiTriage.reasoning')} style={{ marginBottom: 16 }}>
            <p style={{ color: '#666', fontSize: 13, margin: 0 }}>{selectedItem.reasoning}</p>
          </Card>
          <Space wrap>
            {selectedItem.suggestedDoctor && <Tag icon={<UserCheck size={12} />} color="purple">{t('aiTriage.suggestAssign')}: {selectedItem.suggestedDoctor}</Tag>}
            {selectedItem.assignedDoctor && <Tag color="blue">{t('aiTriage.assignedLabel')}: {selectedItem.assignedDoctor}</Tag>}
            {selectedItem.examType && <Tag icon={<Search size={12} />}>{selectedItem.examType}</Tag>}
          </Space>
        </div>)}
      </Modal>

      <Modal title={t('aiTriage.scoreTitle')} open={scoreModal} onCancel={() => setScoreModal(false)} footer={null} width={420}>
        <ScoreForm submitting={scoring} onSubmit={handleScore} />
      </Modal>
    </div>
  )
}

const ScoreForm: React.FC<{ submitting: boolean; onSubmit: (v: { examId: string; patientName: string; examType: string; symptoms: string }) => void }> = ({ submitting, onSubmit }) => {
  const [examId, setExamId] = useState('')
  const [patientName, setPatientName] = useState('')
  const [examType, setExamType] = useState('CT')
  const [symptoms, setSymptoms] = useState('')

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>{t('aiTriage.examIdOptional')}</div>
        <input className="ant-input" style={{ width: '100%' }} value={examId} onChange={(e) => setExamId(e.target.value)} placeholder="EXAM-20260807-005" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>{t('aiTriage.patientName')}</div>
        <input className="ant-input" style={{ width: '100%' }} value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder={t('aiTriage.patientNamePlaceholder')} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>{t('aiTriage.examType')}</div>
        <Segmented options={['CT', 'MR', 'X-ray', 'US']} value={examType} onChange={(v) => setExamType(v as string)} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>{t('aiTriage.symptoms')}</div>
        <textarea className="ant-input" rows={2} style={{ width: '100%' }} value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder={t('aiTriage.symptomsPlaceholder')} />
      </div>
      <Button type="primary" block loading={submitting} icon={<Zap size={14} />} onClick={() => onSubmit({ examId, patientName, examType, symptoms })}>{t('aiTriage.startScore')}</Button>
    </div>
  )
}

export default AiTriagePage
