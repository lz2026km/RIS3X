import { useState, useEffect } from 'react'
import { backupApi, type BackupDto } from '../services/api/systemApi'
import { Card, Table, Tag, Button, Space, message, Modal, Select, Row, Col, Statistic } from 'antd'
import { CloudUploadOutlined, DownloadOutlined, UndoOutlined, ReloadOutlined, SafetyOutlined } from '@ant-design/icons'

export default function BackupPage() {
  const [list, setList] = useState<BackupDto[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const fetchList = async () => {
    setLoading(true)
    const res = await backupApi.list()
    if (res.success) setList(res.data)
    setLoading(false)
  }

  useEffect(() => { fetchList() }, [])

  const handleCreate = async (type: string) => {
    setCreating(true)
    const res = await backupApi.create(type)
    if (res.success) {
      message.success('备份创建成功')
      fetchList()
    }
    setCreating(false)
  }

  const handleRestore = (id: string) => {
    Modal.confirm({
      title: '恢复备份',
      content: '确定要恢复此备份吗？此操作将覆盖当前数据。',
      onOk: async () => {
        const res = await backupApi.restore(id)
        if (res.success) message.success('恢复成功')
      },
    })
  }

  const columns = [
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '类型', dataIndex: 'type', key: 'type', width: 100, render: (v: string) => <Tag color={v === 'FULL' ? 'blue' : 'green'}>{v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={v === 'COMPLETED' ? 'success' : 'warning'}>{v}</Tag> },
    { title: '大小', dataIndex: 'sizeBytes', key: 'sizeBytes', width: 100, render: (v: number) => v ? `${(v / 1024 / 1024).toFixed(2)} MB` : '-' },
    { title: '创建人', dataIndex: 'createdBy', key: 'createdBy', width: 120 },
    {
      title: '操作', key: 'actions', width: 160,
      render: (_: unknown, r: BackupDto) => (
        <Space>
          <Button size="small" icon={<DownloadOutlined />} onClick={() => backupApi.download(r.id)}>下载</Button>
          <Button size="small" icon={<UndoOutlined />} onClick={() => handleRestore(r.id)}>恢复</Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <h2 style={{ margin: 0 }}><SafetyOutlined /> 备份管理</h2>
            <Space>
              <Select placeholder="备份类型" style={{ width: 140 }} onSelect={(v: string) => handleCreate(v)} loading={creating}>
                <Select.Option value="FULL">全量备份</Select.Option>
                <Select.Option value="INCREMENTAL">增量备份</Select.Option>
              </Select>
              <Button icon={<ReloadOutlined />} onClick={fetchList}>刷新</Button>
            </Space>
          </Row>
          <Row gutter={16}>
            <Col span={6}><Statistic title="备份总数" value={list.length} prefix={<CloudUploadOutlined />} /></Col>
            <Col span={6}><Statistic title="全量备份" value={list.filter(b => b.type === 'FULL').length} /></Col>
          </Row>
          <Table dataSource={list} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} size="small" />
        </Space>
      </Card>
    </div>
  )
}
