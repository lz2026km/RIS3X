import { useState, useEffect } from 'react'
import { backupApi, type BackupDto } from '../services/api/systemApi'
import { Card, Table, Tag, Button, Space, message, Modal, Select, Row, Col, Statistic, Tabs, Descriptions, Tooltip } from 'antd'
import { CloudUploadOutlined, DownloadOutlined, UndoOutlined, ReloadOutlined, SafetyOutlined, ClockCircleOutlined, SyncOutlined, DatabaseOutlined } from '@ant-design/icons'
import { usePagination } from '../hooks/usePagination'

export default function BackupPage() {
  const [list, setList] = useState<BackupDto[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [autoBackup, _setAutoBackup] = useState(true)
  const [schedule, _setSchedule] = useState('0 2 * * *')
  const [backupType, setBackupType] = useState<string | undefined>(undefined)
  const { pageData, pagination } = usePagination(list, 10)

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
    { title: '状态', dataIndex: 'status', key: 'status', width: 120, render: (v: string) => {
      const colorMap: Record<string, string> = { COMPLETED: 'success', RUNNING: 'processing', FAILED: 'error', PENDING: 'warning' }
      return <Tag color={colorMap[v] ?? 'default'} icon={v === 'RUNNING' ? <SyncOutlined spin /> : undefined}>{v}</Tag>
    }},
    { title: '大小', dataIndex: 'sizeBytes', key: 'sizeBytes', width: 100, render: (v: number) => v ? `${(v / 1024 / 1024).toFixed(2)} MB` : '-' },
    { title: '创建人', dataIndex: 'createdBy', key: 'createdBy', width: 120 },
    {
      title: '操作', key: 'actions', width: 160,
      render: (_: unknown, r: BackupDto) => (
        <Space>
          <Tooltip title="下载备份文件"><Button size="small" icon={<DownloadOutlined />} onClick={() => backupApi.download(r.id)}>下载</Button></Tooltip>
          <Tooltip title="恢复到此备份"><Button size="small" icon={<UndoOutlined />} onClick={() => handleRestore(r.id)}>恢复</Button></Tooltip>
        </Space>
      ),
    },
  ]

  const completedBackups = list.filter((b) => b.status === 'COMPLETED')
  const totalSize = completedBackups.reduce((acc, b) => acc + (b.sizeBytes ?? 0), 0)

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <h2 style={{ margin: 0 }}><SafetyOutlined /> 备份管理</h2>
            <Space>
              <Select
                placeholder="备份类型"
                style={{ width: 140 }}
                value={backupType}
                onChange={(v: string) => setBackupType(v)}
                options={[
                  { value: 'FULL', label: '全量备份' },
                  { value: 'INCREMENTAL', label: '增量备份' },
                ]}
              />
              <Button type="primary" icon={<CloudUploadOutlined />} loading={creating} disabled={!backupType} onClick={() => { if (backupType) handleCreate(backupType); }}>开始备份</Button>
              <Button icon={<ReloadOutlined />} onClick={fetchList}>刷新</Button>
            </Space>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Card size="small">
                <Statistic title="备份总数" value={list.length} prefix={<CloudUploadOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="全量备份" value={list.filter((b) => b.type === 'FULL').length} prefix={<DatabaseOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="增量备份" value={list.filter((b) => b.type === 'INCREMENTAL').length} prefix={<SyncOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="总存储" value={(totalSize / 1024 / 1024).toFixed(1)} suffix="MB" prefix={<CloudUploadOutlined />} />
              </Card>
            </Col>
          </Row>

          <Tabs items={[
            {
              key: 'list',
              label: <span><ClockCircleOutlined /> 备份记录</span>,
              children: (
                <Table dataSource={pageData} columns={columns} rowKey="id" loading={loading} pagination={pagination} size="small" scroll={{ x: 'max-content' }}/>
              ),
            },
            {
              key: 'schedule',
              label: <span><SyncOutlined /> 自动备份</span>,
              children: (
                <Card size="small">
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label="自动备份">
                      <Tag color={autoBackup ? 'green' : 'default'}>{autoBackup ? '已启用' : '已禁用'}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="备份计划">{schedule}</Descriptions.Item>
                    <Descriptions.Item label="保留策略">最近 7 次全量 + 30 天增量</Descriptions.Item>
                    <Descriptions.Item label="下次执行">每天凌晨 2:00</Descriptions.Item>
                    <Descriptions.Item label="备份位置">/data/backups/ris/</Descriptions.Item>
                    <Descriptions.Item label="加密状态"><Tag color="success">AES-256</Tag></Descriptions.Item>
                  </Descriptions>
                </Card>
              ),
            },
          ]} />
        </Space>
      </Card>
    </div>
  )
}
