// [W1-5] 导出审批中心 — 申请列表/状态筛选/审批操作/新建申请
// 后端: POST /export-approval, GET /export-approval, POST /export-approval/:id/approve|reject
import { useState, useEffect, useCallback } from 'react'
import { Modal, Input, Select, message, Spin } from 'antd'
import { FileDown, Plus, RefreshCw, Check, X, Clock, Loader2, ShieldCheck, FileText } from 'lucide-react'
import { exportApprovalApi, type ExportApprovalDto } from '../../services/api/analyticsApi'
import { useAuth } from '../../hooks/useAuth'
import { normalizeRole } from '../../services/auth/roleUtils'

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
        setError(res.error?.message ?? '加载失败')
      }
    } catch (e) {
      setError((e as Error)?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void load() }, [load])

  const handleCreate = async () => {
    if (!createReason.trim()) {
      message.warning('请填写申请原因')
      return
    }
    if (!createResourceId.trim()) {
      message.warning('请填写资源名称(报告ID/患者号等)')
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
        message.success('导出申请已提交,等待审批')
        setCreateOpen(false)
        setCreateResource('REPORT')
        setCreateResourceId('')
        setCreateReason('')
        void load()
      } else {
        message.error(res.error?.message ?? '提交失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = (id: string) => {
    Modal.confirm({
      title: '批准导出申请',
      content: '确认批准该导出申请?批准后申请者可执行导出。',
      okText: '批准',
      cancelText: '取消',
      okButtonProps: { style: { background: '#22c55e', borderColor: '#22c55e' } },
      onOk: async () => {
        setActionId(id)
        try {
          const res = await exportApprovalApi.approve(id)
          if (res.success) {
            message.success('已批准导出申请')
            void load()
          } else {
            message.error(res.error?.message ?? '操作失败')
          }
        } catch (e) {
          message.error((e as Error)?.message ?? '操作失败')
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
      message.warning('请填写拒绝原因')
      return
    }
    if (!rejectId) return
    setSubmitting(true)
    try {
      const res = await exportApprovalApi.reject(rejectId, rejectReason.trim())
      if (res.success) {
        message.success('已拒绝导出申请')
        setRejectOpen(false)
        setRejectId(null)
        setRejectReason('')
        void load()
      } else {
        message.error(res.error?.message ?? '操作失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '操作失败')
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
    { key: 'all', label: '全部', count: counts.total },
    { key: 'PENDING', label: '待审批', count: counts.pending },
    { key: 'APPROVED', label: '已批准', count: counts.approved },
    { key: 'REJECTED', label: '已拒绝', count: counts.rejected },
  ]

  const modalStyle = { container: { background: '#161b22', color: '#f0f6fc' }, header: { background: '#161b22', color: '#f0f6fc', borderBottom: '1px solid #30363d' }, footer: { borderTop: '1px solid #30363d' } }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileDown size={24} />
          <span style={{ fontSize: 20, fontWeight: 600 }}>导出审批中心</span>
          <span style={{ fontSize: 12, padding: '2px 8px', background: 'rgba(255,255,255,0.2)', borderRadius: 4 }}>
            {canApprove ? '管理员/主任模式' : '申请模式'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void load()} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <RefreshCw size={14} />刷新
          </button>
          <button onClick={() => setCreateOpen(true)} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
            <Plus size={14} />新建申请
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {filterTabs.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: filter === t.key ? '#1e40af' : '#21262d', color: filter === t.key ? '#fff' : '#8b949e', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.key === 'PENDING' && <Clock size={13} />}
              {t.key === 'APPROVED' && <Check size={13} />}
              {t.key === 'REJECTED' && <X size={13} />}
              {t.label}
              <span style={{ padding: '1px 7px', borderRadius: 10, background: filter === t.key ? 'rgba(255,255,255,0.25)' : '#161b22', fontSize: 11 }}>{t.count}</span>
            </button>
          ))}
        </div>

        {error && (
          <div style={{ padding: 12, borderRadius: 6, background: '#ef444420', border: '1px solid #ef4444', color: '#fca5a5', marginBottom: 16, fontSize: 13 }}>
            加载失败:{error}
            <button onClick={() => void load()} style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 4, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12 }}>重试</button>
          </div>
        )}

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 110px 1fr 90px 150px 120px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', background: '#0d1117', color: '#8b949e', fontSize: 12, fontWeight: 600 }}>
            <span>申请者</span>
            <span>资源类型</span>
            <span>资源名称 / 申请原因</span>
            <span>状态</span>
            <span>申请时间</span>
            <span style={{ textAlign: 'right' }}>操作</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>
              <Spin size="large" />
              <div style={{ marginTop: 12, fontSize: 13 }}>加载审批列表...</div>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6e7681', fontSize: 13 }}>
              暂无{filter === 'all' ? '' : STATUS_META[filter]?.label}的导出申请
            </div>
          ) : (
            items.map((item, idx) => {
              const st = STATUS_META[item.status] ?? { label: item.status, color: '#8b949e', bg: '#8b949e20' }
              return (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '150px 110px 1fr 90px 150px 120px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', alignItems: 'center', background: idx % 2 === 0 ? '#0d1117' : '#161b22' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.requesterName ?? '未知用户'}</div>
                    <div style={{ fontSize: 11, color: '#6e7681', fontFamily: 'monospace' }}>{item.requesterId}</div>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: '#1e40af30', color: '#93c5fd', width: 'fit-content' }}>
                    {RESOURCE_LABELS[item.resource] ?? item.resource}
                  </span>
                  <div>
                    <div style={{ fontSize: 13 }}>{item.resourceId ?? '—'}</div>
                    <div style={{ fontSize: 12, color: '#8b949e' }}>{item.reason}</div>
                    {item.status === 'REJECTED' && item.rejectReason && (
                      <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 2 }}>拒绝原因:{item.rejectReason}</div>
                    )}
                  </div>
                  <span style={{ padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: st.bg, color: st.color, width: 'fit-content' }}>{st.label}</span>
                  <div>
                    <div style={{ fontSize: 12, color: '#8b949e' }}>{fmtTime(item.createdAt)}</div>
                    {item.approverId && <div style={{ fontSize: 11, color: '#6e7681' }}>审批人:{item.approverId}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {item.status === 'PENDING' && canApprove && (
                      <>
                        <button onClick={() => handleApprove(item.id)} disabled={actionId === item.id}
                          style={{ padding: '5px 12px', borderRadius: 5, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, opacity: actionId === item.id ? 0.6 : 1 }}>
                          {actionId === item.id ? <Loader2 size={12} /> : <Check size={12} />}批准
                        </button>
                        <button onClick={() => handleReject(item.id)}
                          style={{ padding: '5px 12px', borderRadius: 5, border: '1px solid #ef4444', background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <X size={12} />拒绝
                        </button>
                      </>
                    )}
                    {item.status === 'PENDING' && !canApprove && (
                      <span style={{ fontSize: 12, color: '#6e7681' }}>等待审批</span>
                    )}
                    {item.status !== 'PENDING' && <span style={{ fontSize: 12, color: '#6e7681' }}>—</span>}
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: '#6e7681', display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ShieldCheck size={13} color="#22c55e" />批准/拒绝仅对管理员与主任可见</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={13} color="#3b82f6" />导出操作将自动生成审批申请</span>
        </div>
      </div>

      {/* 新建申请 Modal */}
      <Modal
        open={createOpen}
        title="新建导出申请"
        okText="提交申请"
        cancelText="取消"
        confirmLoading={submitting}
        onOk={() => void handleCreate()}
        onCancel={() => setCreateOpen(false)}
        width={480}
        styles={modalStyle}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>资源类型</div>
            <Select
              value={createResource}
              onChange={setCreateResource}
              style={{ width: '100%' }}
              options={RESOURCE_OPTIONS}
              popupMatchSelectWidth={false}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>资源名称(报告ID / 患者号等)</div>
            <Input value={createResourceId} onChange={e => setCreateResourceId(e.target.value)} placeholder="例如 RPT-202607-001" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>申请原因</div>
            <Input.TextArea value={createReason} onChange={e => setCreateReason(e.target.value)} rows={4} placeholder="请填写导出用途与理由,如:用于院内会诊 / 科研归档" maxLength={200} showCount />
          </div>
        </div>
      </Modal>

      {/* 拒绝 Modal */}
      <Modal
        open={rejectOpen}
        title="拒绝导出申请"
        okText="确认拒绝"
        cancelText="取消"
        confirmLoading={submitting}
        onOk={() => void confirmReject()}
        onCancel={() => { setRejectOpen(false); setRejectId(null); setRejectReason('') }}
        width={440}
        okButtonProps={{ style: { background: '#ef4444', borderColor: '#ef4444' } }}
        styles={modalStyle}
      >
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>拒绝原因(必填)</div>
          <Input.TextArea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={4} placeholder="请填写拒绝原因,将反馈给申请者" maxLength={200} showCount />
        </div>
      </Modal>
    </div>
  )
}
