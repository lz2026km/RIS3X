import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
import { Select } from 'antd'
import {
  AlertTriangle, CheckCircle, ClipboardList, Plus, RefreshCw, Search,
} from 'lucide-react'
import {
  getAdverseEvents, getAdverseEvent, createAdverseEvent, updateAdverseEvent,
  getRcaInvestigations, createRcaInvestigation,
  type AdverseEvent, type RcaInvestigation,
  type EventSeverity, type EventStatus, type EventCategory, type RcaStatus,
} from '../../services/api/safetyApi'
import {
  PageContainer, PageHeader, StatCard, StatCardGrid, DataTable,
  StatusTag, SeverityTag, AppDrawer, AppModal, FormField, StateView, FilterBar,
} from '../../components/common'
import { t } from '../../i18n/appI18n'
import { severityToAntd, statusColor } from '../../theme/statusTokens'

const SEVERITY_TOKEN: Record<EventSeverity, string> = {
  'near-miss': 'info',
  minor: 'normal',
  moderate: 'warning',
  severe: 'critical',
  catastrophic: 'life_threatening',
}

const STATUS_TOKEN: Record<EventStatus, string> = {
  reported: 'open',
  investigating: 'warning',
  resolved: 'success',
  closed: 'closed',
}

const RCA_STATUS_TOKEN: Record<RcaStatus, string> = {
  open: 'open',
  analyzing: 'processing',
  'capa-planned': 'scheduled',
  implementing: 'in_progress',
  verified: 'verified',
  closed: 'closed',
}

const SEVERITY_LABELS: Record<EventSeverity, string> = {
  'near-miss': 'ade.severity.near_miss',
  minor: 'ade.severity.minor',
  moderate: 'ade.severity.moderate',
  severe: 'ade.severity.severe',
  catastrophic: 'ade.severity.catastrophic',
}

const CATEGORY_LABELS: Record<EventCategory, string> = {
  'medication-error': 'ade.category.medication_error',
  'patient-identification': 'ade.category.patient_identification',
  'contrast-reaction': 'ade.category.contrast_reaction',
  'radiation-overdose': 'ade.category.radiation_overdose',
  fall: 'ade.category.fall',
  'specimen-error': 'ade.category.specimen_error',
  'communication-failure': 'ade.category.communication_failure',
  'equipment-malfunction': 'ade.category.equipment_malfunction',
  'information-loss': 'ade.category.information_loss',
  other: 'ade.category.other',
}

const STATUS_LABELS: Record<EventStatus, string> = {
  reported: 'ade.status.reported',
  investigating: 'ade.status.investigating',
  resolved: 'ade.status.resolved',
  closed: 'ade.status.closed',
}

const RCA_STATUS_LABELS: Record<RcaStatus, string> = {
  open: 'ade.rcaStatusOpen',
  analyzing: 'ade.rcaStatusAnalyzing',
  'capa-planned': 'ade.rcaStatusCapaPlanned',
  implementing: 'ade.rcaStatusImplementing',
  verified: 'ade.rcaStatusVerified',
  closed: 'ade.rcaStatusClosed',
}

const SEVERITY_OPTIONS: Array<{ value: EventSeverity; label: string }> = (
  Object.keys(SEVERITY_LABELS) as EventSeverity[]
).map((v) => ({ value: v, label: t(SEVERITY_LABELS[v]) }))

const STATUS_OPTIONS: Array<{ value: EventStatus; label: string }> = (
  Object.keys(STATUS_LABELS) as EventStatus[]
).map((v) => ({ value: v, label: t(STATUS_LABELS[v]) }))

const CATEGORY_OPTIONS: Array<{ value: EventCategory; label: string }> = (
  Object.keys(CATEGORY_LABELS) as EventCategory[]
).map((v) => ({ value: v, label: t(CATEGORY_LABELS[v]) }))

const FIELD_STYLE: CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: '8px',
  border: '1px solid var(--border-color, #d0d7de)',
  background: 'var(--bg-primary, #ffffff)',
  color: 'var(--text-primary, #1f2328)',
  fontSize: '13px',
  boxSizing: 'border-box',
}

const SELECT_STYLE: CSSProperties = {
  minWidth: 140,
  fontSize: '13px',
}

interface TimelineEntry {
  key: string
  at: string
  label: string
  detail?: string
  color: string
}

