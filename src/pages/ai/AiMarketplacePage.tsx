import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Card,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Empty,
  Tooltip,
  Typography,
} from "antd";
import { Cpu, Rocket, StopCircle, PackageX } from 'lucide-react'
import { t } from '../../i18n/appI18n'
import { aiMarketplaceApi, type AiModel } from '../../services/api/aiMarketplaceApi'
import { ActionButton } from '../../components/common/ActionButton'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'

const { Text } = Typography
const { confirm } = Modal

const statusColors: Record<string, string> = { running: 'green', stopped: 'orange', error: 'red' }

const statusLabel = (s: string): string =>
  s === 'running' ? t('w8.aiMarketplace.statusRunning') : s === 'stopped' ? t('w8.aiMarketplace.statusStopped') : t('w8.aiMarketplace.statusError')

/** [W8] 确定性 seed 回退: API 不可用时展示内置演示模型 */
const SEED_MODELS: AiModel[] = [
  { id: 'seed-lung-nodule', name: 'Lung Nodule Detection', version: '2.3.1', modality: 'CT', description: '肺结节检出与分类 (Lung-RADS)', status: 'running', deployedAt: '2026-07-02', accuracy: 0.947 },
  { id: 'seed-fracture', name: 'Fracture Assist', version: '1.8.0', modality: 'DX', description: '四肢骨折辅助检出', status: 'running', deployedAt: '2026-06-18', accuracy: 0.921 },
  { id: 'seed-cardiac', name: 'Cardiac CTA', version: '3.0.2', modality: 'CT', description: '冠脉狭窄自动测量 (CAD-RADS)', status: 'stopped', deployedAt: '2026-05-30', accuracy: 0.903 },
  { id: 'seed-denoise', name: 'Deep Denoise', version: '1.4.0', modality: 'CT', description: '低剂量图像降噪增强', status: 'error', deployedAt: '2026-04-11', accuracy: 0.885 },
]

