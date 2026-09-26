// [W1-5] 导出审批中心 — 申请列表/状态筛选/审批操作/新建申请
// [v3.0.6.11-103 Wave 9] KPI 统计卡 + i18n + 标准 ActionButton
// 后端: POST /export-approval, GET /export-approval, POST /export-approval/:id/approve|reject
import { useState, useEffect, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { Modal, Input, Select, message, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FileDown, Plus, RefreshCw, Check, X, Clock, Loader2, ShieldCheck, FileText, Inbox, Hourglass, BadgeCheck, Ban } from 'lucide-react'
import { exportApprovalApi, type ExportApprovalDto } from '../../services/api/analyticsApi'
import { useAuth } from '../../hooks/useAuth'
import { normalizeRole } from '../../services/auth/roleUtils'
import { t } from '../../i18n/appI18n'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { ActionButton } from '../../components/common/ActionButton'
import { DataTable } from '../../components/common/DataTable'

type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: '待审批', color: '#f59e0b', bg: '#f59e0b20' },
  APPROVED: { label: '已批准', color: '#22c55e', bg: '#22c55e20' },
  REJECTED: { label: '已拒绝', color: '#ef4444', bg: '#ef444420' },
}

const RESOURCE_OPTIONS = [
  { value: 'REPORT', label: '报告导出' },
  { value: 'PATIENT_EXPORT', label: '患者资料' },
  { value: 'DATA', label: '统计数据' },
  { value: 'OTHER', label: '其他' },
]

const RESOURCE_LABELS: Record<string, string> = {
  REPORT: '报告', PATIENT_EXPORT: '患者资料', DATA: '统计数据', OTHER: '其他',
}

function normalizeList(res: { success: boolean; data: unknown }): ExportApprovalDto[] {
  if (!res.success) return []
  const d = res.data as any
  if (Array.isArray(d)) return d as ExportApprovalDto[]
  if (d && Array.isArray(d.items)) return d.items as ExportApprovalDto[]
  return []
}

function fmtTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const darkCard: CSSProperties = { background: '#161b22', border: '1px solid #30363d', boxShadow: 'none' }

