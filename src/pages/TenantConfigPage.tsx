import { useAuth } from '../hooks/useAuth'
import { tenantApi, type TenantProfile, type TenantUsage, type TenantFeatures } from '../services/api/tenantApi'
import {
  SafetyCertificateOutlined, ReloadOutlined, SettingOutlined, TeamOutlined,
  DashboardOutlined, ThunderboltOutlined, PlusOutlined,
  PoweroffOutlined, PlayCircleOutlined,
} from '@ant-design/icons'
import {
  Card, Table, Tag, Statistic, Row, Col, Button, Spin, Alert, Tabs, Descriptions, Space,
  Badge, Progress, Switch, Form, Input, InputNumber, Modal, message, Popconfirm,
} from 'antd'
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { usePagination } from '../hooks/usePagination'

const FEATURE_DEFS: Array<{ key: keyof TenantFeatures; label: string; desc: string }> = [
  { key: 'aiOrchestration', label: 'AI 编排', desc: 'AI 工作流编排与自动化诊断调度' },
  { key: 'biDashboard', label: 'BI 仪表板', desc: '业务智能看板（时效/RVU/OEE/危急值 SLA）' },
  { key: 'doseManagement', label: '剂量管理', desc: '辐射剂量记录与 DRL 参考水平监控' },
  { key: 'vna', label: 'VNA 归档', desc: '厂商中立归档（WORM 不可变存储）' },
  { key: 'similarCases', label: '相似病例', desc: '基于临床发现词表的相似病例检索' },
  { key: 'environmentReport', label: '环境式报告', desc: '沉浸式报告书写工作台' },
  { key: 'mobileApp', label: '移动端', desc: '移动/小程序端访问' },
  { key: 'teleRadiology', label: '远程会诊', desc: '跨院区远程阅片与会诊' },
]

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx++
  }
  return `${value.toFixed(value >= 100 || idx === 0 ? 0 : 1)} ${units[idx]}`
}

