import React, { useMemo, useState } from 'react'
import { Card, Table, Tag, Switch, Tooltip, Typography, Alert, Badge, Space } from 'antd'
import { Shield, ShieldCheck, ShieldOff, Users, Lock, Unlock } from 'lucide-react'
import { ROLES, type Permission } from '../../services/auth/rbacService'

const { Title, Text } = Typography

const permissionGroups: Record<string, Permission[]> = {
  '报告': ['report.create', 'report.edit', 'report.view', 'report.delete', 'report.approve', 'report.sign', 'report.publish'],
  '患者': ['patient.create', 'patient.edit', 'patient.view'],
  '检查': ['exam.create', 'exam.update', 'exam.delete', 'exam.view'],
  '用户': ['user.manage', 'user.view', 'user.create', 'user.update', 'user.delete'],
  '系统': ['system.admin'],
  '审计': ['audit.view', 'audit.approve'],
  '模板': ['template.edit', 'template.use'],
  '危急值': ['critical.ack', 'critical.manage'],
  '统计': ['stats.view', 'stats.export'],
}

export default function PermissionMatrix() {
  const [showDetail, setShowDetail] = useState(false)

  const roleNames = Object.keys(ROLES)
  const allPermissions = Object.values(permissionGroups).flat()

  const dataSource = useMemo(() => {
    return allPermissions.map(p => {
      const row: Record<string, unknown> = { permission: p }
      for (const [roleId, role] of Object.entries(ROLES)) {
        row[roleId] = role.permissions.includes(p)
      }
      return row
    })
  }, [])

  const columns = [
    { title: '权限', dataIndex: 'permission', key: 'permission', width: 180, fixed: 'left' as const,
      render: (v: string) => <Text code>{v}</Text> },
    ...roleNames.map(roleId => ({
      title: <Tooltip title={ROLES[roleId]!.description}><Space><Users size={14} />{ROLES[roleId]!.name}</Space></Tooltip>,
      dataIndex: roleId, key: roleId, width: 80,
      render: (has: boolean) => has
        ? <Tag color="green" icon={<ShieldCheck size={12} />}>✓</Tag>
        : <Tag color="red" icon={<ShieldOff size={12} />}>✗</Tag>,
    })),
  ]

  const groupedData = useMemo(() => {
    return Object.entries(permissionGroups).map(([group, perms]) => ({
      key: group,
      group,
      count: perms.length,
      superAdmin: perms.every(p => ROLES['super-admin']!.permissions.includes(p)),
      admin: perms.filter(p => ROLES['admin']!.permissions.includes(p)).length,
      director: perms.filter(p => ROLES['director']!.permissions.includes(p)).length,
      doctor: perms.filter(p => ROLES['doctor']!.permissions.includes(p)).length,
      tech: perms.filter(p => ROLES['technician']!.permissions.includes(p)).length,
      nurse: perms.filter(p => ROLES['nurse']!.permissions.includes(p)).length,
    }))
  }, [])

  const summaryColumns = [
    { title: '权限组', dataIndex: 'group', key: 'group', width: 180 },
    { title: '数量', dataIndex: 'count', key: 'count', width: 60 },
    ...roleNames.map(roleId => ({
      title: ROLES[roleId]!.name, dataIndex: roleId, key: roleId, width: 80,
      render: (v: number | boolean) => typeof v === 'boolean'
        ? (v ? <Tag color="green">全</Tag> : <Tag color="red">部分</Tag>)
        : <Tag>{v}/{allPermissions.length}</Tag>,
    })),
  ]

  return (
    <Card>
      <Title level={4}><Shield style={{ marginRight: 8 }} />RBAC 权限矩阵</Title>
      <Alert title="6 个角色, 22 个细粒度权限, 支持角色继承和最小权限原则" type="info" showIcon style={{ marginBottom: 16 }} />
      <Space style={{ marginBottom: 16 }}>
        <Switch checked={showDetail} onChange={setShowDetail} checkedChildren={<Unlock size={12} />} unCheckedChildren={<Lock size={12} />} />
        <Text>{showDetail ? '详细视图' : '分组视图'}</Text>
      </Space>
      {showDetail ? (
        <Table dataSource={dataSource} columns={columns} rowKey="permission" size="small" scroll={{ x: 800 }} pagination={false} bordered />
      ) : (
        <Table dataSource={groupedData} columns={summaryColumns} rowKey="group" size="small" pagination={false} bordered />
      )}
    </Card>
  )
}
