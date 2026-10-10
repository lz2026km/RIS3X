// [G005 W7-Exec] MWL 管理页: Modality Worklist 查询 / 工作列表项 / MPPS 状态联动
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HTMLAttributes } from 'react'
import { Button, Empty, Input, Select, Spin, Tag, message } from 'antd'
import { Activity, ClipboardList, RefreshCw, RadioTower, Search } from 'lucide-react'
import { PageContainer } from '../../components/common/PageContainer'
import { PageHeader } from '../../components/common/PageHeader'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { DataTable } from '../../components/common'
import { t } from '../../i18n/appI18n'
import { mwlApi, type MwlItemState, type MwlWorklistItemDto } from '../../services/api/execApi'

const STATE_COLOR: Record<string, string> = {
  SCHEDULED: 'blue',
  ARRIVED: 'purple',
  IN_PROGRESS: 'magenta',
  COMPLETED: 'green',
  DISCONTINUED: 'default',
}

const stateLabel = (state?: MwlItemState | string): string => {
  switch (state) {
    case 'SCHEDULED': return t('w7exec.stateScheduled')
    case 'ARRIVED': return t('w7exec.stateArrived')
    case 'IN_PROGRESS': return t('w7exec.stateInProgress')
    case 'COMPLETED': return t('w7exec.stateCompleted')
    case 'DISCONTINUED': return t('w7exec.stateDiscontinued')
    default: return state ?? '--'
  }
}

