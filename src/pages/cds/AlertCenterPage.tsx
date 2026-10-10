// [G005 W2-B] CDS 告警中心: listAlerts / acknowledgeAlert
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Bell, CheckCircle2, RefreshCw, Info } from 'lucide-react'
import { cdsApi, type CdsAlertDto } from '../../services/api/cdsApi'
import { DataTable } from '../../components/common/DataTable'
import { severityColor } from '../../theme/statusTokens'

const SEVERITY_COLORS: Record<string, string> = {
  critical: severityColor('critical'),
  high: severityColor('high'),
  warning: severityColor('warning'),
  medium: severityColor('warning'),
  info: severityColor('info'),
  low: severityColor('low'),
}

const SEVERITY_LABELS: Record<string, string> = {
  critical: '严重',
  high: '高',
  warning: '警告',
  medium: '中',
  info: '提示',
  low: '低',
}

function normalizeList(res: { success: boolean; data: CdsAlertDto[] | { data: CdsAlertDto[] } }): CdsAlertDto[] {
  if (!res.success) return []
  const d = res.data as unknown
  if (Array.isArray(d)) return d as CdsAlertDto[]
  const nested = (d as { data?: unknown })?.data
  if (Array.isArray(nested)) return nested as CdsAlertDto[]
  return []
}

export default function AlertCenterPage() {
  const [alerts, setAlerts] = useState<CdsAlertDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'acknowledged'>('all')
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' })

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type })
  }, [])

  useEffect(() => {
    if (!toast.show) return
    const t = setTimeout(() => setToast((t0) => ({ ...t0, show: false })), 2000)
    return () => clearTimeout(t)
  }, [toast.show])

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await cdsApi.listAlerts()
      const items = normalizeList(res)
      setAlerts(items)
      if (!res.success) setError(res.error?.message ?? '告警列表加载失败')
    } catch (e) {
      setError((e as Error)?.message || '告警列表加载失败')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  const handleAcknowledge = async (alert: CdsAlertDto) => {
    setAcknowledgingId(alert.id)
    try {
      const res = await cdsApi.acknowledgeAlert(alert.id, {
        acknowledgedBy: '当前用户',
        acknowledgedAt: new Date().toISOString(),
      })
      if (res.success) {
        showToast(`告警 ${alert.id} 已确认`, 'success')
        fetchAlerts()
      } else {
        showToast(res.error?.message ?? '确认失败', 'error')
      }
    } catch (e) {
      showToast((e as Error)?.message || '确认失败', 'error')
    }
    setAcknowledgingId(null)
  }

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return alerts
    return alerts.filter((a) => a.status === statusFilter)
  }, [alerts, statusFilter])

  const pendingCount = alerts.filter((a) => a.status === 'pending').length

  const alertColumns = [
    {
      title: '严重度', key: 'severity', width: 90,
      render: (_: unknown, alert: CdsAlertDto) => {
        const color = SEVERITY_COLORS[alert.severity?.toLowerCase()] || '#8b949e'
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
            <span style={{ fontSize: 12, color }}>{SEVERITY_LABELS[alert.severity?.toLowerCase()] || alert.severity}</span>
          </span>
        )
      },
    },
    { title: '患者', dataIndex: 'patientName', key: 'patientName', render: (v: string) => v || '未知患者' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => v || '通用告警' },
    { title: '消息', dataIndex: 'message', key: 'message', render: (v: string) => v || '-' },
    { title: '时间', dataIndex: 'time', key: 'time', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => <span style={{ color: v === 'pending' ? 'var(--color-warning-500)' : 'var(--color-success-500)' }}>{v === 'pending' ? '待确认' : '已确认'}</span>,
    },
    {
      title: '操作', key: 'actions', width: 120,
      render: (_: unknown, alert: CdsAlertDto) => alert.status === 'pending' ? (
        <button onClick={() => handleAcknowledge(alert)} disabled={acknowledgingId === alert.id} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={14} />{acknowledgingId === alert.id ? '确认中...' : '确认'}
        </button>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--color-success-500)', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} />已处理</span>
      ),
    },
  ]

  return (
    <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,var(--color-primary-800),#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Bell size={24} />
          <span style={{ fontSize: 20, fontWeight: 600 }}>CDS 告警中心</span>
          {pendingCount > 0 && (
            <span style={{ padding: '2px 10px', borderRadius: 999, background: 'var(--color-error-500)', color: '#fff', fontSize: 12, fontWeight: 600 }}>
              {pendingCount} 条待确认
            </span>
          )}
        </div>
        <button onClick={() => { fetchAlerts() }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <RefreshCw size={14} />刷新
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {([['all', '全部'], ['pending', '待确认'], ['acknowledged', '已确认']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setStatusFilter(key)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: statusFilter === key ? 'var(--color-primary-800)' : 'var(--bg-secondary, #21262d)', color: statusFilter === key ? '#fff' : 'var(--text-muted, #8b949e)' }}>
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 6, border: '1px solid #ef444455', background: '#ef444410', color: '#f87171', fontSize: 12, marginBottom: 16 }}>
            加载失败: {error}
          </div>
        )}

        <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, overflow: 'hidden' }}>
          <DataTable dataSource={filtered} rowKey="id" columns={alertColumns} loading={loading} pagination={{ pageSize: 10, showSizeChanger: false }} emptyText="暂无告警" />
        </div>

        <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>
          <Info size={14} style={{ color: 'var(--color-primary-500)' }} />
          CDS 告警来自规则引擎评估结果，确认后将在统计报表中计入响应时长。
        </div>
      </div>

      {toast.show && (
        <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'success' ? '#059669' : 'var(--color-error-600)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 1100 }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
