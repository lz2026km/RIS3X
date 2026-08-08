// [G005 W2-B] CDS 剂量监测: getDoseMonitoring (监测记录 + 阈值)
import { useState, useEffect, useCallback } from 'react'
import { Gauge, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react'
import { cdsApi, type CdsDoseMonitoringDto } from '../../services/api/cdsApi'

function normalize(res: { success: boolean; data: CdsDoseMonitoringDto | null }): CdsDoseMonitoringDto {
  if (res.success && res.data) {
    const d = res.data as CdsDoseMonitoringDto & { data?: CdsDoseMonitoringDto }
    if (Array.isArray(d.records)) return d
    if (d.data && Array.isArray(d.data.records)) return d.data
  }
  return { records: [], thresholds: [] }
}

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
      if (!res.success) setError(res.error?.message ?? '剂量监测数据加载失败')
    } catch (e) {
      setError((e as Error)?.message || '剂量监测数据加载失败')
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
          <span style={{ fontSize: 20, fontWeight: 600 }}>CDS 剂量监测</span>
        </div>
        <button onClick={() => { fetchData() }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <RefreshCw size={14} />刷新
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>监测记录数</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{data.records.length}</div>
          </div>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>平均 DLP (mGy·cm)</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{avgDlp}</div>
          </div>
          <div style={{ background: '#161b22', border: '1px solid #ef444455', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>超阈值告警</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: exceeded.length ? '#ef4444' : '#f0f6fc' }}>{exceeded.length}</div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 6, border: '1px solid #ef444455', background: '#ef444410', color: '#f87171', fontSize: 13, marginBottom: 16 }}>
            加载失败: {error}
          </div>
        )}

        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} style={{ color: '#f59e0b' }} /> 剂量记录
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 120px 110px 160px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', background: '#0d1117', color: '#8b949e', fontSize: 12, fontWeight: 600 }}>
            <span>患者 / 检查</span>
            <span>设备类型</span>
            <span>DLP</span>
            <span>Kerma</span>
            <span>阈值</span>
            <span>状态</span>
          </div>
          {loading ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6e7681', fontSize: 13 }}>加载剂量监测数据...</div>
          ) : data.records.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6e7681', fontSize: 13 }}>暂无剂量监测记录</div>
          ) : (
            data.records.map((r: any, idx: number) => {
              const isExceeded = r.status === 'exceeded'
              return (
                <div key={r.id || idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 120px 110px 160px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', alignItems: 'center', background: idx % 2 === 0 ? '#0d1117' : '#161b22' }}>
                  <div>
                    <span style={{ fontSize: 13 }}>{r.patientName || '未知患者'}</span>
                    <span style={{ fontSize: 12, color: '#6e7681', marginLeft: 8 }}>{r.examType || '-'}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#8b949e' }}>{r.modality || '-'}</span>
                  <span style={{ fontSize: 12, color: isExceeded ? '#ef4444' : '#f0f6fc', fontWeight: isExceeded ? 600 : 400 }}>{Number(r.dlp)?.toFixed(1) ?? '-'} mGy·cm</span>
                  <span style={{ fontSize: 12, color: '#8b949e' }}>{Number(r.kerma)?.toFixed(2) ?? '-'} mGy</span>
                  <span style={{ fontSize: 12, color: '#8b949e' }}>{Number(r.threshold)?.toFixed(0) ?? '-'} mGy·cm</span>
                  <span>
                    {isExceeded ? (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: '#ef444420', color: '#ef4444' }}>超阈值</span>
                    ) : (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: '#22c55e20', color: '#22c55e' }}>正常</span>
                    )}
                  </span>
                </div>
              )
            })
          )}
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={16} style={{ color: '#22c55e' }} /> 阈值配置
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 140px 100px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', background: '#0d1117', color: '#8b949e', fontSize: 12, fontWeight: 600 }}>
            <span>设备类型</span>
            <span>DLP 上限</span>
            <span>单位</span>
            <span>级别</span>
          </div>
          {data.thresholds.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6e7681', fontSize: 13 }}>暂无阈值配置</div>
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