function buildTimeline(event: AdverseEvent, rcas: RcaInvestigation[]): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  entries.push({
    key: 'reported',
    at: event.reportedAt,
    label: t('ade.timelineReported'),
    detail: t('ade.timelineBy', { name: event.reportedBy }),
    color: statusColor(STATUS_TOKEN.reported),
  })
  if (event.status === 'investigating' || event.status === 'resolved' || event.status === 'closed') {
    entries.push({
      key: 'investigating',
      at: event.resolvedAt ?? event.reportedAt,
      label: t('ade.timelineInvestigating'),
      color: statusColor(STATUS_TOKEN.investigating),
    })
  }
  for (const r of rcas) {
    entries.push({
      key: `rca-open-${r.id}`,
      at: (r as { dateInvestigationStarted?: string }).dateInvestigationStarted ?? r.dateOccurred,
      label: `${t('ade.timelineRcaOpened')} · ${r.id}`,
      detail: r.eventTitle,
      color: statusColor(STATUS_TOKEN.investigating),
    })
    if (r.closedAt) {
      entries.push({
        key: `rca-closed-${r.id}`,
        at: r.closedAt,
        label: `${t('ade.timelineRcaClosed')} · ${r.id}`,
        detail: r.closedBy ? t('ade.timelineBy', { name: r.closedBy }) : undefined,
        color: statusColor(STATUS_TOKEN.closed),
      })
    }
  }
  if (event.resolvedAt) {
    entries.push({
      key: 'resolved',
      at: event.resolvedAt,
      label: t('ade.timelineResolved'),
      detail: event.resolvedBy ? t('ade.timelineBy', { name: event.resolvedBy }) : undefined,
      color: statusColor(STATUS_TOKEN.resolved),
    })
  }
  if (event.closedAt) {
    entries.push({
      key: 'closed',
      at: event.closedAt,
      label: t('ade.timelineClosed'),
      detail: event.closedBy ? t('ade.timelineBy', { name: event.closedBy }) : undefined,
      color: statusColor(STATUS_TOKEN.closed),
    })
  }
  return entries.sort((a, b) => a.at.localeCompare(b.at))
}

