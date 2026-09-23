// [G005 W2-C] 报告审计轨迹 Drawer
// reportApi.auditTrail → 修订历史 (事件时间线) 展示
import { reportApi } from '../../services/api'
import { ErrorBanner } from '../../components/feedback'
import type { RadiologyReport } from '../../types'
import { PRIMARY, GRAY } from './reportUtils'
import { Drawer, Empty, Spin, Tag } from 'antd'
import { History, User, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Inbox } from 'lucide-react'
import { t } from '../../i18n/appI18n'

export interface AuditTrailEvent {
  id?: string
  timestamp?: string
  actor?: string
  action?: string
  fromState?: string
  toState?: string
  reason?: string
}

export interface ReportAuditTrailDrawerProps {
  report: RadiologyReport | null
  onClose: () => void
}

const STATE_COLORS: Record<string, string> = {
  WITHDRAWN: '#dc2626',
  REJECTED: '#dc2626',
  PUBLISHED: '#059669',
  SIGNED: '#059669',
  REVIEWED: '#2563eb',
  SUBMITTED: '#7c3aed',
  AMENDED: '#d97706',
  AMENDING: '#d97706',
}

function formatTime(ts?: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

export default function ReportAuditTrailDrawer({ report, onClose }: ReportAuditTrailDrawerProps) {
  const [events, setEvents] = useState<AuditTrailEvent[]>([])
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    setLoaded(false)
    setFailed(null)
    setEvents([])
    if (!report) return
    void (async () => {
      try {
        const res = await reportApi.auditTrail(report.id)
        if (!res.success) {
          setEvents([])
          setFailed(res.error?.message ?? null)
          return
        }
        // MSW 返回裸数组 / 后端返回 { events } 双形状兼容
        const d = res.data as unknown
        const list = Array.isArray(d) ? d : (d as { events?: unknown })?.events
        setEvents(Array.isArray(list) ? (list as AuditTrailEvent[]) : [])
        setFailed(null)
      } catch {
        setEvents([])
        setFailed('审计轨迹加载失败')
      } finally {
        setLoaded(true)
      }
    })()
  }, [report?.id, reloadTick])

  return (
    <Drawer
      open={!!report}
      onClose={onClose}
      width={520}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={16} color={PRIMARY} />
          审计轨迹 {report ? `· ${report.reportId || report.id}` : ''}
        </span>
      }
    >
      <Spin spinning={!loaded}>
        {failed && <ErrorBanner message={failed} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
        {loaded && events.length === 0 && !failed ? (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无修订记录" />
        ) : (
          <div style={{ position: 'relative', paddingLeft: 20 }}>
            {events.map((e, i) => (
              <div key={e.id ?? i} style={{ position: 'relative', paddingBottom: 20 }}>
                <div style={{
                  position: 'absolute', left: -20, top: 4, width: 10, height: 10, borderRadius: '50%',
                  background: STATE_COLORS[(e.toState ?? '').toUpperCase()] ?? '#94a3b8',
                  border: '2px solid var(--bg-card)', boxShadow: '0 0 0 1px var(--border-color)',
                }} />
                {i < events.length - 1 && (
                  <div style={{ position: 'absolute', left: -16, top: 16, bottom: 0, width: 1, background: 'var(--border-color)' }} />
                )}
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {e.action || `${e.fromState ?? '?'} → ${e.toState ?? '?'}`}
                </div>
                <div style={{ fontSize: 12, color: GRAY, marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {e.timestamp && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{formatTime(e.timestamp)}</span>}
                  {e.actor && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={11} />{e.actor}</span>}
                </div>
                {e.fromState && e.toState && (
                  <div style={{ marginTop: 4 }}>
                    <Tag color={STATE_COLORS[e.fromState.toUpperCase()] ?? 'default'} style={{ fontSize: 11, marginRight: 4 }}>{e.fromState}</Tag>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>→</span>
                    <Tag color={STATE_COLORS[e.toState.toUpperCase()] ?? 'default'} style={{ fontSize: 11, marginLeft: 4 }}>{e.toState}</Tag>
                  </div>
                )}
                {e.reason && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#64748b', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                    原因: {e.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Spin>
    </Drawer>
  )
}
