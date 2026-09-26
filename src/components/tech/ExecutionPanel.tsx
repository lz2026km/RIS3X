// [G005 W7-Exec] 检查执行只读面板: 扫描协议 / 序列 / 曝光参数 / 序列级 QC / 剂量 + 图像数校验告警
// 供 ExamDetailView (Worklist 详情/独立页) 复用。
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Empty, Spin, Tag } from 'antd'
import { Activity, AlertTriangle, CheckCircle2, Layers, ScanLine, ShieldCheck } from 'lucide-react'
import { t } from '../../i18n/appI18n'
import {
  execApi,
  type ExamExecutionSummaryDto,
  type SeriesQcRecordDto,
} from '../../services/api/execApi'

function fmtExposure(params?: Record<string, unknown>): string {
  if (!params) return '--'
  const parts: string[] = []
  if (params.kVp !== undefined) parts.push(`kVp ${params.kVp}`)
  if (params.mAs !== undefined) parts.push(`mAs ${params.mAs}`)
  if (params.aec !== undefined) parts.push(`AEC ${params.aec ? 'on' : 'off'}`)
  if (params.rotationTime !== undefined) parts.push(`Rota ${params.rotationTime}s`)
  if (params.pitch !== undefined) parts.push(`Pitch ${params.pitch}`)
  if (params.thickness !== undefined) parts.push(`Thk ${params.thickness}`)
  return parts.length > 0 ? parts.join(' · ') : '--'
}

const sectionTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#1e40af',
  marginBottom: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const panelStyle: CSSProperties = {
  background: 'var(--content-bg)',
  borderRadius: 10,
  padding: 14,
}

export interface ExecutionPanelProps {
  examId: string
  accessionNumber?: string
  testId?: string
}