export default function TenantConfigPage() {
  const { isAdmin } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tenant, setTenant] = useState<TenantProfile | null>(null)
  const [usage, setUsage] = useState<TenantUsage | null>(null)
  const [features, setFeatures] = useState<TenantFeatures | null>(null)
  const [tenants, setTenants] = useState<TenantProfile[]>([])

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [featureBusy, setFeatureBusy] = useState<keyof TenantFeatures | null>(null)
  const [creating, setCreating] = useState(false)
  const [creatingTenant, setCreatingTenant] = useState(false)
  const [statusBusy, setStatusBusy] = useState<string | null>(null)
  const { pageData: pagedTenants, pagination: tenantsPagination } = usePagination(tenants)
  const [form] = Form.useForm()
  const [createForm] = Form.useForm()

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [t, u, f, l] = await Promise.all([
        tenantApi.getCurrent(),
        tenantApi.getUsage(),
        tenantApi.getFeatures(),
        isAdmin ? tenantApi.listTenants() : Promise.resolve({ success: true, data: [] as TenantProfile[] }),
      ])
      if (t.success) setTenant(t.data)
      if (u.success) setUsage(u.data)
      if (f.success) setFeatures(f.data)
      if (l.success) setTenants(l.data)
      if (!t.success || !u.success || !f.success) {
        setError((t.error ?? u.error ?? f.error)?.message ?? '租户数据加载失败')
      }
    } catch (e) {
      setError((e as Error)?.message ?? '租户数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => { void fetchAll() }, [fetchAll])

  const openEdit = () => {
    if (!tenant) return
    form.setFieldsValue({
      name: tenant.name,
      license: tenant.license,
      maxUsers: tenant.maxUsers,
      maxStorageGb: tenant.maxStorageGb,
    })
    setEditing(true)
  }

  const saveProfile = async () => {
    const values = await form.validateFields()
    setSaving(true)
    const res = await tenantApi.updateProfile(values)
    setSaving(false)
    if (res.success) {
      message.success('租户信息已更新')
      setTenant(res.data)
      setEditing(false)
    } else {
      message.error(res.error?.message ?? '保存失败')
    }
  }

  const toggleFeature = async (key: keyof TenantFeatures, checked: boolean) => {
    setFeatureBusy(key)
    const res = await tenantApi.updateFeatures({ [key]: checked })
    setFeatureBusy(null)
    if (res.success) {
      setFeatures(res.data)
      message.success(`功能「${FEATURE_DEFS.find((f) => f.key === key)?.label}」已${checked ? '启用' : '停用'}`)
    } else {
      message.error(res.error?.message ?? '更新失败')
    }
  }

  const createTenant = async () => {
    const values = await createForm.validateFields()
    setCreatingTenant(true)
    const res = await tenantApi.createTenant(values)
    setCreatingTenant(false)
    if (res.success) {
      message.success('租户创建成功')
      setCreating(false)
      createForm.resetFields()
      const list = await tenantApi.listTenants()
      if (list.success) setTenants(list.data)
    } else {
      message.error(res.error?.message ?? '创建失败')
    }
  }

  const toggleTenantStatus = async (record: TenantProfile) => {
    const next = record.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    setStatusBusy(record.id)
    const res = await tenantApi.updateTenantStatus(record.id, next)
    setStatusBusy(null)
    if (res.success) {
      message.success(`租户「${record.name}」已${next === 'ACTIVE' ? '启用' : '停用'}`)
      setTenants((prev) => prev.map((t) => (t.id === record.id ? res.data : t)))
    } else {
      message.error(res.error?.message ?? '操作失败')
    }
  }

  const storagePct = usage && usage.storageLimitBytes > 0
    ? Math.min(100, Math.round((usage.storageBytes / usage.storageLimitBytes) * 100))
    : 0
  const userPct = usage && usage.userLimit > 0
    ? Math.min(100, Math.round((usage.users / usage.userLimit) * 100))
    : 0
  const examPct = usage && usage.examLimit > 0
    ? Math.min(100, Math.round((usage.exams / usage.examLimit) * 100))
    : 0

  const columns = [
    { title: '租户', dataIndex: 'name', key: 'name', render: (_: string, r: TenantProfile) => (
      <Space direction="vertical" size={0}>
        <span><strong>{r.name}</strong> <Tag color={r.status === 'ACTIVE' ? 'success' : 'default'}>{r.status === 'ACTIVE' ? '启用' : '停用'}</Tag></span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.code} · {r.id}</span>
      </Space>
    ) },
    { title: '许可证', dataIndex: 'license', key: 'license' },
    { title: '用户配额', key: 'users', render: (_: string, r: TenantProfile) => `${r.maxUsers} 人` },
    { title: '存储配额', key: 'storage', render: (_: string, r: TenantProfile) => `${r.maxStorageGb} GB` },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => v.slice(0, 10) },
    {
      title: '操作', key: 'action',
      render: (_: string, r: TenantProfile) => r.status === 'ACTIVE' ? (
        <Popconfirm title={`确认停用租户「${r.name}」？`} onConfirm={() => void toggleTenantStatus(r)}>
          <Button size="small" danger icon={<PoweroffOutlined />} loading={statusBusy === r.id}>停用</Button>
        </Popconfirm>
      ) : (
        <Button size="small" type="primary" icon={<PlayCircleOutlined />} loading={statusBusy === r.id} onClick={() => void toggleTenantStatus(r)}>启用</Button>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row justify="space-between" align="middle">
          <h2 style={{ margin: 0 }}><SafetyCertificateOutlined /> 租户配置管理</h2>
          <Button icon={<ReloadOutlined />} onClick={() => void fetchAll()} loading={loading}>刷新</Button>
        </Row>

        {error && <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => void fetchAll()}><RefreshCw size={14} /> 重试</Button>} />}

        {loading && !tenant ? <Spin tip="加载租户信息..." style={{ display: 'block', margin: '48px auto' }} /> : (
          <Tabs items={[
            {
              key: 'overview',
              label: <span><SettingOutlined /> 概览</span>,
              children: (
                <Row gutter={16}>
                  <Col span={14}>
                    <Card
                      title="当前租户信息"
                      size="small"
                      extra={<Button size="small" icon={<SettingOutlined />} onClick={openEdit}>编辑</Button>}
                    >
                      {tenant ? (
                        <Descriptions column={2} size="small" bordered>
                          <Descriptions.Item label="租户ID">{tenant.id}</Descriptions.Item>
                          <Descriptions.Item label="编码">{tenant.code}</Descriptions.Item>
                          <Descriptions.Item label="名称">{tenant.name}</Descriptions.Item>
                          <Descriptions.Item label="状态">
                            <Badge status={tenant.status === 'ACTIVE' ? 'success' : 'error'} text={tenant.status === 'ACTIVE' ? '启用' : '停用'} />
                          </Descriptions.Item>
                          <Descriptions.Item label="许可证">{tenant.license}</Descriptions.Item>
                          <Descriptions.Item label="创建时间">{tenant.createdAt.slice(0, 10)}</Descriptions.Item>
                          <Descriptions.Item label="用户配额">{tenant.maxUsers} 人</Descriptions.Item>
                          <Descriptions.Item label="存储配额">{tenant.maxStorageGb} GB</Descriptions.Item>
                          <Descriptions.Item label="检查配额">{tenant.maxExams} 例</Descriptions.Item>
                        </Descriptions>
                      ) : <Spin />}
                    </Card>
                  </Col>
                  <Col span={10}>
                    <Card title="用量概览" size="small">
                      {usage ? (
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>存储用量</span><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatBytes(usage.storageBytes)} / {formatBytes(usage.storageLimitBytes)}</span></div>
                            <Progress percent={storagePct} size="small" status={storagePct > 90 ? 'exception' : 'normal'} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>用户</span><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{usage.users} / {usage.userLimit}</span></div>
                            <Progress percent={userPct} size="small" />
                          </div>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>检查量</span><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{usage.exams.toLocaleString()} / {usage.examLimit.toLocaleString()}</span></div>
                            <Progress percent={examPct} size="small" />
                          </div>
                        </Space>
                      ) : <Spin />}
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'usage',
              label: <span><DashboardOutlined /> 用量统计</span>,
              children: usage ? (
                <Row gutter={16}>
                  <Col span={6}><Card size="small"><Statistic title="用户数" value={usage.users} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="患者数" value={usage.patients} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="检查数" value={usage.exams} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="报告数" value={usage.reports} /></Card></Col>
                  <Col span={8} style={{ marginTop: 16 }}>
                    <Card size="small"><Statistic title="存储用量" value={formatBytes(usage.storageBytes)} /></Card>
                  </Col>
                  <Col span={8} style={{ marginTop: 16 }}>
                    <Card size="small"><Statistic title="存储配额" value={formatBytes(usage.storageLimitBytes)} /></Card>
                  </Col>
                  <Col span={8} style={{ marginTop: 16 }}>
                    <Card size="small"><Statistic title="检查配额" value={usage.examLimit} suffix={`已用 ${Math.round((usage.exams / Math.max(1, usage.examLimit)) * 100)}%`} /></Card>
                  </Col>
                </Row>
              ) : <Spin />,
            },
            {
              key: 'features',
              label: <span><ThunderboltOutlined /> 功能开关 ({features ? Object.values(features).filter(Boolean).length : 0}/{FEATURE_DEFS.length})</span>,
              children: (
                <Row gutter={[16, 16]}>
                  {FEATURE_DEFS.map((f) => (
                    <Col span={6} key={f.key}>
                      <Card size="small">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div><strong>{f.label}</strong></div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{f.desc}</div>
                          </div>
                          <Switch
                            checked={features?.[f.key] ?? false}
                            loading={featureBusy === f.key}
                            disabled={!features}
                            onChange={(checked) => void toggleFeature(f.key, checked)}
                          />
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              ),
            },
            ...(isAdmin ? [{
              key: 'tenants',
              label: <span><TeamOutlined /> 平台租户管理</span>,
              children: (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>新建租户</Button>
                  <Table rowKey="id" columns={columns} dataSource={pagedTenants} pagination={tenantsPagination} size="small" scroll={{ x: 'max-content' }}/>
                </Space>
              ),
            }] : []),
          ]} />
        )}
      </Space>

      <Modal
        title="编辑租户信息"
        open={editing}
        onOk={() => void saveProfile()}
        confirmLoading={saving}
        onCancel={() => setEditing(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={tenant ?? {}}>
          <Form.Item name="name" label="租户名称" rules={[{ required: true, message: '请输入租户名称' }]}>
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item name="license" label="许可证类型" rules={[{ required: true, message: '请输入许可证类型' }]}>
            <Input maxLength={32} />
          </Form.Item>
          <Form.Item name="maxUsers" label="用户配额" rules={[{ required: true, message: '请输入用户配额' }]}>
            <InputNumber min={1} max={100000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxStorageGb" label="存储配额 (GB)" rules={[{ required: true, message: '请输入存储配额' }]}>
            <InputNumber min={1} max={1048576} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建租户"
        open={creating}
        onOk={() => void createTenant()}
        confirmLoading={creatingTenant}
        onCancel={() => setCreating(false)}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="code" label="租户编码" rules={[
            { required: true, message: '请输入租户编码' },
            { pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/, message: '仅支持字母/数字/._:-，以字母或数字开头' },
          ]}>
            <Input maxLength={64} placeholder="如 zhongshan" />
          </Form.Item>
          <Form.Item name="name" label="租户名称" rules={[{ required: true, message: '请输入租户名称' }]}>
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item name="license" label="许可证类型">
            <Input maxLength={32} placeholder="企业版" />
          </Form.Item>
          <Form.Item name="maxUsers" label="用户配额" initialValue={100}>
            <InputNumber min={1} max={100000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxStorageGb" label="存储配额 (GB)" initialValue={256}>
            <InputNumber min={1} max={1048576} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
