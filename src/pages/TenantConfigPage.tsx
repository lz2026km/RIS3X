import { useAuth } from '../hooks/useAuth'
import { tenantApi, type TenantProfile, type TenantUsage, type TenantFeatures } from '../services/api/tenantApi'
import {
  Card,
  Tag,
  Statistic,
  Row,
  Col,
  Button,
  Spin,
  Alert,
  Tabs,
  Descriptions,
  Space,
  Badge,
  Progress,
  Switch,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Popconfirm,
  List,
  Typography,
} from "antd";
import { useState, useEffect, useCallback } from 'react'
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../components/common"
import { RefreshCw, ShieldCheck, Settings, Users, LayoutDashboard, Zap, Plus, Power, PlayCircle, ClipboardList } from 'lucide-react'
import { usePagination } from '../hooks/usePagination'
import { t } from '../i18n/appI18n'

const { Title } = Typography

// [G005 v3.0.6.11-91 W1-B P1 第12轮] 合规报告: 后端 /compliance/report (overallScore/categories/items)
// 与 MSW 兜底 (summary/details) 两种 shape 归一化
interface ComplianceReportData {
  overallScore?: number
  overallCompliance?: number
  lastAssessedAt?: string
  generatedAt?: string
  summary?: { totalAudits: number; passed: number; failed: number; complianceRate: number }
  categories?: Array<{ category: string; name: string; itemCount: number; implementedCount: number; averageScore: number }>
  items?: Array<{ id: string; category: string; name: string; required: boolean; implemented: boolean; score: number }>
  details?: Array<{ id: string; module: string; checkItem: string; status: string; severity: string; description: string; checkedAt: string }>
}

