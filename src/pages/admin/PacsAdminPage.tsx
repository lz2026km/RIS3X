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
import { Card, Table, Button, Tag, Space, Typography, Row, Col, Statistic, message, Modal, Input, Form, Popconfirm, Alert, Spin, Progress, Tabs, Drawer, Descriptions } from 'antd'
import { Server, Wifi, WifiOff, Database, Activity, Plus, RefreshCw, Link2, Trash2, Zap, HardDrive, ListChecks, Archive, FileText, Route, Settings2, Eraser, Edit3, Eye } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
// [G005 2B] 受控分页: 8 张可增长表 (logs 服务端截断 100 条 → 前端分页)
import { usePagination } from '../../hooks/usePagination'
import { displayExamStatus } from '../../utils/statusMaps'
import { t } from '../../i18n/appI18n'

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
  // [G005 v3.0.6.11-91 W1-B P1 第12轮] updateServer/deleteStorageGroup 接入: 编辑服务器 / 删除存储组
  const [editingServer, setEditingServer] = useState<PacsServer | null>(null)
  const [deletingStorageId, setDeletingStorageId] = useState<string | null>(null)
  // [v3.0.6.11-103 Wave 4A] 服务器详情 Drawer (GET /pacs-admin/servers/:id)
  const [detailServer, setDetailServer] = useState<PacsServer | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  // [G005 2B] 受控分页 (数据可增长)
  const nodePage = usePagination(nodes, 10)
  const serverPage = usePagination(servers, 10)
  const worklistPage = usePagination(worklist, 10)
  const archivePage = usePagination(archives, 10)
  const logPage = usePagination(logs, 10)
  const configPage = usePagination(configs, 10)
  const assocPage = usePagination(associations, 10)
  const routePage = usePagination(routes, 10)

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
      setError((e as Error)?.message ?? t('pacsAdmin.loadFailed'))
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
      else message.error(t('pacsAdmin.connFailed'))
    } catch {
      message.error(t('pacsAdmin.connTestFailed'))
    } finally {
      setTestingId(null)
    }
  }

  const handleAddServer = async () => {
    const values = await serverForm.validateFields()
    const res = await pacsAdminApi.addServer(values)
    if (res.success) { message.success(t('pacsAdmin.serverAdded')); setServerModal(false); serverForm.resetFields(); void fetchData() }
    else message.error(res.error?.message ?? t('pacsAdmin.addFailed'))
  }

  // [G005 v3.0.6.11-91 W1-B P1 第12轮] 编辑 AE 服务器 (updateServer, 复用添加 Modal)
  const openEditServer = (record: PacsServer) => {
    setEditingServer(record)
    serverForm.setFieldsValue({ name: record.name, hostname: record.hostname, port: record.port, aeTitle: record.aeTitle })
    setServerModal(true)
  }

  const handleUpdateServer = async () => {
    if (!editingServer) return
    const values = await serverForm.validateFields()
    const res = await pacsAdminApi.updateServer(editingServer.id, values)
    if (res.success) { message.success(t('pacsAdmin.serverUpdated')); setServerModal(false); setEditingServer(null); serverForm.resetFields(); void fetchData() }
    else message.error(res.error?.message ?? t('pacsAdmin.updateFailed'))
  }

  const handleServerModalOk = () => (editingServer ? handleUpdateServer() : handleAddServer())

  // [v3.0.6.11-103 Wave 4A] 服务器详情 (getServer)
  const handleViewServer = async (id: string) => {
    setDetailLoading(true)
    setDetailOpen(true)
    setDetailServer(null)
    try {
      const res = await pacsAdminApi.getServer(id)
      if (res.success && res.data) setDetailServer(res.data as PacsServer)
      else message.error(res.error?.message ?? t('pacsAdmin.detailFailed'))
    } catch {
      message.error(t('pacsAdmin.detailFailed'))
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDeleteServer = async (id: string) => {
    const res = await pacsAdminApi.deleteServer(id)
    if (res.success) { message.success(t('pacsAdmin.deleted')); void fetchData() }
    else message.error(res.error?.message ?? t('pacsAdmin.deleteFailed'))
  }

  const handleAddStorage = async () => {
    const values = await storageForm.validateFields()
    const res = await pacsAdminApi.createStorageGroup(values)
    if (res.success) { message.success(t('pacsAdmin.storageCreated')); setStorageModal(false); storageForm.resetFields(); void fetchData() }
    else message.error(res.error?.message ?? t('pacsAdmin.createFailed'))
  }

  // [G005 v3.0.6.11-91 W1-B P1 第12轮] 删除存储组 (deleteStorageGroup)
  const handleDeleteStorageGroup = async (id: string) => {
    setDeletingStorageId(id)
    try {
      const res = await pacsAdminApi.deleteStorageGroup(id)
      if (res.success) { message.success(t('pacsAdmin.storageDeleted')); void fetchData() }
      else message.error(res.error?.message ?? t('pacsAdmin.deleteFailed'))
    } catch {
      message.error(t('pacsAdmin.deleteFailed'))
    } finally {
      setDeletingStorageId(null)
    }
  }

  // [G005 Wave1A P0-1] 节点连接测试 / 同步
  const handleTestNode = async (id: string) => {
    setTestingId(id)
    try {
      const res = await pacsAdminApi.testNode(id)
      if (res.success && res.data?.success) message.success(`节点连接正常，延迟 ${res.data.latencyMs}ms`)
      else message.error(t('pacsAdmin.nodeConnFailed'))
    } catch {
      message.error(t('pacsAdmin.connTestFailed'))
    } finally {
      setTestingId(null)
    }
  }

  const handleSyncNode = async (id: string) => {
    setSyncId(id)
    try {
      const res = await pacsAdminApi.syncNode(id)
      if (res.success && res.data?.ok) message.success(`同步完成：${res.data.syncedStudies} 个检查，耗时 ${res.data.durationMs}ms`)
      else message.error(t('pacsAdmin.nodeSyncFailed'))
    } catch {
      message.error(t('pacsAdmin.syncRequestFailed'))
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
      else message.error(t('pacsAdmin.cleanupFailed'))
    } catch {
      message.error(t('pacsAdmin.cleanupRequestFailed'))
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
    else message.error(res.error?.message ?? t('pacsAdmin.saveFailed'))
  }

  const serverColumns = [
    { title: t('pacsAdmin.name'), dataIndex: 'name', key: 'name', render: (v: string, r: PacsServer) => <Space><Server size={14} color="#2563eb" /><b>{v}</b><Tag>{r.aeTitle}</Tag></Space> },
    { title: t('pacsAdmin.host'), dataIndex: 'hostname', key: 'hostname', render: (v: string) => <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Typography.Text> },
    { title: t('pacsAdmin.port'), dataIndex: 'port', key: 'port', width: 80 },
    { title: t('pacsAdmin.aeTitle'), dataIndex: 'aeTitle', key: 'ae', width: 130, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: t('pacsAdmin.status'), dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={v === 'online' ? 'green' : v === 'error' ? 'red' : 'default'} icon={v === 'online' ? <Wifi size={12} /> : <WifiOff size={12} />}>{v === 'online' ? t('pacsAdmin.online') : v === 'error' ? t('pacsAdmin.fault') : t('pacsAdmin.offline')}</Tag> },
    { title: t('pacsAdmin.heartbeat'), dataIndex: 'lastHeartbeat', key: 'heartbeat', width: 170, render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 19) : '-'}</span> },
    { title: t('pacsAdmin.studyCount'), dataIndex: 'studyCount', key: 'studies', width: 100, render: (v: number) => v?.toLocaleString() },
    { title: t('pacsAdmin.storage'), dataIndex: 'storageBytes', key: 'storage', width: 100, render: (v: number) => formatBytes(v ?? 0) },
    {
      title: t('pacsAdmin.actions'), key: 'ops', width: 250,
      render: (_: unknown, r: PacsServer) => (
        <Space size={4}>
          <Button size="small" icon={<Eye size={12} />} onClick={() => void handleViewServer(r.id)}>{t('pacsAdmin.detail')}</Button>
          <Button size="small" icon={<Zap size={12} />} loading={testingId === r.id} onClick={() => void handleTestConnection(r.id)}>{t('pacsAdmin.test')}</Button>
          <Button size="small" icon={<Edit3 size={12} />} onClick={() => openEditServer(r)}>{t('pacsAdmin.edit')}</Button>
          <Popconfirm title={t('pacsAdmin.confirmDeleteServer')} onConfirm={() => void handleDeleteServer(r.id)}>
            <Button size="small" danger icon={<Trash2 size={12} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const associationColumns = [
    { title: t('pacsAdmin.localAe'), dataIndex: 'localAe', key: 'localAe', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: t('pacsAdmin.remoteAe'), dataIndex: 'remoteAe', key: 'remoteAe', render: (v: string) => <Tag>{v}</Tag> },
    { title: t('pacsAdmin.remoteHost'), dataIndex: 'remoteHost', key: 'remoteHost', render: (v: string, r: PacsAssociation) => <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}:{r.remotePort}</Typography.Text> },
    { title: t('pacsAdmin.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'connected' ? 'green' : v === 'failed' ? 'red' : 'default'}>{v === 'connected' ? t('pacsAdmin.connected') : v === 'failed' ? t('pacsAdmin.failed') : t('pacsAdmin.disconnected')}</Tag> },
    { title: t('pacsAdmin.requestCount'), dataIndex: 'requestCount', key: 'req', render: (v: number) => v?.toLocaleString() },
    { title: t('pacsAdmin.errorCount'), dataIndex: 'errorCount', key: 'err', render: (v: number) => <span style={{ color: (v ?? 0) > 20 ? '#ff4d4f' : '#52c41a' }}>{v ?? 0}</span> },
    { title: t('pacsAdmin.lastActivity'), dataIndex: 'lastActivity', key: 'last', render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 19) : '-'}</span> },
  ]

  // [G005 Wave1A P0-1] 节点 / 工作列表 / 归档 / 日志 / 配置 / 路由 列定义
  const nodeColumns = [
    { title: t('pacsAdmin.name'), dataIndex: 'name', key: 'name', render: (v: string, r: PacsNode) => <Space><Server size={14} color="#2563eb" /><b>{v}</b><Tag>{r.aeTitle}</Tag></Space> },
    { title: t('pacsAdmin.host'), dataIndex: 'hostname', key: 'hostname', render: (v: string) => <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Typography.Text> },
    { title: t('pacsAdmin.port'), dataIndex: 'port', key: 'port', width: 70 },
    { title: t('pacsAdmin.modality'), dataIndex: 'modality', key: 'modality', width: 70, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: t('pacsAdmin.location'), dataIndex: 'location', key: 'location', render: (v: string) => <span style={{ fontSize: 12 }}>{v || '-'}</span> },
    { title: t('pacsAdmin.status'), dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={v === 'online' ? 'green' : v === 'error' ? 'red' : 'default'} icon={v === 'online' ? <Wifi size={12} /> : <WifiOff size={12} />}>{v === 'online' ? t('pacsAdmin.online') : v === 'error' ? t('pacsAdmin.fault') : t('pacsAdmin.offline')}</Tag> },
    { title: t('pacsAdmin.studyCount'), dataIndex: 'studyCount', key: 'studies', width: 90, render: (v: number) => v?.toLocaleString() },
    { title: t('pacsAdmin.heartbeat'), dataIndex: 'lastHeartbeat', key: 'heartbeat', width: 170, render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 19) : '-'}</span> },
    {
      title: t('pacsAdmin.actions'), key: 'ops', width: 150,
      render: (_: unknown, r: PacsNode) => (
        <Space size={4}>
          <Button size="small" icon={<Zap size={12} />} loading={testingId === r.id} onClick={() => void handleTestNode(r.id)}>{t('pacsAdmin.test')}</Button>
          <Button size="small" icon={<RefreshCw size={12} />} loading={syncId === r.id} onClick={() => void handleSyncNode(r.id)}>{t('pacsAdmin.sync')}</Button>
        </Space>
      ),
    },
  ]

  const worklistColumns = [
    { title: t('pacsAdmin.accessionNumber'), dataIndex: 'accessionNumber', key: 'acc', render: (v: string) => <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Typography.Text> },
    { title: t('pacsAdmin.patient'), dataIndex: 'patientName', key: 'patient', render: (v: string) => <b>{v}</b> },
    { title: t('pacsAdmin.patientId'), dataIndex: 'patientId', key: 'pid', render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v}</span> },
    { title: t('pacsAdmin.modality'), dataIndex: 'modality', key: 'modality', width: 70, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: t('pacsAdmin.bodyPart'), dataIndex: 'bodyPart', key: 'bodyPart', render: (v: string) => v || '-' },
    { title: t('pacsAdmin.status'), dataIndex: 'state', key: 'state', width: 120, render: (v: string) => <Tag color={v === 'COMPLETED' ? 'green' : v === 'IN_PROGRESS' ? 'blue' : 'orange'}>{displayExamStatus(v)}</Tag> },
    { title: t('pacsAdmin.scheduledAt'), dataIndex: 'scheduledAt', key: 'scheduledAt', width: 170, render: (v?: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 19) : '-'}</span> },
  ]

  const archiveColumns = [
    { title: t('pacsAdmin.archiveId'), dataIndex: 'id', key: 'id', render: (v: string) => <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Typography.Text> },
    { title: t('pacsAdmin.studyId'), dataIndex: 'studyId', key: 'studyId', render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
    { title: t('pacsAdmin.patient'), dataIndex: 'patientName', key: 'patient', render: (v: string) => <b>{v}</b> },
    { title: t('pacsAdmin.modality'), dataIndex: 'modality', key: 'modality', width: 70, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: t('pacsAdmin.size'), dataIndex: 'sizeBytes', key: 'size', render: (v: number) => formatBytes(v ?? 0) },
    { title: t('pacsAdmin.status'), dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={v === 'archived' ? 'green' : v === 'restoring' ? 'orange' : 'blue'}>{v === 'archived' ? t('pacsAdmin.archived') : v === 'restoring' ? t('pacsAdmin.restoring') : t('pacsAdmin.restored')}</Tag> },
    { title: t('pacsAdmin.archivedAt'), dataIndex: 'archivedAt', key: 'time', width: 170, render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 19) : '-'}</span> },
  ]

  const logColumns = [
    { title: t('pacsAdmin.time'), dataIndex: 'time', key: 'time', width: 170, render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 19) : '-'}</span> },
    { title: t('pacsAdmin.level'), dataIndex: 'level', key: 'level', width: 80, render: (v: string) => <Tag color={v === 'ERROR' ? 'red' : v === 'WARN' ? 'orange' : 'green'}>{v}</Tag> },
    { title: t('pacsAdmin.source'), dataIndex: 'source', key: 'source', width: 110, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: t('pacsAdmin.message'), dataIndex: 'message', key: 'message', render: (v: string) => <span style={{ fontSize: 12.5 }}>{v}</span> },
  ]

  const configColumns = [
    { title: t('pacsAdmin.configKey'), dataIndex: 'key', key: 'key', width: 200, render: (v: string) => <Tag color="blue" style={{ fontFamily: 'monospace' }}>{v}</Tag> },
    { title: t('pacsAdmin.category'), dataIndex: 'category', key: 'category', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    { title: t('pacsAdmin.description'), dataIndex: 'description', key: 'desc', render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
    { title: t('pacsAdmin.currentValue'), key: 'value', render: (_: unknown, r: PacsConfig) => (
      <Space.Compact>
        <Input size="small" style={{ width: 160, fontFamily: 'monospace' }} value={configValues[r.key] ?? r.value}
          onChange={e => setConfigValues(prev => ({ ...prev, [r.key]: e.target.value }))} />
        <Button size="small" type="primary" onClick={() => void handleSaveConfig(r.key)}>{t('pacsAdmin.save')}</Button>
      </Space.Compact>
    ) },
  ]

  const routeColumns = [
    { title: t('pacsAdmin.name'), dataIndex: 'name', key: 'name', render: (v: string) => <Space><Route size={14} color="#7c3aed" /><b>{v}</b></Space> },
    { title: t('pacsAdmin.sourceAe'), dataIndex: 'sourceAe', key: 'src', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: t('pacsAdmin.targetAe'), dataIndex: 'targetAe', key: 'dst', render: (v: string) => <Tag>{v}</Tag> },
    { title: t('pacsAdmin.targetHost'), dataIndex: 'targetHost', key: 'host', render: (v: string, r: PacsRoute) => <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}:{r.targetPort}</Typography.Text> },
    { title: t('pacsAdmin.protocol'), dataIndex: 'protocol', key: 'protocol', width: 90, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: t('pacsAdmin.enabled'), dataIndex: 'enabled', key: 'enabled', width: 90, render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? t('pacsAdmin.enabledLabel') : t('pacsAdmin.disabled')}</Tag> },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      {/* [G005 Wave1A P0-1] 后端已实现 pacs-admin.controller, 数据由后端派生, 无数据时演示回退 (MSW) */}
      <Alert
        type="info"
        showIcon
        banner
        message={t('pacsAdmin.alertTitle')}
        description={t('pacsAdmin.alertDesc')}
        style={{ marginBottom: 16 }}
      />
      <Space style={{ marginBottom: 16 }} wrap>
        <Server size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('pacsAdmin.title')}</span>
        <Tag color="cyan">v3.0.6.11-86</Tag>
        <Tag color="green">{t('pacsAdmin.tagDicom')}</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void fetchData()} loading={loading}>{t('pacsAdmin.refresh')}</Button>
      </Space>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void fetchData()}><RefreshCw size={14} /> {t('pacsAdmin.retry')}</Button>} />}

      <Spin spinning={loading && servers.length === 0}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}><Card size="small"><Statistic title={t('pacsAdmin.tabServers')} value={stats?.totalServers ?? servers.length} prefix={<Server size={16} />} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title={t('pacsAdmin.online')} value={stats?.onlineServers ?? servers.filter((s) => s.status === 'online').length} prefix={<Wifi size={16} />} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title={t('pacsAdmin.statTotalStudies')} value={(stats?.totalStudies ?? 0).toLocaleString()} prefix={<Activity size={16} />} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title={t('pacsAdmin.statTotalStorage')} value={formatBytes(stats?.totalStorageBytes ?? 0)} prefix={<Database size={16} />} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title={t('pacsAdmin.statAssociations')} value={stats?.totalAssociations ?? associations.length} prefix={<Link2 size={16} />} /></Card></Col>
          <Col span={4}><Card size="small"><Statistic title={t('pacsAdmin.statDailyTransfer')} value={formatBytes(stats?.dailyTransferBytes ?? 0)} prefix={<Activity size={16} />} /></Card></Col>
        </Row>

        <Tabs
          type="card"
          size="small"
          items={[
            {
              key: 'nodes', label: <Space size={4}><Server size={13} />{t('pacsAdmin.tabNodes')}</Space>,
              children: (
                <Card title={`DICOM 节点 (${nodes.length})`} size="small" style={{ marginBottom: 16 }}>
                  <Table rowKey="id" dataSource={nodePage.pageData} columns={nodeColumns} pagination={nodePage.pagination} size="small" scroll={{ x: 'max-content' }} />
                </Card>
              ),
            },
            {
              key: 'storage', label: <Space size={4}><HardDrive size={13} />{t('pacsAdmin.tabStorage')}</Space>,
              children: (
                <Card title={t('pacsAdmin.cardStorageUsage')} size="small" extra={<Space><Button size="small" icon={<Plus size={12} />} onClick={() => { setEditingServer(null); setStorageModal(true) }}>{t('pacsAdmin.addStorageGroup')}</Button><Button size="small" icon={<Eraser size={12} />} loading={cleaning} onClick={() => void handleCleanupStorage()}>{t('pacsAdmin.cleanupExpired')}</Button></Space>} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {storage.map(g => {
                      const pct = g.totalBytes > 0 ? Math.round((g.usedBytes / g.totalBytes) * 1000) / 10 : 0
                      return (
                        <div key={g.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Space><HardDrive size={14} color="#13c2c2" /><b>{g.name}</b><Typography.Text code style={{ fontSize: 12 }}>{g.path}</Typography.Text></Space>
                            <Space>
                              <span style={{ fontSize: 12, color: '#64748b' }}>{formatBytes(g.usedBytes)} / {formatBytes(g.totalBytes)} · {g.studyCount?.toLocaleString()} {t('pacsAdmin.studiesUnit')} · <Tag color={g.status === 'active' ? 'green' : g.status === 'readonly' ? 'orange' : 'default'}>{g.status === 'active' ? t('pacsAdmin.active') : g.status === 'readonly' ? t('pacsAdmin.readonly') : t('pacsAdmin.offline')}</Tag></span>
                              <Popconfirm title={t('pacsAdmin.confirmDeleteStorage')} onConfirm={() => void handleDeleteStorageGroup(g.id)}>
                                <Button size="small" danger icon={<Trash2 size={12} />} loading={deletingStorageId === g.id} />
                              </Popconfirm>
                            </Space>
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
              key: 'servers', label: <Space size={4}><Server size={13} />{t('pacsAdmin.tabServers')}</Space>,
              children: (
                <Card
                  title={<Space><Server size={14} />{t('pacsAdmin.tabServers')}</Space>}
                  style={{ marginBottom: 16 }}
                  extra={<Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setServerModal(true)}>{t('pacsAdmin.addServer')}</Button>}
                >
                  <Table rowKey="id" dataSource={serverPage.pageData} columns={serverColumns} pagination={serverPage.pagination} size="small" scroll={{ x: 'max-content' }}/>
                </Card>
              ),
            },
            {
              key: 'worklist', label: <Space size={4}><ListChecks size={13} />{t('pacsAdmin.tabWorklist')}</Space>,
              children: (
                <Card title={`工作列表条目 (${worklist.length})`} size="small" style={{ marginBottom: 16 }}>
                  <Table rowKey="id" dataSource={worklistPage.pageData} columns={worklistColumns} pagination={worklistPage.pagination} size="small" scroll={{ x: 'max-content' }} />
                </Card>
              ),
            },
            {
              key: 'archives', label: <Space size={4}><Archive size={13} />{t('pacsAdmin.tabArchives')}</Space>,
              children: (
                <Card title={`归档记录 (${archives.length})`} size="small" style={{ marginBottom: 16 }}>
                  <Table rowKey="id" dataSource={archivePage.pageData} columns={archiveColumns} pagination={archivePage.pagination} size="small" scroll={{ x: 'max-content' }} />
                </Card>
              ),
            },
            {
              key: 'logs', label: <Space size={4}><FileText size={13} />{t('pacsAdmin.tabLogs')}</Space>,
              children: (
                <Card title={`PACS 操作日志 (${logs.length})`} size="small" style={{ marginBottom: 16 }}>
                  <Table rowKey="id" dataSource={logPage.pageData} columns={logColumns} pagination={logPage.pagination} size="small" scroll={{ x: 'max-content' }} />
                </Card>
              ),
            },
            {
              key: 'configs', label: <Space size={4}><Settings2 size={13} />{t('pacsAdmin.tabConfigs')}</Space>,
              children: (
                <Card title={`PACS 配置项 (${configs.length})`} size="small" style={{ marginBottom: 16 }}>
                  <Table rowKey="key" dataSource={configPage.pageData} columns={configColumns} pagination={configPage.pagination} size="small" scroll={{ x: 'max-content' }} />
                </Card>
              ),
            },
            {
              key: 'associations', label: <Space size={4}><Link2 size={13} />{t('pacsAdmin.tabAssociations')}</Space>,
              children: (
                <Card title={<Space><Link2 size={14} />{t('pacsAdmin.cardAssociationStatus')}</Space>}>
                  <Table rowKey="id" dataSource={assocPage.pageData} columns={associationColumns} pagination={assocPage.pagination} size="small" scroll={{ x: 'max-content' }}/>
                </Card>
              ),
            },
            {
              key: 'routes', label: <Space size={4}><Route size={13} />{t('pacsAdmin.tabRoutes')}</Space>,
              children: (
                <Card title={`转发路由 (${routes.length})`} size="small" style={{ marginBottom: 16 }}>
                  <Table rowKey="id" dataSource={routePage.pageData} columns={routeColumns} pagination={routePage.pagination} size="small" scroll={{ x: 'max-content' }} />
                </Card>
              ),
            },
          ]}
        />
      </Spin>

      <Modal title={editingServer ? t('pacsAdmin.editServer') : t('pacsAdmin.addServerTitle')} open={serverModal} onOk={() => void handleServerModalOk()} onCancel={() => { setServerModal(false); setEditingServer(null) }} okText={editingServer ? t('pacsAdmin.save') : t('pacsAdmin.add')}>
        <Form form={serverForm} layout="vertical" initialValues={{ port: 11112 }}>
          <Form.Item name="name" label={t('pacsAdmin.name')} rules={[{ required: true, message: t('pacsAdmin.requiredName') }]}>
            <Input placeholder={t('pacsAdmin.placeholderPrimaryPacs')} />
          </Form.Item>
          <Form.Item name="hostname" label={t('pacsAdmin.hostnameIp')} rules={[{ required: true, message: t('pacsAdmin.requiredHost') }]}>
            <Input placeholder="pacs01.hospital.local" />
          </Form.Item>
          <Form.Item name="port" label={t('pacsAdmin.port')} rules={[{ required: true, message: t('pacsAdmin.requiredPort') }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="aeTitle" label={t('pacsAdmin.aeTitle')} rules={[{ required: true, message: t('pacsAdmin.requiredAeTitle') }]}>
            <Input placeholder="RIS_PRIMARY" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('pacsAdmin.addStorageGroup')} open={storageModal} onOk={() => void handleAddStorage()} onCancel={() => setStorageModal(false)} okText={t('pacsAdmin.create')}>
        <Form form={storageForm} layout="vertical">
          <Form.Item name="name" label={t('pacsAdmin.name')} rules={[{ required: true, message: t('pacsAdmin.requiredName') }]}>
            <Input placeholder={t('pacsAdmin.placeholderHotStorage')} />
          </Form.Item>
          <Form.Item name="path" label={t('pacsAdmin.path')} rules={[{ required: true, message: t('pacsAdmin.requiredPath') }]}>
            <Input placeholder="/data/hot" />
          </Form.Item>
          <Form.Item name="totalBytes" label={t('pacsAdmin.totalCapacityGb')} rules={[{ required: true, message: t('pacsAdmin.requiredCapacity') }]}>
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>

      {/* [v3.0.6.11-103 Wave 4A] 服务器详情 Drawer (GET /pacs-admin/servers/:id) */}
      <Drawer
        title={t('pacsAdmin.serverDetail')}
        width={460}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        extra={<Button size="small" icon={<RefreshCw size={12} />} onClick={() => detailServer && void handleViewServer(detailServer.id)}>{t('pacsAdmin.refresh')}</Button>}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : detailServer ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label={t('pacsAdmin.name')}>
              <Space><Server size={14} color="#2563eb" /><b>{detailServer.name}</b><Tag>{detailServer.aeTitle}</Tag></Space>
            </Descriptions.Item>
            <Descriptions.Item label={t('pacsAdmin.host')}>
              <Typography.Text style={{ fontFamily: 'monospace' }}>{detailServer.hostname}:{detailServer.port}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('pacsAdmin.aeTitle')}>
              <Tag color="blue">{detailServer.aeTitle}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('pacsAdmin.status')}>
              <Tag color={detailServer.status === 'online' ? 'green' : detailServer.status === 'error' ? 'red' : 'default'} icon={detailServer.status === 'online' ? <Wifi size={12} /> : <WifiOff size={12} />}>
                {detailServer.status === 'online' ? t('pacsAdmin.online') : detailServer.status === 'error' ? t('pacsAdmin.fault') : t('pacsAdmin.offline')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('pacsAdmin.lastHeartbeat')}>
              {detailServer.lastHeartbeat ? detailServer.lastHeartbeat.replace('T', ' ').slice(0, 19) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pacsAdmin.storage')}>{formatBytes(detailServer.storageBytes ?? 0)}</Descriptions.Item>
            <Descriptions.Item label={t('pacsAdmin.studies')}>{detailServer.studyCount?.toLocaleString() ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('pacsAdmin.series')}>{detailServer.seriesCount?.toLocaleString() ?? '-'}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Alert type="error" showIcon message={t('pacsAdmin.detailFailed')} />
        )}
      </Drawer>
    </div>
  )
}

export default PacsAdminPage