export default function MwlManagerPage() {
  const [items, setItems] = useState<MwlWorklistItemDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filters, setFilters] = useState<{ stationAE: string; modality: string; date: string; patientName: string }>({
    stationAE: '',
    modality: '',
    date: '',
    patientName: '',
  })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filters.stationAE) params.stationAE = filters.stationAE
      if (filters.modality) params.modality = filters.modality
      if (filters.date) params.date = filters.date
      if (filters.patientName) params.patientName = filters.patientName
      const res = await mwlApi.worklistItems(Object.keys(params).length > 0 ? params : undefined)
      if (!res.success) {
        setError(res.error?.message ?? t('w7exec.loadFailed'))
        setItems([])
        return
      }
      const data = res.data as unknown
      const list: MwlWorklistItemDto[] = Array.isArray(data) ? (data as MwlWorklistItemDto[]) : (data as { items?: MwlWorklistItemDto[] })?.items ?? []
      setItems(list)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('w7exec.loadFailed'))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { void fetchItems() }, [fetchItems])

  const stats = useMemo(() => {
    const by = (s: string) => items.filter((i) => (i.mppsStatus ?? i.state) === s).length
    return {
      total: items.length,
      scheduled: by('SCHEDULED'),
      inProgress: by('IN_PROGRESS'),
      completed: by('COMPLETED'),
    }
  }, [items])

  const updateMpps = async (item: MwlWorklistItemDto, status: 'IN_PROGRESS' | 'COMPLETED') => {
    setBusyId(item.id)
    try {
      const res = await mwlApi.sendMpps({
        studyUid: item.studyInstanceUid,
        status,
        accessionNumber: item.accessionNumber,
        requestedProcedureId: item.requestedProcedureId,
        examId: item.examId,
      })
      if (res.success) {
        message.success(`${t('w7exec.mppsStatus')}: ${stateLabel(status)}`)
        await fetchItems()
      } else {
        message.error(res.error?.message ?? t('w7exec.loadFailed'))
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('w7exec.loadFailed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageContainer background="slate" maxWidth="full" testId="mwl-manager-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <PageHeader
          variant="flex"
          icon={<RadioTower size={22} />}
          title={t('w7exec.mwlManagerTitle')}
          subtitle={<span style={{ color: 'var(--text-secondary)' }}>{t('w7exec.mwlManagerSubtitle')}</span>}
        />
        <Button icon={<RefreshCw size={13} />} loading={loading} onClick={() => void fetchItems()}>
          {t('w7exec.refresh')}
        </Button>
      </div>

      <StatCardGrid minWidth={200} gap={14} style={{ marginBottom: 16 }} testId="mwl-stats">
        <StatCard title={t('w7exec.total')} value={stats.total} icon={<ClipboardList size={18} />} color="info" />
        <StatCard title={t('w7exec.stateScheduled')} value={stats.scheduled} icon={<Activity size={18} />} color="warning" />
        <StatCard title={t('w7exec.stateInProgress')} value={stats.inProgress} icon={<Activity size={18} />} color="warning" />
        <StatCard title={t('w7exec.stateCompleted')} value={stats.completed} icon={<Activity size={18} />} color="success" />
      </StatCardGrid>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select
            size="small" style={{ width: 160 }} placeholder={t('w7exec.queryStation')} allowClear
            value={filters.stationAE || undefined}
            onChange={(v) => setFilters((f) => ({ ...f, stationAE: v ?? '' }))}
            options={['CT_SCANNER_01', 'MR_SCANNER_02', 'DR_ROOM_01', 'US_UNIT_01', 'MG_UNIT_01'].map((s) => ({ value: s, label: s }))}
          />
          <Select
            size="small" style={{ width: 110 }} placeholder={t('w7exec.queryModality')} allowClear
            value={filters.modality || undefined}
            onChange={(v) => setFilters((f) => ({ ...f, modality: v ?? '' }))}
            options={['CT', 'MR', 'DR', 'US', 'MG'].map((m) => ({ value: m, label: m }))}
          />
          <Input size="small" style={{ width: 150 }} type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} />
          <Input size="small" style={{ width: 150 }} placeholder={t('w7exec.queryPatient')} value={filters.patientName} onChange={(e) => setFilters((f) => ({ ...f, patientName: e.target.value }))} />
          <Button size="small" type="primary" icon={<Search size={12} />} loading={loading} onClick={() => void fetchItems()}>
            {t('w7exec.query')}
          </Button>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><Spin tip={t('w7exec.loading')} /></div>
        ) : error ? (
          <Empty description={`${error}`} style={{ padding: 40 }} />
        ) : items.length === 0 ? (
          <Empty description={t('w7exec.empty')} style={{ padding: 40 }} />
        ) : (
          <DataTable
            rowKey="id"
            dataSource={items}
            data-testid="mwl-table"
            onRow={() => ({ 'data-testid': 'mwl-row' }) as HTMLAttributes<HTMLElement>}
            columns={[
              { title: t('w7exec.accession'), dataIndex: 'accessionNumber', key: 'accessionNumber', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
              { title: t('w7exec.patient'), dataIndex: 'patientName', key: 'patientName', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
              { title: t('w7exec.queryModality'), dataIndex: 'modality', key: 'modality', render: (v: string) => <Tag color="geekblue">{v}</Tag> },
              { title: t('w7exec.requestedProcedure'), dataIndex: 'requestedProcedureDescription', key: 'requestedProcedureDescription' },
              { title: t('w7exec.station'), dataIndex: 'scheduledStationAeTitle', key: 'scheduledStationAeTitle', render: (v: string) => <span style={{ color: 'var(--text-secondary)' }}>{v || '--'}</span> },
              { title: t('w7exec.scheduledAt'), key: 'scheduledAt', render: (_v, item) => <span style={{ color: 'var(--text-secondary)' }}>{item.scheduledDate} {item.scheduledTime}</span> },
              {
                title: t('w7exec.contrast'),
                dataIndex: 'contrast',
                key: 'contrast',
                render: (v: boolean) => <Tag color={v ? 'volcano' : 'default'}>{v ? t('w7exec.contrastYes') : t('w7exec.contrastNo')}</Tag>,
              },
              {
                title: t('w7exec.state'),
                key: 'state',
                render: (_v, item) => {
                  const effective = item.mppsStatus ?? item.state
                  return <Tag color={STATE_COLOR[effective] ?? 'default'}>{stateLabel(effective)}</Tag>
                },
              },
              {
                title: t('w7exec.mppsStatus'),
                key: 'mppsStatus',
                render: (_v, item) => item.mppsStatus ? <Tag color={STATE_COLOR[item.mppsStatus]}>{stateLabel(item.mppsStatus)}</Tag> : '--',
              },
              {
                title: t('w7exec.query'),
                key: 'actions',
                render: (_v, item) => {
                  const effective = item.mppsStatus ?? item.state
                  return (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="small" disabled={busyId === item.id || effective === 'IN_PROGRESS' || effective === 'COMPLETED'} onClick={() => void updateMpps(item, 'IN_PROGRESS')}>
                        {t('w7exec.stateInProgress')}
                      </Button>
                      <Button size="small" type="primary" disabled={busyId === item.id || effective === 'COMPLETED'} onClick={() => void updateMpps(item, 'COMPLETED')}>
                        {t('w7exec.stateCompleted')}
                      </Button>
                    </div>
                  )
                },
              },
            ]}
          />
        )}
      </div>
    </PageContainer>
  )
}
