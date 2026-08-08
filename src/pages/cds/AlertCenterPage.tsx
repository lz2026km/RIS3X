// [G005 W2-B] CDS 告警中心: listAlerts / acknowledgeAlert
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Bell, CheckCircle2, RefreshCw, Info } from 'lucide-react'
import { cdsApi, type CdsAlertDto } from '../../services/api/cdsApi'

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  warning: '#f59e0b',
  medium: '#f59e0b',
  info: '#3b82f6',
  low: '#3b82f6',
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

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Bell size={24} />
          <span style={{ fontSize: 20, fontWeight: 600 }}>CDS 告警中心</span>
          {pendingCount > 0 && (
            <span style={{ padding: '2px 10px', borderRadius: 999, background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 600 }}>
              {pendingCount} 条待确认
            </span>
          )}
        </div>
        <button onClick={() => { fetchAlerts() }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <RefreshCw size={14} />刷新
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {([['all', '全部'], ['pending', '待确认'], ['acknowledged', '已确认']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setStatusFilter(key)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: statusFilter === key ? '#1e40af' : '#21262d', color: statusFilter === key ? '#fff' : '#8b949e' }}>
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 6, border: '1px solid #ef444455', background: '#ef444410', color: '#f87171', fontSize: 13, marginBottom: 16 }}>
            加载失败: {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: '#6e7681', fontSize: 13 }}>加载告警列表...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: '#6e7681', fontSize: 13 }}>暂无告警</div>
          ) : (
            filtered.map((alert) => {
              const severityColor = SEVERITY_COLORS[alert.severity?.toLowerCase()] || '#8b949e'
              const pending = alert.status === 'pending'
              return (
                <div key={alert.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: severityColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{alert.patientName || '未知患者'}</span>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: `${severityColor}20`, color: severityColor }}>{SEVERITY_LABELS[alert.severity?.toLowerCase()] || alert.severity}</span>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: '#21262d', color: '#8b949e' }}>{alert.type || '通用告警'}</span>
                      <span style={{ fontSize: 12, color: '#6e7681' }}>{alert.id}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#c9d1d9' }}>{alert.message || '-'}</div>
                    <div style={{ fontSize: 12, color: '#6e7681', marginTop: 4 }}>
                      {alert.time ? new Date(alert.time).toLocaleString('zh-CN') : '-'}
                      {pending ? ' · 待确认' : ' · 已确认'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {pending ? (
                      <button onClick={() => handleAcknowledge(alert)} disabled={acknowledgingId === alert.id} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={14} />{acknowledgingId === alert.id ? '确认中...' : '确认'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={13} />已处理
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div style={{ marginTop: 20, padding: '12px 16px', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#8b949e' }}>
          <Info size={14} style={{ color: '#3b82f6' }} />
          CDS 告警来自规则引擎评估结果，确认后将在统计报表中计入响应时长。
        </div>
      </div>

      {toast.show && (
        <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'success' ? '#059669' : '#dc2626', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 1100 }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
