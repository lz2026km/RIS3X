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

const PRIMARY = '#1e40af'

function formatDateTime(ts?: number): string {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const STATE_LABELS: Record<string, string> = {
  PUBLISHED: '已发布', SIGNED: '已签发', REVIEWED: '已审核', SUBMITTED: '审核中',
  INITIAL_REVIEW: '初审中', FINAL_REVIEW: '终审中', AMENDED: '已修订',
}

export default function OfflineReportsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<OfflineReport[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<OfflineReport | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await offlineStorage.listReports())
    } catch {
      setItems([])
      message.error('离线包读取失败: IndexedDB 不可用')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleDelete = async (r: OfflineReport) => {
    try {
      await offlineStorage.removeReport(r.id)
      setItems(prev => prev.filter(x => x.id !== r.id))
      if (preview?.id === r.id) setPreview(null)
      message.success('离线副本已删除')
    } catch {
      message.error('删除失败: IndexedDB 不可用')
    }
  }

  const handleClearAll = async () => {
    try {
      for (const r of items) await offlineStorage.removeReport(r.id)
      setItems([])
      setPreview(null)
      message.success('离线包已清空')
    } catch {
      message.error('清空失败: IndexedDB 不可用')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)', color: '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={20} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>离线报告包</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>已保存 {items.length} 份 · 断网可离线浏览</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void load()} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={13} /> 刷新
          </button>
          {items.length > 0 && (
            <Popconfirm title="清空全部离线副本？" okText="清空" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => void handleClearAll()}>
              <button style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trash2 size={13} /> 清空
              </button>
            </Popconfirm>
          )}
          <button onClick={() => navigate('/reports')} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: THEME_TOKENS.bgCard, color: PRIMARY, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArrowLeft size={13} /> 返回报告列表
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 20 }}>
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <WifiOff size={14} style={{ color: 'var(--color-info)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: 'var(--color-info)', lineHeight: 1.6 }}>
            离线副本由「报告列表 → 行操作 离线保存」生成，存储于本机浏览器 IndexedDB。
            断网时可在本页浏览已保存报告；在线时报告详情页也会标注「离线副本」存在。
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 13 }}>加载中...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
            <FileText size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 6 }}>暂无离线报告</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>前往「报告列表」点击行内 保存 图标即可生成离线副本</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {items.map(r => (
              <div key={r.id} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 14, border: '1px solid var(--border-color)', borderLeft: '4px solid #0891b2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{r.patientName || '未知患者'}</div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: '1px solid #fcd34d' }}>离线副本</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                  {r.modality ? `${r.modality}${r.bodyPart ? ` · ${r.bodyPart}` : ''}` : '-'} · {r.reportNo || r.id}
                </div>
                {r.state && (
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                    状态: {STATE_LABELS[r.state] ?? r.state}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>保存于 {formatDateTime(r.savedAt ?? r.updatedAt)}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setPreview(r)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <CheckCircle size={12} /> 离线浏览
                  </button>
                  <Popconfirm title="删除该离线副本？" okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => void handleDelete(r)}>
                    <button style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #fecaca', background: 'var(--bg-card)', color: '#dc2626', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Trash2 size={12} /> 删除
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
                <WifiOff size={14} /> 离线副本 — {preview.patientName || preview.id}
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>离线浏览</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setPreview(null); navigate('/reports') }} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, cursor: 'pointer' }}>在线查看该报告</button>
                <button onClick={() => setPreview(null)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>关闭</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {preview.htmlContent ? (
                <div dangerouslySetInnerHTML={{ __html: preview.htmlContent }} />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                  {preview.reportText || '(空报告)'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
