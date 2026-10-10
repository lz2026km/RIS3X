import type { OperationLog } from './types'
import { PRIMARY, ACCENT, SUCCESS, WARNING, DANGER, GRAY, WHITE, ACTION_COLORS } from './constants'
import { formatDateTime } from './utils'
import { History, X, Globe, MonitorSmartphone, Shield, AlertTriangle, AlertCircle } from 'lucide-react'
import { t } from '../../i18n/appI18n'

interface LogDetailProps {
  log: OperationLog | null
  onClose: () => void
}

function renderDiff(log: OperationLog) {
  if (!log.beforeData && !log.afterData) {
    return <div style={{ color: 'var(--text-muted, #64748b)', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>{t('logDetail.noDataCompare')}</div>
  }

  return (
    <div style={{ marginTop: 'var(--space-3, 12px)' }}>
      <div style={{ fontWeight: 600, color: PRIMARY, marginBottom: 'var(--space-2, 8px)', fontSize: 12 }}>{t('logDetail.dataCompare')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
        <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: 'var(--color-error-bg)', padding: '8px 12px', fontWeight: 600, fontSize: 12, color: DANGER, borderBottom: '1px solid #fecaca' }}>
            {t('logDetail.beforeEdit')}
          </div>
          <pre style={{ margin: 0, padding: 'var(--space-3, 12px)', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--color-error-bg)', color: '#991b1b', lineHeight: 1.6 }}>
            {log.beforeData || t('logDetail.emptyCell')}
          </pre>
        </div>
        <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#ecfdf5', padding: '8px 12px', fontWeight: 600, fontSize: 12, color: SUCCESS, borderBottom: '1px solid #a7f3d0' }}>
            {t('logDetail.afterEdit')}
          </div>
          <pre style={{ margin: 0, padding: 'var(--space-3, 12px)', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#ecfdf5', color: '#065f46', lineHeight: 1.6 }}>
            {log.afterData || t('logDetail.emptyCell')}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default function LogDetail({ log, onClose }: LogDetailProps) {
  if (!log) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: WHITE, borderRadius: 12, width: '90%', maxWidth: 800,
        maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          background: PRIMARY, padding: '16px 20px', borderRadius: '12px 12px 0 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <History size={20} color={WHITE} />
            <span style={{ color: WHITE, fontSize: 16, fontWeight: 600 }}>{t('logDetail.title')}</span>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6,
            padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}>
            <X size={18} color={WHITE} />
          </button>
        </div>

        <div style={{ padding: 'var(--space-5, 20px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-5, 20px)' }}>
            <div style={{ background: 'var(--bg-card)', padding: 'var(--space-3, 12px)', borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)' }}>
              <div style={{ color: GRAY, fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>{t('logDetail.logId')}</div>
              <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{log.id}</div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: 'var(--space-3, 12px)', borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)' }}>
              <div style={{ color: GRAY, fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>{t('logDetail.opTime')}</div>
              <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{formatDateTime(log.timestamp)}</div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: 'var(--space-3, 12px)', borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)' }}>
              <div style={{ color: GRAY, fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>{t('logDetail.opType')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  background: `${ACTION_COLORS[log.action] || ACCENT}20`,
                  color: ACTION_COLORS[log.action] || ACCENT,
                  padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                }}>
                  {log.action}
                </span>
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: 'var(--space-3, 12px)', borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)' }}>
              <div style={{ color: GRAY, fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>{t('logDetail.opUser')}</div>
              <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{log.userName}</div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: 'var(--space-3, 12px)', borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)' }}>
              <div style={{ color: GRAY, fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>{t('logDetail.userId')}</div>
              <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{log.userId}</div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: 'var(--space-3, 12px)', borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)' }}>
              <div style={{ color: GRAY, fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>{t('logDetail.opModule')}</div>
              <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{log.module}</div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: 'var(--space-4, 16px)', borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)', marginBottom: 'var(--space-4, 16px)' }}>
            <div style={{ fontWeight: 600, color: PRIMARY, marginBottom: 10, fontSize: 12 }}>{t('logDetail.opTarget')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-3, 12px)' }}>
              <div>
                <div style={{ color: GRAY, fontSize: 12, marginBottom: 2 }}>{t('logDetail.targetId')}</div>
                <div style={{ color: PRIMARY, fontSize: 12 }}>{log.targetId}</div>
              </div>
              <div>
                <div style={{ color: GRAY, fontSize: 12, marginBottom: 2 }}>{t('logDetail.targetDesc')}</div>
                <div style={{ color: PRIMARY, fontSize: 12 }}>{log.targetDesc}</div>
              </div>
            </div>
            {log.patientId && (
              <div style={{ marginTop: 'var(--space-2, 8px)' }}>
                <div style={{ color: GRAY, fontSize: 12, marginBottom: 2 }}>{t('logDetail.patientId')}</div>
                <div style={{ color: PRIMARY, fontSize: 12 }}>{log.patientId}</div>
              </div>
            )}
          </div>

          <div style={{ background: 'var(--bg-card)', padding: 'var(--space-4, 16px)', borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)', marginBottom: 'var(--space-4, 16px)' }}>
            <div style={{ fontWeight: 600, color: PRIMARY, marginBottom: 10, fontSize: 12 }}>{t('logDetail.envInfo')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <Globe size={14} color={GRAY} />
                <div>
                  <div style={{ color: GRAY, fontSize: 12 }}>{t('logDetail.ipAddress')}</div>
                  <div style={{ color: PRIMARY, fontSize: 12 }}>{log.ipAddress}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <MonitorSmartphone size={14} color={GRAY} />
                <div>
                  <div style={{ color: GRAY, fontSize: 12 }}>{t('logDetail.device')}</div>
                  <div style={{ color: PRIMARY, fontSize: 12 }}>{log.device}</div>
                </div>
              </div>
            </div>
          </div>

          {log.complianceLevel && (
            <div style={{
              background: log.complianceLevel === 'critical' ? 'var(--color-error-bg)' : log.complianceLevel === 'warning' ? '#fffbeb' : '#ecfdf5',
              padding: 'var(--space-4, 16px)', borderRadius: 8,
              border: `1px solid ${log.complianceLevel === 'critical' ? '#fecaca' : log.complianceLevel === 'warning' ? '#fde68a' : '#a7f3d0'}`,
              marginBottom: 'var(--space-4, 16px)'
            }}>
              <div style={{ fontWeight: 600, color: PRIMARY, marginBottom: 10, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={16} />
                {t('logDetail.hipaaStatus')}
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                  background: log.complianceLevel === 'critical' ? `${DANGER}20` : log.complianceLevel === 'warning' ? `${WARNING}20` : `${SUCCESS}20`,
                  color: log.complianceLevel === 'critical' ? DANGER : log.complianceLevel === 'warning' ? WARNING : SUCCESS,
                }}>
                  {log.complianceLevel === 'critical' ? t('logDetail.violation') : log.complianceLevel === 'warning' ? t('logDetail.warning') : t('logDetail.compliant')}
                </span>
              </div>
              {log.complianceAlerts && log.complianceAlerts.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {log.complianceAlerts.map((alert, idx) => (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)',
                      color: alert.level === 'critical' ? DANGER : WARNING,
                      fontSize: 12
                    }}>
                      {alert.level === 'critical' ? <AlertTriangle size={14} /> : <AlertCircle size={14} />}
                      {alert.message}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: SUCCESS, fontSize: 12 }}>{t('logDetail.noViolation')}</div>
              )}
            </div>
          )}

          {renderDiff(log)}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 6, border: '1px solid var(--border-color, #e2e8f0)',
            background: WHITE, color: GRAY, fontSize: 12, cursor: 'pointer',
          }}>
            {t('common.action.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
