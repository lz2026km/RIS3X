/**
 * G005 放射RIS系统 v3.0.2 - 用户角色权限管理
 * 对标:RBAC / NIST 800-53 AC
 */
import React, { useState, useMemo } from 'react'
import { Card, Table, Tag, Space, Button, Modal, Form, Select, Input, Switch, Empty, Statistic, Row, Col, message, Alert } from 'antd'
import { Shield, User, Lock, Edit, Trash2, Plus, CheckCircle, XCircle, KeyRound } from 'lucide-react'

export type Role = 'ADMIN' | 'DIRECTOR' | 'DOCTOR' | 'TECHNICIAN' | 'NURSE' | 'REGISTRAR' | 'AUDITOR'

export interface UserAccount {
  id: string
  username: string
  name: string
  role: Role
  department: string
  email?: string
  phone?: string
  active: boolean
  /** 是否双因素认证 */
  twoFactor: boolean
  lastLoginAt?: string
  /** 关联权限(覆盖) */
  customPermissions?: string[]
  /** 失败登录次数 */
  failedLogins: number
  /** 账号创建时间 */
  createdAt: string
}

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  ADMIN: ['*'],
  DIRECTOR: ['report.approve', 'report.amend', 'critical.ack', 'template.edit', 'stats.view', 'user.view'],
  DOCTOR: ['report.create', 'report.edit', 'report.view', 'critical.view', 'template.use'],
  TECHNICIAN: ['exam.create', 'exam.update', 'image.view', 'worklist.view'],
  NURSE: ['patient.view', 'appointment.create', 'critical.notify'],
  REGISTRAR: ['patient.create', 'patient.edit', 'appointment.create', 'worklist.view'],
  AUDITOR: ['audit.view', 'report.view'],
}

const ROLE_META: Record<Role, { color: string; label: string; description: string }> = {
  ADMIN: { color: 'red', label: '系统管理员', description: '全部权限' },
  DIRECTOR: { color: 'magenta', label: '科主任', description: '审核/统计/模板编辑' },
  DOCTOR: { color: 'blue', label: '诊断医师', description: '写/编辑/查看报告' },
  TECHNICIAN: { color: 'cyan', label: '技师', description: '检查操作/影像查看' },
  NURSE: { color: 'pink', label: '护士', description: '通知/预约' },
  REGISTRAR: { color: 'orange', label: '登记员', description: '患者/预约登记' },
  AUDITOR: { color: 'purple', label: '审计员', description: '审计/只读' },
}

/** 中文角色名 → 英文枚举（后端可能返回中文角色） */
const ROLE_ALIAS: Record<string, Role> = {
  管理员: 'ADMIN', 系统管理员: 'ADMIN',
  主任: 'DIRECTOR', 科主任: 'DIRECTOR',
  医生: 'DOCTOR', 诊断医师: 'DOCTOR',
  技师: 'TECHNICIAN',
  护士: 'NURSE',
  登记员: 'REGISTRAR',
  审计员: 'AUDITOR',
}

function resolveRoleMeta(r: string): { color: string; label: string; description: string } {
  return ROLE_META[r as Role] ?? ROLE_META[ROLE_ALIAS[r] ?? 'DOCTOR']
}

export interface UserManagementProps {
  users: UserAccount[]
  onCreate?: (u: Omit<UserAccount, 'id' | 'createdAt' | 'failedLogins'>) => void
  onUpdate?: (id: string, patch: Partial<UserAccount>) => void
  onDelete?: (id: string) => void
  onResetPassword?: (id: string) => void
}

