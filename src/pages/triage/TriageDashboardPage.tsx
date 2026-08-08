import React, { useEffect, useState, useCallback } from 'react'
import {
  Table, Button, Tag, Modal, Select, message, Card, Row, Col, Statistic,
  Space, Descriptions, Progress, Typography, Tooltip, Badge, Input,
} from 'antd'
import { Siren, UserCheck, Clock, AlertTriangle, RefreshCw, Filter } from 'lucide-react'
import { triageApi, type TriagePendingItem, type TriageScoreResult, type TriageFactor } from '../../services/api/triageApi'

const { Text, Title } = Typography

const levelColor: Record<string, string> = {
  CRITICAL: 'red',
  URGENT: 'orange',
  SEMI_URGENT: 'gold',
  ROUTINE: 'green',
}

const levelLabel: Record<string, string> = {
  CRITICAL: '危急',
  URGENT: '紧急',
  SEMI_URGENT: '亚紧急',
  ROUTINE: '常规',
}

const TriageDashboardPage: React.FC = () => {
  const [items, setItems] = useState<TriagePendingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<TriagePendingItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [newDoctor, setNewDoctor] = useState('')
  const [newStatus, setNewStatus] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [searchText, setSearchText] = useState('')
  const [scoreResult, setScoreResult] = useState<TriageScoreResult | null>(null)
  const [scoring, setScoring] = useState(false)

  const fetchPending = useCallback(async () => {
    setLoading(true)
    try {
      const res = await triageApi.getPending()
      if (res.success) {
        setItems(res.data ?? [])
      } else {
        message.error(res.error?.message || '加载分检列表失败')
      }
    } catch {
      message.error('加载分检列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  const handleAssign = async (item: TriagePendingItem) => {
    setScoring(true)
    try {
      const res = await triageApi.assign({
        examId: item.examId,
        patientId: item.patientId,
        patientName: item.patientName,
        examType: item.examType,
      })
      if (res.success) {
        message.success(`已分配给 ${res.data.assignedDoctor}`)
        fetchPending()
      } else {
        message.error(res.error?.message || '分配失败')
      }
    } catch {
      message.error('分配失败')
    } finally {
      setScoring(false)
    }
  }

  const handleScore = async (item: TriagePendingItem) => {
    setScoring(true)
    try {
      const res = await triageApi.score({
        examId: item.examId,
        patientId: item.patientId,
        patientName: item.patientName,
        examType: item.examType,
      })
      if (res.success) {
        setScoreResult(res.data)
        message.info(`评分: ${res.data.score} - ${levelLabel[res.data.level]}`)
      } else {
        message.error(res.error?.message || '评分失败')
      }
    } catch {
      message.error('评分失败')
    } finally {
      setScoring(false)
    }
  }

  const handleConfirm = async (item: TriagePendingItem) => {
    try {
      const res = await triageApi.update(item.id, { status: 'COMPLETED' })
      if (res.success) {
        message.success('已确认完成')
        fetchPending()
      } else {
        message.error(res.error?.message || '确认失败')
      }
    } catch {
      message.error('确认失败')
    }
  }

  const handleManualUpdate = async () => {
    if (!selectedItem) return
    try {
      const res = await triageApi.update(selectedItem.id, {
        assignedDoctor: newDoctor || undefined,
        status: newStatus || undefined,
      })
      if (res.success) {
        message.success('更新成功')
        setDetailOpen(false)
        fetchPending()
      } else {
        message.error(res.error?.message || '更新失败')
      }
    } catch {
      message.error('更新失败')
    }
  }

  const filteredItems = items.filter(item => {
    const matchStatus = !statusFilter || item.status === statusFilter
    const matchSearch = !searchText ||
      item.patientName.includes(searchText) ||
      item.examType.includes(searchText) ||
      (item.assignedDoctor ?? '').includes(searchText)
    return matchStatus && matchSearch
  })

  const scoreColor = (score: number) => {
    if (score >= 16) return 'red'
    if (score >= 11) return 'orange'
    if (score >= 6) return 'gold'
    return 'green'
  }

  const columns = [
    {
      title: '患者姓名',
      dataIndex: 'patientName',
      key: 'patientName',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '检查类型',
      dataIndex: 'examType',
      key: 'examType',
    },
    {
      title: '评分',
      dataIndex: 'score',
      key: 'score',
      sorter: (a: TriagePendingItem, b: TriagePendingItem) => b.score - a.score,
      render: (s: number) => <Tag color={scoreColor(s)}>{s}</Tag>,
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      render: (lvl: string) => (
        <Tag color={levelColor[lvl] ?? 'default'}>{levelLabel[lvl] ?? lvl}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Badge
          status={s === 'COMPLETED' ? 'success' : s === 'ASSIGNED' ? 'processing' : 'default'}
          text={s === 'ASSIGNED' ? '已分诊' : s === 'COMPLETED' ? '已完成' : s === 'PENDING' ? '待分诊' : s}
        />
      ),
    },
    {
      title: '分配医生',
      dataIndex: 'assignedDoctor',
      key: 'assignedDoctor',
      render: (d: string | undefined) => d ?? '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: TriagePendingItem) => (
        <Space size="small">
          {record.status === 'PENDING' && (
            <>
              <Tooltip title="自动分配">
                <Button size="small" type="primary" icon={<UserCheck size={12} />} onClick={() => handleAssign(record)} loading={scoring}>
                  分配
                </Button>
              </Tooltip>
              <Tooltip title="AI评分">
                <Button size="small" icon={<AlertTriangle size={12} />} onClick={() => handleScore(record)} loading={scoring}>
                  评分
                </Button>
              </Tooltip>
            </>
          )}
          <Tooltip title="详情/调整">
            <Button size="small" onClick={() => {
              setSelectedItem(record)
              setNewDoctor(record.assignedDoctor ?? '')
              setNewStatus(record.status)
              setDetailOpen(true)
            }}>
              详情
            </Button>
          </Tooltip>
          {record.status !== 'COMPLETED' && (
            <Tooltip title="确认完成">
              <Button size="small" type="default" onClick={() => handleConfirm(record)}>
                完成
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  const criticalCount = items.filter(i => i.level === 'CRITICAL').length
  const urgentCount = items.filter(i => i.level === 'URGENT').length
  const pendingCount = items.filter(i => i.status === 'PENDING').length
  const completedCount = items.filter(i => i.status === 'COMPLETED').length

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f5f5f5' }}>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Siren size={24} color="#ef4444" />
          <Title level={4} style={{ margin: 0 }}>AI 智能分诊看板</Title>
          <Tag color="red">P0</Tag>
        </Space>
        <Text type="secondary">基于多因子评分模型的急诊分诊工作台，支持自动评分、智能分配和手动调整</Text>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="待分检" value={pendingCount} styles={{ content: {  color: '#2563eb'  } }} prefix={<Clock size={16} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="危急" value={criticalCount} styles={{ content: {  color: '#cf1322'  } }} prefix={<AlertTriangle size={16} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="紧急" value={urgentCount} styles={{ content: {  color: '#fa8c16'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已完成" value={completedCount} styles={{ content: {  color: '#52c41a'  } }} />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <Filter size={14} />
            <span>分诊队列</span>
            <Text type="secondary" style={{ fontSize: 12 }}>({filteredItems.length} 条)</Text>
          </Space>
        }
        extra={
          <Space>
            <Input
              placeholder="搜索患者/检查/医生"
              prefix={<Filter size={12} />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              placeholder="状态筛选"
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              style={{ width: 120 }}
              options={[
                { value: 'PENDING', label: '待分检' },
                { value: 'ASSIGNED', label: '已分配' },
                { value: 'COMPLETED', label: '已完成' },
              ]}
            />
            <Button icon={<RefreshCw size={14} />} onClick={fetchPending} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={filteredItems}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      {scoreResult && (
        <Card title="AI 评分结果" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="总评分" value={scoreResult.score} styles={{ content: {  color: scoreColor(scoreResult.score)  } }} />
            </Col>
            <Col span={6}>
              <Statistic title="分级" value={levelLabel[scoreResult.level]} styles={{ content: {  color: levelColor[scoreResult.level]  } }} />
            </Col>
            <Col span={12}>
              <Text strong>评分因子:</Text>
              {scoreResult.factors.map((f: TriageFactor) => (
                <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <Text style={{ width: 100, fontSize: 13 }}>{f.name}</Text>
                  <Progress percent={Math.min((f.contribution / 10) * 100, 100)} size="small" style={{ flex: 1 }} />
                  <Tag color={scoreColor(f.contribution)}>{f.contribution}</Tag>
                </div>
              ))}
            </Col>
          </Row>
        </Card>
      )}

      <Modal
        title="分诊详情调整"
        open={detailOpen}
        onOk={handleManualUpdate}
        onCancel={() => setDetailOpen(false)}
        width={500}
      >
        {selectedItem && (
          <>
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="患者姓名">{selectedItem.patientName}</Descriptions.Item>
              <Descriptions.Item label="检查类型">{selectedItem.examType}</Descriptions.Item>
              <Descriptions.Item label="评分">
                <Tag color={scoreColor(selectedItem.score)}>{selectedItem.score}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="分级">
                <Tag color={levelColor[selectedItem.level]}>{levelLabel[selectedItem.level]}</Tag>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4, fontWeight: 600 }}>分配医生</div>
              <Select
                style={{ width: '100%' }}
                value={newDoctor}
                onChange={setNewDoctor}
                allowClear
                placeholder="选择医生"
                options={[
                  { value: '张主任', label: '张主任' },
                  { value: '李主任', label: '李主任' },
                  { value: '王主任', label: '王主任' },
                  { value: '陈医生', label: '陈医生' },
                  { value: '赵医生', label: '赵医生' },
                  { value: '周医生', label: '周医生' },
                  { value: '吴医生', label: '吴医生' },
                ]}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4, fontWeight: 600 }}>状态</div>
              <Select
                style={{ width: '100%' }}
                value={newStatus}
                onChange={setNewStatus}
                options={[
                  { value: 'PENDING', label: '待分检' },
                  { value: 'ASSIGNED', label: '已分配' },
                  { value: 'COMPLETED', label: '已完成' },
                ]}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

export default TriageDashboardPage
