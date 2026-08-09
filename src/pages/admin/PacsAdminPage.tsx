// [v3.0.6.11-60] Batch 3: PACS 管理 (pacsAdminApi 真实数据 + AE 服务器/存储管理)
import {
  pacsAdminApi,
  type PacsServer,
  type PacsStorageGroup,
  type PacsAssociation,
  type PacsAdminStats,
} from '../../services/api/pacsAdminApi'
import { Card, Table, Button, Tag, Space, Typography, Row, Col, Statistic, message, Modal, Input, Form, Popconfirm, Alert, Spin, Progress } from 'antd'
import { Server, Wifi, WifiOff, Database, Activity, Plus, RefreshCw, Link2, Trash2, Zap, HardDrive } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(1)} TB`
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

const PacsAdminPage: React.FC = () => {
  const [servers, setServers] = useState<PacsServer[]>([])
  const [storage, setStorage] = useState<PacsStorageGroup[]>([])
  const [associations, setAssociations] = useState<PacsAssociation[]>([])
  const [stats, setStats] = useState<PacsAdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [testingId, setTestingId] = useState<string | null>(null)
  const [serverModal, setServerModal] = useState(false)
  const [storageModal, setStorageModal] = useState(false)
  const [serverForm] = Form.useForm()
  const [storageForm] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [serverRes, storageRes, assocRes, statsRes] = await Promise.all([
        pacsAdminApi.listServers(),
        pacsAdminApi.listStorageGroups(),
        pacsAdminApi.listAssociations(),
        pacsAdminApi.getStats(),
      ])
      if (serverRes.success && Array.isArray(serverRes.data)) setServers(serverRes.data)
      else if (serverRes.error) setError(serverRes.error.message)
      if (storageRes.success && Array.isArray(storageRes.data)) setStorage(storageRes.data)
      if (assocRes.success && Array.isArray(assocRes.data)) setAssociations(assocRes.data)
      if (statsRes.success && statsRes.data) setStats(statsRes.data as PacsAdminStats)
    } catch (e) {
      setError((e as Error)?.message ?? 'PACS 数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleTestConnection = async (id: string) => {
    setTestingId(id)
    try {
      const res = await pacsAdminApi.testConnection(id)
      if (res.success && res.data?.success) message.success(`连接正常，延迟 ${res.data.latencyMs}ms`)
      else message.error('连接失败')
    } catch {
      message.error('连接测试失败')
    } finally {
      setTestingId(null)
    }
  }

  const handleAddServer = async () => {
    const values = await serverForm.validateFields()
    const res = await pacsAdminApi.addServer(values)
    if (res.success) { message.success('AE 服务器已添加'); setServerModal(false); serverForm.resetFields(); void fetchData() }
    else message.error(res.error?.message ?? '添加失败')
  }

  const handleDeleteServer = async (id: string) => {
    const res = await pacsAdminApi.deleteServer(id)
    if (res.success) { message.success('已删除'); void fetchData() }
    else message.error(res.error?.message ?? '删除失败')
  }

  const handleAddStorage = async () => {
    const values = await storageForm.validateFields()
    const res = await pacsAdminApi.createStorageGroup(values)
    if (res.success) { message.success('存储组已创建'); setStorageModal(false); storageForm.resetFields(); void fetchData() }
    else message.error(res.error?.message ?? '创建失败')
  }

  const handleDeleteStorage = async (id: string) => {
    const res = await pacsAdminApi.deleteStorageGroup(id)
    if (res.success) { message.success('已删除'); void fetchData() }
    else message.error(res.error?.message ?? '删除失败')
  }

  const serverColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', render: (v: string, r: PacsServer) => <Space><Server size={14} color="#2563eb" /><b>{v}</b><Tag>{r.aeTitle}</Tag></Space> },
    { title: '主机', dataIndex: 'hostname', key: 'hostname', render: (v: string) => <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Typography.Text> },
    { title: '端口', dataIndex: 'port', key: 'port', width: 80 },
    { title: '应用实体名', dataIndex: 'aeTitle', key: 'ae', width: 130, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={v === 'online' ? 'green' : v === 'error' ? 'red' : 'default'} icon={v === 'online' ? <Wifi size={12} /> : <WifiOff size={12} />}>{v === 'online' ? '在线' : v === 'error' ? '故障' : '离线'}</Tag> },
    { title: '心跳', dataIndex: 'lastHeartbeat', key: 'heartbeat', width: 170, render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 19) : '-'}</span> },
    { title: '检查数', dataIndex: 'studyCount', key: 'studies', width: 100, render: (v: number) => v?.toLocaleString() },
    { title: '存储', dataIndex: 'storageBytes', key: 'storage', width: 100, render: (v: number) => formatBytes(v ?? 0) },
    {
      title: '操作', key: 'ops', width: 170,
      render: (_: unknown, r: PacsServer) => (
        <Space size={4}>
          <Button size="small" icon={<Zap size={12} />} loading={testingId === r.id} onClick={() => void handleTestConnection(r.id)}>测试</Button>
          <Popconfirm title="确认删除该服务器？" onConfirm={() => void handleDeleteServer(r.id)}>
            <Button size="small" danger icon={<Trash2 size={12} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const storageColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', render: (v: string) => <Space><HardDrive size={14} color="#13c2c2" />{v}</Space> },
    { title: '路径', dataIndex: 'path', key: 'path', render: (v: string) => <Typography.Text code style={{ fontSize: 12 }}>{v}</Typography.Text> },
    { title: '总容量', dataIndex: 'totalBytes', key: 'total', render: (v: number) => formatBytes(v) },
    { title: '已用', dataIndex: 'usedBytes', key: 'used', render: (v: number) => formatBytes(v) },
    {
      title: '使用率', key: 'usage',
      render: (_: unknown, r: PacsStorageGroup) => {
        const pct = r.totalBytes > 0 ? Math.round((r.usedBytes / r.totalBytes) * 1000) / 10 : 0
        return <Progress percent={pct} size="small" status={pct > 90 ? 'exception' : 'normal'} />
      },
    },
    { title: '检查数', dataIndex: 'studyCount', key: 'studyCount', render: (v: number) => v?.toLocaleString() },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'active' ? 'green' : v === 'readonly' ? 'orange' : 'default'}>{v === 'active' ? '启用' : v === 'readonly' ? '只读' : '离线'}</Tag> },
    {
      title: '操作', key: 'ops', width: 80,
      render: (_: unknown, r: PacsStorageGroup) => (
        <Popconfirm title="确认删除该存储组？" onConfirm={() => void handleDeleteStorage(r.id)}>
          <Button size="small" danger icon={<Trash2 size={12} />} />
        </Popconfirm>
      ),
    },
  ]

  const associationColumns = [
    { title: '本地 AE', dataIndex: 'localAe', key: 'localAe', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '远端 AE', dataIndex: 'remoteAe', key: 'remoteAe', render: (v: string) => <Tag>{v}</Tag> },
    { title: '远端主机', dataIndex: 'remoteHost', key: 'remoteHost', render: (v: string, r: PacsAssociation) => <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}:{r.remotePort}</Typography.Text> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'connected' ? 'green' : v === 'failed' ? 'red' : 'default'}>{v === 'connected' ? '已连接' : v === 'failed' ? '失败' : '断开'}</Tag> },
    { title: '请求数', dataIndex: 'requestCount', key: 'req', render: (v: number) => v?.toLocaleString() },
    { title: '错误数', dataIndex: 'errorCount', key: 'err', render: (v: number) => <span style={{ color: (v ?? 0) > 20 ? '#ff4d4f' : '#52c41a' }}>{v ?? 0}</span> },
    { title: '最近活动', dataIndex: 'lastActivity', key: 'last', render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 19) : '-'}</span> },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      {/* [G005 W1-C] 演示数据（后端待实现）: 后端无 pacs-admin controller, 数据由 MSW 提供 */}
      <Alert
        type="warning"
        showIcon
        banner
        message="演示数据（后端待实现）"
        description="本页为 PACS 管理演示页面：后端暂无 /pacs-admin 接口，全部数据由 MSW 演示数据提供，待后端接入。"
        style={{ marginBottom: 16 }}
      />
      <Space style={{ marginBottom: 16 }} wrap>
        <Server size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>PACS 管理</span>
        <Tag color="cyan">v3.0.6.11-60</Tag>
        <Tag color="green">DICOM AE 管理</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void fetchData()} loading={loading}>刷新</Button>
      </Space>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void fetchData()}><RefreshCw size={14} /> 重试</Button>} />}

      <Spin spinning={loading && servers.length === 0}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}><Card size="small"><Statistic title="AE 服务器" value={stats?.totalServers ?? servers.length} prefix={<Server size={16} />} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="在线" value={stats?.onlineServers ?? servers.filter((s) => s.status === 'online').length} prefix={<Wifi size={16} />} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="总检查数" value={(stats?.totalStudies ?? 0).toLocaleString()} prefix={<Activity size={16} />} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="总存储" value={formatBytes(stats?.totalStorageBytes ?? 0)} prefix={<Database size={16} />} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="DICOM 关联" value={stats?.totalAssociations ?? associations.length} prefix={<Link2 size={16} />} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title="日传输量" value={formatBytes(stats?.dailyTransferBytes ?? 0)} prefix={<Activity size={16} />} /></Card></Col>
        </Row>

        <Card
          title={<Space><Server size={14} />AE 服务器</Space>}
          style={{ marginBottom: 16 }}
          extra={<Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setServerModal(true)}>添加服务器</Button>}
        >
          <Table rowKey="id" dataSource={servers} columns={serverColumns} pagination={false} size="small" scroll={{ x: 'max-content' }}/>
        </Card>

        <Card
          title={<Space><HardDrive size={14} />存储组</Space>}
          style={{ marginBottom: 16 }}
          extra={<Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setStorageModal(true)}>添加存储组</Button>}
        >
          <Table rowKey="id" dataSource={storage} columns={storageColumns} pagination={false} size="small" scroll={{ x: 'max-content' }}/>
        </Card>

        <Card title={<Space><Link2 size={14} />DICOM 关联状态</Space>}>
          <Table rowKey="id" dataSource={associations} columns={associationColumns} pagination={false} size="small" scroll={{ x: 'max-content' }}/>
        </Card>
      </Spin>

      <Modal title="添加 AE 服务器" open={serverModal} onOk={() => void handleAddServer()} onCancel={() => setServerModal(false)} okText="添加">
        <Form form={serverForm} layout="vertical" initialValues={{ port: 11112 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如 Primary PACS" />
          </Form.Item>
          <Form.Item name="hostname" label="主机名 / IP" rules={[{ required: true, message: '请输入主机' }]}>
            <Input placeholder="pacs01.hospital.local" />
          </Form.Item>
          <Form.Item name="port" label="端口" rules={[{ required: true, message: '请输入端口' }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="aeTitle" label="应用实体名" rules={[{ required: true, message: '请输入应用实体名' }]}>
            <Input placeholder="RIS_PRIMARY" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="添加存储组" open={storageModal} onOk={() => void handleAddStorage()} onCancel={() => setStorageModal(false)} okText="创建">
        <Form form={storageForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如 Hot Storage" />
          </Form.Item>
          <Form.Item name="path" label="路径" rules={[{ required: true, message: '请输入路径' }]}>
            <Input placeholder="/data/hot" />
          </Form.Item>
          <Form.Item name="totalBytes" label="总容量 (GB)" rules={[{ required: true, message: '请输入容量' }]}>
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default PacsAdminPage
