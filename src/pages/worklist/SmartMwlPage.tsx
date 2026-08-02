import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Tag, Space, Input, Select, Row, Col, Statistic, Slider, Form, Modal, message, Progress } from 'antd'
import { Search, Star, ArrowUpDown, Settings, RefreshCw, Clock, AlertTriangle, User, FileText } from 'lucide-react'
import { smartMwlApi, type SmartMwlItem, type SmartScoreFactors } from '../../services/api/smartMwlApi'

const levelColor: Record<string, string> = { critical: 'red', urgent: 'orange', 'semi-urgent': 'gold', routine: 'green' }
const levelLabel: Record<string, string> = { critical: '危急', urgent: '紧急', 'semi-urgent': '半紧急', routine: '常规' }

const SmartMwlPage: React.FC = () => {
  const [items, setItems] = useState<SmartMwlItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<SmartMwlItem | null>(null)
  const [scoreResult, setScoreResult] = useState<SmartScoreFactors | null>(null)
  const [showWeights, setShowWeights] = useState(false)
  const [weights, setWeights] = useState({ urgencyWeight: 0.3, waitTimeWeight: 0.25, ageWeight: 0.15, patientTypeWeight: 0.15, bodyPartWeight: 0.1, clinicalInfoWeight: 0.05 })

  const fetchWorklist = useCallback(async () => {
    setLoading(true)
    try {
      const res = await smartMwlApi.getWorklist()
      if (res.success) setItems(res.data)
    } catch { message.error('加载失败') } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchWorklist() }, [fetchWorklist])

  const handleScore = async (item: SmartMwlItem) => {
    setSelectedItem(item)
    try { const res = await smartMwlApi.score(item); if (res.success) setScoreResult(res.data) } catch { message.error('评分失败') }
  }

  const handleReorder = async () => {
    setLoading(true)
    try {
      const res = await smartMwlApi.reorder(items)
      if (res.success) { setItems(res.data.sort((a, b) => a.rank - b.rank)); message.success('智能排序完成') }
    } catch { message.error('排序失败') } finally { setLoading(false) }
  }

  const filteredItems = items.filter(item => !search || item.patientName.toLowerCase().includes(search.toLowerCase()) || item.id.toLowerCase().includes(search.toLowerCase()))

  const columns = [
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80, render: (p: string) => <Tag color={p === '危重' ? 'red' : p === '紧急' ? 'orange' : 'blue'}>{p}</Tag> },
    { title: '患者', dataIndex: 'patientName', key: 'patientName', render: (name: string, r: SmartMwlItem) => <Space><User size={14} /><span>{name}</span><span style={{ color: '#666', fontSize: 12 }}>{r.gender} / {r.age}岁</span></Space> },
    { title: '检查项目', dataIndex: 'examItem', key: 'examItem', render: (item: string, r: SmartMwlItem) => <Space orientation="vertical" size={0}><span>{item}</span><span style={{ color: '#666', fontSize: 12 }}>{r.modality} · {r.bodyPart}</span></Space> },
    { title: '患者类型', dataIndex: 'patientType', key: 'patientType', width: 100, render: (type: string) => <Tag>{type}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => <Tag color={s === '待检查' ? 'blue' : 'green'}>{s}</Tag> },
    { title: '等待时间', dataIndex: 'createdTime', key: 'waitTime', width: 100, render: (t: string) => { const h = Math.floor((Date.now() - new Date(t).getTime()) / 3600000); return <span style={{ color: h > 2 ? '#ff4d4f' : '#666' }}>{h}h</span> } },
    { title: '操作', key: 'actions', width: 100, render: (_: unknown, r: SmartMwlItem) => <Button size="small" icon={<Star size={14} />} onClick={() => handleScore(r)}>评分</Button> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Search size={20} color="#1677ff" />
        <h1 style={{ fontSize: 20, margin: 0 }}>Smart MWL 智能排序</h1>
        <Tag color="blue">多因子评分</Tag>
      </div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="总检查数" value={items.length} prefix={<FileText size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="平均等待" value={0} suffix="min" prefix={<Clock size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="危急" value={0} styles={{ content: {  color: '#cf1322'  } }} prefix={<AlertTriangle size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="紧急" value={0} styles={{ content: {  color: '#fa8c16'  } }} prefix={<Clock size={16} />} /></Card></Col>
      </Row>
      <Card title="检查列表" extra={<Space>
        <Input placeholder="搜索" prefix={<Search size={14} />} value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
        <Button type="primary" icon={<ArrowUpDown size={14} />} onClick={handleReorder}>智能排序</Button>
        <Button icon={<Settings size={14} />} onClick={() => setShowWeights(true)}>权重配置</Button>
        <Button icon={<RefreshCw size={14} />} onClick={fetchWorklist}>刷新</Button>
      </Space>}>
        <Table dataSource={filteredItems} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} size="small" />
      </Card>
      {selectedItem && scoreResult && (
        <Modal title={`AI评分 - ${selectedItem.patientName}`} open={!!selectedItem} onCancel={() => { setSelectedItem(null); setScoreResult(null) }} footer={null} width={600}>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={8}><Statistic title="综合评分" value={scoreResult.totalScore} styles={{ content: {  color: levelColor[scoreResult.level] === 'red' ? '#cf1322' : '#1677ff'  } }} /></Col>
              <Col span={8}><Statistic title="优先级" value={levelLabel[scoreResult.level]} styles={{ content: {  color: levelColor[scoreResult.level]  } }} /></Col>
            </Row>
          </Card>
          <div style={{ marginBottom: 16 }}><h4>评分因子</h4>{scoreResult.factors.map((f, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ width: 120 }}>{f.name}</span><Slider style={{ flex: 1 }} value={f.contribution * 100} disabled /><span style={{ width: 60, textAlign: 'right' }}>{(f.contribution * 100).toFixed(1)}%</span></div>)}</div>
          <div><h4>评估理由</h4><ul style={{ paddingLeft: 20 }}>{scoreResult.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
        </Modal>
      )}
      <Modal title="智能排序权重配置" open={showWeights} onOk={() => { message.success('权重已保存'); setShowWeights(false) }} onCancel={() => setShowWeights(false)}>
        <Form layout="vertical">
          <Form.Item label="紧急度权重"><Slider value={weights.urgencyWeight * 100} onChange={v => setWeights(prev => ({ ...prev, urgencyWeight: v / 100 }))} /></Form.Item>
          <Form.Item label="等待时间权重"><Slider value={weights.waitTimeWeight * 100} onChange={v => setWeights(prev => ({ ...prev, waitTimeWeight: v / 100 }))} /></Form.Item>
          <Form.Item label="年龄权重"><Slider value={weights.ageWeight * 100} onChange={v => setWeights(prev => ({ ...prev, ageWeight: v / 100 }))} /></Form.Item>
          <Form.Item label="患者类型权重"><Slider value={weights.patientTypeWeight * 100} onChange={v => setWeights(prev => ({ ...prev, patientTypeWeight: v / 100 }))} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SmartMwlPage
