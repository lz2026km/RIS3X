/**
 * G005 放射RIS系统 v3.0.2 - 用户角色权限管理
 * 对标:RBAC / NIST 800-53 AC
 */
import { Card, Tag, Space, Button, Modal, Form, Select, Input, Switch, Empty, Statistic, Row, Col, message, Alert, Popconfirm } from 'antd'
import { DataTable } from '../../common'
import { Shield, User, Lock, Edit, Trash2, Plus, CheckCircle, XCircle, KeyRound } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { Inbox } from 'lucide-react'
import { t } from '../../../i18n/appI18n'

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
  ADMIN: { color: 'red', label: t('userMgmt.role.admin'), description: t('userMgmt.role.adminDesc') },
  DIRECTOR: { color: 'magenta', label: t('userMgmt.role.director'), description: t('userMgmt.role.directorDesc') },
  DOCTOR: { color: 'blue', label: t('userMgmt.role.doctor'), description: t('userMgmt.role.doctorDesc') },
  TECHNICIAN: { color: 'cyan', label: t('userMgmt.role.technician'), description: t('userMgmt.role.technicianDesc') },
  NURSE: { color: 'pink', label: t('userMgmt.role.nurse'), description: t('userMgmt.role.nurseDesc') },
  REGISTRAR: { color: 'orange', label: t('userMgmt.role.registrar'), description: t('userMgmt.role.registrarDesc') },
  AUDITOR: { color: 'purple', label: t('userMgmt.role.auditor'), description: t('userMgmt.role.auditorDesc') },
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

function resolveRoleKey(r: string): Role {
  return ROLE_ALIAS[r] ?? (ROLE_META[r as Role] ? (r as Role) : 'DOCTOR')
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
      <Row gutter={12} style={{ marginBottom: 'var(--space-3, 12px)' }}>
        <Col span={6}>
          <Card>
            <Statistic title={t('userMgmt.stat.totalUsers')} value={stats.total} prefix={<User size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('userMgmt.stat.active')} value={stats.active} styles={{ content: {  color: 'var(--color-success-600)'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('userMgmt.stat.twoFactor')} value={stats.twoFA} styles={{ content: {  color: 'var(--color-primary-500)'  } }} prefix={<KeyRound size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('userMgmt.stat.roles')} value={stats.roles} prefix={<Shield size={14} />} />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 'var(--space-3, 12px)', width: '100%', justifyContent: 'space-between' }}>
        <Input
          placeholder={t('userMgmt.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300 }}
          data-testid="user-search"
          allowClear
        />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)} data-testid="user-create-btn">
          {t('userMgmt.newUser')}
        </Button>
      </Space>

      <DataTable
        dataSource={filtered}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        data-testid="user-table"
        columns={[
          { title: t('userMgmt.col.username'), dataIndex: 'username', width: 120 },
          { title: t('userMgmt.col.name'), dataIndex: 'name', width: 100 },
          {
            title: t('userMgmt.col.role'), dataIndex: 'role', width: 120,
            render: (r: Role) => {
              const m = resolveRoleMeta(String(r))
              return <Tag color={m.color} data-testid={`user-role-${r}`}>{m.label}</Tag>
            },
          },
          { title: t('userMgmt.col.department'), dataIndex: 'department', width: 120 },
          {
            title: t('userMgmt.col.status'), dataIndex: 'active', width: 80,
            render: (a: boolean) =>
              a ? <Tag icon={<CheckCircle size={10} />} color="green">{t('userMgmt.active')}</Tag>
              : <Tag icon={<XCircle size={10} />} color="red">{t('userMgmt.inactive')}</Tag>,
          },
          {
            title: '2FA', dataIndex: 'twoFactor', width: 60,
            render: (v: boolean) => v ? <Tag color="blue">{t('userMgmt.enabled')}</Tag> : <Tag>{t('userMgmt.disabled')}</Tag>,
          },
          { title: t('userMgmt.col.lastLogin'), dataIndex: 'lastLoginAt', width: 140, render: (v) => v ?? <span style={{ color: '#94a3b8' }}>{t('userMgmt.never')}</span> },
          {
            title: t('userMgmt.col.failedLogins'), dataIndex: 'failedLogins', width: 80,
            render: (v) => v > 3 ? <Tag color="red">{v}</Tag> : <span>{v}</span>,
          },
          {
            title: t('userMgmt.col.action'), dataIndex: 'id', width: 220, fixed: 'right',
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
                    {t('userMgmt.edit')}
                  </Button>
                  <Button size="small" type="text" icon={<Shield size={12} />} onClick={() => setPermModal(u)} data-testid={`user-perm-${id}`}>
                    {t('userMgmt.permissions')}
                  </Button>
                  <Popconfirm
                    title={t('userMgmt.resetConfirmTitle')}
                    description={t('userMgmt.resetConfirmDesc')}
                    okText={t('userMgmt.reset')}
                    cancelText={t('userMgmt.cancel')}
                    onConfirm={() => onResetPassword?.(id)}
                  >
                    <Button size="small" type="text" icon={<Lock size={12} />} data-testid={`user-reset-${id}`}>
                      {t('userMgmt.resetPassword')}
                    </Button>
                  </Popconfirm>
                  <Button size="small" type="text" danger icon={<Trash2 size={12} />} onClick={() => onDelete?.(id)}>
                    {t('userMgmt.delete')}
                  </Button>
                </Space>
              )
            },
          },
        ]}
        scroll={{ x: 1100 }}
        locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('userMgmt.noUsers')} /> }}
      />

      <Modal
        title={editing ? t('userMgmt.editUser') : t('userMgmt.newUser')}
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
              void message.success(t('userMgmt.updated'))
            } else {
              onCreate?.({ ...values, active: values.active ?? true, twoFactor: values.twoFactor ?? false })
              void message.success(t('userMgmt.created'))
            }
            setCreateOpen(false)
            setEditing(null)
            form.resetFields()
          }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="username" label={t('userMgmt.col.username')} rules={[{ required: true }]}>
                <Input disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label={t('userMgmt.col.name')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="role" label={t('userMgmt.col.role')} rules={[{ required: true }]}>
                <Select
                  data-testid="user-form-role"
                  options={Object.entries(ROLE_META).map(([k, v]) => ({ value: k, label: `${v.label} - ${v.description}` }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label={t('userMgmt.col.department')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label={t('userMgmt.email')}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label={t('userMgmt.phone')}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="active" label={t('userMgmt.enableLabel')} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="twoFactor" label={t('userMgmt.stat.twoFactor')} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={t('userMgmt.permModalTitle', { name: permModal?.name })}
        open={!!permModal}
        onCancel={() => setPermModal(null)}
        footer={null}
        data-testid="user-perm-modal"
      >
        {permModal && (() => {
          const roleKey = resolveRoleKey(permModal.role)
          const roleMeta = ROLE_META[roleKey]
          const rolePerms = ROLE_PERMISSIONS[roleKey] ?? []
          return (
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                title={t('userMgmt.roleDefaultPerms', { role: roleMeta.label })}
                description={
                  <Space wrap>
                    {rolePerms.map((p) => <Tag key={p}>{p}</Tag>)}
                  </Space>
                }
              />
              {permModal.customPermissions && permModal.customPermissions.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  title={t('userMgmt.customOverride')}
                  description={
                    <Space wrap>
                      {permModal.customPermissions.map((p) => <Tag key={p} color="orange">{p}</Tag>)}
                    </Space>
                  }
                />
              )}
            </Space>
          )
        })()}
      </Modal>
    </div>
  )
}

export default UserManagement
