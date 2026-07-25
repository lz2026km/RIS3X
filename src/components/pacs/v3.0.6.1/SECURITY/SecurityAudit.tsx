/**
 * G005 放射RIS系统 v3.0.6.1 - 安全审计 (HIPAA / 等级保护)
 */
import React from 'react'
import { Card, Row, Col, Tag, Space, Statistic, Table, Alert, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Shield, AlertTriangle, Lock, User } from 'lucide-react'

export interface AuditLog {
  id: string
  ts: string
  user: string
  action: 'VIEW' | 'EDIT' | 'EXPORT' | 'DELETE' | 'LOGIN'
  resource: string
  ip: string
  result: 'OK' | 'DENIED'
}

const MOCK: AuditLog[] = [
  { id: 'A001', ts: '2024-06-18 09:00:12', user: '陈医师', action: 'VIEW', resource: 'P20240618001', ip: '10.0.0.12', result: 'OK' },
  { id: 'A002', ts: '2024-06-18 09:01:23', user: '李护士', action: 'EXPORT', resource: 'Report P002', ip: '10.0.0.45', result: 'OK' },
  { id: 'A003', ts: '2024-06-18 09:02:45', user: '外部访客', action: 'VIEW', resource: 'P003', ip: '203.0.113.5', result: 'DENIED' },
  { id: 'A004', ts: '2024-06-18 09:03:01', user: '陈医师', action: 'EDIT', resource: 'Report P001', ip: '10.0.0.12', result: 'OK' },
  { id: 'A005', ts: '2024-06-18 09:05:14', user: 'admin', action: 'LOGIN', resource: 'Console', ip: '10.0.0.1', result: 'OK' },
  { id: 'A006', ts: '2024-06-18 09:06:00', user: '王医师', action: 'DELETE', resource: 'Draft P005', ip: '10.0.0.18', result: 'DENIED' },
]

export interface SecurityAuditProps {
  logs?: AuditLog[]
}

const ACTION_META = {
  VIEW: { color: 'blue', label: '查看' },
  EDIT: { color: 'orange', label: '编辑' },
  EXPORT: { color: 'cyan', label: '导出' },
  DELETE: { color: 'red', label: '删除' },
  LOGIN: { color: 'green', label: '登录' },
} as const

export const SecurityAudit: React.FC<SecurityAuditProps> = ({ logs = MOCK }) => {
  const denied = logs.filter((l) => l.result === 'DENIED').length
  const exports = logs.filter((l) => l.action === 'EXPORT').length

  const columns: ColumnsType<AuditLog> = [
    { title: '时间', dataIndex: 'ts', width: 160 },
    { title: '用户', dataIndex: 'user', width: 100, render: (u: string) => <Space><User size={10} />{u}</Space> },
    { title: '动作', dataIndex: 'action', width: 80, render: (a: AuditLog['action']) => <Tag color={ACTION_META[a].color}>{ACTION_META[a].label}</Tag> },
    { title: '资源', dataIndex: 'resource', width: 160 },
    { title: 'IP', dataIndex: 'ip', width: 120 },
    { title: '结果', dataIndex: 'result', width: 80, render: (r: string) => <Tag color={r === 'OK' ? 'green' : 'red'}>{r === 'OK' ? '允许' : '拒绝'}</Tag> },
  ]

  return (
    <div data-testid="security-audit">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}><Card size="small"><Statistic title="总事件" value={logs.length} prefix={<Shield size={14} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="拒绝访问" value={denied} valueStyle={{ color: '#dc2626' }} prefix={<Lock size={14} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="导出次数" value={exports} prefix={<AlertTriangle size={14} />} /></Card></Col>
        <Col span={6}><Card size="small"><Tag color="green">HIPAA</Tag><Tag color="blue">等保 2.0 三级</Tag></Card></Col>
      </Row>

      {denied > 0 && (
        <Alert
          type="error"
          showIcon
          message={`检测到 ${denied} 次拒绝访问事件,请关注`}
          style={{ marginBottom: 12 }}
        />
      )}

      <Card size="small" title="审计日志">
        <Table<AuditLog>
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={logs}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无审计日志" /> }}
        />
      </Card>
    </div>
  )
}

export default SecurityAudit