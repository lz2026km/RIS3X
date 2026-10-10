// ============================================================
// G005 放射科RIS系统 - 离线报告包管理 v3.0.6.11-99 Wave7B
// 报告列表「离线保存」→ IndexedDB 快照; 断网时优先展示离线副本并标注「离线副本」
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { message, Popconfirm } from 'antd'
import { FileText, Trash2, ArrowLeft, WifiOff, CheckCircle, RefreshCw } from 'lucide-react'
import { THEME_TOKENS } from '../components/common/ThemeTokens'
import { offlineStorage, type OfflineReport } from '../services/pwa/offlineStorage'
import { t } from '../i18n/appI18n'

const PRIMARY = '#1e40af'

function formatDateTime(ts?: number): string {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const STATE_LABELS: Record<string, string> = {
  PUBLISHED: t('offlineReports.state.published'), SIGNED: t('offlineReports.state.signed'), REVIEWED: t('offlineReports.state.reviewed'), SUBMITTED: t('offlineReports.state.submitted'),
  INITIAL_REVIEW: t('offlineReports.state.initialReview'), FINAL_REVIEW: t('offlineReports.state.finalReview'), AMENDED: t('offlineReports.state.amended'),
}

export default function OfflineReportsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<OfflineReport[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [preview, setPreview] = useState<OfflineReport | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await offlineStorage.listReports())
    } catch {
      setItems([])
      message.error(t('offlineReports.readFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // [fix] 刷新按钮实际重新读取离线报告并给出可见反馈
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
      message.success(t('w4cFixes.offline.refreshed'))
    } finally {
      setRefreshing(false)
    }
  }, [load])

  const handleDelete = async (r: OfflineReport) => {
    try {
      await offlineStorage.removeReport(r.id)
      setItems(prev => prev.filter(x => x.id !== r.id))
      if (preview?.id === r.id) setPreview(null)
      message.success(t('offlineReports.deleted'))
    } catch {
      message.error(t('offlineReports.deleteFailed'))
    }
  }

  const handleClearAll = async () => {
    try {
      for (const r of items) await offlineStorage.removeReport(r.id)
      setItems([])
      setPreview(null)
      message.success(t('offlineReports.cleared'))
    } catch {
      message.error(t('offlineReports.clearFailed'))
    }
  }

  return (
    <div style={{ background: 'var(--bg-primary)', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', color: '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={20} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{t('offlineReports.title')}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{t('offlineReports.savedCount', { count: items.length })}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void handleRefresh()} disabled={refreshing} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: refreshing ? 'default' : 'pointer', opacity: refreshing ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={13} /> {refreshing ? t('w4cFixes.offline.refreshing') : t('offlineReports.refresh')}
          </button>
          {items.length > 0 && (
            <Popconfirm title={t('offlineReports.clearConfirm')} okText={t('offlineReports.clear')} cancelText={t('offlineReports.cancel')} okButtonProps={{ danger: true }} onConfirm={() => void handleClearAll()}>
              <button style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trash2 size={13} /> {t('offlineReports.clear')}
              </button>
            </Popconfirm>
          )}
          <button onClick={() => navigate('/reports')} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: THEME_TOKENS.bgCard, color: PRIMARY, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArrowLeft size={13} /> {t('offlineReports.backToList')}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 20 }}>
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <WifiOff size={14} style={{ color: 'var(--color-info)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: 'var(--color-info)', lineHeight: 1.6 }}>
            {t('offlineReports.desc1')}
            {t('offlineReports.desc2')}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 13 }}>{t('offlineReports.loading')}</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
            <FileText size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 6 }}>{t('offlineReports.empty')}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('offlineReports.emptyHint')}</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {items.map(r => (
              <div key={r.id} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 14, border: '1px solid var(--border-color)', borderLeft: '4px solid #0891b2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{r.patientName || t('offlineReports.unknownPatient')}</div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: '1px solid #fcd34d' }}>{t('offlineReports.offlineCopy')}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                  {r.modality ? `${r.modality}${r.bodyPart ? ` · ${r.bodyPart}` : ''}` : '-'} · {r.reportNo || r.id}
                </div>
                {r.state && (
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                    {t('offlineReports.statusLabel')} {STATE_LABELS[r.state] ?? r.state}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>{t('offlineReports.savedAt', { time: formatDateTime(r.savedAt ?? r.updatedAt) })}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setPreview(r)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <CheckCircle size={12} /> {t('offlineReports.browse')}
                  </button>
                  <Popconfirm title={t('offlineReports.deleteConfirm')} okText={t('offlineReports.delete')} cancelText={t('offlineReports.cancel')} okButtonProps={{ danger: true }} onConfirm={() => void handleDelete(r)}>
                    <button style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #fecaca', background: 'var(--bg-card)', color: '#dc2626', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Trash2 size={12} /> {t('offlineReports.delete')}
                    </button>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 离线浏览 Modal: 展示保存时的 HTML 快照 */}
      {preview && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setPreview(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 780, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, display: 'flex', alignItems: 'center', gap: 6 }}>
                <WifiOff size={14} /> {t('offlineReports.offlineCopyDash', { name: preview.patientName || preview.id })}
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>{t('offlineReports.browse')}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setPreview(null); navigate('/reports') }} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, cursor: 'pointer' }}>{t('offlineReports.viewOnline')}</button>
                <button onClick={() => setPreview(null)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>{t('offlineReports.close')}</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {preview.htmlContent ? (
                <div dangerouslySetInnerHTML={{ __html: preview.htmlContent }} />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                  {preview.reportText || t('offlineReports.emptyReport')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
