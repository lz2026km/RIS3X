import React, { useState } from 'react'
import { Card, Table, Button, Tag, Space, Typography, Row, Col, Statistic, message, Modal, Input } from 'antd'
import { Server, Wifi, WifiOff, Database, Activity } from 'lucide-react'

const { Text } = Input

interface PacsServerItem {
  id: string
  name: string
  hostname: string
  port: number
  aeTitle: string
  status: string
  studyCount: number
  storageBytes: number
}

interface StorageGroupItem {
  id: string
  name: string
  path: string
  totalBytes: number
  usedBytes: number
  status: string
}

const mockServers: PacsServerItem[] = [
  { id: 'ps-001', name: 'Primary PACS', hostname: 'pacs01.hospital.local', port: 11112, aeTitle: 'RIS_PRIMARY', status: 'online', studyCount: 125000, storageBytes: 500 * 1024 * 1024 * 1024 },
  { id: 'ps-002', name: 'Backup PACS', hostname: 'pacs02.hospital.local', port: 11112, aeTitle: 'RIS_BACKUP', status: 'online', studyCount: 125000, storageBytes: 480 * 1024 * 1024 * 1024 },
  { id: 'ps-003', name: 'Archive PACS', hostname: 'pacs03.hospital.local', port: 11112, aeTitle: 'RIS_ARCHIVE', status: 'offline', studyCount: 500000, storageBytes: 2 * 1024 * 1024 * 1024 * 1024 },
]

const mockStorage: StorageGroupItem[] = [
  { id: 'sg-001', name: 'Hot Storage', path: '/data/hot', totalBytes: 2 * 1024 * 1024 * 1024 * 1024, usedBytes: 1.5 * 1024 * 1024 * 1024 * 1024, status: 'active' },
  { id: 'sg-002', name: 'Warm Storage', path: '/data/warm', totalBytes: 5 * 1024 * 1024 * 1024 * 1024, usedBytes: 3.2 * 1024 * 1024 * 1024 * 1024, status: 'active' },
  { id: 'sg-003', name: 'Cold Archive', path: '/data/cold', totalBytes: 20 * 1024 * 1024 * 1024 * 1024, usedBytes: 12 * 1024 * 1024 * 1024 * 1024, status: 'active' },
]

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(1)} TB`
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

const PacsAdminPage: React.FC = () => {
  const [servers] = useState(mockServers)
  const [storage] = useState(mockStorage)

  const serverColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '主机', dataIndex: 'hostname', key: 'hostname', render: (v: string) => <Text style={{ fontFamily: 'monospace' }}>{v}</Text> },
    { title: '端口', dataIndex: 'port', key: 'port' },
    { title: 'AE Title', dataIndex: 'aeTitle', key: 'ae', render: (v: string) => <Tag>{v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'online' ? 'green' : 'red'} icon={v === 'online' ? <Wifi size={12} /> : <WifiOff size={12} />}>{v}</Tag> },
    { title: '检查数', dataIndex: 'studyCount', key: 'studies', render: (v: number) => v.toLocaleString() },
    { title: '存储', dataIndex: 'storageBytes', key: 'storage', render: (v: number) => formatBytes(v) },
  ]

  const storageColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '路径', dataIndex: 'path', key: 'path', render: (v: string) => <Text code>{v}</Text> },
    { title: '总容量', dataIndex: 'totalBytes', key: 'total', render: (v: number) => formatBytes(v) },
    { title: '已用', dataIndex: 'usedBytes', key: 'used', render: (v: number) => formatBytes(v) },
    { title: '使用率', key: 'usage', render: (_: unknown, r: StorageGroupItem) => `${((r.usedBytes / r.totalBytes) * 100).toFixed(1)}%` },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color="green">{v}</Tag> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Server size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>PACS 管理</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="服务器" value={servers.length} prefix={<Server size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="在线" value={servers.filter(s => s.status === 'online').length} prefix={<Wifi size={16} />} styles={{ content: {  color: '#52c41a'  } }} /></Card></Col>
        <Col span={6}><Card><Statistic title="总检查数" value={servers.reduce((s, sv) => s + sv.studyCount, 0).toLocaleString()} prefix={<Activity size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="总存储" value={formatBytes(servers.reduce((s, sv) => s + sv.storageBytes, 0))} prefix={<Database size={16} />} /></Card></Col>
      </Row>
      <Card title="PACS 服务器" style={{ marginBottom: 16 }}>
        <Table rowKey="id" dataSource={servers} columns={serverColumns} pagination={false} size="small" />
      </Card>
      <Card title="存储组">
        <Table rowKey="id" dataSource={storage} columns={storageColumns} pagination={false} size="small" />
      </Card>
    </div>
  )
}

export default PacsAdminPage
