import React, { useState, useEffect } from 'react'
import { Card, Table, Tag, Button, Space, Typography, Modal, message, Select, Statistic, Row, Col, Empty, Descriptions } from 'antd'
import { LogOut, Shield, AlertTriangle, Clock, Globe, Monitor, Smartphone } from 'lucide-react'
import { sessionManager } from '../../services/security'
import type { UserSession, SessionStatus, SessionPolicy } from '../../types/security'

const { Title, Text } = Typography

const statusColor: Record<SessionStatus, string> = { active: 'green', idle: 'orange', expired: 'default', revoked: 'red', concurrent: 'purple' }

export default function SessionManagerComponent() {
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [policy, setPolicy] = useState<SessionPolicy>(sessionManager.getPolicy())

  const refresh = () => {
    setSessions(sessionManager.list())
    setPolicy(sessionManager.getPolicy())
    sessionManager.cleanup()
  }

  useEffect(() => { refresh(); const id = setInterval(refresh, 10000); return () => clearInterval(id) }, [])

  const revokeSession = (sessionId: string) => {
    sessionManager.revoke(sessionId)
    message.success('会话已撤销')
    refresh()
  }

  const revokeAll = (userId: string) => {
    Modal.confirm({ title: '撤销所有会话', content: `确定撤销用户 ${userId} 的所有会话?`, onOk: () => { sessionManager.revokeAllForUser(userId); message.success('已撤销'); refresh() } })
  }

  const updatePolicy = (key: keyof SessionPolicy, value: number) => {
    sessionManager.updatePolicy({ [key]: value })
    setPolicy(sessionManager.getPolicy())
    message.success('策略已更新')
  }

  const stats = sessionManager.stats()

  const columns = [
    { title: '会话 ID', dataIndex: 'sessionId', key: 'sessionId', width: 200, render: (v: string) => <Text code style={{ fontSize: 12 }}>{v.slice(0, 12)}...</Text> },
    { title: '用户', dataIndex: 'userName', key: 'userName', width: 100 },
    { title: '角色', dataIndex: 'role', key: 'role', width: 80 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v: SessionStatus) => <Tag color={statusColor[v]}>{v}</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 150, render: (v: string) => new Date(v).toLocaleString() },
    { title: '最后活动', dataIndex: 'lastActivity', key: 'lastActivity', width: 150, render: (v: string) => new Date(v).toLocaleString() },
    { title: 'IP', dataIndex: 'ipAddress', key: 'ipAddress', width: 120 },
    { title: '设备', dataIndex: 'userAgent', key: 'userAgent', width: 180, render: (v: string) => <Tooltip title={v}>{v.slice(0, 40)}...</Tooltip> },
    { title: 'MFA', dataIndex: 'mfaVerified', key: 'mfaVerified', width: 50, render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '✓' : '✗'}</Tag> },
    { title: '风险', dataIndex: 'riskScore', key: 'riskScore', width: 60, render: (v: number) => <Tag color={v >= 50 ? 'red' : v >= 20 ? 'orange' : 'green'}>{v}</Tag> },
    { title: '操作', key: 'actions', width: 100, render: (_: unknown, r: UserSession) => r.status === 'active' ? <Button size="small" danger icon={<LogOut size={12} />} onClick={() => revokeSession(r.sessionId)}>撤销</Button> : null },
  ]

  return (
    <Card title={<><Shield size={16} style={{ marginRight: 8 }} />会话管理</>}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="总会话" value={stats.total} prefix={<Globe size={14} />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="活跃" value={stats.active} styles={{ content: {  color: '#3f8600'  } }} prefix={<Monitor size={14} />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="空闲" value={stats.idle} styles={{ content: {  color: '#faad14'  } }} prefix={<Clock size={14} />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="已撤销" value={stats.revoked} styles={{ content: {  color: '#cf1322'  } }} prefix={<LogOut size={14} />} /></Card></Col>
        <Col span={8}><Card size="small" title="策略">
          <Space wrap>
            <span>并发: <Select size="small" value={policy.maxConcurrentSessions} onChange={v => updatePolicy('maxConcurrentSessions', v)} style={{ width: 60 }}>{[1,2,3,5,10].map(n => <Select.Option key={n} value={n}>{n}</Select.Option>)}</Select></span>
            <span>空闲超时: <Select size="small" value={policy.idleTimeoutSeconds / 60} onChange={v => updatePolicy('idleTimeoutSeconds', v * 60)} style={{ width: 70 }}>{[5,10,15,30,60].map(n => <Select.Option key={n} value={n}>{n}min</Select.Option>)}</Select></span>
          </Space>
        </Card></Col>
      </Row>
      <Table dataSource={sessions} columns={columns} rowKey="sessionId" size="small" pagination={{ pageSize: 10 }} locale={{ emptyText: <Empty description="无活跃会话" /> }} />
    </Card>
  )
}

function Tooltip({ title, children }: { title: string; children: React.ReactNode }) {
  return <div title={title}>{children}</div>
}
