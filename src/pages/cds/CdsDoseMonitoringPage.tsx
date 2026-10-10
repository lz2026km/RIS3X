// [G005 W2-B] CDS 剂量监测: getDoseMonitoring (监测记录 + 阈值)
// [G005 Wave1B] DTO 兼容: 后端返回 { data: [auditLog] } (backend cds.service getDoseMonitoring),
//               页面期望 { records, thresholds } → normalize 兼容三种形状, 修复空数据
import { useState, useEffect, useCallback } from 'react'
import { Gauge, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react'
import { cdsApi, type CdsDoseMonitoringDto } from '../../services/api/cdsApi'
import { DataTable } from '../../components/common/DataTable'
import { t } from '../../i18n/appI18n'

function normalize(res: { success: boolean; data: CdsDoseMonitoringDto | null }): CdsDoseMonitoringDto {
  if (res.success && res.data) {
    const d = res.data as CdsDoseMonitoringDto & { data?: CdsDoseMonitoringDto | any[] }
    // 形状 1: { records, thresholds } (MSW)
    if (Array.isArray(d.records)) return d
    // 形状 2: { data: { records, thresholds } }
    if (d.data && !Array.isArray(d.data) && Array.isArray((d.data as CdsDoseMonitoringDto).records)) {
      return d.data as CdsDoseMonitoringDto
    }
    // 形状 3: { data: [auditLog...] } (后端真实形状, auditLog.detail 为 JSON 负载) → 条目映射为记录
    if (Array.isArray(d.data) && d.data.length > 0) {
      const items = d.data as any[]
      const records = items.map((a: any) => {
        const p = a.detail && typeof a.detail === 'object' ? a.detail : {}
        return {
          id: a.id,
          patientName: p.patientName ?? a.patientName ?? p.patient ?? '-',
          examType: p.examType ?? a.examType ?? (p.bodyPart ?? ''),
          modality: p.modality ?? a.modality ?? '-',
          dlp: Number(p.dlp ?? a.dlp ?? p.doseValue ?? p.dose?.dlp ?? 0),
          kerma: Number(p.kerma ?? a.kerma ?? p.dose?.kerma ?? 0),
          threshold: Number(p.threshold ?? a.threshold ?? p.drl?.dlpDrl ?? p.dlpDrl ?? 0),
          status: (p.status ?? a.status ?? p.result ?? 'ok') === 'exceeded' ? 'exceeded' : 'ok',
          recordedAt: a.createdAt ?? a.timestamp,
        }
      })
      // [G005 2B] 阈值提取: 优先取记录内 threshold/DRL, 无则按模态固定默认值 (标注来源)
      const perModality = new Map<string, { dlpLimit: number; source: string }>()
      for (const r of records) {
        const mod = String(r.modality || '通用')
        const prev = perModality.get(mod)
        if (r.threshold > 0) {
          if (!prev || r.threshold > prev.dlpLimit) perModality.set(mod, { dlpLimit: r.threshold, source: 'auditLog' })
        } else if (!prev) {
          perModality.set(mod, { dlpLimit: DEFAULT_DLP_LIMITS[mod] ?? 1000, source: '默认(CDS)' })
        }
      }
      if (perModality.size === 0) perModality.set('CT', { dlpLimit: DEFAULT_DLP_LIMITS['CT'] ?? 1500, source: '默认(CDS)' })
      const thresholds = Array.from(perModality.entries()).map(([modality, v], i) => ({
        id: `TH-${modality}-${i}`,
        modality,
        dlpLimit: v.dlpLimit,
        unit: 'mGy·cm',
        level: v.source,
      }))
      return { records, thresholds }
    }
  }
  return { records: [], thresholds: [] }
}

// [G005 2B] 后端 cds-dose 无阈值表 → 按模态固定默认 DLP 上限 (对标 MSW 种子 + 国家 DRL)
const DEFAULT_DLP_LIMITS: Record<string, number> = { CT: 1500, DR: 5, MR: 100, CR: 10, 通用: 1000 }

export default function CdsDoseMonitoringPage() {
  const [data, setData] = useState<CdsDoseMonitoringDto>({ records: [], thresholds: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await cdsApi.getDoseMonitoring()
      setData(normalize(res))
      if (!res.success) setError(res.error?.message ?? t('cdsDose.dataLoadFailed'))
    } catch (e) {
      setError((e as Error)?.message || t('cdsDose.dataLoadFailed'))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const exceeded = data.records.filter((r: any) => r.status === 'exceeded')
  const avgDlp = data.records.length
    ? (data.records.reduce((s: number, r: any) => s + (Number(r.dlp) || 0), 0) / data.records.length).toFixed(1)
    : '0'

  const recordColumns = [
    {
      title: t('cdsDose.col.patientExam'), key: 'patientExam',
      render: (_: unknown, r: any) => (
        <div>
          <span>{r.patientName || t('cdsDose.unknownPatient')}</span>
          <span style={{ fontSize: 12, color: '#6e7681', marginLeft: 8 }}>{r.examType || '-'}</span>
        </div>
      ),
    },
    { title: t('cdsDose.col.modality'), dataIndex: 'modality', key: 'modality', render: (v: string) => <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{v || '-'}</span> },
    {
      title: 'DLP', dataIndex: 'dlp', key: 'dlp',
      render: (v: number, r: any) => <span style={{ fontSize: 12, color: r.status === 'exceeded' ? 'var(--color-error-500)' : 'var(--text-primary, #f0f6fc)', fontWeight: r.status === 'exceeded' ? 600 : 400 }}>{Number(v)?.toFixed(1) ?? '-'} mGy·cm</span>,
    },
    { title: t('cdsDose.col.kerma'), dataIndex: 'kerma', key: 'kerma', render: (v: number) => <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{Number(v)?.toFixed(2) ?? '-'} mGy</span> },
    { title: t('cdsDose.col.threshold'), dataIndex: 'threshold', key: 'threshold', render: (v: number) => <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{Number(v)?.toFixed(0) ?? '-'} mGy·cm</span> },
    {
      title: t('cdsDose.col.status'), dataIndex: 'status', key: 'status',
      render: (v: string) => v === 'exceeded'
        ? <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.13)', color: 'var(--color-error-500, var(--color-error-500))' }}>{t('cdsDose.exceeded')}</span>
        : <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.13)', color: 'var(--color-success-500, var(--color-success-500))' }}>{t('cdsDose.normal')}</span>,
    },
  ]

  const thresholdColumns = [
    { title: t('cdsDose.col.modality'), dataIndex: 'modality', key: 'modality', render: (v: string) => v || '-' },
    { title: t('cdsDose.col.dlpLimit'), dataIndex: 'dlpLimit', key: 'dlpLimit', render: (v: number) => <span style={{ color: 'var(--text-primary, #f0f6fc)' }}>{Number(v)?.toFixed(0) ?? '-'}</span> },
    { title: t('cdsDose.col.unit'), dataIndex: 'unit', key: 'unit', render: (v: string) => <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{v || 'mGy·cm'}</span> },
    { title: t('cdsDose.col.level'), dataIndex: 'level', key: 'level', render: (v: string) => <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{v || '-'}</span> },
  ]

  return (
    <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,var(--color-primary-800),#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Gauge size={24} />
          <span style={{ fontSize: 20, fontWeight: 600 }}>{t('cdsDose.title')}</span>
        </div>
        <button onClick={() => { fetchData() }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <RefreshCw size={14} />{t('cdsDose.refresh')}
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 8 }}>{t('cdsDose.stat.recordCount')}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{data.records.length}</div>
          </div>
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 8 }}>{t('cdsDose.stat.avgDlp')}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{avgDlp}</div>
          </div>
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid #ef444455', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: 'var(--color-error-400, #f87171)', marginBottom: 8 }}>{t('cdsDose.stat.exceeded')}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: exceeded.length ? 'var(--color-error-500, var(--color-error-500))' : 'var(--text-primary, #f0f6fc)' }}>{exceeded.length}</div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 6, border: '1px solid #ef444455', background: '#ef444410', color: '#f87171', fontSize: 12, marginBottom: 16 }}>
            {t('cdsDose.loadFailed')}: {error}
          </div>
        )}

        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} style={{ color: 'var(--color-warning-500, var(--color-warning-500))' }} /> {t('cdsDose.recordsTitle')}
        </div>
        <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
          <DataTable dataSource={data.records} rowKey={(r: any) => r.id || `${r.patientName}-${r.recordedAt}`} columns={recordColumns} loading={loading} pagination={{ pageSize: 10, showSizeChanger: false }} emptyText={t('cdsDose.emptyRecords')} />
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={16} style={{ color: 'var(--color-success-500, var(--color-success-500))' }} /> {t('cdsDose.thresholdTitle')}
        </div>
        <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, overflow: 'hidden' }}>
          <DataTable dataSource={data.thresholds} rowKey={(r: any) => r.id} columns={thresholdColumns} pagination={{ pageSize: 10, showSizeChanger: false }} emptyText={t('cdsDose.emptyThresholds')} />
        </div>
      </div>
    </div>
  )
}
