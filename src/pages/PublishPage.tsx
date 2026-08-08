/**
 * G005 RIS - 报告发布页面 v3.0.4.0
 * 已签发 → 已发布
 * v3.0.4.0: 强制每条报告单独输入质量分 + 确认弹窗，禁止一键发布全部
 */
import { useState, useEffect } from 'react'
import { useReportStore } from '../store'
import { reportApi } from '../services/api'
import type { ReportDto } from '../services/api'

const MIN_QUALITY_SCORE = 60

export default function PublishPage() {
  const [reports, setReports] = useState<ReportDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [qualityScores, setQualityScores] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState<{ id: string; report: ReportDto; score: number } | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await reportApi.list({ status: '已签发' })
        // [G005 P1] 列表双形状兼容: MSW 裸数组 / 后端 { items, total }
        const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
        if (res.success && Array.isArray(list)) {
          setReports(list as ReportDto[])
        } else {
          setError(res.error?.message ?? '加载已签发报告失败')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '网络错误')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handlePublishClick = (report: ReportDto) => {
    const raw = qualityScores[report.id] ?? ''
    const score = Number(raw)
    if (raw.trim() === '' || Number.isNaN(score)) {
      setError(`请先为报告 ${report.reportId} 输入有效的质量分`)
      return
    }
    if (score < MIN_QUALITY_SCORE) {
      setError(`质量分 ${score} 低于最低阈值 ${MIN_QUALITY_SCORE},无法发布`)
      return
    }
    setError(null)
    setConfirming({ id: report.id, report, score })
  }

  const handleConfirmPublish = async () => {
    if (!confirming) return
    const { id, score } = confirming
    setConfirming(null)
    setPublishing(id)
    try {
      await useReportStore.getState().publish(id, score)
      setReports((prev) => prev.filter((r) => r.id !== id))
      setQualityScores((prev) => {
        const { [id]: _drop, ...rest } = prev
        void _drop
        return rest
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '发布失败')
    } finally {
      setPublishing(null)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e40af', margin: 0 }}>
          报告发布管理
        </h1>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          已签发报告需录入质量分(≥ {MIN_QUALITY_SCORE})后逐条确认发布,防止误操作批量上发布队列。
        </p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 12, padding: '8px 14px', background: '#fee2e2',
            border: '1px solid #fca5a5', color: '#7f1d1d', borderRadius: 6, fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>加载中...</div>}

      {!loading && reports.length === 0 && (
        <div
          data-testid="publish-empty"
          style={{
            textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 14,
            background: '#fff', borderRadius: 8, border: '1px dashed #cbd5e1',
          }}
        >
          暂无待发布的已签发报告
        </div>
      )}

      {reports.map((r) => {
        const raw = qualityScores[r.id] ?? ''
        const score = Number(raw)
        const scoreValid = raw.trim() !== '' && !Number.isNaN(score) && score >= MIN_QUALITY_SCORE
        return (
          <div
            key={r.id}
            data-testid={`publish-row-${r.id}`}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', marginBottom: 12, background: '#fff', borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)', gap: 16,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.patientName}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                {r.modality} · {r.bodyPart} · {r.reportId}
              </div>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#475569' }}>
              质量分(≥ {MIN_QUALITY_SCORE})
              <input
                type="number"
                min={0}
                max={100}
                value={raw}
                data-testid={`publish-score-${r.id}`}
                onChange={(e) => setQualityScores((prev) => ({ ...prev, [r.id]: e.target.value }))}
                style={{
                  width: 96, padding: '6px 8px', border: '1px solid #cbd5e1',
                  borderRadius: 4, fontSize: 13, color: '#0f172a',
                }}
                placeholder="0-100"
              />
            </label>
            <button
              onClick={() => handlePublishClick(r)}
              disabled={publishing === r.id || !scoreValid}
              title={!scoreValid ? `请录入 ≥ ${MIN_QUALITY_SCORE} 的质量分` : '发布该报告'}
              style={{
                padding: '6px 16px',
                background: publishing === r.id || !scoreValid ? '#94a3b8' : '#059669',
                color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600,
                cursor: publishing === r.id || !scoreValid ? 'not-allowed' : 'pointer',
              }}
            >
              {publishing === r.id ? '发布中...' : '发布'}
            </button>
          </div>
        )
      })}

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="publish-confirm"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 420, maxWidth: '90%' }}>
            <h2 style={{ margin: 0, fontSize: 16, color: '#1e293b' }}>确认发布报告</h2>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginTop: 12 }}>
              报告号 <strong>{confirming.report.reportId}</strong> · 患者 <strong>{confirming.report.patientName}</strong>
              <br />
              质量分 <strong>{confirming.score}</strong> 已通过阈值校验,确认发布到队列?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setConfirming(null)}
                style={{
                  padding: '6px 14px', background: '#e2e8f0', color: '#1e293b',
                  border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={handleConfirmPublish}
                style={{
                  padding: '6px 14px', background: '#059669', color: '#fff',
                  border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                确认发布
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