const AiMarketplacePage: React.FC = () => {
  const [models, setModels] = useState<AiModel[]>([])
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<'api' | 'seed'>('api')
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deployOpen, setDeployOpen] = useState(false)
  const [form] = Form.useForm()

  const fetchModels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await aiMarketplaceApi.listModels()
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setModels(res.data)
        setDataSource('api')
      } else {
        setModels(SEED_MODELS)
        setDataSource('seed')
        message.info(t('w8.aiMarketplace.seedFallback'))
      }
    } catch (err) {
      console.error('[AiMarketplace] fetchModels failed:', err)
      setModels(SEED_MODELS)
      setDataSource('seed')
      message.warning(t('w8.aiMarketplace.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  const handleDeploy = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      const res = await aiMarketplaceApi.deployModel({
        name: values.name,
        version: values.version,
        modality: values.modality,
        description: values.description,
      })
      if (res.success) {
        setModels(prev => [res.data, ...prev])
        setDeployOpen(false)
        form.resetFields()
        message.success(t('w8.aiMarketplace.deployedMsg'))
      } else {
        message.error(res.error?.message || t('w8.aiMarketplace.deployFailed'))
      }
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(t('w8.aiMarketplace.deployFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = (id: string) => {
    confirm({
      title: t('w8.aiMarketplace.confirmUnload'),
      onOk: async () => {
        try {
          const res = await aiMarketplaceApi.removeModel(id)
          if (res.success) {
            setModels(prev => prev.filter(m => m.id !== id))
            message.success(t('w8.aiMarketplace.removedMsg'))
          } else {
            message.error(res.error?.message || t('w8.aiMarketplace.removeFailed'))
          }
        } catch (err) {
          console.error('[AiMarketplace] removeModel failed:', err)
          message.error(t('w8.aiMarketplace.removeFailed'))
        }
      }
    })
  }

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return models.filter(m => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false
      if (!kw) return true
      return m.name.toLowerCase().includes(kw) || (m.description || '').toLowerCase().includes(kw)
    })
  }, [models, keyword, statusFilter])

  const running = models.filter(m => m.status === 'running').length
  const errorCount = models.filter(m => m.status === 'error').length
  const accModels = models.filter(m => m.accuracy)
  const avgAcc = accModels.length > 0 ? (accModels.reduce((s, m) => s + (m.accuracy || 0), 0) / accModels.length) * 100 : 0

  const columns = [
    { title: t('w8.aiMarketplace.colName'), dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
    { title: t('w8.aiMarketplace.colVersion'), dataIndex: 'version', key: 'version', width: 90 },
    { title: t('w8.aiMarketplace.colModality'), dataIndex: 'modality', key: 'modality', width: 90, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: t('w8.aiMarketplace.colDescription'), dataIndex: 'description', key: 'description', ellipsis: true },
    { title: t('w8.aiMarketplace.colAccuracy'), dataIndex: 'accuracy', key: 'accuracy', width: 100, render: (v: number) => v ? `${(v * 100).toFixed(0)}%` : '-' },
    { title: t('w8.aiMarketplace.colStatus'), dataIndex: 'status', key: 'status', width: 100, render: (s: string) => <Tag color={statusColors[s]}>{statusLabel(s)}</Tag> },
    { title: t('w8.aiMarketplace.colDeployedAt'), dataIndex: 'deployedAt', key: 'deployedAt', width: 110 },
    { title: t('w8.aiMarketplace.colActions'), key: 'action', width: 90, render: (_: unknown, r: AiModel) => (
      <Tooltip title={t('w8.aiMarketplace.unload')}>
        <ActionButton action="delete" size="compact" icon={<StopCircle size={14} />} onClick={() => handleRemove(r.id)}>{t('w8.aiMarketplace.unload')}</ActionButton>
      </Tooltip>
    ) },
  ]

  return (
    <div style={{ padding: 'var(--space-6, 24px)', background: 'var(--bg-primary)',}}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }} align="center">
        <Cpu size={22} color="var(--color-primary-600)" />
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{t('w8.aiMarketplace.title')}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('w8.aiMarketplace.subtitle')}</Text>
        </div>
        <Tag color={dataSource === 'api' ? 'green' : 'orange'}>{dataSource === 'api' ? 'API' : 'Seed'}</Tag>
      </Space>

      <StatCardGrid style={{ marginBottom: 'var(--space-4, 16px)' }} minWidth={220}>
        <StatCard title={t('w8.aiMarketplace.kpiTotal')} value={models.length} icon={<Cpu size={18} />} color="primary" />
        <StatCard title={t('w8.aiMarketplace.kpiRunning')} value={running} icon={<Rocket size={18} />} color="success" sub={dataSource === 'seed' ? t('w8.aiMarketplace.seedFallback') : undefined} />
        <StatCard title={t('w8.aiMarketplace.kpiAvgAccuracy')} value={avgAcc.toFixed(1)} suffix="%" icon={<StopCircle size={18} />} color="warning" />
        <StatCard title={t('w8.aiMarketplace.kpiError')} value={errorCount} icon={<PackageX size={18} />} color="error" />
      </StatCardGrid>

      <Card
        extra={
          <Space>
            <ActionButton action="refresh" loading={loading} onClick={fetchModels}>{t('w8.aiMarketplace.refresh')}</ActionButton>
            <ActionButton action="create" onClick={() => setDeployOpen(true)}>{t('w8.aiMarketplace.deploy')}</ActionButton>
          </Space>
        }
        loading={loading}
      >
        <Space style={{ marginBottom: 'var(--space-3, 12px)' }} wrap>
          <Input.Search
            allowClear
            placeholder={t('w8.aiMarketplace.searchPlaceholder')}
            style={{ width: 260 }}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: t('w8.aiMarketplace.statusAll') },
              { value: 'running', label: t('w8.aiMarketplace.statusRunning') },
              { value: 'stopped', label: t('w8.aiMarketplace.statusStopped') },
              { value: 'error', label: t('w8.aiMarketplace.statusError') },
            ]}
          />
        </Space>
        <DataTable
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 6, showSizeChanger: false, showTotal: (total) => `${t('w8.aiMarketplace.kpiTotal')}: ${total}` }}
          locale={{ emptyText: <Empty description={t('w8.aiMarketplace.empty')} /> }}
        />
      </Card>

      <Modal title={t('w8.aiMarketplace.deployTitle')} open={deployOpen} onOk={handleDeploy} onCancel={() => setDeployOpen(false)} confirmLoading={loading}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('w8.aiMarketplace.formName')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="version" label={t('w8.aiMarketplace.formVersion')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="modality" label={t('w8.aiMarketplace.formModality')} rules={[{ required: true }]}>
            <Select options={[{ value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'DX', label: 'DX' }, { value: 'MG', label: 'MG' }, { value: 'US', label: 'US' }]} />
          </Form.Item>
          <Form.Item name="description" label={t('w8.aiMarketplace.formDescription')}><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AiMarketplacePage

import { DataTable } from "../../components/common";