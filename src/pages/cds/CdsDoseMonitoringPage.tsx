// [G005 W2-B] CDS 剂量监测: getDoseMonitoring (监测记录 + 阈值)
// [G005 Wave1B] DTO 兼容: 后端返回 { data: [auditLog] } (backend cds.service getDoseMonitoring),
//               页面期望 { records, thresholds } → normalize 兼容三种形状, 修复空数据
import { useState, useEffect, useCallback } from 'react'
import { Gauge, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react'
import { cdsApi, type CdsDoseMonitoringDto } from '../../services/api/cdsApi'
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

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Gauge size={24} />
          <span style={{ fontSize: 20, fontWeight: 600 }}>{t('cdsDose.title')}</span>
        </div>
        <button onClick={() => { fetchData() }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <RefreshCw size={14} />{t('cdsDose.refresh')}
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>{t('cdsDose.stat.recordCount')}</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{data.records.length}</div>
          </div>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>{t('cdsDose.stat.avgDlp')}</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{avgDlp}</div>
          </div>
          <div style={{ background: '#161b22', border: '1px solid #ef444455', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: 'var(--color-error-400, #f87171)', marginBottom: 8 }}>{t('cdsDose.stat.exceeded')}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: exceeded.length ? 'var(--color-error-500, #ef4444)' : '#f0f6fc' }}>{exceeded.length}</div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 6, border: '1px solid #ef444455', background: '#ef444410', color: '#f87171', fontSize: 13, marginBottom: 16 }}>
            {t('cdsDose.loadFailed')}: {error}
          </div>
        )}

        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} style={{ color: 'var(--color-warning-500, #f59e0b)' }} /> {t('cdsDose.recordsTitle')}
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 120px 110px 160px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', background: '#0d1117', color: '#8b949e', fontSize: 12, fontWeight: 600 }}>
            <span>{t('cdsDose.col.patientExam')}</span>
            <span>{t('cdsDose.col.modality')}</span>
            <span>DLP</span>
            <span>{t('cdsDose.col.kerma')}</span>
            <span>{t('cdsDose.col.threshold')}</span>
            <span>{t('cdsDose.col.status')}</span>
          </div>
          {loading ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6e7681', fontSize: 13 }}>{t('cdsDose.loading')}</div>
          ) : data.records.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6e7681', fontSize: 13 }}>{t('cdsDose.emptyRecords')}</div>
          ) : (
            data.records.map((r: any, idx: number) => {
              const isExceeded = r.status === 'exceeded'
              return (
                <div key={r.id || idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 120px 110px 160px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', alignItems: 'center', background: idx % 2 === 0 ? '#0d1117' : '#161b22' }}>
                  <div>
                    <span style={{ fontSize: 13 }}>{r.patientName || t('cdsDose.unknownPatient')}</span>
                    <span style={{ fontSize: 12, color: '#6e7681', marginLeft: 8 }}>{r.examType || '-'}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#8b949e' }}>{r.modality || '-'}</span>
                  <span style={{ fontSize: 12, color: isExceeded ? '#ef4444' : '#f0f6fc', fontWeight: isExceeded ? 600 : 400 }}>{Number(r.dlp)?.toFixed(1) ?? '-'} mGy·cm</span>
                  <span style={{ fontSize: 12, color: '#8b949e' }}>{Number(r.kerma)?.toFixed(2) ?? '-'} mGy</span>
                  <span style={{ fontSize: 12, color: '#8b949e' }}>{Number(r.threshold)?.toFixed(0) ?? '-'} mGy·cm</span>
                  <span>
                    {isExceeded ? (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.13)', color: 'var(--color-error-500, #ef4444)' }}>{t('cdsDose.exceeded')}</span>
                    ) : (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.13)', color: 'var(--color-success-500, #22c55e)' }}>{t('cdsDose.normal')}</span>
                    )}
                  </span>
                </div>
              )
            })
          )}
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={16} style={{ color: 'var(--color-success-500, #22c55e)' }} /> {t('cdsDose.thresholdTitle')}
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 140px 100px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', background: '#0d1117', color: '#8b949e', fontSize: 12, fontWeight: 600 }}>
            <span>{t('cdsDose.col.modality')}</span>
            <span>{t('cdsDose.col.dlpLimit')}</span>
            <span>{t('cdsDose.col.unit')}</span>
            <span>{t('cdsDose.col.level')}</span>
          </div>
          {data.thresholds.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6e7681', fontSize: 13 }}>{t('cdsDose.emptyThresholds')}</div>
          ) : (
            data.thresholds.map((t: any, idx: number) => (
              <div key={t.id || idx} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 140px 100px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', alignItems: 'center', background: idx % 2 === 0 ? '#0d1117' : '#161b22' }}>
                <span style={{ fontSize: 13 }}>{t.modality || '-'}</span>
                <span style={{ fontSize: 13, color: '#f0f6fc' }}>{Number(t.dlpLimit)?.toFixed(0) ?? '-'}</span>
                <span style={{ fontSize: 12, color: '#8b949e' }}>{t.unit || 'mGy·cm'}</span>
                <span style={{ fontSize: 12, color: '#8b949e' }}>{t.level || '-'}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