export default function AdverseEventPage() {
  const [events, setEvents] = useState<AdverseEvent[]>([])
  const [rcas, setRcas] = useState<RcaInvestigation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [keyword, setKeyword] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    patientName: '', patientId: '', eventType: '' as EventCategory | '',
    severity: '' as EventSeverity | '', department: '', description: '',
    reportedBy: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdverseEvent | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [draftStatus, setDraftStatus] = useState<EventStatus | ''>('')
  const [statusSaving, setStatusSaving] = useState(false)

  const [rcaOpen, setRcaOpen] = useState(false)
  const [rcaSaving, setRcaSaving] = useState(false)
  const [rcaForm, setRcaForm] = useState({
    adverseEventId: '', eventTitle: '', dateOccurred: '', description: '', teamMembers: '',
  })
  const [rcaErrors, setRcaErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [evts, rcaData] = await Promise.all([getAdverseEvents(), getRcaInvestigations()])
      setEvents(evts ?? [])
      setRcas(rcaData ?? [])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('ade.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id)
    setDetail(null)
    setDraftStatus('')
    setDetailLoading(true)
    try {
      const item = await getAdverseEvent(id)
      setDetail(item)
      setDraftStatus(item?.status ?? '')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return events.filter((e) => {
      if (severityFilter && e.severity !== severityFilter) return false
      if (statusFilter && e.status !== statusFilter) return false
      const day = e.reportedAt?.slice(0, 10) ?? ''
      if (dateFrom && day < dateFrom) return false
      if (dateTo && day > dateTo) return false
      if (kw) {
        const hay = `${e.id} ${e.patientName ?? ''} ${e.patientId ?? ''} ${e.description ?? ''}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [events, keyword, severityFilter, statusFilter, dateFrom, dateTo])

  const kpis = useMemo(() => ({
    total: events.length,
    open: events.filter((e) => e.status === 'reported').length,
    investigating: events.filter((e) => e.status === 'investigating').length,
    closed: events.filter((e) => e.status === 'closed').length,
  }), [events])

  const linkedRcas = useMemo(
    () => (selectedId ? rcas.filter((r) => r.adverseEventId === selectedId) : []),
    [rcas, selectedId],
  )

  const timeline = useMemo(
    () => (detail ? buildTimeline(detail, linkedRcas) : []),
    [detail, linkedRcas],
  )

  const handleCreate = async () => {
    const errors: Record<string, string> = {}
    if (!form.eventType) errors.eventType = t('ade.eventTypeRequired')
    if (!form.severity) errors.severity = t('ade.severityRequired')
    if (!form.department.trim()) errors.department = t('ade.departmentRequired')
    if (!form.description.trim()) errors.description = t('ade.descriptionRequired')
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return
    setCreating(true)
    try {
      await createAdverseEvent({
        eventType: form.eventType as EventCategory,
        severity: form.severity as EventSeverity,
        description: form.description.trim(),
        department: form.department.trim(),
        reportedBy: form.reportedBy.trim() || t('ade.currentUser'),
        patientName: form.patientName.trim() || undefined,
        patientId: form.patientId.trim() || undefined,
        contributingFactors: [],
        actionsTaken: [],
        rootCauseIds: [],
      })
      setCreateOpen(false)
      setForm({ patientName: '', patientId: '', eventType: '', severity: '', department: '', description: '', reportedBy: '' })
      setFormErrors({})
      await load()
    } catch {
      setFormErrors({ submit: t('ade.createFailed') })
    } finally {
      setCreating(false)
    }
  }

  const handleStatusSave = async () => {
    if (!detail || !draftStatus || draftStatus === detail.status) return
    setStatusSaving(true)
    try {
      const patch: Partial<AdverseEvent> = { status: draftStatus }
      if (draftStatus === 'resolved') patch.resolvedAt = new Date().toISOString()
      if (draftStatus === 'closed') patch.closedAt = new Date().toISOString()
      await updateAdverseEvent(detail.id, patch)
      setDetail({ ...detail, ...patch })
      await load()
    } finally {
      setStatusSaving(false)
    }
  }

  const handleRcaCreate = async () => {
    const errors: Record<string, string> = {}
    if (!rcaForm.adverseEventId) errors.adverseEventId = t('ade.rcaEventRequired')
    if (!rcaForm.eventTitle.trim()) errors.eventTitle = t('ade.rcaTitleRequired')
    setRcaErrors(errors)
    if (Object.keys(errors).length > 0) return
    setRcaSaving(true)
    try {
      await createRcaInvestigation({
        adverseEventId: rcaForm.adverseEventId,
        eventTitle: rcaForm.eventTitle.trim(),
        description: rcaForm.description.trim() || undefined,
        dateOccurred: rcaForm.dateOccurred
          ? new Date(rcaForm.dateOccurred).toISOString()
          : new Date().toISOString(),
        teamMembers: rcaForm.teamMembers.split(',').map((s) => s.trim()).filter(Boolean),
        capaStatus: 'open',
      })
      setRcaOpen(false)
      setRcaForm({ adverseEventId: '', eventTitle: '', dateOccurred: '', description: '', teamMembers: '' })
      setRcaErrors({})
      await load()
    } catch {
      setRcaErrors({ submit: t('ade.rcaSubmitFailed') })
    } finally {
      setRcaSaving(false)
    }
  }

  const resetFilters = () => {
    setKeyword('')
    setSeverityFilter('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <PageContainer background="default" maxWidth="full" testId="adverse-event-page">
      <PageHeader
        title={t('ade.dashboardTitle')}
        subtitle={t('ade.dashboardSubtitle')}
        icon={<AlertTriangle size={22} />}
        as="h1"
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px',
                border: '1px solid var(--border-color, #d0d7de)',
                background: 'var(--bg-card, #ffffff)',
                color: 'var(--text-primary, #1f2328)',
                fontSize: '13px', cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} />{t('ade.refresh')}
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              data-testid="ade-create-btn"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px', border: 'none',
                background: 'var(--color-primary-600, #1f6feb)',
                color: '#ffffff', fontSize: '13px', cursor: 'pointer',
              }}
            >
              <Plus size={14} />{t('ade.reportEvent')}
            </button>
          </>
        }
      />

      <StatCardGrid columns={4} gap={16} style={{ margin: 'var(--space-4, 16px) 0' }}>
        <StatCard
          title={t('ade.kpiTotal')}
          value={kpis.total}
          suffix={t('ade.events')}
          color="primary"
          loading={loading}
          icon={<AlertTriangle size={20} />}
          testId="ade-kpi-total"
        />
        <StatCard
          title={t('ade.kpiOpen')}
          value={kpis.open}
          color="info"
          loading={loading}
          icon={<ClipboardList size={20} />}
          testId="ade-kpi-open"
        />
        <StatCard
          title={t('ade.kpiInvestigating')}
          value={kpis.investigating}
          color="warning"
          loading={loading}
          icon={<Search size={20} />}
          testId="ade-kpi-investigating"
        />
        <StatCard
          title={t('ade.kpiClosed')}
          value={kpis.closed}
          color="success"
          loading={loading}
          icon={<CheckCircle size={20} />}
          testId="ade-kpi-closed"
        />
      </StatCardGrid>

      <FilterBar
        searchPlaceholder={t('ade.searchPlaceholder')}
        searchValue={keyword}
        onSearchChange={setKeyword}
        filters={[
          {
            key: 'severity',
            label: t('ade.filterSeverity'),
            options: SEVERITY_OPTIONS,
          },
          {
            key: 'status',
            label: t('ade.filterStatus'),
            options: STATUS_OPTIONS,
          },
        ]}
        filterValues={{ severity: severityFilter, status: statusFilter }}
        onFilterChange={(key, value) => {
          if (key === 'severity') setSeverityFilter(value)
          if (key === 'status') setStatusFilter(value)
        }}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary, #57606a)' }} htmlFor="ade-date-from">
              {t('ade.filterFrom')}
            </label>
            <input
              id="ade-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ ...FIELD_STYLE, width: 'auto' }}
            />
            <label style={{ fontSize: '12px', color: 'var(--text-secondary, #57606a)' }} htmlFor="ade-date-to">
              {t('ade.filterTo')}
            </label>
            <input
              id="ade-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ ...FIELD_STYLE, width: 'auto' }}
            />
            <button
              type="button"
              onClick={resetFilters}
              style={{
                padding: '6px 12px', borderRadius: '8px',
                border: '1px solid var(--border-color, #d0d7de)',
                background: 'transparent', color: 'var(--text-secondary, #57606a)',
                fontSize: '12px', cursor: 'pointer',
              }}
            >
              {t('ade.resetFilters')}
            </button>
          </div>
        }
      />

      <StateView
        loading={loading}
        error={loadError}
        empty={!loading && !loadError && filtered.length === 0}
        emptyDescription={t('ade.empty')}
        onRetry={() => void load()}
        skeletonRows={5}
      >
        <DataTable
          rowKey="id"
          dataSource={filtered}
          exportFileName="adverse-events"
          emptyText={t('ade.empty')}
          onRow={(record) => ({
            onClick: () => void openDetail(record.id),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: t('ade.colId'),
              dataIndex: 'id',
              key: 'id',
              render: (v: string) => (
                <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', color: 'var(--text-secondary, #57606a)' }}>{v}</span>
              ),
            },
            {
              title: t('ade.colPatient'),
              dataIndex: 'patientName',
              key: 'patientName',
              render: (v: string, record: AdverseEvent) => (
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary, #1f2328)' }}>{v || t('ade.unspecified')}</div>
                  {record.patientId && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #8b949e)' }}>{record.patientId}</div>
                  )}
                </div>
              ),
            },
            {
              title: t('ade.colType'),
              dataIndex: 'eventType',
              key: 'eventType',
              render: (v: EventCategory) => t(CATEGORY_LABELS[v] ?? 'ade.category.other'),
            },
            {
              title: t('ade.colSeverity'),
              dataIndex: 'severity',
              key: 'severity',
              render: (v: EventSeverity) => (
                <SeverityTag level={SEVERITY_TOKEN[v] ?? 'neutral'} dot>
                  {t(SEVERITY_LABELS[v] ?? String(v))}
                </SeverityTag>
              ),
            },
            {
              title: t('ade.colStatus'),
              dataIndex: 'status',
              key: 'status',
              render: (v: EventStatus) => (
                <StatusTag status={STATUS_TOKEN[v] ?? 'neutral'} dot>
                  {t(STATUS_LABELS[v] ?? String(v))}
                </StatusTag>
              ),
            },
            {
              title: t('ade.colDate'),
              dataIndex: 'reportedAt',
              key: 'reportedAt',
              render: (v: string) => (
                <span style={{ fontSize: '12px', color: 'var(--text-secondary, #57606a)' }}>
                  {(v ?? '').slice(0, 10) || '-'}
                </span>
              ),
            },
            {
              title: t('ade.colDepartment'),
              dataIndex: 'department',
              key: 'department',
              render: (v: string) => v || t('ade.unspecified'),
            },
          ]}
        />
      </StateView>

      <div
        style={{
          marginTop: 'var(--space-6, 24px)',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #d0d7de)',
          borderRadius: '12px',
          padding: 'var(--space-4, 16px)',
        }}
        data-testid="ade-rca-section"
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-3, 12px)', flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #1f2328)' }}>
            {t('ade.rcaSectionTitle')}
          </div>
          <button
            type="button"
            onClick={() => {
              setRcaForm((f) => ({ ...f, adverseEventId: selectedId ?? f.adverseEventId }))
              setRcaOpen(true)
            }}
            data-testid="ade-rca-create-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '8px', border: 'none',
              background: 'var(--color-primary-600, #1f6feb)',
              color: '#ffffff', fontSize: '13px', cursor: 'pointer',
            }}
          >
            <Plus size={14} />{t('ade.rcaCreate')}
          </button>
        </div>
        <StateView
          loading={loading}
          empty={!loading && rcas.length === 0}
          emptyDescription={t('ade.rcaEmpty')}
          minHeight={160}
          skeletonRows={3}
        >
          <DataTable
            rowKey="id"
            dataSource={rcas}
            exportFileName="rca-investigations"
            emptyText={t('ade.rcaEmpty')}
            pagination={rcas.length > 10 ? undefined : false}
            columns={[
              {
                title: t('ade.rcaColId'),
                dataIndex: 'id',
                key: 'id',
                render: (v: string) => (
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '12px' }}>{v}</span>
                ),
              },
              { title: t('ade.rcaColTitle'), dataIndex: 'eventTitle', key: 'eventTitle' },
              { title: t('ade.rcaColEvent'), dataIndex: 'adverseEventId', key: 'adverseEventId' },
              {
                title: t('ade.rcaColStatus'),
                dataIndex: 'capaStatus',
                key: 'capaStatus',
                render: (v: RcaStatus) => (
                  <StatusTag status={RCA_STATUS_TOKEN[v] ?? 'neutral'} dot>
                    {t(RCA_STATUS_LABELS[v] ?? String(v))}
                  </StatusTag>
                ),
              },
              {
                title: t('ade.rcaColStarted'),
                key: 'started',
                render: (_: unknown, record: RcaInvestigation) => {
                  const started = (record as { dateInvestigationStarted?: string }).dateInvestigationStarted ?? record.dateOccurred
                  return <span style={{ fontSize: '12px', color: 'var(--text-secondary, #57606a)' }}>{(started ?? '').slice(0, 10) || '-'}</span>
                },
              },
              {
                title: t('ade.rcaColTeam'),
                key: 'team',
                render: (_: unknown, record: RcaInvestigation) =>
                  (record.teamMembers ?? []).join('、') || '-',
              },
            ]}
          />
        </StateView>
      </div>

      <AppDrawer
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        title={detail ? `${t('ade.detailTitle')} · ${detail.id}` : t('ade.detailTitle')}
        size="md"
        testId="ade-detail-drawer"
      >
        {detailLoading && (
          <StateView loading skeletonRows={6} minHeight={200} />
        )}
        {!detailLoading && detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
            <div
              style={{
                borderLeft: `4px solid ${severityToAntd(SEVERITY_TOKEN[detail.severity] ?? 'neutral')}`,
                borderRadius: '8px',
                background: 'var(--bg-primary, #f6f8fa)',
                padding: 'var(--space-3, 12px)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', flexWrap: 'wrap', marginBottom: 'var(--space-2, 8px)' }}>
                <SeverityTag level={SEVERITY_TOKEN[detail.severity] ?? 'neutral'} dot>
                  {t(SEVERITY_LABELS[detail.severity] ?? String(detail.severity))}
                </SeverityTag>
                <StatusTag status={STATUS_TOKEN[detail.status] ?? 'neutral'} dot>
                  {t(STATUS_LABELS[detail.status] ?? String(detail.status))}
                </StatusTag>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary, #1f2328)', lineHeight: 1.6 }}>
                {detail.description}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
              {[
                { label: t('ade.colPatient'), value: detail.patientName || t('ade.unspecified') },
                { label: t('ade.detailPatientId'), value: detail.patientId || '-' },
                { label: t('ade.colType'), value: t(CATEGORY_LABELS[detail.eventType] ?? 'ade.category.other') },
                { label: t('ade.departmentLabel'), value: detail.department || '-' },
                { label: t('ade.detailLocation'), value: detail.location || '-' },
                { label: t('ade.detailReporter'), value: detail.reportedBy || '-' },
                { label: t('ade.detailReportedAt'), value: (detail.reportedAt ?? '').slice(0, 16).replace('T', ' ') || '-' },
                { label: t('ade.colStatus'), value: t(STATUS_LABELS[detail.status] ?? String(detail.status)) },
              ].map((row) => (
                <div key={row.label}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #8b949e)', marginBottom: '2px' }}>{row.label}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary, #1f2328)' }}>{row.value}</div>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #57606a)', marginBottom: 'var(--space-1, 4px)' }}>
                {t('ade.detailFactors')}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary, #1f2328)' }}>
                {(detail.contributingFactors ?? []).join('、') || t('ade.detailNoFactors')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #57606a)', marginBottom: 'var(--space-1, 4px)' }}>
                {t('ade.detailActionsTaken')}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary, #1f2328)' }}>
                {(detail.actionsTaken ?? []).join('、') || t('ade.detailNoFactors')}
              </div>
            </div>

            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', flexWrap: 'wrap',
                background: 'var(--bg-primary, #f6f8fa)', borderRadius: '8px', padding: 'var(--space-3, 12px)',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #57606a)' }}>
                {t('ade.changeStatus')}
              </span>
              <Select
                value={draftStatus || undefined}
                onChange={(v: EventStatus) => setDraftStatus(v)}
                options={STATUS_OPTIONS}
                style={SELECT_STYLE}
                placeholder={t('ade.filterStatus')}
                aria-label={t('ade.changeStatus')}
              />
              <button
                type="button"
                onClick={() => void handleStatusSave()}
                disabled={statusSaving || !draftStatus || draftStatus === detail.status}
                data-testid="ade-save-status-btn"
                style={{
                  padding: '6px 14px', borderRadius: '8px', border: 'none',
                  background: 'var(--color-primary-600, #1f6feb)',
                  color: '#ffffff', fontSize: '13px',
                  cursor: statusSaving || !draftStatus ? 'not-allowed' : 'pointer',
                  opacity: statusSaving || !draftStatus ? 0.6 : 1,
                }}
              >
                {t('ade.saveStatus')}
              </button>
            </div>

            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #1f2328)', marginBottom: 'var(--space-3, 12px)' }}>
                {t('ade.timelineTitle')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
                {timeline.map((entry) => (
                  <div key={entry.key} style={{ display: 'flex', gap: 'var(--space-3, 12px)', alignItems: 'flex-start' }}>
                    <span
                      aria-hidden
                      style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: entry.color, marginTop: '4px', flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary, #1f2328)', fontWeight: 600 }}>
                        {entry.label}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted, #8b949e)' }}>
                        {(entry.at ?? '').slice(0, 16).replace('T', ' ')}
                        {entry.detail ? ` · ${entry.detail}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #1f2328)', marginBottom: 'var(--space-2, 8px)' }}>
                {t('ade.rcaForEvent')}
              </div>
              {linkedRcas.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted, #8b949e)' }}>{t('ade.noRcaForEvent')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
                  {linkedRcas.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        border: '1px solid var(--border-color, #d0d7de)', borderRadius: '8px',
                        padding: 'var(--space-3, 12px)', background: 'var(--bg-card, #ffffff)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2, 8px)', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #1f2328)' }}>{r.eventTitle}</span>
                        <StatusTag status={RCA_STATUS_TOKEN[r.capaStatus] ?? 'neutral'} dot>
                          {t(RCA_STATUS_LABELS[r.capaStatus] ?? String(r.capaStatus))}
                        </StatusTag>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted, #8b949e)', marginTop: '2px' }}>
                        {r.id}{r.teamMembers?.length ? ` · ${(r.teamMembers ?? []).join('、')}` : ''}
                      </div>
                      {r.conclusion && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary, #57606a)', marginTop: 'var(--space-2, 8px)' }}>
                          {r.conclusion}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </AppDrawer>

      <AppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('ade.newEvent')}
        size="md"
        testId="ade-create-modal"
        confirmText={t('ade.submit')}
        cancelText={t('ade.cancel')}
        okLoading={creating}
        onOk={() => void handleCreate()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
          <FormField label={t('ade.patientName')} layout="vertical">
            <input
              style={FIELD_STYLE}
              value={form.patientName}
              onChange={(e) => setForm({ ...form, patientName: e.target.value })}
              placeholder={t('ade.patientOptional')}
            />
          </FormField>
          <FormField label={t('ade.patientId')} layout="vertical">
            <input
              style={FIELD_STYLE}
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
            />
          </FormField>
          <FormField label={t('ade.colType')} required layout="vertical" error={formErrors.eventType}>
            <Select
              value={form.eventType || undefined}
              onChange={(v: EventCategory) => setForm({ ...form, eventType: v })}
              options={CATEGORY_OPTIONS}
              style={{ width: '100%' }}
              placeholder={t('ade.selectEventType')}
              aria-label={t('ade.selectEventType')}
            />
          </FormField>
          <FormField label={t('ade.colSeverity')} required layout="vertical" error={formErrors.severity}>
            <Select
              value={form.severity || undefined}
              onChange={(v: EventSeverity) => setForm({ ...form, severity: v })}
              options={SEVERITY_OPTIONS}
              style={{ width: '100%' }}
              placeholder={t('ade.selectSeverity')}
              aria-label={t('ade.selectSeverity')}
            />
          </FormField>
          <FormField label={t('ade.departmentLabel')} required layout="vertical" error={formErrors.department}>
            <input
              style={FIELD_STYLE}
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
          </FormField>
          <FormField label={t('ade.description')} required layout="vertical" error={formErrors.description}>
            <textarea
              style={{ ...FIELD_STYLE, minHeight: '96px', resize: 'vertical' }}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </FormField>
          <FormField label={t('ade.reportedBy')} layout="vertical">
            <input
              style={FIELD_STYLE}
              value={form.reportedBy}
              onChange={(e) => setForm({ ...form, reportedBy: e.target.value })}
              placeholder={t('ade.currentUser')}
            />
          </FormField>
          {formErrors.submit && (
            <div role="alert" style={{ color: 'var(--color-error-600, #cf222e)', fontSize: '12px' }}>
              {formErrors.submit}
            </div>
          )}
        </div>
      </AppModal>

      <AppModal
        open={rcaOpen}
        onClose={() => setRcaOpen(false)}
        title={t('ade.rcaModalTitle')}
        size="md"
        testId="ade-rca-modal"
        confirmText={t('ade.submit')}
        cancelText={t('ade.cancel')}
        okLoading={rcaSaving}
        onOk={() => void handleRcaCreate()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
          <FormField label={t('ade.rcaEvent')} required layout="vertical" error={rcaErrors.adverseEventId}>
            <Select
              value={rcaForm.adverseEventId || undefined}
              onChange={(v: string) => setRcaForm({ ...rcaForm, adverseEventId: v })}
              options={events.map((e) => ({ value: e.id, label: `${e.id} · ${e.patientName || t('ade.unspecified')}` }))}
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
              placeholder={t('ade.rcaEvent')}
              aria-label={t('ade.rcaEvent')}
            />
          </FormField>
          <FormField label={t('ade.rcaTitleLabel')} required layout="vertical" error={rcaErrors.eventTitle}>
            <input
              style={FIELD_STYLE}
              value={rcaForm.eventTitle}
              onChange={(e) => setRcaForm({ ...rcaForm, eventTitle: e.target.value })}
            />
          </FormField>
          <FormField label={t('ade.rcaOccurred')} layout="vertical">
            <input
              type="date"
              style={FIELD_STYLE}
              value={rcaForm.dateOccurred}
              onChange={(e) => setRcaForm({ ...rcaForm, dateOccurred: e.target.value })}
            />
          </FormField>
          <FormField label={t('ade.rcaDescription')} layout="vertical">
            <textarea
              style={{ ...FIELD_STYLE, minHeight: '80px', resize: 'vertical' }}
              value={rcaForm.description}
              onChange={(e) => setRcaForm({ ...rcaForm, description: e.target.value })}
            />
          </FormField>
          <FormField label={t('ade.rcaTeamMembers')} layout="vertical">
            <input
              style={FIELD_STYLE}
              value={rcaForm.teamMembers}
              onChange={(e) => setRcaForm({ ...rcaForm, teamMembers: e.target.value })}
            />
          </FormField>
          {rcaErrors.submit && (
            <div role="alert" style={{ color: 'var(--color-error-600, #cf222e)', fontSize: '12px' }}>
              {rcaErrors.submit}
            </div>
          )}
        </div>
      </AppModal>
    </PageContainer>
  )
}