export function ExecutionPanel({ examId, accessionNumber, testId = 'execution-panel' }: ExecutionPanelProps) {
  const [data, setData] = useState<ExamExecutionSummaryDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    execApi.getExamExecution(examId)
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data) {
          setData(res.data)
          setError(null)
        } else {
          setError(res.error?.message ?? t('w7exec.loadFailed'))
        }
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : t('w7exec.loadFailed')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [examId])

  const rejectCount = useMemo(
    () => (data?.seriesQc ?? []).filter((q: SeriesQcRecordDto) => q.quality === 'REJECT').length,
    [data],
  )

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center' }} data-testid={`${testId}-loading`}><Spin tip={t('w7exec.loading')} /></div>
  }
  if (error || !data) {
    return <Empty description={error ?? t('w7exec.empty')} style={{ padding: 24 }} data-testid={`${testId}-empty`} />
  }

  const validation = data.validation
  return (
    <div data-testid={testId}>
      {validation.expectedImages > 0 && (
        <div
          data-testid={`${testId}-mismatch`}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', borderRadius: 8,
            background: validation.imageCountMismatch ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${validation.imageCountMismatch ? '#fecaca' : '#bbf7d0'}`,
            color: validation.imageCountMismatch ? '#dc2626' : '#059669',
            fontSize: 12, fontWeight: 600,
          }}
        >
          {validation.imageCountMismatch ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
          {validation.imageCountMismatch ? t('w7exec.imageCountMismatch') : t('w7exec.imageCountMatch')}
          <span style={{ marginLeft: 'auto', fontWeight: 400 }}>
            {t('w7exec.expectedImages')} {validation.expectedImages} / {t('w7exec.capturedImages')} {validation.capturedImages}
            {validation.delta !== 0 ? ` (Δ${validation.delta > 0 ? '+' : ''}${validation.delta})` : ''}
          </span>
        </div>
      )}

      <div style={{ marginBottom: 20 }} data-testid={`${testId}-protocol`}>
        <div style={sectionTitle}><ScanLine size={14} />{t('w7exec.protocol')}</div>
        <div style={panelStyle}>
          {data.protocol || data.state.protocolId ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{data.protocol?.name ?? data.state.protocolName ?? data.state.protocolId}</span>
                <Tag color="geekblue">{data.protocol?.modality ?? '--'}</Tag>
                {data.protocol?.code && <Tag>{data.protocol.code}</Tag>}
                <Tag color={(data.protocol?.contrast ?? false) ? 'volcano' : 'default'}>
                  {(data.protocol?.contrast ?? false) ? t('w7exec.contrastYes') : t('w7exec.contrastNo')}
                </Tag>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                <div>{t('w7exec.exposureParams')}: <b>{fmtExposure(data.state.exposureParams as Record<string, unknown> | undefined)}</b></div>
                <div>{t('w7exec.scanRange')}: <b>{data.state.scanRange?.orientation ?? '--'}</b></div>
                <div>{t('w7exec.expectedSeries')}: <b>{validation.expectedSeries}</b> · {t('w7exec.capturedSeries')}: <b>{validation.capturedSeries}</b></div>
                <div>{t('w7exec.contrastProtocol')}: <b>{data.state.contrastProtocolId ?? '--'}</b></div>
              </div>
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('w7exec.protocolNone')}</span>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 20 }} data-testid={`${testId}-series`}>
        <div style={sectionTitle}><Layers size={14} />{t('w7exec.series')} <Tag color="blue">{data.series.length}</Tag></div>
        <div style={panelStyle}>
          {data.series.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('w7exec.empty')}</span>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '4px 8px' }}>{t('w7exec.seriesNumber')}</th>
                  <th style={{ padding: '4px 8px' }}>{t('w7exec.seriesDescription')}</th>
                  <th style={{ padding: '4px 8px' }}>{t('w7exec.imageCount')}</th>
                  <th style={{ padding: '4px 8px' }}>{t('w7exec.exposureParams')}</th>
                </tr>
              </thead>
              <tbody>
                {data.series.map((s) => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>#{s.seriesNumber}</td>
                    <td style={{ padding: '6px 8px' }}>{s.description}</td>
                    <td style={{ padding: '6px 8px' }}>{s.imageCount}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{fmtExposure(s.exposureParams as Record<string, unknown> | undefined)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 20 }} data-testid={`${testId}-qc`}>
        <div style={sectionTitle}><ShieldCheck size={14} />{t('w7exec.seriesQc')} <Tag color={rejectCount > 0 ? 'red' : 'green'}>{data.qcSummary.passed}/{data.qcSummary.total}</Tag></div>
        <div style={panelStyle}>
          {data.seriesQc.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('w7exec.qcNone')}</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.seriesQc.map((q) => (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }} data-testid={`${testId}-qc-${q.seriesNumber}`}>
                  <Tag color={q.quality === 'PASS' ? 'green' : 'red'}>#{q.seriesNumber} {q.quality === 'PASS' ? t('w7exec.qcPassed') : t('w7exec.qcRejected')}</Tag>
                  {q.score !== undefined && <span>{t('w7exec.qcScore')}: {q.score}</span>}
                  {q.reason && <span style={{ color: 'var(--text-secondary)' }}>{q.reason}</span>}
                  <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>{q.scoredBy ?? '--'} · {String(q.scoredAt).slice(0, 19).replace('T', ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 20 }} data-testid={`${testId}-dose`}>
        <div style={sectionTitle}><Activity size={14} />{t('w7exec.dose')}</div>
        <div style={panelStyle}>
          {data.dose ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 12 }}>
              <div><div style={{ color: 'var(--text-secondary)' }}>{t('w7exec.doseDlp')}</div><div style={{ fontWeight: 700 }}>{data.dose.dlp} mGy·cm</div></div>
              <div><div style={{ color: 'var(--text-secondary)' }}>{t('w7exec.doseCtdiVol')}</div><div style={{ fontWeight: 700 }}>{data.dose.ctdiVol} mGy</div></div>
              <div><div style={{ color: 'var(--text-secondary)' }}>{t('w7exec.doseSsde')}</div><div style={{ fontWeight: 700 }}>{data.dose.ssde ?? '--'}</div></div>
              <div><div style={{ color: 'var(--text-secondary)' }}>{t('w7exec.doseSource')}</div><div style={{ fontWeight: 700 }}>{data.dose.source}</div></div>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }} data-testid={`${testId}-dose-none`}>{t('w7exec.doseNone')}</span>
          )}
        </div>
      </div>

      {accessionNumber && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('w7exec.accession')}: {accessionNumber}</div>
      )}
    </div>
  )
}

export default ExecutionPanel
