// [W6] 已归档报告列表 (只读)
// 数据源: 复用后端 GET /reports?state=ARCHIVED (ReportStateEnum 含 ARCHIVED), 无独立归档列表页的历史缺口。
import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Card,
  Input,
  Space,
  Tag,
  message,
} from "antd";
import { Archive, RotateCcw, Search } from 'lucide-react'
import { reportApi, type ListPayload } from '../../services/api/reportApi'
import { ErrorBanner } from '../../components/feedback'
import type { ReportDto } from '../../types/dto'
import { t } from '../../i18n/appI18n'

function unwrap(payload: ListPayload<ReportDto> | undefined): ReportDto[] {
  if (!payload) return []
  return Array.isArray(payload) ? payload : (payload.items ?? [])
}

export default function ArchivedReportsPage() {
  const [data, setData] = useState<ReportDto[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchData = useCallback(async (kw?: string) => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await reportApi.listArchived(kw ? { keyword: kw } : undefined)
      if (res.success) {
        setData(unwrap(res.data))
      } else {
        setLoadError(t('w9.states.error'))
        message.error(res.error?.message ?? t('w6Workflow.archive.loadFailed'))
      }
    } catch (e) {
      setLoadError(t('w9.states.error'))
      message.error(e instanceof Error ? e.message : t('w6Workflow.archive.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  const columns = [
    {
      title: t('w6Workflow.archive.colReportId'),
      dataIndex: 'reportId',
      key: 'reportId',
      width: 180,
      render: (v: string, r: ReportDto) => <span style={{ fontFamily: 'monospace' }}>{v ?? r.id}</span>,
    },
    { title: t('w6Workflow.archive.colPatient'), dataIndex: 'patientName', key: 'patientName', width: 140 },
    { title: t('w6Workflow.archive.colModality'), dataIndex: 'modality', key: 'modality', width: 100, render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : '--' },
    { title: t('w6Workflow.archive.colBodyPart'), dataIndex: 'bodyPart', key: 'bodyPart', width: 140, render: (v: string) => v || '--' },
    {
      title: t('w6Workflow.archive.colState'),
      dataIndex: 'state',
      key: 'state',
      width: 120,
      render: () => <Tag color="purple">{t('w6Workflow.archive.stateArchived')}</Tag>,
    },
    {
      title: t('w6Workflow.archive.colArchivedAt'),
      dataIndex: 'updatedTime',
      key: 'updatedTime',
      width: 180,
      render: (v: string, r: ReportDto) => (v || r.reportAt || r.createdTime || '').toString().slice(0, 19).replace('T', ' ') || '--',
    },
  ]

  return (
    <div style={{ padding: 'var(--space-4, 16px)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
      <Card size="small">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2, 8px)' }}>
          <Space>
            <Archive size={20} color="#7c3aed" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{t('w6Workflow.archive.title')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('w6Workflow.archive.subtitle')}</div>
            </div>
          </Space>
          <Space>
            <Input
              allowClear
              prefix={<Search size={13} />}
              placeholder={t('w6Workflow.archive.searchPlaceholder')}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={() => void fetchData(keyword)}
              style={{ width: 260 }}
            />
            <Button size="small" type="primary" onClick={() => void fetchData(keyword)}>{t('w6Workflow.archive.query')}</Button>
            <Button size="small" icon={<RotateCcw size={13} />} onClick={() => void fetchData(keyword)}>{t('w6Workflow.archive.refresh')}</Button>
          </Space>
        </div>
      </Card>

      {loadError && <ErrorBanner message={loadError} onRetry={() => void fetchData(keyword)} retryLabel={t('w9.states.retry')} />}

      <Card size="small">
        <DataTable<ReportDto>
          rowKey={(r) => r.id ?? r.reportId}
          loading={loading}
          dataSource={data}
          columns={columns}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: t('w6Workflow.archive.empty') }}
        />
      </Card>
    </div>
  )
}

import { DataTable } from "../../components/common";