export const UserManagement: React.FC<UserManagementProps> = ({ users, onCreate, onUpdate, onDelete, onResetPassword }) => {
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<UserAccount | null>(null)
  const [permModal, setPermModal] = useState<UserAccount | null>(null)

  const filtered = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
    )
  }, [users, search])

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.active).length,
      twoFA: users.filter((u) => u.twoFactor).length,
      roles: new Set(users.map((u) => u.role)).size,
    }
  }, [users])

  return (
    <div data-testid="user-management">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总用户" value={stats.total} prefix={<User size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="活跃" value={stats.active} styles={{ content: {  color: '#16a34a'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="双因素认证" value={stats.twoFA} styles={{ content: {  color: '#3b82f6'  } }} prefix={<KeyRound size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="角色数" value={stats.roles} prefix={<Shield size={14} />} />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Input
          placeholder="搜索用户名/姓名/科室"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300 }}
          data-testid="user-search"
          allowClear
        />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)} data-testid="user-create-btn">
          新建用户
        </Button>
      </Space>

      <Table
        size="small"
        dataSource={filtered}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        data-testid="user-table"
        columns={[
          { title: '账号', dataIndex: 'username', width: 120 },
          { title: '姓名', dataIndex: 'name', width: 100 },
          {
            title: '角色', dataIndex: 'role', width: 120,
            render: (r: Role) => {
              const m = resolveRoleMeta(String(r))
              return <Tag color={m.color} data-testid={`user-role-${r}`}>{m.label}</Tag>
            },
          },
          { title: '科室', dataIndex: 'department', width: 120 },
          {
            title: '状态', dataIndex: 'active', width: 80,
            render: (a: boolean) =>
              a ? <Tag icon={<CheckCircle size={10} />} color="green">启用</Tag>
              : <Tag icon={<XCircle size={10} />} color="red">停用</Tag>,
          },
          {
            title: '2FA', dataIndex: 'twoFactor', width: 60,
            render: (v: boolean) => v ? <Tag color="blue">已开启</Tag> : <Tag>未开启</Tag>,
          },
          { title: '上次登录', dataIndex: 'lastLoginAt', width: 140, render: (v) => v ?? <span style={{ color: '#94a3b8' }}>从未</span> },
          {
            title: '失败次数', dataIndex: 'failedLogins', width: 80,
            render: (v) => v > 3 ? <Tag color="red">{v}</Tag> : <span>{v}</span>,
          },
          {
            title: '操作', dataIndex: 'id', width: 220, fixed: 'right',
            render: (id: string) => {
              const u = users.find((x) => x.id === id)!
              return (
                <Space size={2}>
                  <Button
                    size="small"
                    type="text"
                    icon={<Edit size={12} />}
                    onClick={() => {
                      setEditing(u)
                      form.setFieldsValue(u)
                      setCreateOpen(true)
                    }}
                    data-testid={`user-edit-${id}`}
                  >
                    编辑
                  </Button>
                  <Button size="small" type="text" icon={<Shield size={12} />} onClick={() => setPermModal(u)} data-testid={`user-perm-${id}`}>
                    权限
                  </Button>
                  <Button size="small" type="text" icon={<Lock size={12} />} onClick={() => onResetPassword?.(id)} data-testid={`user-reset-${id}`}>
                    重置密码
                  </Button>
                  <Button size="small" type="text" danger icon={<Trash2 size={12} />} onClick={() => onDelete?.(id)}>
                    删除
                  </Button>
                </Space>
              )
            },
          },
        ]}
        scroll={{ x: 1100 }}
        locale={{ emptyText: <Empty description="无用户" /> }}
      />

      <Modal
        title={editing ? '编辑用户' : '新建用户'}
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        onOk={() => {
          form.submit()
        }}
        data-testid="user-form-modal"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            if (editing) {
              onUpdate?.(editing.id, values)
              void message.success('已更新')
            } else {
              onCreate?.({ ...values, active: values.active ?? true, twoFactor: values.twoFactor ?? false })
              void message.success('已创建')
            }
            setCreateOpen(false)
            setEditing(null)
            form.resetFields()
          }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="username" label="账号" rules={[{ required: true }]}>
                <Input disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="role" label="角色" rules={[{ required: true }]}>
                <Select
                  data-testid="user-form-role"
                  options={Object.entries(ROLE_META).map(([k, v]) => ({ value: k, label: `${v.label} - ${v.description}` }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label="科室" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="邮箱">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="电话">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="active" label="启用" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="twoFactor" label="双因素认证" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={`权限 · ${permModal?.name}`}
        open={!!permModal}
        onCancel={() => setPermModal(null)}
        footer={null}
        data-testid="user-perm-modal"
      >
        {permModal && (
          <Space orientation="vertical" size={8} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              title={`角色 ${ROLE_META[permModal.role].label} 默认权限`}
              description={
                <Space wrap>
                  {ROLE_PERMISSIONS[permModal.role].map((p) => <Tag key={p}>{p}</Tag>)}
                </Space>
              }
            />
            {permModal.customPermissions && permModal.customPermissions.length > 0 && (
              <Alert
                type="warning"
                showIcon
                title="自定义覆盖"
                description={
                  <Space wrap>
                    {permModal.customPermissions.map((p) => <Tag key={p} color="orange">{p}</Tag>)}
                  </Space>
                }
              />
            )}
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default UserManagement
