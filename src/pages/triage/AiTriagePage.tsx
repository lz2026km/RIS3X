import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Tag, Space, Row, Col, Statistic, Modal, Progress, message, Tabs } from 'antd'
import { Bot, User, AlertTriangle, CheckCircle, Clock, BarChart3, RefreshCw, FileText, Zap } from 'lucide-react'
import { aiTriageApi, type AiTriageResult } from '../../services/api/aiTriageApi'

const levelColor: Record<string, string> = { CRITICAL: 'red', URGENT: 'orange', SEMI_URGENT: 'gold', ROUTINE: 'green' }
const levelLabel: Record<string, string> = { CRITICAL: '危急', URGENT: '紧急', SEMI_URGENT: '半紧急', ROUTINE: '常规' }

const AiTriagePage: React.FC = () => {
  const [items, setItems] = useState<AiTriageResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<AiTriageResult | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const fetchPending = useCallback(async () => {
    setLoading(true)
    try { const res = await aiTriageApi.getPending(); if (res.success) setItems(res.data) } catch { message.error('加载失败') } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPending() }, [fetchPending])

  const handleScore = async () => {
    try {
      const res = await aiTriageApi.score({ examId: `EXAM-${Date.now()}`, patientId: `P${Date.now()}`, patientName: '测试患者', examType: 'CT' })
      if (res.success) { setItems(prev => [res.data, ...prev]); message.success('AI评分完成') }
    } catch { message.error('评分失败') }
  }

  const columns = [
    { title: '检查ID', dataIndex: 'examId', key: 'examId', width: 120 },
    { title: 'AI评分', dataIndex: 'score', key: 'score', width: 100, sorter: (a: AiTriageResult, b: AiTriageResult) => b.score - a.score, render: (s: number) => <Progress percent={s} size="small" strokeColor={s >= 80 ? '#ff4d4f' : s >= 60 ? '#faad14' : '#52c41a'} /> },
    { title: '优先级', dataIndex: 'level', key: 'level', width: 100, render: (l: string) => <Tag color={levelColor[l]}>{levelLabel[l]}</Tag> },
    { title: 'AI置信度', dataIndex: 'aiConfidence', key: 'aiConfidence', width: 120, render: (c: number) => `${(c * 100).toFixed(1)}%` },
    { title: '建议医生', dataIndex: 'suggestedDoctor', key: 'suggestedDoctor', render: (d: string) => d || '-' },
    { title: '操作', key: 'actions', width: 100, render: (_: unknown, r: AiTriageResult) => <Button size="small" onClick={() => { setSelectedItem(r); setShowDetail(true) }}>详情</Button> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Bot size={20} color="#722ed1" /><h1 style={{ fontSize: 20, margin: 0 }}>AI 智能分检</h1><Tag color="purple">AI 辅助诊断</Tag>
      </div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="总分检数" value={items.length} prefix={<FileText size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="危急" value={items.filter(i => i.level === 'CRITICAL').length} valueStyle={{ color: '#cf1322' }} prefix={<AlertTriangle size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="AI准确率" value={95} suffix="%" prefix={<CheckCircle size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="平均处理" value={120} suffix="ms" prefix={<Clock size={16} />} /></Card></Col>
      </Row>
      <Card title="AI分检任务" extra={<Space><Button type="primary" icon={<Zap size={14} />} onClick={handleScore}>AI评分</Button><Button icon={<RefreshCw size={14} />} onClick={fetchPending}>刷新</Button></Space>}>
        <Table dataSource={items} columns={columns} rowKey="examId" loading={loading} pagination={{ pageSize: 10 }} size="small" />
      </Card>
      <Modal title="AI分检详情" open={showDetail} onCancel={() => { setShowDetail(false); setSelectedItem(null) }} footer={null} width={600}>
        {selectedItem && (<div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Card size="small"><Statistic title="综合评分" value={selectedItem.score} valueStyle={{ color: levelColor[selectedItem.level] }} /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title="优先级" value={levelLabel[selectedItem.level]} valueStyle={{ color: levelColor[selectedItem.level] }} /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title="AI置信度" value={`${(selectedItem.aiConfidence * 100).toFixed(1)}%`} /></Card></Col>
          </Row>
          <Card size="small" title="评估因子" style={{ marginBottom: 16 }}>
            {selectedItem.factors.map((f, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ width: 120 }}>{f.name}</span><Progress style={{ flex: 1 }} percent={f.contribution * 100} size="small" /><span style={{ width: 60, textAlign: 'right' }}>{(f.contribution * 100).toFixed(1)}%</span></div>)}
          </Card>
          <Card size="small" title="AI推理"><p style={{ color: '#666', fontSize: 13, margin: 0 }}>{selectedItem.reasoning}</p></Card>
          {selectedItem.suggestedDoctor && <div style={{ marginTop: 16 }}><AlertTriangle size={14} /> 建议分配给: {selectedItem.suggestedDoctor}</div>}
        </div>)}
      </Modal>
    </div>
  )
}

export default AiTriagePage