export default function ExportApprovalPage() {
  const { user } = useAuth()
  const role = normalizeRole(user?.role)
  const canApprove = role === 'ADMIN' || role === 'DIRECTOR'

  const [items, setItems] = useState<ExportApprovalDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [actionId, setActionId] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createResource, setCreateResource] = useState('REPORT')
  const [createResourceId, setCreateResourceId] = useState('')
  const [createReason, setCreateReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await exportApprovalApi.list({ page: 1, pageSize: 100, status: filter === 'all' ? undefined : filter })
      if (res.success) {
        setItems(normalizeList(res))
      } else {
        setError(res.error?.message ?? t('w9.exportApproval.loading'))
      }
    } catch (e) {
      setError((e as Error)?.message ?? t('w9.exportApproval.loading'))
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  const handleCreate = async () => {
    if (!createReason.trim()) {
      message.warning(t('w9.exportApproval.reasonLabel'))
      return
    }
    if (!createResourceId.trim()) {
      message.warning(t('w9.exportApproval.resourceIdLabel'))
      return
    }
    setSubmitting(true)
    try {
      const res = await exportApprovalApi.request({
        resource: createResource,
        resourceId: createResourceId.trim(),
        reason: createReason.trim(),
      })
      if (res.success) {
        message.success(t('w9.exportApproval.submittedMsg'))
        setCreateOpen(false)
        setCreateResource('REPORT')
        setCreateResourceId('')
        setCreateReason('')
        void load()
      } else {
        message.error(res.error?.message ?? t('w9.exportApproval.submittedMsg'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('w9.exportApproval.submittedMsg'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = (id: string) => {
    Modal.confirm({
      title: t('w9.exportApproval.approveTitle'),
      content: t('w9.exportApproval.approveContent'),
      okText: t('w9.exportApproval.approve'),
      cancelText: '取消',
      okButtonProps: { style: { background: '#22c55e', borderColor: '#22c55e' } },
      onOk: async () => {
        setActionId(id)
        try {
          const res = await exportApprovalApi.approve(id)
          if (res.success) {
            message.success(t('w9.exportApproval.approvedMsg'))
            void load()
          } else {
            message.error(res.error?.message ?? t('w9.exportApproval.approvedMsg'))
          }
        } catch (e) {
          message.error((e as Error)?.message ?? t('w9.exportApproval.approvedMsg'))
        } finally {
          setActionId(null)
        }
      },
    })
  }

  const handleReject = (id: string) => {
    setRejectId(id)
    setRejectReason('')
    setRejectOpen(true)
  }

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      message.warning(t('w9.exportApproval.rejectReason'))
      return
    }
    if (!rejectId) return
    setSubmitting(true)
    try {
      const res = await exportApprovalApi.reject(rejectId, rejectReason.trim())
      if (res.success) {
        message.success(t('w9.exportApproval.rejectedMsg'))
        setRejectOpen(false)
        setRejectId(null)
        setRejectReason('')
        void load()
      } else {
        message.error(res.error?.message ?? t('w9.exportApproval.rejectedMsg'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('w9.exportApproval.rejectedMsg'))
    } finally {
      setSubmitting(false)
    }
  }

  const counts = {
    total: items.length,
    pending: items.filter(i => i.status === 'PENDING').length,
    approved: items.filter(i => i.status === 'APPROVED').length,
    rejected: items.filter(i => i.status === 'REJECTED').length,
  }

  const filterTabs: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: 'all', label: t('w9.exportApproval.all'), count: counts.total },
    { key: 'PENDING', label: t('w9.exportApproval.pending'), count: counts.pending },
    { key: 'APPROVED', label: t('w9.exportApproval.approved'), count: counts.approved },
    { key: 'REJECTED', label: t('w9.exportApproval.rejected'), count: counts.rejected },
  ]

  const modalStyle = { container: { background: '#161b22', color: '#f0f6fc' }, header: { background: '#161b22', color: '#f0f6fc', borderBottom: '1px solid #30363d' }, footer: { borderTop: '1px solid #30363d' } }

  const columns: ColumnsType<ExportApprovalDto> = [
    {
      title: t('w9.exportApproval.requester'), dataIndex: 'requesterName', key: 'requester', width: 150,
      render: (_: unknown, item) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{item.requesterName ?? '未知用户'}</div>
          <div style={{ fontSize: 11, color: '#6e7681', fontFamily: 'monospace' }}>{item.requesterId}</div>
        </div>
      ),
    },
    {
      title: t('w9.exportApproval.resource'), dataIndex: 'resource', key: 'resource', width: 110,
      render: (value: string) => <Tag color="blue">{RESOURCE_LABELS[value] ?? value}</Tag>,
    },
    {
      title: t('w9.exportApproval.resourceInfo'), key: 'resourceInfo',
      render: (_: unknown, item) => (
        <div>
          <div style={{ fontSize: 13 }}>{item.resourceId ?? '—'}</div>
          <div style={{ fontSize: 12, color: '#8b949e' }}>{item.reason}</div>
          {item.status === 'REJECTED' && item.rejectReason && (
            <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 2 }}>{t('w9.exportApproval.rejectReason')}:{item.rejectReason}</div>
          )}
        </div>
      ),
    },
    {
      title: t('w9.exportApproval.status'), dataIndex: 'status', key: 'status', width: 90,
      render: (value: string) => {
        const st = STATUS_META[value] ?? { label: value, color: '#8b949e', bg: '#8b949e20' }
        return <div style={{ padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: st.bg, color: st.color, width: 'fit-content' }}>{st.label}</div>
      },
    },
    {
      title: t('w9.exportApproval.time'), dataIndex: 'createdAt', key: 'time', width: 150,
      render: (_: unknown, item) => (
        <div>
          <div style={{ fontSize: 12, color: '#8b949e' }}>{fmtTime(item.createdAt)}</div>
          {item.approverId && <div style={{ fontSize: 11, color: '#6e7681' }}>审批人:{item.approverId}</div>}
        </div>
      ),
    },
    {
      title: t('w9.exportApproval.actions'), key: 'actions', width: 150, align: 'right',
      render: (_: unknown, item) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {item.status === 'PENDING' && canApprove && (
            <>
              <button onClick={() => handleApprove(item.id)} disabled={actionId === item.id}
                style={{ padding: '5px 12px', borderRadius: 5, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, opacity: actionId === item.id ? 0.6 : 1 }}>
                {actionId === item.id ? <Loader2 size={12} /> : <Check size={12} />}{t('w9.exportApproval.approve')}
              </button>
              <button onClick={() => handleReject(item.id)}
                style={{ padding: '5px 12px', borderRadius: 5, border: '1px solid #ef4444', background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <X size={12} />{t('w9.exportApproval.reject')}
              </button>
            </>
          )}
          {item.status === 'PENDING' && !canApprove && (
            <span style={{ fontSize: 12, color: '#6e7681' }}>{t('w9.exportApproval.waiting')}</span>
          )}
          {item.status !== 'PENDING' && <span style={{ fontSize: 12, color: '#6e7681' }}>—</span>}
        </div>
      ),
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileDown size={24} />
          <span style={{ fontSize: 20, fontWeight: 600 }}>{t('w9.exportApproval.title')}</span>
          <span style={{ fontSize: 12, padding: '2px 8px', background: 'rgba(255,255,255,0.2)', borderRadius: 4 }}>
            {canApprove ? t('w9.exportApproval.approved') + '/' + t('w9.exportApproval.rejected') + ' 模式' : '申请模式'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton action="refresh" size="compact" loading={loading} onClick={() => void load()} icon={<RefreshCw size={14} />} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}>
            {t('w9.exportApproval.refresh')}
          </ActionButton>
          <ActionButton action="create" size="compact" onClick={() => setCreateOpen(true)} icon={<Plus size={14} />} style={{ background: '#22c55e', border: 'none', color: '#fff' }}>
            {t('w9.exportApproval.create')}
          </ActionButton>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <StatCardGrid minWidth={180} style={{ marginBottom: 16 }}>
          <StatCard title={t('w9.exportApproval.all')} value={counts.total} icon={<Inbox size={18} />} color="info" style={darkCard} />
          <StatCard title={t('w9.exportApproval.pending')} value={counts.pending} icon={<Hourglass size={18} />} color="warning" style={darkCard} />
          <StatCard title={t('w9.exportApproval.approved')} value={counts.approved} icon={<BadgeCheck size={18} />} color="success" style={darkCard} />
          <StatCard title={t('w9.exportApproval.rejected')} value={counts.rejected} icon={<Ban size={18} />} color="error" style={darkCard} />
        </StatCardGrid>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {filterTabs.map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: filter === tab.key ? '#1e40af' : '#21262d', color: filter === tab.key ? '#fff' : '#8b949e', display: 'flex', alignItems: 'center', gap: 6 }}>
              {tab.key === 'PENDING' && <Clock size={13} />}
              {tab.key === 'APPROVED' && <Check size={13} />}
              {tab.key === 'REJECTED' && <X size={13} />}
              {tab.label}
              <span style={{ padding: '1px 7px', borderRadius: 10, background: filter === tab.key ? 'rgba(255,255,255,0.25)' : '#161b22', fontSize: 11 }}>{tab.count}</span>
            </button>
          ))}
        </div>

        {error && (
          <div style={{ padding: 12, borderRadius: 6, background: '#ef444420', border: '1px solid #ef4444', color: '#fca5a5', marginBottom: 16, fontSize: 13 }}>
            {t('w9.exportApproval.loading')}:{error}
            <button onClick={() => void load()} style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 4, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12 }}>{t('w9.exportApproval.refresh')}</button>
          </div>
        )}

        <DataTable<ExportApprovalDto>
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          emptyText={t('w9.exportApproval.empty') + (filter === 'all' ? '' : `: ${STATUS_META[filter]?.label ?? ''}`)}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />
        <div style={{ marginTop: 12, fontSize: 12, color: '#6e7681', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ShieldCheck size={13} color="#22c55e" />{t('w9.exportApproval.approverHint')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={13} color="#3b82f6" />{t('w9.exportApproval.autoHint')}</span>
        </div>
      </div>

      {/* 新建申请 Modal */}
      <Modal
        open={createOpen}
        title={t('w9.exportApproval.createTitle')}
        okText={t('w9.exportApproval.create')}
        cancelText="取消"
        confirmLoading={submitting}
        onOk={() => void handleCreate()}
        onCancel={() => setCreateOpen(false)}
        width={480}
        styles={modalStyle}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{t('w9.exportApproval.resourceLabel')}</div>
            <Select
              value={createResource}
              onChange={setCreateResource}
              style={{ width: '100%' }}
              options={RESOURCE_OPTIONS}
              popupMatchSelectWidth={false}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{t('w9.exportApproval.resourceIdLabel')}</div>
            <Input value={createResourceId} onChange={e => setCreateResourceId(e.target.value)} placeholder="例如 RPT-202607-001" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{t('w9.exportApproval.reasonLabel')}</div>
            <Input.TextArea value={createReason} onChange={e => setCreateReason(e.target.value)} rows={4} placeholder={t('w9.exportApproval.reasonPlaceholder')} maxLength={200} showCount />
          </div>
        </div>
      </Modal>

      {/* 拒绝 Modal */}
      <Modal
        open={rejectOpen}
        title={t('w9.exportApproval.rejectTitle')}
        okText={t('w9.exportApproval.reject')}
        cancelText="取消"
        confirmLoading={submitting}
        onOk={() => void confirmReject()}
        onCancel={() => { setRejectOpen(false); setRejectId(null); setRejectReason('') }}
        width={440}
        okButtonProps={{ style: { background: '#ef4444', borderColor: '#ef4444' } }}
        styles={modalStyle}
      >
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{t('w9.exportApproval.rejectReason')}</div>
          <Input.TextArea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={4} placeholder={t('w9.exportApproval.rejectReason')} maxLength={200} showCount />
        </div>
      </Modal>
    </div>
  )
}
