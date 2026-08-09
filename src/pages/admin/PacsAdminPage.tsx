// [v3.0.6.11-60] Batch 3: PACS 管理 (pacsAdminApi 真实数据 + AE 服务器/存储管理)
// [G005 Wave1A P0-1] 补齐 nodes/storage/worklist/archives/logs/configs/routes 7 Tab (pacs-admin.controller 真实端点)
import {
  pacsAdminApi,
  type PacsServer,
  type PacsStorageGroup,
  type PacsAssociation,
  type PacsAdminStats,
  type PacsNode,
  type PacsWorklistEntry,
  type PacsArchive,
  type PacsLogEntry,
  type PacsConfig,
  type PacsRoute,
} from '../../services/api/pacsAdminApi'
import { Card, Table, Button, Tag, Space, Typography, Row, Col, Statistic, message, Modal, Input, Form, Popconfirm, Alert, Spin, Progress, Tabs } from 'antd'
import { Server, Wifi, WifiOff, Database, Activity, Plus, RefreshCw, Link2, Trash2, Zap, HardDrive, ListChecks, Archive, FileText, Route, Settings2, Eraser } from 'lucide-react'
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
  const [nodes, setNodes] = useState<PacsNode[]>([])
  const [worklist, setWorklist] = useState<PacsWorklistEntry[]>([])
  const [archives, setArchives] = useState<PacsArchive[]>([])
  const [logs, setLogs] = useState<PacsLogEntry[]>([])
  const [configs, setConfigs] = useState<PacsConfig[]>([])
  const [configValues, setConfigValues] = useState<Record<string, string>>({})
  const [routes, setRoutes] = useState<PacsRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [testingId, setTestingId] = useState<string | null>(null)
  const [syncId, setSyncId] = useState<string | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [serverModal, setServerModal] = useState(false)
  const [storageModal, setStorageModal] = useState(false)
  const [serverForm] = Form.useForm()
  const [storageForm] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [serverRes, storageRes, assocRes, statsRes, nodeRes, worklistRes, archiveRes, logRes, configRes, routeRes] = await Promise.all([
        pacsAdminApi.listServers(),
        pacsAdminApi.listStorageGroups(),
        pacsAdminApi.listAssociations(),
        pacsAdminApi.getStats(),
        pacsAdminApi.listNodes(),
        pacsAdminApi.listWorklistEntries(),
        pacsAdminApi.listArchives(),
        pacsAdminApi.listLogs(100),
        pacsAdminApi.listConfigs(),
        pacsAdminApi.listRoutes(),
      ])
      if (serverRes.success && Array.isArray(serverRes.data)) setServers(serverRes.data)
      else if (serverRes.error) setError(serverRes.error.message)
      if (storageRes.success && Array.isArray(storageRes.data)) setStorage(storageRes.data)
      if (assocRes.success && Array.isArray(assocRes.data)) setAssociations(assocRes.data)
      if (statsRes.success && statsRes.data) setStats(statsRes.data as PacsAdminStats)
      if (nodeRes.success && Array.isArray(nodeRes.data)) setNodes(nodeRes.data)
      if (worklistRes.success && Array.isArray(worklistRes.data)) setWorklist(worklistRes.data)
      if (archiveRes.success && Array.isArray(archiveRes.data)) setArchives(archiveRes.data)
      if (logRes.success && Array.isArray(logRes.data)) setLogs(logRes.data)
      if (configRes.success && Array.isArray(configRes.data)) {
        setConfigs(configRes.data)
        setConfigValues(prev => {
          const next: Record<string, string> = {}
          for (const c of configRes.data) next[c.key] = prev[c.key] ?? c.value
          return next
        })
      }
      if (routeRes.success && Array.isArray(routeRes.data)) setRoutes(routeRes.data)
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

  // [G005 Wave1A P0-1] 节点连接测试 / 同步
  const handleTestNode = async (id: string) => {
    setTestingId(id)
    try {
      const res = await pacsAdminApi.testNode(id)
      if (res.success && res.data?.success) message.success(`节点连接正常，延迟 ${res.data.latencyMs}ms`)
      else message.error('节点连接失败')
    } catch {
      message.error('连接测试失败')
    } finally {
      setTestingId(null)
    }
  }

  const handleSyncNode = async (id: string) => {
    setSyncId(id)
    try {
      const res = await pacsAdminApi.syncNode(id)
      if (res.success && res.data?.ok) message.success(`同步完成：${res.data.syncedStudies} 个检查，耗时 ${res.data.durationMs}ms`)
      else message.error('节点同步失败')
    } catch {
      message.error('同步请求失败')
    } finally {
      setSyncId(null)
    }
  }

  // [G005 Wave1A P0-1] 存储空间清理
  const handleCleanupStorage = async () => {
    setCleaning(true)
    try {
      const res = await pacsAdminApi.cleanupStorage()
      if (res.success && res.data?.ok) message.success(`清理完成：释放 ${formatBytes(res.data.freedBytes)}，删除 ${res.data.deletedCount} 个过期对象`)
      else message.error('清理失败')
    } catch {
      message.error('清理请求失败')
    } finally {
      setCleaning(false)
    }
  }

  // [G005 Wave1A P0-1] 配置保存
  const handleSaveConfig = async (key: string) => {
    const value = configValues[key]
    if (value === undefined) return
    const res = await pacsAdminApi.updateConfig(key, { value })
    if (res.success) { message.success(`配置已更新: ${key}`); void fetchData() }
    else message.error(res.error?.message ?? '保存失败')
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

  const associationColumns = [
    { title: '本地 AE', dataIndex: 'localAe', key: 'localAe', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '远端 AE', dataIndex: 'remoteAe', key: 'remoteAe', render: (v: string) => <Tag>{v}</Tag> },
    { title: '远端主机', dataIndex: 'remoteHost', key: 'remoteHost', render: (v: string, r: PacsAssociation) => <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}:{r.remotePort}</Typography.Text> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'connected' ? 'green' : v === 'failed' ? 'red' : 'default'}>{v === 'connected' ? '已连接' : v === 'failed' ? '失败' : '断开'}</Tag> },
    { title: '请求数', dataIndex: 'requestCount', key: 'req', render: (v: number) => v?.toLocaleString() },
    { title: '错误数', dataIndex: 'errorCount', key: 'err', render: (v: number) => <span style={{ color: (v ?? 0) > 20 ? '#ff4d4f' : '#52c41a' }}>{v ?? 0}</span> },
    { title: '最近活动', dataIndex: 'lastActivity', key: 'last', render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 19) : '-'}</span> },
  ]

  // [G005 Wave1A P0-1] 节点 / 工作列表 / 归档 / 日志 / 配置 / 路由 列定义
  const nodeColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', render: (v: string, r: PacsNode) => <Space><Server size={14} color="#2563eb" /><b>{v}</b><Tag>{r.aeTitle}</Tag></Space> },
    { title: '主机', dataIndex: 'hostname', key: 'hostname', render: (v: string) => <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Typography.Text> },
    { title: '端口', dataIndex: 'port', key: 'port', width: 70 },
    { title: '模态', dataIndex: 'modality', key: 'modality', width: 70, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: '位置', dataIndex: 'location', key: 'location', render: (v: string) => <span style={{ fontSize: 12 }}>{v || '-'}</span> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={v === 'online' ? 'green' : v === 'error' ? 'red' : 'default'} icon={v === 'online' ? <Wifi size={12} /> : <WifiOff size={12} />}>{v === 'online' ? '在线' : v === 'error' ? '故障' : '离线'}</Tag> },
    { title: '检查数', dataIndex: 'studyCount', key: 'studies', width: 90, render: (v: number) => v?.toLocaleString() },
    { title: '心跳', dataIndex: 'lastHeartbeat', key: 'heartbeat', width: 170, render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 19) : '-'}</span> },
    {
      title: '操作', key: 'ops', width: 150,
      render: (_: unknown, r: PacsNode) => (
        <Space size={4}>
          <Button size="small" icon={<Zap size={12} />} loading={testingId === r.id} onClick={() => void handleTestNode(r.id)}>测试</Button>
          <Button size="small" icon={<RefreshCw size={12} />} loading={syncId === r.id} onClick={() => void handleSyncNode(r.id)}>同步</Button>
        </Space>
      ),
    },
  ]

  const worklistColumns = [
    { title: '申请号', dataIndex: 'accessionNumber', key: 'acc', render: (v: string) => <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Typography.Text> },
    { title: '患者', dataIndex: 'patientName', key: 'patient', render: (v: string) => <b>{v}</b> },
    { title: '患者ID', dataIndex: 'patientId', key: 'pid', render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v}</span> },
    { title: '模态', dataIndex: 'modality', key: 'modality', width: 70, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: '部位', dataIndex: 'bodyPart', key: 'bodyPart', render: (v: string) => v || '-' },
    { title: '状态', dataIndex: 'state', key: 'state', width: 120, render: (v: string) => <Tag color={v === 'COMPLETED' ? 'green' : v === 'IN_PROGRESS' ? 'blue' : 'orange'}>{v}</Tag> },
    { title: '预约时间', dataIndex: 'scheduledAt', key: 'scheduledAt', width: 170, render: (v?: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 19) : '-'}</span> },
  ]

  const archiveColumns = [
    { title: '归档ID', dataIndex: 'id', key: 'id', render: (v: string) => <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Typography.Text> },
    { title: '检查号', dataIndex: 'studyId', key: 'studyId', render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
    { title: '患者', dataIndex: 'patientName', key: 'patient', render: (v: string) => <b>{v}</b> },
    { title: '模态', dataIndex: 'modality', key: 'modality', width: 70, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: '大小', dataIndex: 'sizeBytes', key: 'size', render: (v: number) => formatBytes(v ?? 0) },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={v === 'archived' ? 'green' : v === 'restoring' ? 'orange' : 'blue'}>{v === 'archived' ? '已归档' : v === 'restoring' ? '恢复中' : '已恢复'}</Tag> },
    { title: '归档时间', dataIndex: 'archivedAt', key: 'time', width: 170, render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 19) : '-'}</span> },
  ]

  const logColumns = [
    { title: '时间', dataIndex: 'time', key: 'time', width: 170, render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 19) : '-'}</span> },
    { title: '级别', dataIndex: 'level', key: 'level', width: 80, render: (v: string) => <Tag color={v === 'ERROR' ? 'red' : v === 'WARN' ? 'orange' : 'green'}>{v}</Tag> },
    { title: '来源', dataIndex: 'source', key: 'source', width: 110, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '消息', dataIndex: 'message', key: 'message', render: (v: string) => <span style={{ fontSize: 12.5 }}>{v}</span> },
  ]

  const configColumns = [
    { title: '配置项', dataIndex: 'key', key: 'key', width: 200, render: (v: string) => <Tag color="blue" style={{ fontFamily: 'monospace' }}>{v}</Tag> },
    { title: '分类', dataIndex: 'category', key: 'category', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    { title: '说明', dataIndex: 'description', key: 'desc', render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
    { title: '当前值', key: 'value', render: (_: unknown, r: PacsConfig) => (
      <Space.Compact>
        <Input size="small" style={{ width: 160, fontFamily: 'monospace' }} value={configValues[r.key] ?? r.value}
          onChange={e => setConfigValues(prev => ({ ...prev, [r.key]: e.target.value }))} />
        <Button size="small" type="primary" onClick={() => void handleSaveConfig(r.key)}>保存</Button>
      </Space.Compact>
    ) },
  ]

  const routeColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', render: (v: string) => <Space><Route size={14} color="#7c3aed" /><b>{v}</b></Space> },
    { title: '源 AE', dataIndex: 'sourceAe', key: 'src', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '目标 AE', dataIndex: 'targetAe', key: 'dst', render: (v: string) => <Tag>{v}</Tag> },
    { title: '目标主机', dataIndex: 'targetHost', key: 'host', render: (v: string, r: PacsRoute) => <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}:{r.targetPort}</Typography.Text> },
    { title: '协议', dataIndex: 'protocol', key: 'protocol', width: 90, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: '启用', dataIndex: 'enabled', key: 'enabled', width: 90, render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag> },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      {/* [G005 Wave1A P0-1] 后端已实现 pacs-admin.controller, 数据由后端派生, 无数据时演示回退 (MSW) */}
      <Alert
        type="info"
        showIcon
        banner
        message="PACS 管理已接入真实后端"
        description="本页数据由后端 /pacs-admin (Device/Exam/AuditLog 派生 + seed 回退) 提供，接口不可用时回退 MSW 演示数据。"
        style={{ marginBottom: 16 }}
      />
      <Space style={{ marginBottom: 16 }} wrap>
        <Server size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>PACS 管理</span>
        <Tag color="cyan">v3.0.6.11-86</Tag>
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

        <Tabs
          type="card"
          size="small"
          items={[
            {
              key: 'nodes', label: <Space size={4}><Server size={13} />节点列表</Space>,
              children: (
                <Card title={`DICOM 节点 (${nodes.length})`} size="small" style={{ marginBottom: 16 }}>
                  <Table rowKey="id" dataSource={nodes} columns={nodeColumns} pagination={false} size="small" scroll={{ x: 'max-content' }} />
                </Card>
              ),
            },
            {
              key: 'storage', label: <Space size={4}><HardDrive size={13} />存储空间</Space>,
              children: (
                <Card title="存储组使用情况" size="small" extra={<Button size="small" icon={<Eraser size={12} />} loading={cleaning} onClick={() => void handleCleanupStorage()}>清理过期对象</Button>} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {storage.map(g => {
                      const pct = g.totalBytes > 0 ? Math.round((g.usedBytes / g.totalBytes) * 1000) / 10 : 0
                      return (
                        <div key={g.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Space><HardDrive size={14} color="#13c2c2" /><b>{g.name}</b><Typography.Text code style={{ fontSize: 12 }}>{g.path}</Typography.Text></Space>
                            <span style={{ fontSize: 12, color: '#64748b' }}>{formatBytes(g.usedBytes)} / {formatBytes(g.totalBytes)} · {g.studyCount?.toLocaleString()} 检查 · <Tag color={g.status === 'active' ? 'green' : g.status === 'readonly' ? 'orange' : 'default'}>{g.status === 'active' ? '启用' : g.status === 'readonly' ? '只读' : '离线'}</Tag></span>
                          </div>
                          <Progress percent={pct} status={pct > 90 ? 'exception' : 'normal'} />
                        </div>
                      )
                    })}
                  </div>
                </Card>
              ),
            },
            {
              key: 'servers', label: <Space size={4}><Server size={13} />AE 服务器</Space>,
              children: (
                <Card
                  title={<Space><Server size={14} />AE 服务器</Space>}
                  style={{ marginBottom: 16 }}
                  extra={<Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setServerModal(true)}>添加服务器</Button>}
                >
                  <Table rowKey="id" dataSource={servers} columns={serverColumns} pagination={false} size="small" scroll={{ x: 'max-content' }}/>
                </Card>
              ),
            },
            {
              key: 'worklist', label: <Space size={4}><ListChecks size={13} />工作列表</Space>,
              children: (
                <Card title={`Worklist 条目 (${worklist.length})`} size="small" style={{ marginBottom: 16 }}>
                  <Table rowKey="id" dataSource={worklist} columns={worklistColumns} pagination={false} size="small" scroll={{ x: 'max-content' }} />
                </Card>
              ),
            },
            {
              key: 'archives', label: <Space size={4}><Archive size={13} />归档</Space>,
              children: (
                <Card title={`归档记录 (${archives.length})`} size="small" style={{ marginBottom: 16 }}>
                  <Table rowKey="id" dataSource={archives} columns={archiveColumns} pagination={false} size="small" scroll={{ x: 'max-content' }} />
                </Card>
              ),
            },
            {
              key: 'logs', label: <Space size={4}><FileText size={13} />日志</Space>,
              children: (
                <Card title={`PACS 操作日志 (${logs.length})`} size="small" style={{ marginBottom: 16 }}>
                  <Table rowKey="id" dataSource={logs} columns={logColumns} pagination={false} size="small" scroll={{ x: 'max-content' }} />
                </Card>
              ),
            },
            {
              key: 'configs', label: <Space size={4}><Settings2 size={13} />配置</Space>,
              children: (
                <Card title={`PACS 配置项 (${configs.length})`} size="small" style={{ marginBottom: 16 }}>
                  <Table rowKey="key" dataSource={configs} columns={configColumns} pagination={false} size="small" scroll={{ x: 'max-content' }} />
                </Card>
              ),
            },
            {
              key: 'associations', label: <Space size={4}><Link2 size={13} />DICOM 关联</Space>,
              children: (
                <Card title={<Space><Link2 size={14} />DICOM 关联状态</Space>}>
                  <Table rowKey="id" dataSource={associations} columns={associationColumns} pagination={false} size="small" scroll={{ x: 'max-content' }}/>
                </Card>
              ),
            },
            {
              key: 'routes', label: <Space size={4}><Route size={13} />转发路由</Space>,
              children: (
                <Card title={`转发路由 (${routes.length})`} size="small" style={{ marginBottom: 16 }}>
                  <Table rowKey="id" dataSource={routes} columns={routeColumns} pagination={false} size="small" scroll={{ x: 'max-content' }} />
                </Card>
              ),
            },
          ]}
        />
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
