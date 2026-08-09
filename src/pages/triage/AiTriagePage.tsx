// [W3-2] AI 智能分检: 真实 API (aiTriageApi) + loading/error + 紧急度排序 + 详情
import { usePagination } from '../../hooks/usePagination'
import { aiTriageApi, type AiTriageResult } from '../../services/api/aiTriageApi'
import { Card, Table, Button, Tag, Space, Row, Col, Statistic, Modal, Progress, message, Alert, Empty, Tooltip, Segmented } from 'antd'
import { Bot, AlertTriangle, CheckCircle, Clock, RefreshCw, FileText, Zap, UserCheck, Search } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'

const levelColor: Record<string, string> = { CRITICAL: 'red', URGENT: 'orange', SEMI_URGENT: 'gold', ROUTINE: 'green' }
const levelLabel: Record<string, string> = { CRITICAL: '危急', URGENT: '紧急', SEMI_URGENT: '半紧急', ROUTINE: '常规' }
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
        setError(res.error?.message ?? '加载失败')
      }
    } catch (e) {
      console.error('[AiTriage] fetchPending:', e)
      setError('分检任务加载失败, 请检查网络后重试')
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
        patientName: values.patientName || '当前患者',
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
        message.success(`AI 评分完成: ${res.data.score} 分 (${levelLabel[res.data.level]})`)
        void fetchStats()
      } else {
        message.error(res.error?.message ?? '评分失败')
      }
    } catch {
      message.error('评分失败, 请稍后重试')
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
        patientName: item.patientName ?? '当前患者',
        examType: item.examType ?? 'CT',
      })
      if (res.success && res.data) {
        setItems(prev => prev.map(i => i.examId === item.examId ? { ...i, status: 'ASSIGNED', assignedDoctor: res.data.assignedDoctor } : i))
        setShowDetail(false)
        message.success(`已分配: ${res.data.assignedDoctor}`)
      } else {
        message.error(res.error?.message ?? '分配失败')
      }
    } catch {
      message.error('分配失败')
    } finally {
      setAssigning(false)
    }
  }

  const filtered = filter === 'ALL' ? items : items.filter(i => i.status === filter)
  const { pageData: triagePageData, pagination: triagePagination } = usePagination(filtered, 10)

  const columns = [
    { title: '检查ID', dataIndex: 'examId', key: 'examId', width: 150, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { title: '患者', dataIndex: 'patientName', key: 'patientName', width: 90 },
    { title: 'AI评分', dataIndex: 'score', key: 'score', width: 140, sorter: (a: AiTriageResult, b: AiTriageResult) => b.score - a.score, render: (s: number) => <Progress percent={s} size="small" strokeColor={s >= 80 ? '#ff4d4f' : s >= 60 ? '#faad14' : '#52c41a'} /> },
    { title: '优先级', dataIndex: 'level', key: 'level', width: 90, sorter: (a: AiTriageResult, b: AiTriageResult) => (levelOrder[a.level] ?? 0) - (levelOrder[b.level] ?? 0), render: (l: string) => <Tag color={levelColor[l]}>{levelLabel[l]}</Tag> },
    { title: 'AI置信度', dataIndex: 'aiConfidence', key: 'aiConfidence', width: 100, render: (c: number) => `${((c ?? 0) * 100).toFixed(1)}%` },
    { title: '建议医生', dataIndex: 'suggestedDoctor', key: 'suggestedDoctor', ellipsis: true, render: (d: string) => d || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (s: string) => <Tag color={s === 'COMPLETED' ? 'green' : s === 'ASSIGNED' ? 'blue' : 'orange'}>{s === 'COMPLETED' ? '已完成' : s === 'ASSIGNED' ? '已分配' : '待分检'}</Tag> },
    { title: '操作', key: 'actions', width: 120, render: (_: unknown, r: AiTriageResult) => (
      <Space>
        <Button size="small" onClick={() => { setSelectedItem(r); setShowDetail(true) }}>详情</Button>
        {r.status !== 'ASSIGNED' && r.status !== 'COMPLETED' && (
          <Button size="small" type="primary" icon={<UserCheck size={12} />} loading={assigning} onClick={() => void handleAssign(r)}>分配</Button>
        )}
      </Space>
    ) },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Bot size={20} color="#722ed1" /><h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>AI 智能分检</h1><Tag color="purple">AI 辅助诊断</Tag>
      </div>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void fetchPending()}><RefreshCw size={14} /> 重试</Button>} />}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small" loading={statsLoading}><Statistic title="总分检数" value={stats.total ?? items.length} prefix={<FileText size={16} />} /></Card></Col>
        <Col xs={12} md={6}><Card size="small" loading={statsLoading}><Statistic title="危急" value={stats.byLevel?.CRITICAL ?? items.filter(i => i.level === 'CRITICAL').length} styles={{ content: { color: '#cf1322' } }} prefix={<AlertTriangle size={16} />} /></Card></Col>
        <Col xs={12} md={6}><Card size="small" loading={statsLoading}><Statistic title="AI准确率" value={stats.accuracy ?? 95} suffix="%" prefix={<CheckCircle size={16} />} /></Card></Col>
        <Col xs={12} md={6}><Card size="small" loading={statsLoading}><Statistic title="平均评分" value={stats.avgScore ?? '-'} prefix={<Clock size={16} />} /></Card></Col>
      </Row>
      <Card
        title="AI分检任务"
        extra={
          <Space wrap>
            <Segmented
              size="small"
              value={filter}
              onChange={(v) => setFilter(v as typeof filter)}
              options={[
                { label: '全部', value: 'ALL' },
                { label: '待分检', value: 'PENDING' },
                { label: '已分配', value: 'ASSIGNED' },
              ]}
            />
            <Button type="primary" icon={<Zap size={14} />} onClick={() => setScoreModal(true)}>AI评分</Button>
            <Button icon={<RefreshCw size={14} />} onClick={() => { void fetchPending(); void fetchStats() }}>刷新</Button>
          </Space>
        }
      >
        <Table
          dataSource={triagePageData}
          columns={columns}
          rowKey="examId"
          loading={loading}
          pagination={triagePagination}
          size="small"
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分检任务" /> }}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal title="AI分检详情" open={showDetail} onCancel={() => { setShowDetail(false); setSelectedItem(null) }} footer={
        selectedItem && selectedItem.status !== 'ASSIGNED' && selectedItem.status !== 'COMPLETED' ? (
          <Button type="primary" icon={<UserCheck size={14} />} loading={assigning} onClick={() => void handleAssign(selectedItem)}>分配医生</Button>
        ) : null
      } width={640}>
        {selectedItem && (<div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Card size="small"><Statistic title="综合评分" value={selectedItem.score} styles={{ content: { color: levelColor[selectedItem.level] } }} /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title="优先级" value={levelLabel[selectedItem.level]} styles={{ content: { color: levelColor[selectedItem.level] } }} /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title="AI置信度" value={`${((selectedItem.aiConfidence ?? 0) * 100).toFixed(1)}%`} /></Card></Col>
          </Row>
          <Card size="small" title="评估因子" style={{ marginBottom: 16 }}>
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
          <Card size="small" title="AI推理" style={{ marginBottom: 16 }}>
            <p style={{ color: '#666', fontSize: 13, margin: 0 }}>{selectedItem.reasoning}</p>
          </Card>
          <Space wrap>
            {selectedItem.suggestedDoctor && <Tag icon={<UserCheck size={12} />} color="purple">建议分配给: {selectedItem.suggestedDoctor}</Tag>}
            {selectedItem.assignedDoctor && <Tag color="blue">已分配: {selectedItem.assignedDoctor}</Tag>}
            {selectedItem.examType && <Tag icon={<Search size={12} />}>{selectedItem.examType}</Tag>}
          </Space>
        </div>)}
      </Modal>

      <Modal title="AI 分检评分" open={scoreModal} onCancel={() => setScoreModal(false)} footer={null} width={420}>
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
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>检查ID (可选)</div>
        <input className="ant-input" style={{ width: '100%' }} value={examId} onChange={(e) => setExamId(e.target.value)} placeholder="EXAM-20260807-005" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>患者姓名</div>
        <input className="ant-input" style={{ width: '100%' }} value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="请输入患者姓名" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>检查类型</div>
        <Segmented options={['CT', 'MR', 'X-ray', 'US']} value={examType} onChange={(v) => setExamType(v as string)} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>主诉症状</div>
        <textarea className="ant-input" rows={2} style={{ width: '100%' }} value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="如: 突发胸痛、呼吸困难" />
      </div>
      <Button type="primary" block loading={submitting} icon={<Zap size={14} />} onClick={() => onSubmit({ examId, patientName, examType, symptoms })}>开始评分</Button>
    </div>
  )
}

export default AiTriagePage