const FEATURE_DEFS: Array<{ key: keyof TenantFeatures }> = [
  { key: 'aiOrchestration' },
  { key: 'biDashboard' },
  { key: 'doseManagement' },
  { key: 'vna' },
  { key: 'similarCases' },
  { key: 'environmentReport' },
  { key: 'mobileApp' },
  { key: 'teleRadiology' },
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
  // [G005 v3.0.6.11-91 W1-B P1 第12轮] 合规报告 Modal
  const [complianceOpen, setComplianceOpen] = useState(false)
  const [complianceLoading, setComplianceLoading] = useState(false)
  const [complianceError, setComplianceError] = useState('')
  const [complianceReport, setComplianceReport] = useState<ComplianceReportData | null>(null)

  const loadCompliance = async () => {
    setComplianceOpen(true)
    setComplianceLoading(true)
    setComplianceError('')
    setComplianceReport(null)
    try {
      const res = await tenantApi.getComplianceReport()
      if (res.success && res.data) {
        setComplianceReport(res.data as unknown as ComplianceReportData)
      } else {
        setComplianceError(res.error?.message ?? t('tenantConfig.complianceLoadFailed'))
      }
    } catch (e) {
      setComplianceError((e as Error)?.message ?? t('tenantConfig.complianceLoadFailed'))
    } finally {
      setComplianceLoading(false)
    }
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tRes, u, f, l] = await Promise.all([
        tenantApi.getCurrent(),
        tenantApi.getUsage(),
        tenantApi.getFeatures(),
        isAdmin ? tenantApi.listTenants() : Promise.resolve({ success: true, data: [] as TenantProfile[] }),
      ])
      if (tRes.success) setTenant(tRes.data)
      if (u.success) setUsage(u.data)
      if (f.success) setFeatures(f.data)
      if (l.success) setTenants(l.data)
      if (!tRes.success || !u.success || !f.success) {
        setError((tRes.error ?? u.error ?? f.error)?.message ?? t('tenantConfig.dataLoadFailed'))
      }
    } catch (e) {
      setError((e as Error)?.message ?? t('tenantConfig.dataLoadFailed'))
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
      message.success(t('tenantConfig.profileUpdated'))
      setTenant(res.data)
      setEditing(false)
    } else {
      message.error(res.error?.message ?? t('tenantConfig.saveFailed'))
    }
  }

  const toggleFeature = async (key: keyof TenantFeatures, checked: boolean) => {
    setFeatureBusy(key)
    const res = await tenantApi.updateFeatures({ [key]: checked })
    setFeatureBusy(null)
    if (res.success) {
      setFeatures(res.data)
      message.success(`${t(`tenantConfig.feat.${key}.label`)} ${checked ? t('tenantConfig.enabled') : t('tenantConfig.disabled')}`)
    } else {
      message.error(res.error?.message ?? t('tenantConfig.updateFailed'))
    }
  }

  const createTenant = async () => {
    const values = await createForm.validateFields()
    setCreatingTenant(true)
    const res = await tenantApi.createTenant(values)
    setCreatingTenant(false)
    if (res.success) {
      message.success(t('tenantConfig.tenantCreated'))
      setCreating(false)
      createForm.resetFields()
      const list = await tenantApi.listTenants()
      if (list.success) setTenants(list.data)
    } else {
      message.error(res.error?.message ?? t('tenantConfig.createFailed'))
    }
  }

  const toggleTenantStatus = async (record: TenantProfile) => {
    const next = record.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    setStatusBusy(record.id)
    const res = await tenantApi.updateTenantStatus(record.id, next)
    setStatusBusy(null)
    if (res.success) {
      message.success(`${record.name} ${next === 'ACTIVE' ? t('tenantConfig.enabled') : t('tenantConfig.disabled')}`)
      setTenants((prev) => prev.map((tn) => (tn.id === record.id ? res.data : tn)))
    } else {
      message.error(res.error?.message ?? t('tenantConfig.operationFailed'))
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
    { title: t('tenantConfig.colTenant'), dataIndex: 'name', key: 'name', render: (_: string, r: TenantProfile) => (
      <Space direction="vertical" size={0}>
        <span><strong>{r.name}</strong> <Tag color={r.status === 'ACTIVE' ? 'success' : 'default'}>{r.status === 'ACTIVE' ? t('tenantConfig.enabled') : t('tenantConfig.disabled')}</Tag></span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.code} · {r.id}</span>
      </Space>
    ) },
    { title: t('tenantConfig.colLicense'), dataIndex: 'license', key: 'license' },
    { title: t('tenantConfig.colUserQuota'), key: 'users', render: (_: string, r: TenantProfile) => `${r.maxUsers} ${t('tenantConfig.peopleUnit')}` },
    { title: t('tenantConfig.colStorageQuota'), key: 'storage', render: (_: string, r: TenantProfile) => `${r.maxStorageGb} GB` },
    { title: t('tenantConfig.colCreatedAt'), dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => v.slice(0, 10) },
    {
      title: t('tenantConfig.colActions'), key: 'action',
      render: (_: string, r: TenantProfile) => r.status === 'ACTIVE' ? (
        <Popconfirm title={`${r.name} ?`} onConfirm={() => void toggleTenantStatus(r)}>
          <Button size="small" danger icon={<Power />} loading={statusBusy === r.id}>{t('tenantConfig.disabled')}</Button>
        </Popconfirm>
      ) : (
        <Button size="small" type="primary" icon={<PlayCircle />} loading={statusBusy === r.id} onClick={() => void toggleTenantStatus(r)}>{t('tenantConfig.enabled')}</Button>
      ),
    },
  ]

  return (
    <PageContainer padding={24}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row justify="space-between" align="middle">
          <Title level={4} style={{ margin: 0 }}><ShieldCheck /> {t('tenantConfig.pageTitle')}</Title>
          <Space>
            <Button icon={<ClipboardList />} loading={complianceLoading} onClick={() => void loadCompliance()}>{t('tenantConfig.complianceReport')}</Button>
            <Button icon={<RefreshCw />} onClick={() => void fetchAll()} loading={loading}>{t('tenantConfig.refresh')}</Button>
          </Space>
        </Row>

        {error && <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => void fetchAll()}><RefreshCw size={14} /> {t('tenantConfig.retry')}</Button>} />}

        {loading && !tenant ? <Spin tip={t('tenantConfig.loadingTenant')} style={{ display: 'block', margin: '48px auto' }} /> : (
          <Tabs items={[
            {
              key: 'overview',
              label: <span><Settings /> {t('tenantConfig.tabOverview')}</span>,
              children: (
                <Row gutter={16}>
                  <Col span={14}>
                    <Card
                      title={t('tenantConfig.currentTenant')}
                      size="small"
                      extra={<Button size="small" icon={<Settings />} onClick={openEdit}>{t('tenantConfig.edit')}</Button>}
                    >
                      {tenant ? (
                        <Descriptions column={2} size="small" bordered>
                          <Descriptions.Item label={t('tenantConfig.labelTenantId')}>{tenant.id}</Descriptions.Item>
                          <Descriptions.Item label={t('tenantConfig.labelCode')}>{tenant.code}</Descriptions.Item>
                          <Descriptions.Item label={t('tenantConfig.labelName')}>{tenant.name}</Descriptions.Item>
                          <Descriptions.Item label={t('tenantConfig.labelStatus')}>
                            <Badge status={tenant.status === 'ACTIVE' ? 'success' : 'error'} text={tenant.status === 'ACTIVE' ? t('tenantConfig.enabled') : t('tenantConfig.disabled')} />
                          </Descriptions.Item>
                          <Descriptions.Item label={t('tenantConfig.labelLicense')}>{tenant.license}</Descriptions.Item>
                          <Descriptions.Item label={t('tenantConfig.labelCreatedAt')}>{tenant.createdAt.slice(0, 10)}</Descriptions.Item>
                          <Descriptions.Item label={t('tenantConfig.labelUserQuota')}>{tenant.maxUsers} {t('tenantConfig.peopleUnit')}</Descriptions.Item>
                          <Descriptions.Item label={t('tenantConfig.labelStorageQuota')}>{tenant.maxStorageGb} GB</Descriptions.Item>
                          <Descriptions.Item label={t('tenantConfig.labelExamQuota')}>{tenant.maxExams} {t('tenantConfig.casesUnit')}</Descriptions.Item>
                        </Descriptions>
                      ) : <Spin />}
                    </Card>
                  </Col>
                  <Col span={10}>
                    <Card title={t('tenantConfig.usageOverview')} size="small">
                      {usage ? (
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('tenantConfig.storageUsage')}</span><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatBytes(usage.storageBytes)} / {formatBytes(usage.storageLimitBytes)}</span></div>
                            <Progress percent={storagePct} size="small" status={storagePct > 90 ? 'exception' : 'normal'} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('tenantConfig.userLabel')}</span><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{usage.users} / {usage.userLimit}</span></div>
                            <Progress percent={userPct} size="small" />
                          </div>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t('tenantConfig.examVolume')}</span><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{usage.exams.toLocaleString()} / {usage.examLimit.toLocaleString()}</span></div>
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
              label: <span><LayoutDashboard /> {t('tenantConfig.tabUsage')}</span>,
              children: usage ? (
                <StatCardGrid minWidth={200} gap={16}>
                  <StatCard title={t('tenantConfig.statUsers')} value={usage.users} />
                  <StatCard title={t('tenantConfig.statPatients')} value={usage.patients} />
                  <StatCard title={t('tenantConfig.statExams')} value={usage.exams} />
                  <StatCard title={t('tenantConfig.statReports')} value={usage.reports} />
                  <StatCard title={t('tenantConfig.statStorageUsage')} value={formatBytes(usage.storageBytes)} />
                  <StatCard title={t('tenantConfig.statStorageQuota')} value={formatBytes(usage.storageLimitBytes)} />
                  <StatCard title={t('tenantConfig.statExamQuota')} value={usage.examLimit} suffix={`${t('tenantConfig.usedSuffix')} ${Math.round((usage.exams / Math.max(1, usage.examLimit)) * 100)}%`} />
                </StatCardGrid>
              ) : <Spin />,
            },
            {
              key: 'features',
              label: <span><Zap /> {t('tenantConfig.tabFeatures')} ({features ? Object.values(features).filter(Boolean).length : 0}/{FEATURE_DEFS.length})</span>,
              children: (
                <Row gutter={[16, 16]}>
                  {FEATURE_DEFS.map((f) => (
                    <Col span={6} key={f.key}>
                      <Card size="small">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div><strong>{t(`tenantConfig.feat.${f.key}.label`)}</strong></div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{t(`tenantConfig.feat.${f.key}.desc`)}</div>
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
              label: <span><Users /> {t('tenantConfig.tabTenants')}</span>,
              children: (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Button type="primary" icon={<Plus />} onClick={() => setCreating(true)}>{t('tenantConfig.newTenant')}</Button>
                  <DataTable rowKey="id" columns={columns} dataSource={pagedTenants} pagination={tenantsPagination} scroll={{ x: 'max-content' }}/>
                </Space>
              ),
            }] : []),
          ]} />
        )}
      </Space>

      <Modal
        title={t('tenantConfig.editTenant')}
        open={editing}
        onOk={() => void saveProfile()}
        confirmLoading={saving}
        onCancel={() => setEditing(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={tenant ?? {}}>
          <Form.Item name="name" label={t('tenantConfig.tenantName')} rules={[{ required: true, message: t('tenantConfig.tenantNameRequired') }]}>
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item name="license" label={t('tenantConfig.licenseType')} rules={[{ required: true, message: t('tenantConfig.licenseRequired') }]}>
            <Input maxLength={32} />
          </Form.Item>
          <Form.Item name="maxUsers" label={t('tenantConfig.colUserQuota')} rules={[{ required: true, message: t('tenantConfig.userQuotaRequired') }]}>
            <InputNumber min={1} max={100000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxStorageGb" label={t('tenantConfig.storageQuotaGb')} rules={[{ required: true, message: t('tenantConfig.storageRequired') }]}>
            <InputNumber min={1} max={1048576} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('tenantConfig.createTenant')}
        open={creating}
        onOk={() => void createTenant()}
        confirmLoading={creatingTenant}
        onCancel={() => setCreating(false)}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="code" label={t('tenantConfig.tenantCode')} rules={[
            { required: true, message: t('tenantConfig.tenantCodeRequired') },
            { pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/, message: t('tenantConfig.tenantCodePattern') },
          ]}>
            <Input maxLength={64} placeholder={t('tenantConfig.tenantCodePlaceholder')} />
          </Form.Item>
          <Form.Item name="name" label={t('tenantConfig.tenantName')} rules={[{ required: true, message: t('tenantConfig.tenantNameRequired') }]}>
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item name="license" label={t('tenantConfig.licenseType')}>
            <Input maxLength={32} placeholder={t('tenantConfig.enterprise')} />
          </Form.Item>
          <Form.Item name="maxUsers" label={t('tenantConfig.colUserQuota')} initialValue={100}>
            <InputNumber min={1} max={100000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxStorageGb" label={t('tenantConfig.storageQuotaGb')} initialValue={256}>
            <InputNumber min={1} max={1048576} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('tenantConfig.complianceReportTitle')}
        open={complianceOpen}
        onCancel={() => setComplianceOpen(false)}
        footer={null}
        width={720}
      >
        <Spin spinning={complianceLoading}>
          {complianceError && (
            <Alert type="error" showIcon style={{ marginBottom: 12 }} message={t('tenantConfig.loadFailed')} description={complianceError} />
          )}
          {complianceReport && (() => {
            const score = complianceReport.summary?.complianceRate ?? complianceReport.overallCompliance ?? complianceReport.overallScore ?? 0
            const generatedAt = complianceReport.generatedAt ?? complianceReport.lastAssessedAt ?? '-'
            const checks = complianceReport.details
              ? complianceReport.details.map((d) => ({ name: d.checkItem, module: d.module, passed: d.status !== 'FAIL', note: d.description }))
              : (complianceReport.items ?? []).map((i) => ({ name: i.name, module: i.category, passed: i.implemented, note: `${t('tenantConfig.scoreLabel')} ${i.score}` }))
            const passedCount = checks.filter((c) => c.passed).length
            return (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Row gutter={16}>
                  <Col span={8}>
                    <Card size="small">
                      <Statistic title={t('tenantConfig.statComplianceScore')} value={score} suffix="%" valueStyle={{ color: score >= 80 ? 'var(--color-success-600)' : score >= 60 ? 'var(--color-warning-600)' : 'var(--color-error-600)' }} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small">
                      <Statistic title={t('tenantConfig.statPassed')} value={`${passedCount}/${checks.length}`} valueStyle={{ color: 'var(--color-primary-600)' }} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small">
                      <Statistic title={t('tenantConfig.statGeneratedAt')} value={generatedAt.slice(0, 10)} />
                    </Card>
                  </Col>
                </Row>
                <Progress percent={Math.round(score)} status={score >= 80 ? 'success' : score >= 60 ? 'normal' : 'exception'} />
                <Alert
                  type={score >= 80 ? 'success' : 'warning'}
                  showIcon
                  message={score >= 80 ? t('tenantConfig.overallCompliant') : t('tenantConfig.nonCompliant')}
                  description={t('tenantConfig.assessmentSummary', { total: checks.length, passed: passedCount, generatedAt })}
                />
                <List
                  size="small"
                  bordered
                  dataSource={checks}
                  renderItem={(c) => (
                    <List.Item>
                      <Space>
                        <Badge status={c.passed ? 'success' : 'error'} />
                        <span style={{ fontWeight: 500 }}>{c.name}</span>
                        <Tag>{c.module}</Tag>
                        {c.note && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.note}</span>}
                      </Space>
                    </List.Item>
                  )}
                />
              </Space>
            )
          })()}
        </Spin>
      </Modal>
    </PageContainer>
  )
}
