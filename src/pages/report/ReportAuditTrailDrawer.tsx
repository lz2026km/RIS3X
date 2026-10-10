// [G005 W2-C] 报告审计轨迹 Drawer
// reportApi.auditTrail → 修订历史 (事件时间线) 展示
import { reportApi } from '../../services/api'
import type { ReportSignatureDto, ReportSignatureVerificationDto } from '../../services/api/reportApi'
import { ErrorBanner } from '../../components/feedback'
import type { RadiologyReport } from '../../types'
import { PRIMARY, GRAY } from './reportUtils'
import { Button, Drawer, Empty, Spin, Tag } from 'antd'
import { History, User, Clock, ShieldCheck, BadgeCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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
  WITHDRAWN: 'var(--color-error-600)',
  REJECTED: 'var(--color-error-600)',
  PUBLISHED: '#059669',
  SIGNED: '#059669',
  REVIEWED: 'var(--color-primary-600)',
  SUBMITTED: '#7c3aed',
  AMENDED: 'var(--color-warning-600)',
  AMENDING: 'var(--color-warning-600)',
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
  // [G005 W8-Report] 数据签名状态 + 验签
  const [signature, setSignature] = useState<ReportSignatureDto | null>(null)
  const [verifyResult, setVerifyResult] = useState<ReportSignatureVerificationDto | null>(null)
  const [verifying, setVerifying] = useState(false)

  const loadSignature = useCallback(async (id: string) => {
    try {
      const res = await reportApi.getSignature(id)
      if (res.success && res.data) {
        setSignature(res.data.signature)
        setVerifyResult(null)
      }
    } catch {
      setSignature(null)
    }
  }, [])

  const handleVerify = async () => {
    if (!report) return
    setVerifying(true)
    try {
      const res = await reportApi.verifySignature(report.id)
      if (res.success && res.data) setVerifyResult(res.data)
    } catch {
      setVerifyResult(null)
    } finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    setLoaded(false)
    setFailed(null)
    setEvents([])
    setVerifyResult(null)
    if (!report) { setSignature(null); return }
    void loadSignature(report.id)
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
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
          <History size={16} color={PRIMARY} />
          审计轨迹 {report ? `· ${report.reportId || report.id}` : ''}
        </span>
      }
    >
      {/* [G005 W8-Report] 数据签名与证书 */}
      <div style={{ marginBottom: 'var(--space-4, 16px)', padding: 'var(--space-3, 12px)', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-2, 8px)', fontSize: 12, fontWeight: 700, color: 'var(--color-info-600)' }}>
          <ShieldCheck size={14} /> {t('w8Report.sig.panelTitle')}
        </div>
        {signature ? (
          <div style={{ fontSize: 12, display: 'grid', gap: 'var(--space-1, 4px)' }}>
            <div>{t('w8Report.sig.algorithm')}: <Tag color={signature.algorithm === 'SM3' ? 'purple' : 'blue'} style={{ marginInlineEnd: 0 }}>{signature.algorithm}</Tag></div>
            <div>{t('w8Report.sig.digest')}: <code style={{ fontSize: 11 }}>{signature.digest.slice(0, 40)}…</code></div>
            <div>{t('w8Report.sig.certificate')}: {signature.certificateSerial}</div>
            <div>{t('w8Report.sig.signedBy')}: {signature.signedById} · {signature.signedAt.slice(0, 19).replace('T', ' ')}</div>
            <div>{t('w8Report.sig.status')}: <Tag color={signature.status === 'valid' ? 'green' : signature.status === 'superseded' ? 'orange' : 'red'} style={{ marginInlineEnd: 0 }}>{t(`w8Report.sig.status.${signature.status}`)}</Tag></div>
            <div style={{ marginTop: 'var(--space-1, 4px)' }}>
              <Button size="small" type="primary" ghost loading={verifying} icon={<BadgeCheck size={12} />} onClick={() => void handleVerify()}>{t('w8Report.sig.verify')}</Button>
            </div>
            {verifyResult && (
              <div style={{ marginTop: 6, padding: 'var(--space-2, 8px)', borderRadius: 6, background: verifyResult.valid ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: verifyResult.valid ? 'var(--color-success)' : '#92400e' }}>
                <div style={{ fontWeight: 700 }}>{verifyResult.valid ? t('w8Report.sig.verifyPass') : t('w8Report.sig.verifyFail')}</div>
                <div style={{ fontSize: 11 }}>
                  {t('w8Report.sig.digestMatch')}: {String(verifyResult.digestMatch)} · {t('w8Report.sig.certValid')}: {String(verifyResult.certificateValid)} · {t('w8Report.sig.notRevoked')}: {String(verifyResult.notRevoked)} · {t('w8Report.sig.tsaValid')}: {String(verifyResult.tsaValid)}
                </div>
                {verifyResult.reasons.length > 0 && <div style={{ fontSize: 11, marginTop: 2 }}>{verifyResult.reasons.join('; ')}</div>}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: GRAY }}>{t('w8Report.sig.noSignature')}</div>
        )}
      </div>

      <Spin spinning={!loaded}>
        {failed && <ErrorBanner message={failed} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
        {loaded && events.length === 0 && !failed ? (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无修订记录" />
        ) : (
          <div style={{ position: 'relative', paddingLeft: 'var(--space-5, 20px)' }}>
            {events.map((e, i) => (
              <div key={e.id ?? i} style={{ position: 'relative', paddingBottom: 'var(--space-5, 20px)' }}>
                <div style={{
                  position: 'absolute', left: -20, top: 4, width: 10, height: 10, borderRadius: '50%',
                  background: STATE_COLORS[(e.toState ?? '').toUpperCase()] ?? '#94a3b8',
                  border: '2px solid var(--bg-card)', boxShadow: '0 0 0 1px var(--border-color)',
                }} />
                {i < events.length - 1 && (
                  <div style={{ position: 'absolute', left: -16, top: 16, bottom: 0, width: 1, background: 'var(--border-color)' }} />
                )}
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {e.action || `${e.fromState ?? '?'} → ${e.toState ?? '?'}`}
                </div>
                <div style={{ fontSize: 12, color: GRAY, marginTop: 2, display: 'flex', gap: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
                  {e.timestamp && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}><Clock size={11} />{formatTime(e.timestamp)}</span>}
                  {e.actor && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}><User size={11} />{e.actor}</span>}
                </div>
                {e.fromState && e.toState && (
                  <div style={{ marginTop: 'var(--space-1, 4px)' }}>
                    <Tag color={STATE_COLORS[e.fromState.toUpperCase()] ?? 'default'} style={{ fontSize: 11, marginRight: 'var(--space-1, 4px)' }}>{e.fromState}</Tag>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>→</span>
                    <Tag color={STATE_COLORS[e.toState.toUpperCase()] ?? 'default'} style={{ fontSize: 11, marginLeft: 'var(--space-1, 4px)' }}>{e.toState}</Tag>
                  </div>
                )}
                {e.reason && (
                  <div style={{ marginTop: 'var(--space-1, 4px)', fontSize: 12, color: '#64748b', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)' }}>
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
