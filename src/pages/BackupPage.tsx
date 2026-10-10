import { useState, useEffect } from 'react'
import { backupApi, type BackupDto } from '../services/api/systemApi'
import { Card, Tag, Button, Space, message, Modal, Select, Row, Tabs, Descriptions, Tooltip } from 'antd'
import { CloudUpload, Download, Undo2, ShieldCheck, Clock, RefreshCw, Database } from 'lucide-react'
import { usePagination } from '../hooks/usePagination'
import { StatCard, StatCardGrid, PageContainer } from '../components/common'
import { PageHeader } from '../components/common/PageHeader'
import { DataTable } from '../components/common/DataTable'
import { ActionButton } from '../components/common/ActionButton'
import { ErrorBanner } from '../components/feedback'
import { t } from '../i18n/appI18n'

const BACKUP_TYPE_LABEL: Record<string, string> = { FULL: t('bk.type.full'), INCREMENTAL: t('bk.type.incremental') }
const BACKUP_STATUS_LABEL: Record<string, string> = { COMPLETED: t('bk.status.completed'), RUNNING: t('bk.status.running'), FAILED: t('bk.status.failed'), PENDING: t('bk.status.pending') }

export default function BackupPage() {
  const [list, setList] = useState<BackupDto[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [autoBackup, _setAutoBackup] = useState(true)
  const [schedule, _setSchedule] = useState('0 2 * * *')
  const [backupType, setBackupType] = useState<string | undefined>(undefined)
  const { pageData, pagination } = usePagination(list, 10)

  const fetchList = async () => {
    setLoading(true)
    try {
      const res = await backupApi.list()
      if (res.success) {
        setList(res.data)
        setLoadError(null)
      } else {
        setLoadError(t('w9.states.error'))
      }
    } catch {
      setLoadError(t('w9.states.error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList() }, [])

  const handleCreate = async (type: string) => {
    setCreating(true)
    const res = await backupApi.create(type)
    if (res.success) {
      message.success(t('bk.createSuccess'))
      fetchList()
    }
    setCreating(false)
  }

  const handleRestore = (id: string) => {
    Modal.confirm({
      title: t('bk.restoreTitle'),
      content: t('bk.restoreConfirm'),
      onOk: async () => {
        const res = await backupApi.restore(id)
        if (res.success) message.success(t('bk.restoreSuccess'))
      },
    })
  }

  const columns = [
    { title: t('bk.colCreatedAt'), dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: t('bk.colType'), dataIndex: 'type', key: 'type', width: 100, render: (v: string) => <Tag color={v === 'FULL' ? 'blue' : 'green'}>{BACKUP_TYPE_LABEL[v] ?? v}</Tag> },
    { title: t('bk.colStatus'), dataIndex: 'status', key: 'status', width: 120, render: (v: string) => {
      const colorMap: Record<string, string> = { COMPLETED: 'success', RUNNING: 'processing', FAILED: 'error', PENDING: 'warning' }
      return <Tag color={colorMap[v] ?? 'default'} icon={v === 'RUNNING' ? <RefreshCw size={12} className="spin" /> : undefined}>{BACKUP_STATUS_LABEL[v] ?? v}</Tag>
    }},
    { title: t('bk.colSize'), dataIndex: 'sizeBytes', key: 'sizeBytes', width: 100, render: (v: number) => v ? `${(v / 1024 / 1024).toFixed(2)} MB` : '-' },
    { title: t('bk.colCreatedBy'), dataIndex: 'createdBy', key: 'createdBy', width: 120 },
    {
      title: t('bk.colActions'), key: 'actions', width: 160,
      render: (_: unknown, r: BackupDto) => (
        <Space>
          <Tooltip title={t('bk.downloadTip')}><Button size="small" icon={<Download />} onClick={() => backupApi.download(r.id)}>{t('bk.download')}</Button></Tooltip>
          <Tooltip title={t('bk.restoreTip')}><Button size="small" icon={<Undo2 />} onClick={() => handleRestore(r.id)}>{t('bk.restore')}</Button></Tooltip>
        </Space>
      ),
    },
  ]

  const completedBackups = list.filter((b) => b.status === 'COMPLETED')
  const totalSize = completedBackups.reduce((acc, b) => acc + (b.sizeBytes ?? 0), 0)

  return (
    <PageContainer padding={24}>
      <Card>
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <PageHeader variant="flex" icon={<ShieldCheck />} title={t('bk.title')} style={{ marginBottom: 0 }} />
            <Space>
              <Select
                placeholder={t('bk.backupType')}
                style={{ width: 140 }}
                value={backupType}
                onChange={(v: string) => setBackupType(v)}
                options={[
                  { value: 'FULL', label: t('bk.fullBackup') },
                  { value: 'INCREMENTAL', label: t('bk.incrementalBackup') },
                ]}
              />
              <Button type="primary" icon={<CloudUpload />} loading={creating} disabled={!backupType} onClick={() => { if (backupType) handleCreate(backupType); }}>{t('bk.startBackup')}</Button>
              <ActionButton action="refresh" onClick={fetchList}>{t('bk.refresh')}</ActionButton>
            </Space>
          </Row>

          {loadError && !loading && <ErrorBanner message={loadError} />}

          <StatCardGrid minWidth={200} gap={16}>
            <StatCard title={t('bk.total')} value={list.length} icon={<CloudUpload />} />
            <StatCard title={t('bk.fullBackup')} value={list.filter((b) => b.type === 'FULL').length} icon={<Database />} />
            <StatCard title={t('bk.incrementalBackup')} value={list.filter((b) => b.type === 'INCREMENTAL').length} icon={<RefreshCw />} />
            <StatCard title={t('bk.totalStorage')} value={(totalSize / 1024 / 1024).toFixed(1)} suffix="MB" icon={<CloudUpload />} />
          </StatCardGrid>

          <Tabs items={[
            {
              key: 'list',
              label: <span><Clock /> {t('bk.tabRecords')}</span>,
              children: (
                <DataTable dataSource={pageData} columns={columns} rowKey="id" loading={loading} pagination={pagination} emptyText={t('w9.states.empty')} scroll={{ x: 'max-content' }} />
              ),
            },
            {
              key: 'schedule',
              label: <span><RefreshCw /> {t('bk.tabSchedule')}</span>,
              children: (
                <div style={{ padding: 'var(--space-3, 12px)' }}>
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label={t('bk.autoBackup')}>
                      <Tag color={autoBackup ? 'green' : 'default'}>{autoBackup ? t('bk.enabled') : t('bk.disabled')}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('bk.scheduleLabel')}>{schedule}</Descriptions.Item>
                    <Descriptions.Item label={t('bk.retentionLabel')}>{t('bk.retentionValue')}</Descriptions.Item>
                    <Descriptions.Item label={t('bk.nextRunLabel')}>{t('bk.nextRunValue')}</Descriptions.Item>
                    <Descriptions.Item label={t('bk.locationLabel')}>/data/backups/ris/</Descriptions.Item>
                    <Descriptions.Item label={t('bk.encryptionLabel')}><Tag color="success">AES-256</Tag></Descriptions.Item>
                  </Descriptions>
                </div>
              ),
            },
          ]} />
        </Space>
      </Card>
    </PageContainer>
  )
}
